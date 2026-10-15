import {createId} from '../../../platform/identity';
import {executeRun,toolMetadataMatches,type RuntimeHost,type RoundDetail} from '@cuepoint/agent-core';
import type {ProductStore,StoreTx,TableScope} from '../../../platform/storage/types';
import {StorageError} from '../../../platform/storage/errors';
import {getOfferedToolNames,refreshRunToolLoading,toolNamesForCall} from './toolLoading';
import {saveAgentFinishingCheck} from '../commands/agentFinishingCheck';
import {upgradeLegacyPlanCalls} from '../commands/agentToolRecovery';
import {budgetContext} from './contextPlanner';
import {continuationExtraTokens,prepareRunContext} from './contextCompaction';
import {refreshRunMemoryContext} from '../../memory/agent/memoryContext';
import {refreshRunProjectContext} from './projectContext';
import {frozenProjectScope} from './projectScope';
import {toolFailureResult,ToolPendingError,ToolUnavailableError} from './toolErrors';
import {streamResponses,type ResponsesResult} from '../providers/responsesStream';
import {db as productDb} from '../../../platform/product/store';
import {appendToolResults,AtomicToolRollbackError,markRunningToolsUnknown,pauseAtModelStepLimit,pauseForApproval,resumeAgentRun,saveToolPreview,saveToolRound,startModelStep,transitionToolCall} from '../commands/agentTools';
import type {AgentRun,AgentToolCall,AgentToolPreview,AgentResponseItem} from '../models/agent';
import {type AgentToolContext,type AgentToolDefinition,BUILTIN_TOOLS,requiresToolApproval,toolSchemas,validateToolCall} from './tools';
import {checkpointAgentRun,finishAgentRun,recordAgentModelMetrics} from '../commands/agentRuns';
import {streamChatCompletions} from '../providers/chatStream';
import {withExecutionOwnership,withOwnedExecution,assertThreadOwnership,type ThreadOwnership} from './runOwnership';
import {createRunCredentials} from './runCredentials';
import {responseRoundMatches} from '@cuepoint/agent-providers';

/** Only user review may supply an execution override; wire arguments remain untouched. */
function effectiveToolInput(call:AgentToolCall) {
    if (!call.generationOverride) return {arguments:call.arguments,preview:call.preview};
    if (call.name !== 'submit_generation' || !call.requiresConfirmation || call.decision !== 'approve') throw new Error('工具覆盖参数没有有效的用户确认');
    return call.generationOverride;
}

