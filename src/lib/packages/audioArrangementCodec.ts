import {z} from "zod";
import type {AudioClip, AudioSegment, AudioTake} from "@/domain/audio";
import type {AudioArrangementProposal} from "@/domain/audioArrangement";

/** Reuse the audio package's row allowlists; execution ownership never enters a ZIP. */
export function createAudioArrangementPackageSchema(rows: {segment: z.ZodType<AudioSegment>; take: z.ZodType<AudioTake>; clip: z.ZodType<AudioClip>}) {
    const id = z.string().min(1), number = z.number().finite();
    const choice = z.object({segmentId:id,segmentRevision:number.int().positive(),takeId:id,takeRevision:number.int().positive()});
    return z.object({
        id,projectId:id,chapterId:id,revision:number.int().positive(),createdAt:z.string(),updatedAt:z.string(),
        kind:z.enum(["selection","arrangement"]),state:z.enum(["prepared","applied"]),owner:z.object({type:z.literal("manual")}),dormant:z.literal(true),fingerprint:z.string(),
        choices:z.array(choice).max(20),
        request:z.object({segmentIds:z.array(id).max(20),trackId:id,gapSec:number.optional(),startSec:number.optional(),trims:z.array(z.object({segmentId:id,startSec:number,endSec:number})).max(20).optional()}).optional(),
        selections:z.array(z.object({segment:rows.segment,take:rows.take,textMismatch:z.boolean()})).max(20),
        items:z.array(z.object({segmentId:id,takeId:id,text:z.string(),takeName:z.string(),textMismatch:z.boolean(),durationSec:number.positive(),status:z.enum(["add","already_placed","manual_conflict"]),preservedClipIds:z.array(id),clip:rows.clip.optional()})).max(20),
        before:z.array(rows.clip),
        receipt:z.object({proposalId:id,projectId:id,kind:z.enum(["selection","arrangement"]),selected:z.array(rows.segment).max(20),added:z.array(rows.clip).max(20),preserved:number.int().nonnegative(),conflicts:number.int().nonnegative(),before:z.array(rows.clip),after:z.array(rows.clip),replayed:z.boolean().optional(),currentAddedIds:z.array(id).optional()}).optional(),
        reverted:z.boolean().optional(),
    });
}

export function sanitizeAudioArrangementHistory(rows: AudioArrangementProposal[]) {
    return rows.map(row => ({...row, owner:{type:"manual" as const}, dormant:true as const, fingerprint:"historical"}));
}

/** Missing snapshots reference historical identities; they are not revived as live records. */
export function remapAudioArrangementHistory(row: AudioArrangementProposal, input: {projectId:string; historical:(id:string)=>string; media:(id:string)=>string | undefined}): AudioArrangementProposal {
    const h = input.historical;
    const segment = (value:AudioSegment):AudioSegment => ({...value,id:h(value.id),projectId:input.projectId,chapterId:h(value.chapterId),speakerId:value.speakerId ? h(value.speakerId) : undefined,selectedTakeId:value.selectedTakeId ? h(value.selectedTakeId) : undefined});
    const take = (value:AudioTake):AudioTake => ({...value,id:h(value.id),projectId:input.projectId,segmentId:value.segmentId ? h(value.segmentId) : undefined,mediaId:input.media(value.mediaId) ?? h(value.mediaId),provenance:value.provenance ? {...value.provenance,jobId:value.provenance.jobId ? h(value.provenance.jobId) : undefined} : undefined});
    const clip = (value:AudioClip):AudioClip => ({...value,id:h(value.id),projectId:input.projectId,chapterId:h(value.chapterId),trackId:h(value.trackId),takeId:h(value.takeId)});
    return {...row,id:h(row.id),projectId:input.projectId,chapterId:h(row.chapterId),owner:{type:"manual"},dormant:true,fingerprint:"historical",
        choices:row.choices.map(value => ({...value,segmentId:h(value.segmentId),takeId:h(value.takeId)})),
        request:row.request ? {...row.request,segmentIds:row.request.segmentIds.map(h),trackId:h(row.request.trackId),trims:row.request.trims?.map(value => ({...value,segmentId:h(value.segmentId)}))} : undefined,
        selections:row.selections.map(value => ({...value,segment:segment(value.segment),take:take(value.take)})),
        items:row.items.map(value => ({...value,segmentId:h(value.segmentId),takeId:h(value.takeId),preservedClipIds:value.preservedClipIds.map(h),clip:value.clip ? clip(value.clip) : undefined})),
        before:row.before.map(clip),
        receipt:row.receipt ? {...row.receipt,proposalId:h(row.receipt.proposalId),projectId:input.projectId,selected:row.receipt.selected.map(segment),added:row.receipt.added.map(clip),before:row.receipt.before.map(clip),after:row.receipt.after.map(clip),currentAddedIds:row.receipt.currentAddedIds?.map(h)} : undefined,
    };
}
