import { db } from '@/db/database';
import type { AgentToolContext } from './tools';
import { getProjectKind } from '@/domain/types';
/** Scope is read from durable execution, never from the model or mutable UI. */
export async function frozenProjectScope(context:AgentToolContext):Promise<string|undefined>{
 const run=await db.agentRuns.get(context.runId),thread=await db.chatThreads.get(context.threadId);
 if(!run||!thread||run.threadId!==context.threadId||thread.projectId!==run.projectId||context.projectId!==undefined&&context.projectId!==run.projectId)throw new Error('执行项目归属不匹配');
 if(run.projectId&&!(await db.projects.get(run.projectId)))throw new Error('关联项目已不存在，无法继续执行');
 return run.projectId;
}
/** A missing read target means the current project, never an inferred or foreign owner. */
export async function requireBoundProjectScope(context: AgentToolContext, requestedProjectId?: string): Promise<string> {
 context.signal.throwIfAborted();
 const projectId = await frozenProjectScope(context);
 if (!projectId) throw new Error('当前对话尚未绑定项目，请从目标项目的“在此项目继续创作”入口开启对话。此次操作未执行。');
 if (requestedProjectId !== undefined && requestedProjectId !== projectId) {
  throw new Error(`当前对话已绑定项目，调用参数 projectId 与绑定项目不一致。当前 projectId：${projectId}。此次操作未执行；若要操作当前项目，请使用此 ID 重新读取，再根据读取结果继续。无需重新打开当前项目对话；不要重复原来的错误参数，也不要将其他项目的修改目标改到此项目。`);
 }
 return projectId;
}
export async function assertProjectToolScope(context:AgentToolContext,name:string,raw:unknown,write:boolean){
 const projectId=await frozenProjectScope(context);if(!projectId)return;
 const args=raw as Record<string,unknown>;
 if(write){const project=await db.projects.get(projectId);if(project&&getProjectKind(project)!=='video'&&(/^(episode_|beat_|shot_|slot_|creative_)/.test(name)||name==='project_update'))throw new Error('此工具用于视频项目；请加载音频或音乐创作工具');}
 if(name==='project_create')throw new Error('项目绑定对话不能创建其他项目，请在项目页新建');
 let owner=args.ownerId??args.projectId;
 if(name.startsWith('project_')||args.kind==='project')owner=args.id??owner;
 if(name==='business_search'&&args.kind==='project')return;
 if(owner!==projectId&&!(owner==='studio'&&!write))throw new Error('此执行只能操作绑定项目；工作室原始资料不可修改');
}
