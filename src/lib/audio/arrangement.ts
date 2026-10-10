import type {AudioClip, AudioSegment, AudioTake, AudioTrack} from "@/domain/audio";
import {AUDIO_ARRANGEMENT_LIMIT, type AudioArrangementItem, type AudioArrangementRequest} from "@/domain/audioArrangement";
import {targetRevision} from "@/lib/productionRevision";

function validSeconds(value: number, max = 86400) {
    if (!Number.isFinite(value) || value < 0 || value > max) throw new Error("时间超出有效范围");
}
/** Deterministic append-only plan. Existing clips are never changed by planning. */
export function planAudioArrangement(input: {
    projectId: string; chapterId: string; proposalId: string; at: string;
    request: AudioArrangementRequest; segments: AudioSegment[]; takes: AudioTake[]; tracks: AudioTrack[]; clips: AudioClip[];
}): AudioArrangementItem[] {
    const {request} = input;
    if (!request.segmentIds.length || request.segmentIds.length > AUDIO_ARRANGEMENT_LIMIT || new Set(request.segmentIds).size !== request.segmentIds.length) throw new Error("每次请选择 1–20 个不同段落");
    const track = input.tracks.find(row => row.id === request.trackId && row.projectId === input.projectId && row.chapterId === input.chapterId);
    if (!track || track.role !== "voice") throw new Error("请选择当前章节的现有人声音轨");
    const gap = request.gapSec ?? 0;
    validSeconds(gap, 300);
    const trims = request.trims ?? [];
    if (new Set(trims.map(row => row.segmentId)).size !== trims.length || trims.some(row => !request.segmentIds.includes(row.segmentId))) throw new Error("裁剪段落无效或重复");
    let cursor = request.startSec ?? Math.max(0, ...input.clips.filter(row => row.trackId === track.id).map(row => row.startSec + row.trimEndSec - row.trimStartSec));
    validSeconds(cursor);
    const segments = request.segmentIds.map(id => {
        const segment = input.segments.find(row => row.id === id && row.projectId === input.projectId && row.chapterId === input.chapterId);
        if (!segment) throw new Error("段落不存在或不属于当前章节");
        return segment;
    }).sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
    let additions = 0;
    return segments.map(segment => {
        const take = input.takes.find(row => row.id === segment.selectedTakeId && row.projectId === input.projectId && row.segmentId === segment.id);
        if (!take) throw new Error("请先明确选用每个段落的声音版本");
        if (!Number.isFinite(take.durationSec) || take.durationSec <= 0) throw new Error("声音缺少真实有效时长");
        const trim = trims.find(row => row.segmentId === segment.id);
        const trimStartSec = trim?.startSec ?? 0, trimEndSec = trim?.endSec ?? take.durationSec;
        validSeconds(trimStartSec); validSeconds(trimEndSec);
        if (trimEndSec > take.durationSec || trimEndSec <= trimStartSec) throw new Error("裁剪范围超出来源声音");
        const linkedTakes = new Set(input.takes.filter(row => row.segmentId === segment.id).map(row => row.id));
        const existing = input.clips.filter(row => row.chapterId === input.chapterId && linkedTakes.has(row.takeId));
        const status = existing.length ? existing.length === 1 && existing[0].takeId === take.id ? "already_placed" : "manual_conflict" : "add";
        const item: AudioArrangementItem = {segmentId: segment.id, takeId: take.id, text: segment.text.slice(0,300), takeName: take.name.slice(0,300), textMismatch: take.textSnapshot !== undefined && take.textSnapshot !== segment.text, durationSec: trimEndSec-trimStartSec, status, preservedClipIds: existing.map(row => row.id).sort()};
        if (status === "add") {
            if (additions++) cursor += gap;
            validSeconds(cursor + item.durationSec);
            item.clip = {id: `acl_${targetRevision([input.proposalId, segment.id]).slice(10)}`, projectId: input.projectId, chapterId: input.chapterId, trackId: track.id, takeId: take.id, startSec: cursor, trimStartSec, trimEndSec, gain: 1, fadeInSec: 0, fadeOutSec: 0, revision: 1, createdAt: input.at, updatedAt: input.at};
            cursor += item.durationSec;
        }
        return item;
    });
}
