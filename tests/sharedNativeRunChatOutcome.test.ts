import {describe,expect,it,vi} from "vitest";
import {z} from "zod";
import {beginAgentRun} from "@/db/agentRuns";
import {createChatThread} from "@/db/chat";
import {createProject} from "@/db/projects";
import {executeAtomicTool,resumeAgentRun,saveToolRound} from "@/db/agentTools";
import {updateGeneralAgentConfig} from "@/db/agentSettings";
import {executeChatRun,resumeChatRun} from "@/lib/agent/runChat";
import type {AgentToolDefinition} from "@/lib/agent/tools";
import {BUILTIN_TOOLS} from "@/lib/agent/tools";
import type {ConnectorConfig} from "@/domain/types";
import {withFinalReviewFixture} from "./helpers/finalReviewFixture";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import type {ProductStore} from "@/lib/storage/types";

const name="fixture_native_atomic_project";
const connector:ConnectorConfig={id:"fixture",name:"fixture",definitionId:"openai-compatible",baseUrl:"https://fixture.test/v1",apiKey:"fixture",updatedAt:"2026-10-12"};

async function seedRun(store:ProductStore,toolName=name,raw:unknown={}) {
    await updateGeneralAgentConfig({permissionMode:"full"},store);
    const thread=await createChatThread({},store);
    const initial=await beginAgentRun({threadId:thread.id,connector,model:"fixture",content:"创建一次项目"},store);
    const toolLoading={version:1 as const,groups:[],foundationToolNames:[toolName],foundationInstructions:"",loadedGroupIds:[],loadedToolNames:[]};
    await store.agentRuns.update(initial.id,{enabledToolNames:[toolName],toolLoading,offeredTools:[{step:1,names:[toolName]}]});
    await saveToolRound(initial.id,"",[{id:"provider-call",type:"function",function:{name:toolName,arguments:JSON.stringify(raw)}}],[{title:"创建一次",effect:toolName === "update_run_plan" ? "bookkeeping" : "write",atomic:true,highRisk:false}],undefined,undefined,store);
    return (await store.agentRuns.get(initial.id))!;
}