/** Product integration owns transactions and predicates, while core owns every execution transition. */
function createStudioRuntimeHost(db:ProductStore,ownership:ThreadOwnership,apiKey:string,fetchImpl:typeof fetch|undefined,registry:readonly AgentToolDefinition[],signal:AbortSignal):RuntimeHost<AgentRun,AgentToolCall,AgentToolContext,AgentToolPreview,AgentResponseItem[]> {
    assertThreadOwnership(ownership,ownership.threadId);
    const credentials=createRunCredentials(db,apiKey,!!fetchImpl);
    const scope:TableScope=[db.projects,db.agentRuns,db.agentToolCalls,db.chatThreads,db.chatMessages,db.agentTasks,db.agentGenerationJobs,db.agentTaskRecords,db.agentTaskRecordVersions,db.agentGenerationBatches,db.agentGenerationBatchItems];
    const guard=async<T>(run:AgentRun,operation:(tx:StoreTx)=>Promise<T>,tables:TableScope=scope):Promise<T>=>db.transaction('rw',tables,async tx=>{
        assertThreadOwnership(ownership,run.threadId);
        if (ownership.threadId !== run.threadId) throw new Error('执行锁与对话归属不匹配');
        const current=await tx.agentRuns.get(run.id);
        const message=current ? await tx.chatMessages.get(current.assistantMessageId) : undefined;
        if (!current || current.threadId !== run.threadId || current.assistantMessageId !== run.assistantMessageId || !message || message.runId !== run.id || message.threadId !== run.threadId) throw new Error('执行消息归属不匹配');
        if (current.status === 'running' && current.modelStep !== run.modelStep) throw new Error('执行步骤已经变化');
        const value=await operation(tx);
        ownership.assertHeld();
        return value;
    });
    const host:RuntimeHost<AgentRun,AgentToolCall,AgentToolContext,AgentToolPreview,AgentResponseItem[]>={
        executionId:createId('exec'),ownership,clock:()=>Date.now(),
        readRun:id=>{ownership.assertHeld();return db.agentRuns.get(id);},
        readOutput:run=>{ownership.assertHeld();return db.chatMessages.get(run.assistantMessageId);},
        checkpoint:(run,seq,output)=>guard(run,tx=>checkpointAgentRun(run.id,seq,output,tx),[db.agentRuns,db.chatMessages]),
        pauseAtLimit:run=>guard(run,tx=>pauseAtModelStepLimit(run.id,tx)),
        async prepareContext(run,signal) {
            ownership.assertHeld();
            run=await refreshRunToolLoading(run.id,db);
            run=await refreshRunProjectContext(run.id,db);
            run=await refreshRunMemoryContext(run.id,db);
            run=await prepareRunContext(run.id,toolSchemas(getOfferedToolNames(run),registry),apiKey,signal,fetchImpl,db,run=>credentials.resolve(run),cause=>credentials.message(cause));
            run=await refreshRunMemoryContext(run.id,db);
            if (budgetContext(run.continuationMessages ?? run.requestMessages,toolSchemas(getOfferedToolNames(run),registry),run.context?.capacity,!!run.context?.summaryId,continuationExtraTokens(run)).overBudget) throw new Error('记忆更新后上下文超出安全预算，请减少历史或调整输入后继续');
            return run;
        },
        admitModelStep:(run,limit)=>guard(run,tx=>startModelStep(run.id,limit,tx)),
        async request(run,signal,onDelta) {
            ownership.assertHeld();
            const currentKey=await credentials.resolve(run);
            signal.throwIfAborted();
            const transport=run.protocol === 'responses' ? streamResponses : streamChatCompletions;
            const result:ResponsesResult=await transport({projectId:run.projectId,runId:run.id,visionCapability:run.visionCapability,responseItems:run.responseItems,baseUrl:run.connector.baseUrl,apiKey:currentKey,model:run.model,connectorDefinitionId:run.connector.definitionId,reasoningEffort:run.reasoningEffort,messages:run.continuationMessages ?? run.requestMessages,tools:toolSchemas(getOfferedToolNames(run),registry)},{signal,fetchImpl,onDelta:content=>onDelta({content}),onReasoning:reasoning=>onDelta({reasoning})});
            return result.ok ? {...result,continuation:result.responseOutput} : result;
        },
        recordMetrics:(run,metrics)=>guard(run,tx=>recordAgentModelMetrics(run.id,metrics,tx),[db.agentRuns,db.chatMessages]),
        finishingCheck:(run,output,continuation,signal)=>{ownership.assertHeld();return saveAgentFinishingCheck(run.id,run.modelStep!,output,continuation,signal,db);},
        commitRound:(run,result,details,output)=>guard(run,tx=>saveToolRound(run.id,result.content,result.toolCalls!,details.map(detail=>({...detail,recovery:productRecovery(detail)})),result.continuation,output,tx)),
        offeredNames:(run,step)=>step === undefined ? getOfferedToolNames(run) : toolNamesForCall(run,step),
        settle:(run,status,output,error,reason)=>guard(run,async tx=>{await finishAgentRun(run.id,status,output,error,reason,tx);return (await tx.agentRuns.get(run.id))!.status;},[db.agentRuns,db.chatMessages]),
        tools:{
            registry,
            readRound:run=>guard(run,async tx=>{await upgradeLegacyPlanCalls(run.id,tx);return tx.agentToolCalls.where('runId').equals(run.id).toArray();}),
            validateEnvelope(run,calls) {
                if (run.protocol !== 'responses') return;
                if (!responseRoundMatches(run.responseItems,calls.map(call=>({id:call.providerCallId,type:'function',function:{name:call.name,arguments:call.arguments}})),false)) throw new Error('Responses 调用信封与执行记录不匹配，已阻止继续执行');
            },
            readCall:(_run,id)=>{ownership.assertHeld();return db.agentToolCalls.get(id);},
            assertScope:(run,call,signal)=>frozenProjectScope({runId:run.id,threadId:run.threadId,callId:call.id,signal,projectId:run.projectId},db).then(()=>undefined),
            input:effectiveToolInput,
            validate:(name,raw,offered)=>validateToolCall(name,raw,offered,registry),
            context:(run,call,signal,preview)=>({projectId:run.projectId,runId:run.id,threadId:run.threadId,callId:call.id,signal,preview,store:db}),
            approval:requiresToolApproval,
            preview:(run,call,preview)=>guard(run,tx=>saveToolPreview(run.id,call.id,preview,tx)),
            transition:(run,call,from,to,extra)=>to !== 'running' ? guard(run,tx=>transitionToolCall(run.id,call.id,from,to,extra,tx)) : transitionToolCall(run.id,call.id,from,to,extra,db,async(current,saved,tx)=>{
                assertThreadOwnership(ownership,current.threadId);
                if (current.id !== run.id || current.modelStep !== run.modelStep || current.assistantMessageId !== run.assistantMessageId || claimFingerprint(saved) !== claimFingerprint(call)) throw new Error('工具调用或审批在领取前已经变化');
                const {tool,args}=validateToolCall(saved.name,effectiveToolInput(saved).arguments,toolNamesForCall(current,saved.step),registry);
                if (!toolMetadataMatches(tool,args,saved) || requiresToolApproval(current.permissionMode ?? 'ask',tool,args) && saved.status !== 'approved') throw new Error('工具定义、权限或审批在领取前已经变化');
                await frozenProjectScope({runId:current.id,threadId:current.threadId,callId:saved.id,signal,projectId:current.projectId},tx);
            }),
            park:run=>guard(run,tx=>pauseForApproval(run.id,tx)),
            appendResults:run=>guard(run,tx=>appendToolResults(run.id,tx)),
            markUnknown:(run,force)=>guard(run,tx=>markRunningToolsUnknown(run.id,tx,force))
        },
        errors:{failure:toolFailureResult,unavailable:(name,offered)=>new ToolUnavailableError(name,offered),pending:cause=>cause instanceof ToolPendingError,pendingError:()=>new ToolPendingError('生成任务已保存，请继续查询已有任务。'),rolledBack:cause=>cause instanceof AtomicToolRollbackError,unknown:cause=>cause instanceof StorageError && cause.certainty === 'unknown',publicMessage:cause=>credentials.message(cause)}
    };
    return host;
}
function claimFingerprint(call:AgentToolCall):string {
    return JSON.stringify({runId:call.runId,threadId:call.threadId,providerCallId:call.providerCallId,name:call.name,arguments:call.arguments,step:call.step,order:call.order,title:call.title,status:call.status,effect:call.effect,highRisk:call.highRisk,atomic:call.atomic,requiresConfirmation:call.requiresConfirmation,recovery:call.recovery,decision:call.decision,preview:call.preview,generationOverride:call.generationOverride});
}
function productRecovery(detail:RoundDetail):AgentToolCall['recovery'] {
    if (detail.recovery === undefined || detail.recovery === 'generation' || detail.recovery === 'repeatable') return detail.recovery;
    throw new Error('未知工具恢复策略');
}

