import {describe,expect,it,vi} from "vitest";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import {AtomicToolRollbackError,executeAtomicTool} from "@/features/agent/commands/agentTools";
import {createProject} from "@/features/projects/commands/projects";
import {UnknownCommitError} from "@/platform/storage/errors";
import type {ProductStore} from "@/platform/storage/types";
import {createNativeProductStore} from "@/platform/storage/native";

async function seedTool(store:ProductStore) {
    await store.transaction("rw",["chatThreads","chatMessages","agentRuns","agentToolCalls"],async tx=> {
        await tx.chatThreads.add({id:"thread"} as never);
        await tx.chatMessages.add({id:"assistant",threadId:"thread",runId:"run",role:"assistant"} as never);
        await tx.agentRuns.add({id:"run",threadId:"thread",assistantMessageId:"assistant",status:"running"} as never);
        await tx.agentToolCalls.add({id:"call",threadId:"thread",runId:"run",status:"running"} as never);
    });
    return {threadId:"thread",runId:"run",callId:"call",signal:new AbortController().signal,store};
}

describe("real native commit certainty through the business atomic boundary",()=> {
    it.each(["malformed","rejected"] as const)("reconciles a %s acknowledgement without replaying the callback",async failure=> {
        let inject=false;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string};
            const reply=await next();
            if (inject && envelope.type === "commit") {
                if (failure === "rejected") throw new Error("committed response was lost");
                return {status:"committed",operationId:"malformed"};
            }
            return reply;
        }});
        try {
            const context=await seedTool(native.store);let runs=0;inject=true;
            const callback=async (tx:ProductStore)=> {runs++;return {id:(await createProject("确认已提交",undefined,undefined,undefined,tx)).id};};
            const result=await executeAtomicTool(context,callback);
            expect(await executeAtomicTool(context,callback)).toEqual(result);expect(runs).toBe(1);
            expect(await native.store.projects.count()).toBe(1);expect(await native.store.episodes.count()).toBe(1);
            inject=false;await native.reopen();
            expect(await native.store.agentToolCalls.get("call")).toMatchObject({status:"completed",result:JSON.stringify(result)});
        }finally {await native.close();}
    });
    it("preserves unknown certainty when durable status cannot be reached after COMMIT",async ()=> {
        let inject=false;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string};
            if (inject && envelope.type === "status") throw new Error("status transport unavailable");
            const reply=await next();
            return inject && envelope.type === "commit" ? {status:"committed"} : reply;
        }});
        try {
            const context=await seedTool(native.store);let runs=0;inject=true;
            let caught:unknown;
            try {await executeAtomicTool(context,async tx=> {runs++;return {id:(await createProject("未知但已保存",undefined,undefined,undefined,tx)).id};});}catch(error) {caught=error;}
            expect(caught).toBeInstanceOf(UnknownCommitError);expect(caught).not.toBeInstanceOf(AtomicToolRollbackError);expect(runs).toBe(1);
            inject=false;await native.reopen();
            expect(await native.store.projects.count()).toBe(1);expect(await native.store.agentToolCalls.get("call")).toMatchObject({status:"completed"});
        }finally {await native.close();}
    });
});

describe("actual native observation races and precise selectors",()=> {
    it("retries a conflicted initial readonly snapshot and delivers only its coherent result",async ()=> {
        const native=await createNativeProbe();let dispose:()=>void=()=>undefined;
        try {
            let release!:()=>void,read!:()=>void,runs=0;
            const barrier=new Promise<void>(resolve=>release=resolve),readSignal=new Promise<void>(resolve=>read=resolve);
            const values:number[]=[],errors:unknown[]=[];
            dispose=native.store.observe(async tx=> {
                const rows=await tx.episodes.where("projectId").equals("p").toArray();
                if (++runs === 1) {read();await barrier;}
                return rows.length;
            },{next:value=>values.push(value),error:error=>errors.push(error)});
            const outside=createNativeProductStore({...native.bridge,open:async ()=>({...await native.driver.getSession(),changeSequence:0})},native.binaries).store;
            await readSignal;await outside.episodes.add({id:"e",projectId:"p"} as never);release();
            await vi.waitUntil(()=>values.length === 1);expect(values).toEqual([1]);expect(errors).toEqual([]);expect(runs).toBe(2);
            await native.store.episodes.add({id:"other",projectId:"excluded"} as never);
            await new Promise(resolve=>setTimeout(resolve,30));expect(runs).toBe(2);
        }finally {dispose();await native.close();}
    });
    it("tracks point and fixed-kind selectors and stops delivering after disposal",async ()=> {
        const native=await createNativeProbe();let dispose:()=>void=()=>undefined;
        try {
            const values:number[]=[],errors:unknown[]=[];let runs=0;
            dispose=native.store.observe(async tx=> {runs++;await tx.projects.get("chosen");return (await tx.libraryMaterials.where("kind").equals("image").toArray()).length;},{next:value=>values.push(value),error:error=>errors.push(error)});
            await vi.waitUntil(()=>values.length === 1);
            await native.store.projects.add({id:"excluded"} as never);
            await native.store.libraryMaterials.add({id:"video",kind:"video"} as never);
            await new Promise(resolve=>setTimeout(resolve,30));expect(runs).toBe(1);
            await native.store.libraryMaterials.add({id:"image",kind:"image"} as never);await vi.waitUntil(()=>values.length === 2);
            expect(values).toEqual([0,1]);expect(errors).toEqual([]);
            dispose();await native.store.projects.add({id:"chosen"} as never);
            await new Promise(resolve=>setTimeout(resolve,30));expect(runs).toBe(2);
        }finally {dispose();await native.close();}
    });
});
