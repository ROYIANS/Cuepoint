import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { saveToolRound, transitionToolCall } from "@/db/agentTools";
import { addCharacter, addShot, createChatThread, createProject, deleteChatThread, deleteMediaIfOrphan, deleteProject, patchShot, putMedia } from "@/db/repo";
import { updateGenerationJob } from "@/db/agentGeneration";
import type { ConnectorConfig } from "@/domain/types";
import { applyAgentGeneration, checkAgentGeneration, GenerationPendingError, monitorAgentGeneration, prepareAgentGeneration, submitAgentGeneration } from "@/lib/agent/generationRuntime";
import { generationSubmitSchema, profileRequest, type GenerationSubmitArgs } from "@/lib/agent/generationProfiles";
import type { AgentToolContext } from "@/lib/agent/tools";
import { GENERATION_TOOLS } from "@/lib/agent/generationTools";
import { exportProjectZip } from "@/lib/projectPackage";
import JSZip from "jszip";

const png=Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII="),(char)=>char.charCodeAt(0));
const referencePng=Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAA1UlEQVR4nO3BMQEAAADCoPVP7WULoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAGwEtAAHMpTgHAAAAAElFTkSuQmCC"),(char)=>char.charCodeAt(0));
const mp4=new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109]);
async function setup(provider:"apimart"|"aihubmix"="apimart",kind:"image"|"video"="image") {
  const config:ConnectorConfig={id:"cx-gen",name:"Generation",definitionId:provider,baseUrl:`https://${provider}.test/v1`,apiKey:"private-key-123",updatedAt:"now"};
  await db.connectors.put(config);
  const project=await createProject("测试生成");
  const episode=(await db.episodes.where("projectId").equals(project.id).first())!;
  const shot=await addShot(project.id,episode.id);
  const thread=await createChatThread();
  const run=await beginAgentRun({threadId:thread.id,connector:config,model:"chat",content:"生成"});
  const args:GenerationSubmitArgs={connectorId:config.id,model:kind === "image" ? "gpt-image-2" : provider === "apimart" ? "MiniMax-H3" : "veo-3.1-fast-generate-preview",
    target:{kind:"shot",projectId:project.id,episodeId:episode.id,entityId:shot.id,slot:kind === "image" ? "firstFrame" : "clip"},prompt:"雨夜车站",parameters:{},inputs:[]};
  const context=await toolContext(run.id,thread.id,"submit_generation",args);
  return {config,project,episode,shot,thread,run,args,context};
}
async function toolContext(runId:string,threadId:string,name:string,args:unknown):Promise<AgentToolContext> {
  const providerCallId=`call-${Math.random()}`;
  await saveToolRound(runId,"",[{id:providerCallId,type:"function",function:{name,arguments:JSON.stringify(args)}}],[{title:name,effect:name === "apply_generation" ? "write":"network",highRisk:false}]);
  const call=(await db.agentToolCalls.where("runId").equals(runId).toArray()).find((item)=>item.providerCallId===providerCallId)!;
  await transitionToolCall(runId,call.id,["pending"],"running");
  return {runId,threadId,callId:call.id,signal:new AbortController().signal};
}
function apimartFetch(kind:"image"|"video"="image") {
  return vi.fn<typeof fetch>(async(url,init)=>{
    if (init?.method === "POST" && String(url).includes("/uploads/")) return Response.json({url:"https://upload.test/reference.png"});
    if (init?.method === "POST") return Response.json({code:200,data:[{task_id:"task-1",status:"submitted"}]});
    if (String(url).includes("/tasks/")) return Response.json({code:200,data:{id:"task-1",status:"completed",progress:100,result:{[kind === "image" ? "images":"videos"]:[{url:"https://cdn.test/result"}]}}});
    expect(init?.headers).toBeUndefined();expect(init?.credentials).toBe("omit");
    return new Response(kind === "image" ? png : mp4,{headers:{"content-type":kind === "image" ? "image/png":"video/mp4"}});
  });
}
function hubFetch(kind:"image"|"video"="image",base64=false) {
  return vi.fn<typeof fetch>(async(url,init)=>{
    if (String(url).includes("/content")) {
      expect(init?.headers).toEqual({Authorization:"Bearer private-key-123"});
      return new Response(kind === "image" ? png:mp4,{headers:{"content-type":`${kind}/${kind === "image" ? "png":"mp4"}`}});
    }
    const model=kind === "image" ? "gpt-image-2":"veo-3.1-fast-generate-preview";
    return Response.json({id:"hub-task",object:kind,model,status:init?.method === "POST" && !base64 ? "in_progress":"completed",output:init?.method === "POST" && !base64 ? []:[{index:0,type:"file",...(base64?{b64_json:btoa(String.fromCharCode(...png))}:{content_url:`https://aihubmix.test/ai/v1/${kind}s/hub-task/content${kind === "image" ? "/result-1":""}`})}]});
  });
}

