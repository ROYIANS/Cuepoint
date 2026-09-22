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
