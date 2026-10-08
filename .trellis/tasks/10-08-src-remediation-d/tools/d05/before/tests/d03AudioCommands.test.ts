import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {addAudioChapter, addAudioClip, addAudioSegment, addAudioTake, getAudioProjectSnapshot, patchAudioSegment} from "@/db/audio";
import {addMusicDraft} from "@/db/music";
import {defaultMusicSettings} from "@/domain/music";
import {deriveAudioSelection} from "@/components/audio/audioSelection";
import {switchMusicVariant} from "@/components/music/switchMusicVariant";
import {exportAudioMix} from "@/lib/audio/exportMix";
import {loadAudioBuffer} from "@/lib/audio/buffers";
import {getAudioExportFreshness} from "@/lib/audio/fingerprint";
import {registerPendingDraft} from "@/lib/debouncedDraft";
import Dexie from "dexie";

const audio = vi.hoisted(() => ({decode: vi.fn(), render: vi.fn()}));
vi.mock("@/lib/audio/engine", async original => ({...await original<typeof import("@/lib/audio/engine")>(),
    decodeAudioBlob: audio.decode, renderAudioMix: audio.render}));

async function fixture() {
    const project = await createAudioMusicProject("D03 audio", "audio");
    const initial = await getAudioProjectSnapshot(project.id);
    const chapter = initial.chapters[0];
    const segment = await addAudioSegment(project.id, {chapterId: chapter.id, order: 0, text: "voice", notes: ""});
    const take = await addAudioTake(project.id, {mediaId: "d03-source", name: "voice", source: "upload", segmentId: segment.id,
        durationSec: 1, sampleRate: 48000, channels: 1}, {id: "d03-source", projectId: project.id, filename: "voice.wav", mimeType: "audio/wav", blob: new Blob(["source"])});
    const clip = await addAudioClip(project.id, {chapterId: chapter.id, trackId: initial.tracks[0].id, takeId: take.id,
        startSec: 2, trimStartSec: 0, trimEndSec: 1, gain: 1, fadeInSec: 0, fadeOutSec: 0});
    return {project, chapter, segment, take, clip};
}