describe("durable agent generation",()=>{
  it.each(["apimart","aihubmix"] as const)("%s image reaches genuine local bytes then separately and atomically applies",async(provider)=>{
    const f=await setup(provider);
    const fetchImpl=provider === "apimart" ? apimartFetch():hubFetch();
    f.context.preview=await prepareAgentGeneration(f.args,f.context);
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl,pollIntervalMs:0,maxPolls:3});
    expect(job.status).toBe("downloaded");
    expect(job.providerTaskId).toBeTruthy();
    expect((await db.shots.get(f.shot.id))?.firstFrame.result).toBeUndefined();
    const stored=(await db.media.get(job.result!.mediaId))!;
    expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(png);
    expect(JSON.stringify(job)).not.toContain(f.config.apiKey);
    expect(JSON.stringify(job)).not.toContain("https://cdn");
    const apply=await toolContext(f.run.id,f.thread.id,"apply_generation",{jobId:job.id});
    expect(await applyAgentGeneration(job.id,apply)).toMatchObject({status:"applied",applied:true});
    expect((await db.shots.get(f.shot.id))?.firstFrame.result).toEqual(job.result);
    expect((await db.agentToolCalls.get(apply.callId))?.status).toBe("completed");
    expect(await applyAgentGeneration(job.id,apply)).toMatchObject({status:"applied"});
    expect(await db.media.count()).toBe(1);
    const replay=await submitAgentGeneration(f.args,f.context,{fetchImpl});
    expect(replay.status).toBe("applied");
    expect(fetchImpl.mock.calls.filter(([,init])=>init?.method === "POST")).toHaveLength(1);
  });
  it.each(["apimart","aihubmix"] as const)("%s video uses verified native parameters and persists only video results",async(provider)=>{
    const f=await setup(provider,"video");
    const fetchImpl=provider === "apimart" ? apimartFetch("video"):hubFetch("video");
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl,pollIntervalMs:0});
    expect(job.result?.kind).toBe("video");
    const request=JSON.parse(String(fetchImpl.mock.calls.find(([,init])=>init?.method === "POST")![1]!.body));
    expect(request).toMatchObject({model:f.args.model,duration:provider === "apimart" ? 5:8});
    expect(request.seconds).toBeUndefined();expect(request.mode).toBeUndefined();
    expect((await db.media.get(job.result!.mediaId))?.mimeType).toBe("video/mp4");
  });
  it("decodes genuine AIHubMix inline results without persisting base64 or another network read",async()=>{
    const f=await setup("aihubmix");const fetchImpl=hubFetch("image",true);
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl});
    expect(job.status).toBe("downloaded");expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Random UUIDs/hashes may contain the letters b64; check the actual wire
    // field and fixture payload, not an arbitrary substring of identifiers.
    expect(JSON.stringify(job)).not.toContain('"b64_json":');
    expect(JSON.stringify(job)).not.toContain(btoa(String.fromCharCode(...png)));
  });
  it("freezes preview and rejects changed targets before POST",async()=>{
    const f=await setup();f.context.preview=await prepareAgentGeneration(f.args,f.context);
    await patchShot(f.shot.id,{notes:"用户刚修改"});const fetchImpl=apimartFetch();
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow("重新确认");
    expect(fetchImpl).not.toHaveBeenCalled();expect(await db.agentGenerationJobs.count()).toBe(0);
  });
  it("lost paid response becomes unknown and neither replay nor a new identical call resubmits",async()=>{
    const f=await setup();const fetchImpl=vi.fn<typeof fetch>(async()=>{throw new TypeError("Network failed");});
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    const job=(await db.agentGenerationJobs.toArray())[0];expect(job.status).toBe("unknown");
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    const second=await toolContext(f.run.id,f.thread.id,"submit_generation",f.args);
    await expect(submitAgentGeneration(f.args,second,{fetchImpl})).rejects.toThrow("不会重复付费");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("known task resumes after monitoring timeout without another POST",async()=>{
    const f=await setup();let completed=false;
    const real=apimartFetch();
    const fetchImpl=vi.fn<typeof fetch>(async(url,init)=>String(url).includes("/tasks/")&&!completed
      ?Response.json({code:200,data:{id:"task-1",status:"processing",progress:35}}):real(url,init));
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl,maxPolls:1,pollIntervalMs:0})).rejects.toThrow("等待已暂停");
    let job=(await db.agentGenerationJobs.toArray())[0];expect(job).toMatchObject({status:"running",providerTaskId:"task-1",progress:35});
    completed=true;job=await submitAgentGeneration(f.args,f.context,{fetchImpl,maxPolls:2,pollIntervalMs:0});
    expect(job.status).toBe("downloaded");
    expect(fetchImpl.mock.calls.filter(([,init])=>init?.method === "POST")).toHaveLength(1);
  });
  it("download failure remains recoverable, uses no fabricated output and does not resubmit",async()=>{
    const f=await setup();let fail=true;const real=apimartFetch();
    const fetchImpl=vi.fn<typeof fetch>(async(url,init)=>String(url).includes("cdn.test")&&fail?new Response("CORS/expired",{status:410}):real(url,init));
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow("下载失败");
    expect(await db.media.count()).toBe(0);let job=(await db.agentGenerationJobs.toArray())[0];expect(job.status).toBe("downloading");
    fail=false;job=await monitorAgentGeneration(job.id,f.context,{fetchImpl});expect(job.status).toBe("downloaded");
    expect(fetchImpl.mock.calls.filter(([,init])=>init?.method === "POST")).toHaveLength(1);
  });
  it("rejects HTML/incorrect output bytes and preserves the known task for recovery",async()=>{
    const f=await setup();const real=apimartFetch();
    const fetchImpl=vi.fn<typeof fetch>(async(url,init)=>String(url).includes("cdn.test")?new Response("<html>authentication required</html>",{headers:{"content-type":"image/png"}}):real(url,init));
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow("不是可识别");
    expect(await db.media.count()).toBe(0);expect((await db.agentGenerationJobs.toArray())[0].providerTaskId).toBe("task-1");
  });
  it.each(["edited","deleted"])("%s targets preserve downloaded output as visible conflict",async(mode)=>{
    const f=await setup();const job=await submitAgentGeneration(f.args,f.context,{fetchImpl:apimartFetch()});
    if(mode === "edited") await patchShot(f.shot.id,{content:"手写内容"}); else await db.shots.delete(f.shot.id);
    const context=await toolContext(f.run.id,f.thread.id,"apply_generation",{jobId:job.id});
    expect(await applyAgentGeneration(job.id,context)).toMatchObject({status:"conflict",applied:false});
    expect(await db.media.get(job.result!.mediaId)).toBeDefined();
    if(mode === "edited") expect((await db.shots.get(f.shot.id))?.content).toBe("手写内容");
  });
  it("keeps results referenced by jobs, excludes unattached bytes from backup and cascades on project deletion",async()=>{
    const f=await setup();const job=await submitAgentGeneration(f.args,f.context,{fetchImpl:apimartFetch()});
    await deleteMediaIfOrphan(job.result!.mediaId);expect(await db.media.get(job.result!.mediaId)).toBeDefined();
    const zip=await JSZip.loadAsync(await exportProjectZip(f.project.id));
    expect(Object.keys(zip.files).some((name)=>name.includes(job.result!.mediaId))).toBe(false);
    await deleteProject(f.project.id);expect(await db.agentGenerationJobs.get(job.id)).toBeUndefined();
    await expect(updateGenerationJob(job.id,{status:"running"})).rejects.toThrow("已删除");
  });
  it("can generate into studio assets without inventing a project",async()=>{
    const f=await setup();const character=await addCharacter("studio");
    f.args.target={kind:"character",projectId:"studio",entityId:character.id,slot:"front"};
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl:apimartFetch()});
    const context=await toolContext(f.run.id,f.thread.id,"apply_generation",{jobId:job.id});
    await applyAgentGeneration(job.id,context);expect((await db.characters.get(character.id))?.slots.front?.result).toEqual(job.result);
    expect(await db.projects.get("studio")).toBeUndefined();
  });
  it("APIMart uploads original references and assigns explicit frame roles",async()=>{
    const f=await setup("apimart","video");
    await putMedia({id:"reference",projectId:f.project.id,filename:"ref.png",mimeType:"image/png",blob:new Blob([referencePng],{type:"image/png"})});
    f.args.inputs=[{mediaId:"reference",role:"first-frame"}];f.args.parameters={mode:"frames",aspectRatio:"adaptive"};
    const fetchImpl=apimartFetch("video");
    await submitAgentGeneration(f.args,f.context,{fetchImpl});
    const request=JSON.parse(String(fetchImpl.mock.calls.find(([url])=>String(url).includes("/videos/generations"))![1]!.body));
    expect(request.image_with_roles).toEqual([{url:"https://upload.test/reference.png",role:"first_frame"}]);expect(request.aspect_ratio).toBeUndefined();
  });
  it("AIHubMix uploads scoped reference bytes via documented data URI fields",async()=>{
    const f=await setup("aihubmix","video");
    await putMedia({id:"ref",projectId:f.project.id,filename:"ref.png",mimeType:"image/png",blob:new Blob([png])});
    f.args.inputs=[{mediaId:"ref",role:"first-frame"}];f.args.parameters={mode:"frames"};
    const fetchImpl=hubFetch("video");await submitAgentGeneration(f.args,f.context,{fetchImpl});
    const body=JSON.parse(String(fetchImpl.mock.calls[0][1]!.body));
    expect(body.frame_images[0]).toEqual({frame_type:"first_frame",image_url:{url:`data:image/png;base64,${btoa(String.fromCharCode(...png))}`}});
  });
  it("changed connector destination blocks recovery without forwarding a key",async()=>{
    const f=await setup();const fetchImpl=apimartFetch();
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl});
    await db.agentGenerationJobs.update(job.id,{status:"running",result:undefined});
    await db.connectors.update(f.config.id,{baseUrl:"https://different.test/v1"});const calls=fetchImpl.mock.calls.length;
    await expect(checkAgentGeneration(job.id,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    expect(fetchImpl).toHaveBeenCalledTimes(calls);
  });
});

