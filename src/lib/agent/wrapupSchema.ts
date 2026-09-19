import { z } from "zod";
import type { WrapupContent, WrapupSnapshot } from "@/domain/agentTaskWrapup";
const refs=z.array(z.string().min(1).max(240)).max(12);
const item=z.object({text:z.string().trim().min(1).max(2400),sourceIds:refs}).strict();
export const wrapupContentSchema=z.object({overview:z.string().trim().max(4000),results:z.array(item).max(30),acceptance:z.array(z.object({criterionIndex:z.number().int().min(0).max(19),criterion:z.string().max(500),status:z.enum(['met','unmet','review']),note:z.string().max(2400),sourceIds:refs}).strict()).max(20),decisions:z.array(item).max(20),lessons:z.array(item).max(20),unresolved:z.array(item).max(30)}).strict();
export function validateWrapupContent(raw:unknown,snapshot:WrapupSnapshot,author:'ai'|'user'):WrapupContent {
  const content=wrapupContentSchema.parse(raw);
  if(content.acceptance.length!==snapshot.criteria.length||new Set(content.acceptance.map(a=>a.criterionIndex)).size!==snapshot.criteria.length||content.acceptance.some(a=>snapshot.criteria[a.criterionIndex]!==a.criterion))throw new Error('验收要求与任务快照不一致');
  const sources=new Map(snapshot.evidence.map(e=>[e.id,e]));
  for(const entry of [...content.results,...content.decisions,...content.lessons,...content.unresolved,...content.acceptance]){
    if(entry.sourceIds.some(id=>!sources.has(id)))throw new Error('总结引用了未提供或不属于当前任务的来源');
  }
  if(author==='ai' && [...content.decisions,...content.lessons,...content.unresolved].some(item=>!item.sourceIds.length))throw new Error("AI 结论和待解决事项必须引用实际来源；无法核实的验收判断保留 review");
  for(const result of content.results){
    if(author==='ai'&&!result.sourceIds.some(id=>sources.get(id)?.supportsResult))throw new Error('AI 成果必须引用真实来源');
    if(result.sourceIds.some(id=>sources.get(id)!.outcome==='unresolved'||!sources.get(id)!.available))throw new Error('未解决或不可用的来源不能作为已交付成果');
  }
  for(const finding of content.acceptance){
    if(finding.status==='met'&&finding.sourceIds.some(id=>sources.get(id)!.outcome==='unresolved'||!sources.get(id)!.available))throw new Error('未解决的来源不能作为验收通过依据');
    // A model proposes findings, never independently certifies creative acceptance.
    if(author==='ai'&&finding.status==='met')finding.status='review';
  }
  return content;
}
export function emptyWrapupContent(criteria:readonly string[]):WrapupContent {
  return {overview:'',results:[],acceptance:criteria.map((criterion,criterionIndex)=>({criterionIndex,criterion,status:'review',note:'',sourceIds:[]})),decisions:[],lessons:[],unresolved:[]};
}
