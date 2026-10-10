import {describe,expect,it} from "vitest";
import JSZip from "jszip";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {addAudioSegment,addAudioTake,deleteAudioTake,getAudioProjectSnapshot,patchAudioSegment} from "@/db/audio";
import {applyAudioArrangementProposal,previewAudioArrangement,previewAudioSelection,revertAudioArrangementProposal,saveAudioArrangementProposal} from "@/db/audioArrangement";
import {exportProjectZip,importProjectZip} from "@/lib/projectPackage";
import {snapshotAudioPackage} from "@/lib/audioProjectPackage";
import {parseAudioPackageData} from "@/lib/packages/audioPackageCodec";

async function fixture() {
    const project=await createAudioMusicProject("历史导出","audio"),snap=await getAudioProjectSnapshot(project.id),chapter=snap.chapters[0],track=snap.tracks[0];
    const segment=await addAudioSegment(project.id,{chapterId:chapter.id,text:"你好",notes:"",order:0}),mediaId="history-source";
    await db.media.add({id:mediaId,projectId:project.id,filename:"source.wav",mimeType:"audio/wav",blob:new Blob(["source"],{type:"audio/wav"})});
    const take=await addAudioTake(project.id,{segmentId:segment.id,mediaId,name:"版本",source:"upload",durationSec:1.75,sampleRate:48000,channels:1});
    const selected=await patchAudioSegment(project.id,segment.id,segment.revision,{selectedTakeId:take.id});
    const proposal=await previewAudioArrangement(project.id,chapter.id,{segmentIds:[segment.id],trackId:track.id}, {type:"agent",threadId:"private-thread",runId:"private-run",callId:"private-call"});
    await saveAudioArrangementProposal(proposal);
    const receipt=await applyAudioArrangementProposal(project.id,proposal.id,1,proposal.owner);
    return {project,chapter,track,segment:selected,take,proposal,receipt};
}
describe("dormant arrangement ZIP history",()=>{
    it("exports/imports exact placement and remapped dormant proposal, stripping Agent ownership",async()=>{
        const f=await fixture(),zip=await exportProjectZip(f.project.id),loaded=await JSZip.loadAsync(zip);
        const jsonNames=Object.keys(loaded.files).filter(name=>name.endsWith(".json"));
        const text=(await Promise.all(jsonNames.map(name=>loaded.files[name].async("string")))).join("\n");
        expect(text).not.toMatch(/private-thread|private-run|private-call/);
        const imported=await importProjectZip(zip),snapshot=await getAudioProjectSnapshot(imported.id),rows=await db.audioArrangementProposals.where("projectId").equals(imported.id).toArray();
        expect(rows).toHaveLength(1);const row=rows[0];
        expect(row).toMatchObject({dormant:true,owner:{type:"manual"},state:"applied"});expect(row.id).not.toBe(f.proposal.id);
        expect(row.receipt?.proposalId).toBe(row.id);expect(row.items[0].segmentId).toBe(snapshot.segments[0].id);expect(row.items[0].takeId).toBe(snapshot.takes[0].id);expect(row.items[0].clip?.id).toBe(snapshot.clips[0].id);
        expect(snapshot.clips[0]).toMatchObject({startSec:0,trimStartSec:0,trimEndSec:1.75});
        await expect(applyAudioArrangementProposal(imported.id,row.id,row.revision)).rejects.toThrow("导入历史");await expect(revertAudioArrangementProposal(imported.id,row.id,row.revision)).rejects.toThrow("不能撤销");
        expect((await getAudioProjectSnapshot(f.project.id)).clips).toEqual(f.receipt.added);
    });
    it("retains deleted take snapshots as remapped history without reviving media or clips",async()=>{
        const f=await fixture();await revertAudioArrangementProposal(f.project.id,f.proposal.id,2);
        const selection=await previewAudioSelection(f.project.id,f.chapter.id,[{segmentId:f.segment.id,segmentRevision:f.segment.revision,takeId:f.take.id,takeRevision:f.take.revision}]);await saveAudioArrangementProposal(selection);
        await patchAudioSegment(f.project.id,f.segment.id,f.segment.revision,{selectedTakeId:undefined});await deleteAudioTake(f.project.id,f.take.id,f.take.revision);await db.media.delete(f.take.mediaId);
        const imported=await importProjectZip(await exportProjectZip(f.project.id));
        expect(await db.audioTakes.where("projectId").equals(imported.id).count()).toBe(0);expect(await db.audioClips.where("projectId").equals(imported.id).count()).toBe(0);expect(await db.media.where("projectId").equals(imported.id).count()).toBe(0);
        const history=await db.audioArrangementProposals.where("projectId").equals(imported.id).toArray();expect(history).toHaveLength(2);
        expect(history.every(row=>row.dormant)).toBe(true);expect(history.find(row=>row.kind === "selection")?.selections[0].take.id).not.toBe(f.take.id);
    });
    it("accepts older packages without proposal history and rejects live approval data at allowlist",async()=>{
        const f=await fixture(),raw=await snapshotAudioPackage(f.project.id);const {audioArrangementProposals:_,...old}=raw;
        expect(parseAudioPackageData(old).audioArrangementProposals).toEqual([]);
        expect(()=>parseAudioPackageData({...raw,audioArrangementProposals:[{...raw.audioArrangementProposals[0],dormant:false}]})).toThrow();
    });
});
