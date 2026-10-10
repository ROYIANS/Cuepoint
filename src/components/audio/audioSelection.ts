import type {AudioProjectSnapshot, AudioSegment, AudioTake} from "@/domain/audio";

export interface AudioSelectionState {
    chapterId: string;
    segmentId: string;
    takeId: string;
    clipId: string
}

export type AudioSelectionIntent = { kind: "segment"; row: AudioSegment } | { kind: "clip"; id: string } | {
    kind: "take";
    id: string
} | { kind: "saved"; take: AudioTake };

interface AudioSelectionResult {
    patch: Partial<AudioSelectionState>;
    seek?: { clipId: string; position: number }
}

function selectionForSegment(snapshot: AudioProjectSnapshot, previous: AudioSelectionState, row: AudioSegment): AudioSelectionResult {
    if (previous.segmentId === row.id) return {patch: {segmentId: row.id}};
    const takes = snapshot.takes.filter(take => take.segmentId === row.id);
    const adopted = takes.find(take => take.id === row.selectedTakeId) ?? takes.at(-1);
    const clip = snapshot.clips.find(item => item.chapterId === row.chapterId && item.takeId === adopted?.id)
        ?? snapshot.clips.find(item => item.chapterId === row.chapterId && takes.some(take => take.id === item.takeId));
    return {
        patch: {segmentId: row.id, takeId: adopted?.id ?? "", clipId: clip?.id ?? ""},
        seek: clip ? {clipId: clip.id, position: clip.startSec} : undefined
    };
}

function selectionForClip(snapshot: AudioProjectSnapshot, id: string): AudioSelectionResult {
    const clip = snapshot.clips.find(row => row.id === id);
    const take = snapshot.takes.find(row => row.id === clip?.takeId);
    return {patch: {clipId: id, ...(take ? {takeId: take.id, segmentId: take.segmentId ?? ""} : {})}};
}

function selectionForTake(snapshot: AudioProjectSnapshot, chapterId: string, id: string): AudioSelectionResult {
    const take = snapshot.takes.find(row => row.id === id);
    const owner = snapshot.segments.find(row => row.id === take?.segmentId);
    const clip = snapshot.clips.find(row => row.takeId === id && row.chapterId === (owner?.chapterId ?? chapterId));
    return {
        patch: {
            takeId: id,
            segmentId: owner?.id ?? "",
            clipId: clip?.id ?? "", ...(owner ? {chapterId: owner.chapterId} : {})
        },
        seek: clip ? {clipId: clip.id, position: clip.startSec} : undefined
    };
}

function selectionForSavedTake(snapshot: AudioProjectSnapshot, take: AudioTake): AudioSelectionResult {
    const owner = snapshot.segments.find(row => row.id === take.segmentId);
    return {
        patch: {
            takeId: take.id,
            clipId: "",
            segmentId: take.segmentId ?? "", ...(owner ? {chapterId: owner.chapterId} : {})
        }
    };
}

export function deriveAudioSelection(snapshot: AudioProjectSnapshot, previous: AudioSelectionState, intent: AudioSelectionIntent): AudioSelectionResult {
    switch (intent.kind) {
        case "segment":
            return selectionForSegment(snapshot, previous, intent.row);
        case "clip":
            return selectionForClip(snapshot, intent.id);
        case "take":
            return selectionForTake(snapshot, previous.chapterId, intent.id);
        case "saved":
            return selectionForSavedTake(snapshot, intent.take);
    }
}
