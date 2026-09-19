import { collectReferenceEvidence, toolReferenceAttachments, referenceToolSummary } from "./referenceEvidence";
import { provesCompletedEffect } from "@/db/agentTaskRecords";
import { db } from "@/db/database";
import type { AgentTask } from "@/domain/agent";
import type { WrapupEvidence, WrapupSnapshot } from "@/domain/agentTaskWrapup";
import { targetRevision } from "@/lib/productionRevision";
import { getRow, navigation, projection, type BusinessKind } from "./businessStore";
import { parseGenerationSlot } from "@/domain/slot";

const kinds = ["project","episode","beat","shot","character","scene","prop","style","media"];
function json(value: unknown): Record<string, unknown> { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
/** Caller opens a consistent read transaction; full fingerprints include omitted history. */
export async function collectWrapupSnapshot(task: AgentTask, includeAllEvidence = false): Promise<WrapupSnapshot> {
  const runs = (await db.agentRuns.where("threadId").equals(task.threadId).toArray()).filter(r=>r.taskId===task.id);
  const runIds=new Set(runs.map(r=>r.id));
  const messages=(await db.chatMessages.where("threadId").equals(task.threadId).sortBy("createdAt")).filter(m=>m.role==="user"||!!m.runId&&runIds.has(m.runId));
  const calls=(await db.agentToolCalls.where("threadId").equals(task.threadId).toArray()).filter(c=>runIds.has(c.runId));
  const records=await db.agentTaskRecords.where("taskId").equals(task.id).sortBy("updatedAt");
  const jobs=(await db.agentGenerationJobs.where("threadId").equals(task.threadId).toArray()).filter(j=>runIds.has(j.runId));
  const batches=(await db.agentGenerationBatches.where("threadId").equals(task.threadId).toArray()).filter(batch=>runIds.has(batch.runId));
  const batchItems=(await db.agentGenerationBatchItems.where("threadId").equals(task.threadId).toArray()).filter(item=>batches.some(batch=>batch.id===item.batchId));
  const evidence:WrapupEvidence[]=[], fingerprints:unknown[]=[];
  const add=(item:WrapupEvidence,raw:unknown)=>{fingerprints.push([item.id,targetRevision(raw)]);evidence.push({...item,body:item.body.slice(0,1800),truncated:item.body.length>1800});};
  const entityIds=new Set<string>();
  // Cache hits and invalid locators can settle without any IndexedDB request.
  // Callers adopt this native promise through the transaction-zone Promise; a long
  // loop of bare awaits otherwise exhausts Dexie's zone tracking in real browsers.
  async function entity(kind:BusinessKind,id:string,ownerId?:string,episodeId?:string,label?:string) {
    const key=`entity:${kind}:${id}`;
    if(entityIds.has(key)) return;entityIds.add(key);
    try{const row=await getRow(kind,id,ownerId,episodeId);const link=navigation(kind,row);add({id:key,kind:"entity",label:link.label,body:JSON.stringify(projection(kind,row)),outcome:"fact",available:true,supportsResult:true,href:link.href},row);}
    catch{add({id:key,kind:"entity",label:label??`${kind} · ${id}`,body:"原目标已删除或不再属于原范围",outcome:"unresolved",available:false},null);}
  }
  for(const call of calls) {
    const value=json(call.result),args=json(call.arguments);
    const unsettled=!['completed','failed','rejected'].includes(call.status);
    const generation=["submit_generation","apply_generation","check_generation"].includes(call.name);
    const failed=call.status!=="completed"||!!value.error||value.ok===false||value.success===false||(!generation&&value.applied===false);
    const outcome:WrapupEvidence['outcome']=unsettled||failed?"unresolved":generation?(value.status==="applied"?"applied":value.status==="downloaded"?"downloaded":"unresolved"):"fact";
    add({id:`tool:${call.id}`,kind:"tool",label:call.title,body:JSON.stringify({status:call.status,result:referenceToolSummary(call.name, call.result, task.projectId ?? "") ?? value,error:call.error}),outcome,available:true,supportsResult:call.status==="completed"&&provesCompletedEffect(call)},call);
    const rows=Array.isArray(value.items)?value.items:[value];
    for(const item of rows){const row=json(item);const kind=typeof row.kind==='string'&&kinds.includes(row.kind)?row.kind:typeof args.kind==='string'&&kinds.includes(args.kind)?args.kind:call.name.split('_')[0];
      const id=typeof row.id==='string'?row.id:typeof args.id==='string'?args.id:undefined;
      if(id&&kinds.includes(kind)) {
        await Promise.resolve(entity(kind as BusinessKind,id,typeof row.ownerId==='string'?row.ownerId:typeof args.ownerId==='string'?args.ownerId:undefined,typeof row.episodeId==='string'?row.episodeId:typeof args.episodeId==='string'?args.episodeId:undefined,typeof row.label==='string'?row.label:undefined));
        // Keep successful deletion as a historical effect. Creation/update/copy
        // evidence cannot certify a currently delivered object after its removal.
        if(call.effect==='write'&&!call.name.includes('_delete')&&!evidence.find(e=>e.id===`entity:${kind}:${id}`)?.available){
          const source=evidence.find(e=>e.id===`tool:${call.id}`)!;
          source.supportsResult=false;source.outcome='unresolved';
          source.body=`${source.body}\n当前关联目标不可用；此结果仅证明当时执行过操作，不能证明成果仍可交付。`;
        }
      }
    }
  }
  for(const batch of batches) {
    const items=batchItems.filter(item=>item.batchId===batch.id);
    const unresolved=batch.status==='draft'||items.some(item=>item.state==='queued')||jobs.some(job=>job.batchId===batch.id&&['submitting','submitted','running','downloading','remote_completed','unknown'].includes(job.status));
    add({id:`batch:${batch.id}`,kind:'generation',label:`批量生成 · ${batch.title}`,body:JSON.stringify({status:batch.status,candidates:items.map(item=>({id:item.id,state:item.state,jobId:item.jobId,selected:batch.selections[item.targetKey]===item.id})),pauseReason:batch.pauseReason}),outcome:unresolved?'unresolved':'fact',available:true,supportsResult:false},{batch,items});
  }
  for(const job of jobs) {
    const target=job.target;await Promise.resolve(entity(target.kind,target.entityId,target.projectId,'episodeId' in target?target.episodeId:undefined));
    const media=job.result?await db.media.get(job.result.mediaId):undefined;
    let applied=false,href:string|undefined;
    try{const row=await getRow(target.kind,target.entityId,target.projectId,'episodeId'in target?target.episodeId:undefined);href=navigation(target.kind,row).href;
      const slot=target.kind==='shot'?row[target.slot??'clip']:json(row.slots)[target.slot];applied=!!media&&parseGenerationSlot(slot).result?.mediaId===media.id;
    }catch{/* Missing targets remain historical evidence. */}
    const status=applied?'applied':media&&(['downloaded','applied','conflict'].includes(job.status))?'downloaded':'unresolved';
    for (const call of calls.filter(call => call.id === job.callId || json(call.arguments).jobId === job.id)) {
      const source=evidence.find(item=>item.id===`tool:${call.id}`);
      if(source){source.supportsResult=status!=="unresolved";source.outcome=status;source.available=!!media;source.body=`${source.body}\n当前输出状态：${status}；原工具返回只记录当时事实。`;}
    }
    add({id:`generation:${job.id}`,kind:"generation",label:`${job.kind==='image'?'图片':'视频'} · ${job.model}`,body:JSON.stringify({status:job.status,currentOutcome:status,target:job.target,result:job.result,mediaAvailable:!!media,appliedToCurrentTarget:applied,error:job.error}),outcome:status,available:!!media,supportsResult:status!=="unresolved",href}, {...job,media:media?{id:media.id,projectId:media.projectId,mimeType:media.mimeType,size:media.blob.size}:null,currentApplied:applied});
  }
  for(const record of records)add({id:`record:${record.id}`,kind:"record",label:record.title,body:JSON.stringify({kind:record.kind,claim:record.claim,author:record.author,body:record.body,sources:record.sources}),outcome:record.kind==='question'?'unresolved':'fact',available:true},record);
  for(const message of messages)add({id:`message:${message.id}`,kind:"message",label:message.role==='user'?'用户要求与反馈':'AI 回复（待核实）',body:message.content,outcome:message.role==='assistant'&&message.status!=='complete'?'unresolved':'fact',available:true},message);
  if (task.projectId) {
    const attachments = [
      ...messages.flatMap(message => message.attachments ?? []),
      ...calls.filter(call => call.status === "completed").flatMap(call => toolReferenceAttachments(call.result, task.projectId!)),
    ];
    for (const source of await collectReferenceEvidence(task.projectId, attachments)) add(source.evidence, source.fingerprint);
  }
  // Prioritize unresolved outcomes and the latest user corrections. Record all omissions.
  const ordered=[...evidence].reverse(), selected:WrapupEvidence[]=[];
  const take=(items:WrapupEvidence[],count:number)=>{for(const item of items.filter(item=>!selected.some(s=>s.id===item.id)).slice(0,count))selected.push(item);};
  take(ordered.filter(e=>e.outcome==='unresolved'),6);
  for(const kind of ['generation','entity','tool','record','reference'] as const)take(ordered.filter(e=>e.kind===kind),Math.min(8,48-selected.length));
  take(ordered.filter(e=>e.kind==='message'),Math.min(10,48-selected.length));
  take(ordered,48-selected.length);
  const selectedIds=new Set(selected.map(e=>e.id));
  return {fingerprint:targetRevision({project:task.projectId?await db.projects.get(task.projectId):null,task:{id:task.id,projectId:task.projectId,title:task.title,goal:task.goal,plan:task.plan,acceptanceCriteria:task.acceptanceCriteria??[],revision:task.revision??1,artifacts:task.artifacts},runs:runs.map(r=>({id:r.id,status:r.status,updatedAt:r.updatedAt})),sources:fingerprints.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}),taskRevision:task.revision??1,criteria:task.acceptanceCriteria??[],evidence:includeAllEvidence?evidence.map(item=>selectedIds.has(item.id)?item:{...item,body:"",truncated:true}):selected,coverage:{total:evidence.length,included:selected.length,omitted:evidence.length-selected.length,truncated:selected.filter(e=>e.truncated).length}};
}
