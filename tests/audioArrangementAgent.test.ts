import {afterEach,describe,expect,it,vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {resolveAgentToolApproval} from "@/db/agentTools";
import {updateGeneralAgentConfig} from "@/db/agentSettings";
import {addAudioSegment,addAudioTake,getAudioProjectSnapshot} from "@/db/audio";
import {executeChatRun,resumeChatRun} from "@/lib/agent/runChat";
import {AUDIO_ARRANGEMENT_TOOLS} from "@/lib/agent/audioArrangementTools";
import {BUILTIN_TOOLS,requiresToolApproval} from "@/lib/agent/tools";
import {describeRunWrites} from "@/lib/agent/runWriteOutcomes";
import {withFinalReviewFixture} from "./helpers/finalReviewFixture";
import type {AgentRun,AgentWireToolCall} from "@/domain/agent";
import type {ConnectorConfig} from "@/domain/types";

const connector:ConnectorConfig={id:"review",definitionId:"openai-compatible",baseUrl:"https://example.test/v1",apiKey:"fixture",updatedAt:"2026-10-10"};
const call=(name:string,args:unknown,id:string):AgentWireToolCall=>({id,type:"function",function:{name,arguments:JSON.stringify(args)}});
function reply(protocol:AgentRun["protocol"],calls:AgentWireToolCall[]=[]) {
    return protocol === "responses" ? Response.json({status:"completed",output:calls.length ? calls.map(row=>({type:"function_call",call_id:row.id,name:row.function.name,arguments:row.function.arguments})) : [{type:"message",role:"assistant",content:[{type:"output_text",text:"已保存明确选用和排列。"}]}]}) : Response.json({choices:[{message:{content:calls.length ? "" : "已保存明确选用和排列。",...(calls.length ? {tool_calls:calls} : {})},finish_reason:calls.length ? "tool_calls" : "stop"}]});
}
async function fixture(protocol:AgentRun["protocol"]="chat-completions") {
    await updateGeneralAgentConfig({permissionMode:"full",enabledSkillIds:["workspace","audio-production"]});
    const project=await createAudioMusicProject("真实审批路径","audio"),snapshot=await getAudioProjectSnapshot(project.id),chapter=snapshot.chapters[0],track=snapshot.tracks[0];
    const choices=[];
    for(let i=0;i<2;i++) {
        const segment=await addAudioSegment(project.id,{chapterId:chapter.id,text:`段落${i}`,notes:"",order:i}),mediaId=`source-${i}`;
        await db.media.add({id:mediaId,projectId:project.id,filename:"voice.wav",mimeType:"audio/wav",blob:new Blob(["bytes"],{type:"audio/wav"})});
        const take=await addAudioTake(project.id,{segmentId:segment.id,mediaId,name:`版本${i}`,source:"upload",durationSec:1.25+i,sampleRate:48000,channels:1});
        choices.push({segmentId:segment.id,segmentRevision:segment.revision,takeId:take.id,takeRevision:take.revision});
    }
    const thread=await createChatThread({projectId:project.id}),initial=await beginAgentRun({threadId:thread.id,connector,model:"fixture",content:"选用这两段声音，确认后按顺序排列"}),run={...initial,protocol};
    await db.agentRuns.put(run);return {project,chapter,track,choices,run};
}
const pending=async(run:AgentRun)=>(await db.agentToolCalls.where("runId").equals(run.id).toArray()).find(row=>row.status === "awaiting_approval")!;
afterEach(()=>vi.restoreAllMocks());

describe("reviewed arrangement Agent adapters",()=>{
    it("keeps review mandatory in every permission mode and rejects model confirmation fields",()=>{
        for(const tool of AUDIO_ARRANGEMENT_TOOLS.filter(row=>row.effect === "write")) for(const mode of ["ask","assist","full"] as const) expect(requiresToolApproval(mode,tool,{})).toBe(true);
        const select=BUILTIN_TOOLS.find(row=>row.name === "audio_select_takes")!;
        expect(()=>select.parseArguments({chapterId:"c",choices:[{segmentId:"s",segmentRevision:1,takeId:"t",takeRevision:1}],confirm:true})).toThrow();
    });
    it.each(["chat-completions","responses"] as const)("%s performs separately approved selection and arrangement with actual receipts",async protocol=>{
        const f=await fixture(protocol);let rounds=0;
        const fetcher=vi.fn<typeof fetch>(async()=>reply(protocol,++rounds === 1 ? [call("audio_select_takes",{chapterId:f.chapter.id,choices:f.choices},"select")] : rounds === 2 ? [call("audio_arrange_selected",{chapterId:f.chapter.id,segmentIds:f.choices.map(row=>row.segmentId),trackId:f.track.id,gapSec:.5},"arrange")] : []));
        const transport=withFinalReviewFixture(fetcher);
        await executeChatRun(f.run,connector.apiKey,new AbortController(),transport);
        expect((await db.agentRuns.get(f.run.id))?.status).toBe("waiting_approval");expect(await db.audioClips.count()).toBe(0);
        expect((await db.audioSegments.toArray()).every(row=>!row.selectedTakeId)).toBe(true);
        const first=await pending(f.run);await resolveAgentToolApproval(f.run.id,first.id,"approve");
        await resumeChatRun(f.run.id,connector.apiKey,new AbortController(),transport);
        expect((await db.audioSegments.toArray()).every(row=>row.selectedTakeId)).toBe(true);expect(await db.audioClips.count()).toBe(0);
        const second=await pending(f.run);expect(second.name).toBe("audio_arrange_selected");expect(second.preview?.changes.join("\n")).toContain("1.750 秒");
        await resolveAgentToolApproval(f.run.id,second.id,"approve");await resumeChatRun(f.run.id,connector.apiKey,new AbortController(),transport);
        const clips=await db.audioClips.toArray();expect(clips.map(row=>row.startSec).sort((a,b)=>a-b)).toEqual([0,1.75]);
        expect(await db.audioTakes.count()).toBe(2);expect(await db.media.count()).toBe(2);
        const calls=await db.agentToolCalls.where("runId").equals(f.run.id).toArray();
        expect(calls.every(row=>row.status === "completed")).toBe(true);
        const writes=describeRunWrites(f.run,calls);expect(writes).toMatchObject({total:4,uncoveredCalls:0});expect(writes.entries.filter(row=>row.kind === "audio_segment")).toHaveLength(2);expect(writes.entries.filter(row=>row.kind === "audio_clip")).toHaveLength(2);
        expect(await db.audioArrangementProposals.count()).toBe(2);expect(rounds).toBe(4);
        const reader=BUILTIN_TOOLS.find(row=>row.name === "audio_read_arrangement")!;
        const result=JSON.parse(calls.find(row=>row.name === "audio_arrange_selected")!.result!);
        const current=await reader.execute(reader.parseArguments({proposalId:result.proposalId}),{projectId:f.project.id,threadId:f.run.threadId,runId:f.run.id,callId:"read",signal:new AbortController().signal});
        expect(current).toMatchObject({revision:2,historicalAddedCount:2,currentAddedIds:expect.arrayContaining(clips.map(row=>row.id))});
    });
    it("rejected selection performs no write or generation",async()=>{
        const f=await fixture(),fetcher=vi.fn<typeof fetch>(async()=>reply(f.run.protocol,[call("audio_select_takes",{chapterId:f.chapter.id,choices:f.choices},"reject")]));
        await executeChatRun(f.run,connector.apiKey,new AbortController(),fetcher);
        const item=await pending(f.run);await resolveAgentToolApproval(f.run.id,item.id,"reject");
        expect((await db.audioSegments.toArray()).every(row=>!row.selectedTakeId)).toBe(true);expect(await db.audioArrangementProposals.count()).toBe(0);expect(await db.audioClips.count()).toBe(0);expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it("a later manual track edit invalidates a frozen placement approval atomically",async()=>{
        const f=await fixture();
        await db.audioSegments.bulkPut((await db.audioSegments.toArray()).map(row=>({...row,selectedTakeId:f.choices.find(choice=>choice.segmentId === row.id)!.takeId,revision:row.revision+1})));
        const fetcher=withFinalReviewFixture(vi.fn<typeof fetch>(async()=>reply(f.run.protocol,[call("audio_arrange_selected",{chapterId:f.chapter.id,segmentIds:f.choices.map(row=>row.segmentId),trackId:f.track.id},"stale")] )));
        await executeChatRun(f.run,connector.apiKey,new AbortController(),fetcher);const item=await pending(f.run);
        // Same owner, but changing a target track changes the concrete reviewed effect.
        await db.audioTracks.update(f.track.id,{gain:.25,revision:f.track.revision+1});
        await resolveAgentToolApproval(f.run.id,item.id,"approve");
        const final=withFinalReviewFixture(async()=>reply(f.run.protocol));
        await resumeChatRun(f.run.id,connector.apiKey,new AbortController(),final);
        expect((await db.agentToolCalls.get(item.id))?.status).toBe("failed");expect(await db.audioClips.count()).toBe(0);expect(await db.audioArrangementProposals.count()).toBe(0);
    });
    it("Stop prevents an approved group from starting",async()=>{
        const f=await fixture(),fetcher=vi.fn<typeof fetch>(async()=>reply(f.run.protocol,[call("audio_select_takes",{chapterId:f.chapter.id,choices:f.choices},"stop")]));
        await executeChatRun(f.run,connector.apiKey,new AbortController(),fetcher);const item=await pending(f.run);
        await resolveAgentToolApproval(f.run.id,item.id,"approve");
        const controller=new AbortController();controller.abort();
        await expect(resumeChatRun(f.run.id,connector.apiKey,controller,fetcher)).rejects.toThrow();
        expect((await db.audioSegments.toArray()).every(row=>!row.selectedTakeId)).toBe(true);expect(await db.audioArrangementProposals.count()).toBe(0);expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it("ledger failure rolls back selected rows and durable proposal together",async()=>{
        const f=await fixture(),fetcher=vi.fn<typeof fetch>(async()=>reply(f.run.protocol,[call("audio_select_takes",{chapterId:f.chapter.id,choices:f.choices},"atomic")]));
        await executeChatRun(f.run,connector.apiKey,new AbortController(),fetcher);const item=await pending(f.run);
        await resolveAgentToolApproval(f.run.id,item.id,"approve");
        const original=db.agentToolCalls.update.bind(db.agentToolCalls);let failed=false;
        const fault=vi.spyOn(db.agentToolCalls,"update").mockImplementation(async(...args)=>{
            const patch=args[1];
            if(!failed && "status" in patch && patch.status === "completed") {failed=true;throw new Error("ledger unavailable");}
            return original(...args);
        });
        try {await resumeChatRun(f.run.id,connector.apiKey,new AbortController(),withFinalReviewFixture(async()=>reply(f.run.protocol)));} finally {fault.mockRestore();}
        expect(failed).toBe(true);expect((await db.audioSegments.toArray()).every(row=>!row.selectedTakeId)).toBe(true);expect(await db.audioArrangementProposals.count()).toBe(0);expect((await db.agentToolCalls.get(item.id))?.status).toBe("failed");
    });
});
