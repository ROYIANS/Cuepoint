import {describe,expect,it,vi} from "vitest";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import {createProject} from "@/features/projects/commands/projects";
import {addShot} from "@/features/video/commands/shots";
import {prepareGenerationBatch} from "@/features/agent/commands/agentGenerationBatches";
import {submitAgentGeneration} from "@/features/video/agent/generationRuntime";
import {AtomicToolRollbackError} from "@/features/agent/commands/agentTools";
import {UnknownCommitError} from "@/platform/storage/errors";

describe("actual native local preparation certainty",()=> {
    it.each(["batch","claim"] as const)("retains %s COMMIT uncertainty and never begins a paid POST",async scenario=> {
        let inject=false,commits=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string};
            if (inject && envelope.type === "status") throw new Error("receipt unavailable after real COMMIT");
            const result=await next();
            if (inject && envelope.type === "commit") {commits++;throw new Error("actual COMMIT reply lost");}
            return result;
        }});
        const fetcher=vi.fn<typeof fetch>();vi.stubGlobal("fetch",fetcher);
        try {
            const project=await createProject("原生准备结果",undefined,undefined,undefined,native.store);
            const connector={id:"provider",definitionId:"apimart" as const,baseUrl:"https://fixture.invalid/v1",apiKey:"fixture",updatedAt:"2026-10-12"};
            await native.store.connectors.put(connector);
            await native.store.transaction("rw",["chatThreads","chatMessages","agentRuns","agentToolCalls"],async tx=> {
                await tx.chatThreads.add({id:"thread",projectId:project.id} as never);
                await tx.chatMessages.add({id:"assistant",threadId:"thread",runId:"run"} as never);
                await tx.agentRuns.add({id:"run",projectId:project.id,threadId:"thread",assistantMessageId:"assistant",status:"running"} as never);
                await tx.agentToolCalls.add({id:"call",threadId:"thread",runId:"run",name:scenario === "batch" ? "prepare_generation_batch" : "submit_generation",status:"running",decision:"approve",requiresConfirmation:true} as never);
            });
            const episode=(await native.store.episodes.where("projectId").equals(project.id).first())!;
            const shot=await addShot(project.id,episode.id,undefined,native.store);
            const args={connectorId:connector.id,model:"gpt-image-2",prompt:"fixture",parameters:{},inputs:[],target:{kind:"shot" as const,projectId:project.id,episodeId:episode.id,entityId:shot.id,slot:"firstFrame" as const}};
            const context={projectId:project.id,runId:"run",threadId:"thread",callId:"call",signal:new AbortController().signal,store:native.store};
            inject=true;let caught:unknown;
            try {await (scenario === "batch" ? prepareGenerationBatch("实际草稿",[args],context) : submitAgentGeneration(args,context));}catch(error) {caught=error;}
            expect(caught).toBeInstanceOf(UnknownCommitError);expect(caught).not.toBeInstanceOf(AtomicToolRollbackError);
            expect(commits).toBe(1);expect(fetcher).not.toHaveBeenCalled();
            inject=false;await native.reopen();
            if (scenario === "batch") {
                expect(await native.store.agentGenerationBatches.count()).toBe(1);expect(await native.store.agentGenerationBatchItems.count()).toBe(1);
                expect((await native.store.agentToolCalls.get("call"))?.status).toBe("completed");
            }else {
                expect((await native.store.agentGenerationJobs.toArray()).map(job=>job.status)).toEqual(["submitting"]);
                expect((await native.store.agentToolCalls.get("call"))?.status).toBe("running");
            }
            expect(commits).toBe(1);expect(fetcher).not.toHaveBeenCalled();
        }finally {inject=false;vi.unstubAllGlobals();await native.close();}
    });
});
