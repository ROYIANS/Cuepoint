import {describe,expect,it,vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {addAudioChapter,addAudioClip,addAudioSegment,addAudioTake,deleteAudioChapter,deleteAudioClip,getAudioProjectSnapshot,patchAudioClip,patchAudioSegment,patchAudioTrack} from "@/db/audio";
import {applyAudioArrangementProposal,previewAudioArrangement,previewAudioSelection,revertAudioArrangementProposal,saveAudioArrangementProposal} from "@/db/audioArrangement";
import {deleteProject} from "@/db/cascadeCommands";
import {AudioClipHistory} from "@/lib/audio/commands";
import {planAudioArrangement} from "@/lib/audio/arrangement";
import {AudioArrangementConflictError} from "@/domain/audioArrangement";

async function fixture(count=3) {
    const project=await createAudioMusicProject("排列测试","audio");
    const initial=await getAudioProjectSnapshot(project.id), chapter=initial.chapters[0],track=initial.tracks[0];
    const segments=[],takes=[];
    for(let i=0;i<count;i++) {
        const segment=await addAudioSegment(project.id,{chapterId:chapter.id,text:`第${i}段`,notes:"",order:count-i});
        const mediaId=`media-${i}`;
        await db.media.add({id:mediaId,projectId:project.id,filename:`${i}.wav`,mimeType:"audio/wav",blob:new Blob(["bytes"],{type:"audio/wav"})});
        const take=await addAudioTake(project.id,{segmentId:segment.id,mediaId,name:`声音${i}`,source:"upload",durationSec:1.125+i,sampleRate:48000,channels:1,textSnapshot:segment.text});
        segments.push(await patchAudioSegment(project.id,segment.id,segment.revision,{selectedTakeId:take.id}));takes.push(take);
    }
    return {project,chapter,track,segments,takes};
}
const saved = async <T extends Awaited<ReturnType<typeof previewAudioArrangement>>>(proposal:T) => {await saveAudioArrangementProposal(proposal);return proposal;};

describe("reviewed audio selection and arrangement",()=>{
    it("plans fractional decoded durations, source trims, manuscript order and gap without text estimates",async()=>{
        const f=await fixture(),snap=await getAudioProjectSnapshot(f.project.id);
        const items=planAudioArrangement({projectId:f.project.id,chapterId:f.chapter.id,proposalId:"stable",at:"at",request:{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id,startSec:4,gapSec:.25,trims:[{segmentId:f.segments[2].id,startSec:.5,endSec:2}]},...snap});
        expect(items.map(row=>[row.segmentId,row.clip?.startSec,row.durationSec])).toEqual([[f.segments[2].id,4,1.5],[f.segments[1].id,5.75,2.125],[f.segments[0].id,8.125,1.125]]);
        expect(items[0].clip).toMatchObject({trimStartSec:.5,trimEndSec:2});
        expect(planAudioArrangement({projectId:f.project.id,chapterId:f.chapter.id,proposalId:"stable",at:"at",request:{segmentIds:[f.segments[0].id],trackId:f.track.id},...snap})[0].clip?.id).toBe(planAudioArrangement({projectId:f.project.id,chapterId:f.chapter.id,proposalId:"stable",at:"at",request:{segmentIds:[f.segments[0].id],trackId:f.track.id},...snap})[0].clip?.id);
    });
    it("selection is all-or-none, discloses script mismatch, and never places a clip",async()=>{
        const f=await fixture();
        const take=await addAudioTake(f.project.id,{...f.takes[0],segmentId:f.segments[0].id,name:"旧稿版本",textSnapshot:"不同文本"});
        const choices=[{segmentId:f.segments[0].id,segmentRevision:f.segments[0].revision,takeId:take.id,takeRevision:take.revision}];
        const proposal=await saved(await previewAudioSelection(f.project.id,f.chapter.id,choices));
        expect(proposal.selections[0].textMismatch).toBe(true);
        const result=await applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision);
        expect(result.selected).toHaveLength(1);expect(await db.audioClips.count()).toBe(0);
        const current=(await db.audioSegments.get(f.segments[0].id))!;
        const noOp=await saved(await previewAudioSelection(f.project.id,f.chapter.id,[{...choices[0],segmentRevision:current.revision}]));
        expect((await applyAudioArrangementProposal(f.project.id,noOp.id,noOp.revision)).selected).toHaveLength(0);
        expect(await db.audioSegments.get(current.id)).toEqual(current);
        await expect(previewAudioSelection(f.project.id,f.chapter.id,[{...choices[0],segmentRevision:current.revision},{segmentId:f.segments[1].id,segmentRevision:f.segments[1].revision,takeId:take.id,takeRevision:take.revision}])).rejects.toThrow("不属于");
        expect(await db.audioSegments.get(current.id)).toEqual(current);
    });
    it("appends missing voices, preserving manual rows and revisions, and repeat never duplicates",async()=>{
        const f=await fixture();
        const manual=await addAudioClip(f.project.id,{chapterId:f.chapter.id,trackId:f.track.id,takeId:f.takes[0].id,startSec:12,trimStartSec:.125,trimEndSec:1,gain:.4,fadeInSec:.1,fadeOutSec:.2});
        const proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id,gapSec:.25}));
        expect(proposal.items.find(row=>row.segmentId===f.segments[0].id)?.status).toBe("already_placed");
        expect(proposal.items[0].clip?.startSec).toBe(12.875);
        const result=await applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision);
        expect(result).toMatchObject({preserved:1,conflicts:0});expect(result.added).toHaveLength(2);
        expect(await db.audioClips.get(manual.id)).toEqual(manual);
        const replay=await applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision);
        expect(replay.replayed).toBe(true);expect(await db.audioClips.count()).toBe(3);
        const repeated=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id}));
        expect((await applyAudioArrangementProposal(f.project.id,repeated.id,repeated.revision)).added).toHaveLength(0);
        expect(await db.audioClips.get(manual.id)).toEqual(manual);
    });
    it("retains other versions and split/manual placements as conflicts instead of duplicating",async()=>{
        const f=await fixture(1);
        const other=await addAudioTake(f.project.id,{...f.takes[0],name:"手动版本"});
        const clip=await addAudioClip(f.project.id,{chapterId:f.chapter.id,trackId:f.track.id,takeId:other.id,startSec:3,trimStartSec:0,trimEndSec:1,gain:1,fadeInSec:0,fadeOutSec:0});
        const proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:[f.segments[0].id],trackId:f.track.id}));
        expect(proposal.items[0]).toMatchObject({status:"manual_conflict",preservedClipIds:[clip.id]});
        expect(await applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision)).toMatchObject({added:[],conflicts:1,preserved:1});
        expect(await db.audioClips.get(clip.id)).toEqual(clip);
    });
    it.each(["clip_add","clip_edit","selection","track","media"])("rejects a stale preview after %s with no partial insertion",async(change)=>{
        const f=await fixture();
        const existing=await addAudioClip(f.project.id,{chapterId:f.chapter.id,trackId:f.track.id,takeId:f.takes[0].id,startSec:2,trimStartSec:0,trimEndSec:1,gain:1,fadeInSec:0,fadeOutSec:0});
        const proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id}));
        if(change==="clip_add") await addAudioClip(f.project.id,{...existing,takeId:f.takes[1].id});
        if(change==="clip_edit") await patchAudioClip(f.project.id,existing.id,existing.revision,{gain:.2});
        if(change==="selection") await patchAudioSegment(f.project.id,f.segments[1].id,f.segments[1].revision,{selectedTakeId:undefined});
        if(change==="track") await patchAudioTrack(f.project.id,f.track.id,f.track.revision,{gain:.6});
        if(change==="media") await db.media.delete(f.takes[1].mediaId);
        const before=await db.audioClips.toArray();
        await expect(applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision)).rejects.toThrow("改变");
        await expect(applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision)).rejects.toBeInstanceOf(AudioArrangementConflictError);
        expect(await db.audioClips.toArray()).toEqual(before);expect((await db.audioArrangementProposals.get(proposal.id))?.state).toBe("prepared");
    });
    it("records one guarded undo/redo group, preserving original rows and media",async()=>{
        const f=await fixture(),history=new AudioClipHistory(f.project.id,f.chapter.id);
        const manual=await addAudioClip(f.project.id,{chapterId:f.chapter.id,trackId:f.track.id,takeId:f.takes[0].id,startSec:8,trimStartSec:0,trimEndSec:1,gain:.7,fadeInSec:0,fadeOutSec:0});
        const proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id}));
        const result=await history.applyArrangement(()=>applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision));
        await history.undo();expect(await db.audioClips.toArray()).toEqual([manual]);
        const old=await applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision);
        expect(old.currentAddedIds).toEqual([]);expect(await db.audioClips.count()).toBe(1);
        await history.redo();expect(await db.audioClips.get(manual.id)).toEqual(manual);
        expect((await db.audioClips.toArray()).map(row=>row.id).sort()).toEqual(result.after.map(row=>row.id).sort());
        expect(await db.media.count()).toBe(3);expect(await db.audioTakes.count()).toBe(3);
        const changed=result.added[0];await patchAudioClip(f.project.id,changed.id,changed.revision,{startSec:40});
        await expect(history.undo()).rejects.toThrow("其他操作修改");
        expect((await db.audioClips.get(changed.id))?.startSec).toBe(40);
    });
    it("supports durable exact revert after reload and never resurrects a deleted addition",async()=>{
        const f=await fixture(1),proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:[f.segments[0].id],trackId:f.track.id}));
        const result=await applyAudioArrangementProposal(f.project.id,proposal.id,proposal.revision);
        db.close();await db.open();
        await revertAudioArrangementProposal(f.project.id,proposal.id,2);
        expect(await db.audioClips.count()).toBe(0);expect((await db.audioSegments.get(f.segments[0].id))?.selectedTakeId).toBe(f.takes[0].id);
        await applyAudioArrangementProposal(f.project.id,proposal.id,1);expect(await db.audioClips.count()).toBe(0);
        await expect(revertAudioArrangementProposal(f.project.id,proposal.id,3)).rejects.toThrow("不能撤销");
        const next=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:[f.segments[0].id],trackId:f.track.id}));
        const added=(await applyAudioArrangementProposal(f.project.id,next.id,1)).added[0];
        await deleteAudioClip(f.project.id,added.id,added.revision);
        await applyAudioArrangementProposal(f.project.id,next.id,1);expect(await db.audioClips.count()).toBe(0);expect(result.added[0].id).not.toBe(added.id);
    });
    it("keeps insertion groups compatible with sequential manual edit undo and redo",async()=>{
        const f=await fixture(2),history=new AudioClipHistory(f.project.id,f.chapter.id);
        const proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id}));
        const receipt=await history.applyArrangement(()=>applyAudioArrangementProposal(f.project.id,proposal.id,1));
        await history.executePatch(receipt.added[0],{startSec:50});
        await history.undo();await history.undo();expect(await db.audioClips.count()).toBe(0);
        await history.redo();expect((await db.audioClips.get(receipt.added[0].id))?.startSec).toBe(receipt.added[0].startSec);
        await history.redo();expect((await db.audioClips.get(receipt.added[0].id))?.startSec).toBe(50);
        expect(await db.audioTakes.count()).toBe(2);expect(await db.media.count()).toBe(2);
    });
    it("rolls back insertions if final proposal persistence fails",async()=>{
        const f=await fixture(),proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id}));
        const fault=vi.spyOn(db.audioArrangementProposals,"put").mockRejectedValueOnce(new Error("disk full"));
        try {await expect(applyAudioArrangementProposal(f.project.id,proposal.id,1)).rejects.toThrow("disk full");} finally {fault.mockRestore();}
        expect(await db.audioClips.count()).toBe(0);expect((await db.audioArrangementProposals.get(proposal.id))?.state).toBe("prepared");
    });
    it("rejects dormant history, wrong owners, missing selection/media and invalid limits",async()=>{
        const f=await fixture(),request={segmentIds:f.segments.map(row=>row.id),trackId:f.track.id};
        const proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,request));
        await expect(applyAudioArrangementProposal(f.project.id,proposal.id,1,{type:"agent",threadId:"x",runId:"x",callId:"x"})).rejects.toThrow("其他执行");
        await db.audioArrangementProposals.update(proposal.id,{dormant:true});
        await expect(applyAudioArrangementProposal(f.project.id,proposal.id,1)).rejects.toThrow("导入历史");
        await expect(previewAudioArrangement(f.project.id,f.chapter.id,{...request,segmentIds:[f.segments[0].id,f.segments[0].id]})).rejects.toThrow("不同段落");
        await expect(previewAudioArrangement(f.project.id,f.chapter.id,{...request,gapSec:301})).rejects.toThrow("时间");
        await expect(previewAudioArrangement(f.project.id,f.chapter.id,{...request,trims:[{segmentId:f.segments[0].id,startSec:0,endSec:40}]})).rejects.toThrow("裁剪");
        await patchAudioSegment(f.project.id,f.segments[1].id,f.segments[1].revision,{selectedTakeId:undefined});
        await expect(previewAudioArrangement(f.project.id,f.chapter.id,request)).rejects.toThrow("先明确选用");
    });
    it("cascades chapter and project proposal history",async()=>{
        const f=await fixture(),proposal=await saved(await previewAudioArrangement(f.project.id,f.chapter.id,{segmentIds:f.segments.map(row=>row.id),trackId:f.track.id}));
        await addAudioChapter(f.project.id,{title:"保留章节",order:2});await deleteAudioChapter(f.project.id,f.chapter.id,f.chapter.revision);
        expect(await db.audioArrangementProposals.get(proposal.id)).toBeUndefined();
        await expect(applyAudioArrangementProposal(f.project.id,proposal.id,1)).rejects.toThrow("记录不存在");
        await deleteProject(f.project.id);expect(await db.audioArrangementProposals.count()).toBe(0);
    });
});