/** Direct typed consumers acquire the same execution lock without recovering their own new run. */
export async function executeChatRun(run:AgentRun,apiKey:string,controller:AbortController,fetchImpl?:typeof fetch,registry:readonly AgentToolDefinition[]=BUILTIN_TOOLS,store:ProductStore=productDb,ownership?:ThreadOwnership):Promise<void> {
    const execute=(held:ThreadOwnership)=>withOwnedExecution(held,run.threadId,()=>executeRun(run,controller,createStudioRuntimeHost(store,held,apiKey,fetchImpl,registry,controller.signal)));
    if (ownership) await execute(ownership);else await withExecutionOwnership(run.threadId,execute);
}
export async function resumeChatRun(runId:string,apiKey:string,controller:AbortController,fetchImpl?:typeof fetch,registry:readonly AgentToolDefinition[]=BUILTIN_TOOLS,store:ProductStore=productDb,ownership?:ThreadOwnership):Promise<void> {
    const saved=await store.agentRuns.get(runId);
    if (!saved) throw new Error('执行已删除');
    const execute=(held:ThreadOwnership)=>withOwnedExecution(held,saved.threadId,async()=>{
        controller.signal.throwIfAborted();
        const run=await resumeAgentRun(runId,store);
        await executeRun(run,controller,createStudioRuntimeHost(store,held,apiKey,fetchImpl,registry,controller.signal));
    });
    if (ownership) await execute(ownership);else await withExecutionOwnership(saved.threadId,execute);
}