describe("real native commit uncertainty through executeChatRun",()=> {
    it.each(["unreachable","pending","notFound"] as const)("uses the persisted completed ledger after a lost COMMIT reply and %s status",async status=> {
        let armed=false,lost=false,runs=0;
        const businessOperations=new Set<string>();
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string;request:{operationId:string}};
            if (lost && envelope.type === "status") {
                if (status === "unreachable") throw new Error("status lookup unavailable");
                // Fault only the status transport visibility; the COMMIT below is real.
                return {status,operationId:envelope.request.operationId};
            }
            const reply=await next();
            if (armed && envelope.type === "commit") {armed=false;lost=true;businessOperations.add(envelope.request.operationId);throw new Error("reply lost after actual COMMIT");}
            return reply;
        }});
        try {
            const run=await seedRun(native.store);
            const tool:AgentToolDefinition={name,title:"创建一次",description:"actual local fixture",effect:"write",atomic:true,parameters:{type:"object",properties:{},additionalProperties:false},parseArguments:raw=>z.object({}).strict().parse(raw),highRisk:()=>false,
                execute:async (_args,context)=> {armed=true;return executeAtomicTool(context,async tx=> {runs++;return {id:(await createProject("单次保存",undefined,undefined,undefined,tx)).id};});}};
            const provider=vi.fn(async ()=>Response.json({choices:[{message:{content:"工具已处理"},finish_reason:"stop"}]}));
            await executeChatRun(run,connector.apiKey,new AbortController(),withFinalReviewFixture(provider),[tool],native.store);
            expect(runs).toBe(1);expect(businessOperations.size).toBe(1);expect(provider).toHaveBeenCalled();
            expect(await native.store.projects.count()).toBe(1);
            expect((await native.store.agentToolCalls.where("runId").equals(run.id).first())?.status).toBe("completed");
            lost=false;await native.reopen();
            expect((await native.store.agentRuns.get(run.id))?.status).toBe("completed");
            expect((await native.store.agentToolCalls.where("runId").equals(run.id).first())?.status).toBe("completed");
            expect(runs).toBe(1);expect(businessOperations.size).toBe(1);
        }finally {await native.close();}
    });

    it("keeps a committed operation immutable when the completion read also fails, then resumes from its reopened ledger",async ()=> {
        let armed=false,lost=false,failedRead=false,runs=0;
        const businessOperations=new Set<string>();
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string;request:{operationId:string;table?:string}};
            if (lost && envelope.type === "status") throw new Error("status lookup unavailable");
            if (lost && !failedRead && envelope.type === "get" && envelope.request.table === "agentToolCalls") {failedRead=true;throw new Error("completion read unavailable");}
            const reply=await next();
            if (armed && envelope.type === "commit") {armed=false;lost=true;businessOperations.add(envelope.request.operationId);throw new Error("reply lost after actual COMMIT");}
            return reply;
        }});
        try {
            const run=await seedRun(native.store);
            const tool:AgentToolDefinition={name,title:"创建一次",description:"actual local fixture",effect:"write",atomic:true,parameters:{type:"object",properties:{},additionalProperties:false},parseArguments:raw=>z.object({}).strict().parse(raw),highRisk:()=>false,
                execute:async (_args,context)=> {armed=true;return executeAtomicTool(context,async tx=> {runs++;return {id:(await createProject("读失败也保留",undefined,undefined,undefined,tx)).id};});}};
            const provider=vi.fn(async ()=>Response.json({choices:[{message:{content:"工具已处理"},finish_reason:"stop"}]}));
            await executeChatRun(run,connector.apiKey,new AbortController(),withFinalReviewFixture(provider),[tool],native.store);
            expect(failedRead).toBe(true);expect(provider).not.toHaveBeenCalled();expect(runs).toBe(1);expect(businessOperations.size).toBe(1);
            expect((await native.store.agentRuns.get(run.id))?.error).toContain("不能自动重跑");
            expect((await native.store.agentToolCalls.where("runId").equals(run.id).first())?.status).toBe("completed");
            lost=false;await native.reopen();
            await resumeChatRun(run.id,connector.apiKey,new AbortController(),withFinalReviewFixture(provider),[tool],native.store);
            expect(runs).toBe(1);expect(businessOperations.size).toBe(1);expect(await native.store.projects.count()).toBe(1);
            expect((await native.store.agentRuns.get(run.id))?.status).toBe("completed");
            expect((await native.store.agentToolCalls.where("runId").equals(run.id).first())?.status).toBe("completed");
            await expect(resumeAgentRun(run.id,native.store)).rejects.toThrow();
        }finally {await native.close();}
    });

    it.each([false,true])("keeps actual update_run_plan committed after reply/status loss, completion read failure=%s",async failRead=> {
        let armed=false,lost=false,readFailed=false,executions=0;
        const operationIds=new Set<string>();
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string;request:{operationId:string;table?:string}};
            if (lost && envelope.type === "status") throw new Error("status unavailable after plan COMMIT");
            if (lost && failRead && !readFailed && envelope.type === "get" && envelope.request.table === "agentToolCalls") {readFailed=true;throw new Error("plan completion lookup unavailable");}
            const reply=await next();
            if (armed && envelope.type === "commit") {armed=false;lost=true;operationIds.add(envelope.request.operationId);throw new Error("actual plan COMMIT acknowledgement lost");}
            return reply;
        }});
        try {
            const plan=[{id:"step",title:"验证计划",status:"pending" as const}];
            const run=await seedRun(native.store,"update_run_plan",{steps:plan});
            const original=BUILTIN_TOOLS.find(tool=>tool.name === "update_run_plan")!;
            const tool:AgentToolDefinition={...original,execute:async (args,context)=> {executions++;armed=true;return original.execute(args,context);}};
            const provider=vi.fn(async ()=>Response.json({choices:[{message:{content:"计划已保存"},finish_reason:"stop"}]}));
            await executeChatRun(run,connector.apiKey,new AbortController(),withFinalReviewFixture(provider),[tool],native.store);
            expect(executions).toBe(1);expect(operationIds.size).toBe(1);
            expect((await native.store.agentRuns.get(run.id))?.plan).toEqual(plan);
            expect((await native.store.agentToolCalls.where("runId").equals(run.id).first())?.status).toBe("completed");
            if (failRead) {expect(readFailed).toBe(true);expect(provider).not.toHaveBeenCalled();}
            lost=false;await native.reopen();
            if (failRead) await resumeChatRun(run.id,connector.apiKey,new AbortController(),withFinalReviewFixture(provider),[tool],native.store);
            expect(executions).toBe(1);expect(operationIds.size).toBe(1);
            expect((await native.store.agentRuns.get(run.id))?.plan).toEqual(plan);
            expect((await native.store.agentToolCalls.where("runId").equals(run.id).first())?.status).toBe("completed");
        }finally {await native.close();}
    });
});