describe("verified generation tool contracts",()=>{
  it("advertises only separated truthful effects and strict schemas",()=>{
    expect(GENERATION_TOOLS.map(({name,effect})=>[name,effect])).toEqual([["generation_capabilities","read"],["submit_generation","network"],["check_generation","network"],["apply_generation","write"],["list_generation_jobs","read"]]);
    expect(()=>generationSubmitSchema.parse({apiKey:"secret"})).toThrow();
  });
  it("rejects unsupported model/provider parameters and explicit role mismatches before networking",async()=>{
    const f=await setup("apimart","video");
    for(const parameters of [{resolution:"1080P"},{duration:3},{duration:16},{mode:"frames" as const},{aspectRatio:"2:3"}]) expect(()=>profileRequest({...f.args,parameters},"apimart")).toThrow();
    expect(()=>profileRequest({...f.args,inputs:[{mediaId:"x",role:"reference-video"}]},"apimart")).toThrow("上传");
    expect(()=>profileRequest(f.args,"aihubmix")).toThrow("Veo");
    expect(()=>profileRequest({...f.args,model:"veo-3.1-fast-generate-preview",parameters:{resolution:"4K",duration:4}},"aihubmix")).toThrow("8 秒");
  });
});

describe("generation interruption and storage failures",()=>{
  it("same-call concurrent execution makes at most one paid submission",async()=>{
    const f=await setup();const fetchImpl=apimartFetch();
    const results=await Promise.allSettled([submitAgentGeneration(f.args,f.context,{fetchImpl,pollIntervalMs:0}),submitAgentGeneration(f.args,f.context,{fetchImpl,pollIntervalMs:0})]);
    expect(results.some((result)=>result.status === "fulfilled")).toBe(true);
    expect(fetchImpl.mock.calls.filter(([,init])=>init?.method === "POST")).toHaveLength(1);
    expect(await db.agentGenerationJobs.count()).toBe(1);
  });
  it("aborts known polling without claiming remote cancellation and resumes safely",async()=>{
    const f=await setup();const controller=new AbortController();f.context.signal=controller.signal;
    const real=apimartFetch();
    const fetchImpl=vi.fn<typeof fetch>(async(url,init)=>{if(String(url).includes("/tasks/"))controller.abort();return real(url,init);});
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    const job=(await db.agentGenerationJobs.toArray())[0];expect(job.providerTaskId).toBe("task-1");expect(job.status).not.toBe("failed");
    f.context.signal=new AbortController().signal;
    expect((await submitAgentGeneration(f.args,f.context,{fetchImpl:real})).status).toBe("downloaded");
    expect(real.mock.calls.filter(([,init])=>init?.method === "POST")).toHaveLength(1);
  });
  it("abandoned submitting marker never retries a paid POST",async()=>{
    const f=await setup();const fetchImpl=apimartFetch();
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl});
    await db.agentGenerationJobs.update(job.id,{status:"submitting",providerTaskId:undefined,result:undefined});
    const count=fetchImpl.mock.calls.length;
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    expect(fetchImpl).toHaveBeenCalledTimes(count);expect((await db.agentGenerationJobs.get(job.id))?.status).toBe("unknown");
  });
  it("unexpected multiple APIMart task identities require reconciliation and block duplicate submissions",async()=>{
    const f=await setup();const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({code:200,data:[{task_id:"paid-1"},{task_id:"paid-2"}]}));
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    const job=(await db.agentGenerationJobs.toArray())[0];expect(job).toMatchObject({status:"unknown",providerTaskIds:["paid-1","paid-2"]});
    const second=await toolContext(f.run.id,f.thread.id,"submit_generation",f.args);
    await expect(submitAgentGeneration(f.args,second,{fetchImpl})).rejects.toThrow("不会重复付费");expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("synchronous AIHubMix malformed result stays a known recoverable job",async()=>{
    const f=await setup("aihubmix");
    const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({id:"hub-task",object:"image",model:"gpt-image-2",status:"completed",output:[{index:0,type:"file",b64_json:"not base64!"}]}));
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toBeInstanceOf(GenerationPendingError);
    const job=(await db.agentGenerationJobs.toArray())[0];expect(job.providerTaskId).toBe("hub-task");
    expect((await monitorAgentGeneration(job.id,f.context,{fetchImpl:hubFetch()})).status).toBe("downloaded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("local output write failure rolls back media and recovers by downloading known task",async()=>{
    const f=await setup();const fetchImpl=apimartFetch();
    const fail=()=>{throw new Error("storage full");};db.media.hook("creating",fail);
    try {await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow("storage full");}
    finally {db.media.hook("creating").unsubscribe(fail);}
    expect(await db.media.count()).toBe(0);let job=(await db.agentGenerationJobs.toArray())[0];expect(job.result).toBeUndefined();expect(job.providerTaskId).toBe("task-1");
    job=await monitorAgentGeneration(job.id,f.context,{fetchImpl});expect(job.status).toBe("downloaded");
    expect(fetchImpl.mock.calls.filter(([,init])=>init?.method === "POST")).toHaveLength(1);
  });
  it("atomic ledger failure rolls back the slot and job application together",async()=>{
    const f=await setup();const job=await submitAgentGeneration(f.args,f.context,{fetchImpl:apimartFetch()});
    const context=await toolContext(f.run.id,f.thread.id,"apply_generation",{jobId:job.id});
    const fail=(changes:Record<string,unknown>)=>{if(changes.status === "completed")throw new Error("ledger storage failed");};
    db.agentToolCalls.hook("updating",fail);
    try {await expect(applyAgentGeneration(job.id,context)).rejects.toThrow("ledger storage failed");}
    finally {db.agentToolCalls.hook("updating").unsubscribe(fail);}
    expect((await db.shots.get(f.shot.id))?.firstFrame.result).toBeUndefined();
    expect((await db.agentGenerationJobs.get(job.id))?.status).toBe("downloaded");
    expect((await db.agentToolCalls.get(context.callId))?.status).toBe("running");
    expect(await applyAgentGeneration(job.id,context)).toMatchObject({status:"applied"});
  });
  it("thread removed during download cannot receive late media writes",async()=>{
    const f=await setup();const real=apimartFetch();
    const fetchImpl=vi.fn<typeof fetch>(async(url,init)=>{if(String(url).includes("cdn.test"))await deleteChatThread(f.thread.id);return real(url,init);});
    await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow();
    expect(await db.media.count()).toBe(0);expect(await db.agentGenerationJobs.count()).toBe(0);
  });
  it("detects same-size input bytes changed after review before any paid or upload request",async()=>{
    const f=await setup();await putMedia({id:"ref",projectId:f.project.id,filename:"ref.png",mimeType:"image/png",blob:new Blob([png])});
    f.args.inputs=[{mediaId:"ref",role:"reference-image"}];f.context.preview=await prepareAgentGeneration(f.args,f.context);
    const changed=png.slice();changed[changed.length-1]^=1;await db.media.update("ref",{blob:new Blob([changed])});
    const fetchImpl=apimartFetch();await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow("重新确认");expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("enforces H3 image dimensions and format before upload or paid POST",async()=>{
    const f=await setup("apimart","video");await putMedia({id:"tiny",projectId:f.project.id,filename:"tiny.png",mimeType:"image/png",blob:new Blob([png])});
    f.args.inputs=[{mediaId:"tiny",role:"first-frame"}];f.args.parameters={mode:"frames"};
    const fetchImpl=apimartFetch("video");await expect(submitAgentGeneration(f.args,f.context,{fetchImpl})).rejects.toThrow("256");expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("does not leak connector secrets echoed in remote failure status/messages",async()=>{
    const f=await setup();const real=apimartFetch();const fetchImpl=vi.fn<typeof fetch>(async(url,init)=>String(url).includes("/tasks/")?Response.json({code:200,data:{id:"task-1",status:"failed",error:{message:`echo ${f.config.apiKey}`}}}):real(url,init));
    const job=await submitAgentGeneration(f.args,f.context,{fetchImpl});expect(job.status).toBe("failed");expect(JSON.stringify(job)).not.toContain(f.config.apiKey);
  });
});