describe("D03 selection and audio commands", () => {
    it("keeps repeated segment selection and missing clip asymmetric, while take/saved select owner", async () => {
        const {project, chapter, segment, take, clip} = await fixture();
        const other = await addAudioChapter(project.id, {title: "other", order: 1});
        const snapshot = await getAudioProjectSnapshot(project.id);
        const previous = {chapterId: other.id, segmentId: segment.id, takeId: "keep", clipId: "keep"};
        expect(deriveAudioSelection(snapshot, previous, {kind: "segment", row: segment})).toEqual({patch: {segmentId: segment.id}});
        expect(deriveAudioSelection(snapshot, previous, {kind: "clip", id: "missing"})).toEqual({patch: {clipId: "missing"}});
        expect(deriveAudioSelection(snapshot, previous, {kind: "clip", id: clip.id})).toEqual({patch: {clipId: clip.id, takeId: take.id, segmentId: segment.id}});
        expect(deriveAudioSelection(snapshot, previous, {kind: "take", id: take.id})).toEqual({patch: {chapterId: chapter.id, takeId: take.id, segmentId: segment.id, clipId: clip.id}, seek: {clipId: clip.id, position: 2}});
        expect(deriveAudioSelection(snapshot, previous, {kind: "take", id: "missing"})).toEqual({patch: {takeId: "missing", segmentId: "", clipId: ""}, seek: undefined});
        expect(deriveAudioSelection(snapshot, previous, {kind: "saved", take})).toEqual({patch: {chapterId: chapter.id, takeId: take.id, segmentId: segment.id, clipId: ""}});
    });
    it("chooses an adopted segment take before the last candidate, while placement fallback can seek another take", async () => {
        const {project, chapter, segment, take, clip} = await fixture();
        const latest = await addAudioTake(project.id, {mediaId: "d03-latest", name: "latest", source: "upload", segmentId: segment.id,
            durationSec: 1, sampleRate: 48000, channels: 1}, {id: "d03-latest", projectId: project.id, filename: "latest.wav", mimeType: "audio/wav", blob: new Blob(["latest"])});
        const previous = {chapterId: chapter.id, segmentId: "", takeId: "", clipId: ""};
        // The selector preserves input order; Dexie primary-key order is not creation order.
        const snapshot = {...await getAudioProjectSnapshot(project.id), takes: [take, latest]};
        expect(deriveAudioSelection(snapshot, previous, {kind: "segment", row: segment})).toEqual({
            patch: {segmentId: segment.id, takeId: latest.id, clipId: clip.id}, seek: {clipId: clip.id, position: clip.startSec}});
        const adopted = await patchAudioSegment(project.id, segment.id, segment.revision, {selectedTakeId: take.id});
        expect(deriveAudioSelection(snapshot, previous, {kind: "segment", row: adopted})).toEqual({
            patch: {segmentId: segment.id, takeId: take.id, clipId: clip.id}, seek: {clipId: clip.id, position: clip.startSec}});
        expect(deriveAudioSelection(snapshot, previous, {kind: "saved", take: {...latest, segmentId: "unavailable"}})).toEqual({
            patch: {takeId: latest.id, segmentId: "unavailable", clipId: ""}});
    });
    it("flushes before snapshot, shares decoded buffers, renders outside writes and saves current export evidence", async () => {
        const {project, chapter, segment} = await fixture();
        const decoded = {numberOfChannels: 1, sampleRate: 48000, length: 48000, duration: 1};
        audio.decode.mockImplementation(async () => {expect(Dexie.currentTransaction).toBeNull(); return decoded;});
        audio.render.mockImplementation(async (schedule, buffers) => {
            expect(Dexie.currentTransaction).toBeNull();
            expect(schedule.sources[0].textSnapshot).toBeUndefined();
            expect(buffers.get("d03-source")).toBe(decoded);
            return {blob: new Blob(["rendered"]), durationSec: 3, attenuation: .5, attenuationDb: -6};
        });
        const dispose = registerPendingDraft(project.id, async () => {
            expect(Dexie.currentTransaction).toBeNull();
            const current = await db.audioSegments.get(segment.id);
            await patchAudioSegment(project.id, segment.id, current!.revision, {text: "flushed"});
        });
        try {
            await loadAudioBuffer("d03-source");
            const result = await exportAudioMix({projectId: project.id, projectName: project.name, chapterId: chapter.id, scope: "chapter"});
            expect(result.filename).toBe(`${project.name}-${chapter.title}.wav`);
            expect(await result.blob.text()).toBe("rendered");
            expect(audio.decode).toHaveBeenCalledTimes(1);
            expect((await db.audioSegments.get(segment.id))?.text).toBe("flushed");
            const row = await db.audioExports.where("projectId").equals(project.id).first();
            expect(row).toMatchObject({scope: "chapter", chapterId: chapter.id, durationSec: 3});
            expect(getAudioExportFreshness(row!, await getAudioProjectSnapshot(project.id))).toBe("current");
        } finally {dispose();}
    });
    it("does not save partial export evidence when rendering fails", async () => {
        const {project, chapter} = await fixture();
        audio.render.mockRejectedValueOnce(new Error("render failed"));
        await expect(exportAudioMix({projectId: project.id, projectName: project.name, chapterId: chapter.id, scope: "project"})).rejects.toThrow("render failed");
        expect(await db.audioExports.where("projectId").equals(project.id).count()).toBe(0);
        expect(await db.media.where("projectId").equals(project.id).count()).toBe(1);
    });
    it("reuses a legitimate music variant and refuses stale/foreign link ownership", async () => {
        const project = await createAudioMusicProject("D03 music", "music");
        const current = await db.musicDrafts.where("projectId").equals(project.id).first();
        const foreign = await createAudioMusicProject("foreign", "music");
        const wrong = await addMusicDraft(foreign.id, {settings: defaultMusicSettings("flowmusic")});
        const switched = await switchMusicVariant({projectId: project.id, draftId: current!.id, target: "flowmusic", links: {[current!.id]: {flowmusic: wrong.id}}});
        expect(switched.draftId).not.toBe(wrong.id);
        const reused = await switchMusicVariant({projectId: project.id, draftId: current!.id, target: "flowmusic", links: switched.links});
        expect(reused.draftId).toBe(switched.draftId);
        await expect(switchMusicVariant({projectId: foreign.id, draftId: current!.id, target: "flowmusic", links: {}})).rejects.toThrow("创作草稿不存在");
    });
});
