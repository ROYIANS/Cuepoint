import {describe, expect, it} from "vitest";
import JSZip from "jszip";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/repo";
import {
    addAudioChapter, addAudioClip, addAudioExport, addAudioSegment, addAudioTake, addAudioTrack,
    deleteAudioChapter, getAudioProjectSnapshot, patchAudioClip
} from "@/db/audio";
import {prepareAudioGenerationJob} from "@/db/audioGeneration";
import type {AudioExport, AudioProjectSnapshot} from "@/domain/audio";
import {buildAudioSchedule, type AudioSchedule} from "@/lib/audio/schedule";
import {createAudioExportFingerprint, getAudioExportFreshness, remapAudioExportFingerprint} from "@/lib/audio/fingerprint";
import {exportProjectZip, importProjectZip} from "@/lib/projectPackage";

type Format = "v0" | "v1";
const fingerprint = (schedule: AudioSchedule, format: Format) => format === "v0"
    ? JSON.stringify(schedule) : createAudioExportFingerprint(schedule);

async function fixture() {
    const project = await createAudioMusicProject("指纹往返", "audio");
    const initial = await getAudioProjectSnapshot(project.id);
    const job = await prepareAudioGenerationJob(project.id, {
        intentId: "fingerprint-job", input: {kind: "speech", text: "你好", voice: "alloy", speed: 1},
        connector: {id: "api", provider: "apimart", baseUrl: "https://api.apimart.ai/v1"}, source: {kind: "manual"}
    });
    const chapter = initial.chapters[0];
    const segment = await addAudioSegment(project.id, {chapterId: chapter.id, order: 0, text: "你好", notes: ""});
    const mediaId = "fingerprint-source";
    const take = await addAudioTake(project.id, {
        mediaId, segmentId: segment.id, name: "原始配音", source: "tts", textSnapshot: "你好",
        durationSec: 5.5, sampleRate: 48000, channels: 1,
        provenance: {provider: "apimart", model: "speech", jobId: job.id, taskId: "remote-task", clipId: "remote-clip", audioIndex: 1}
    }, {id: mediaId, projectId: project.id, filename: "take.wav", mimeType: "audio/wav", blob: new Blob(["source-bytes"])});
    const clip = await addAudioClip(project.id, {
        chapterId: chapter.id, trackId: initial.tracks[0].id, takeId: take.id,
        startSec: 0.5, trimStartSec: 0, trimEndSec: 5, gain: 1, fadeInSec: 0.5, fadeOutSec: 0.5
    });
    return {project, chapter, segment, take, clip, job};
}

async function save(projectId: string, label: string, format: Format, chapterId?: string, raw?: string) {
    const snapshot = await getAudioProjectSnapshot(projectId);
    const schedule = buildAudioSchedule(snapshot, chapterId);
    const mediaId = `export-${label}`;
    return addAudioExport(projectId, {
        chapterId, chapterTitle: snapshot.chapters.find(chapter => chapter.id === chapterId)?.title,
        fingerprint: raw ?? fingerprint(schedule, format), format: "wav", mediaId, durationSec: schedule.durationSec
    }, {id: mediaId, projectId, filename: `${label}.wav`, mimeType: "audio/wav", blob: new Blob([`bytes:${label}`])});
}

async function findExport(snapshot: AudioProjectSnapshot, label: string): Promise<AudioExport> {
    for (const item of snapshot.exports) {
        const media = await db.media.get(item.mediaId);
        if (media?.filename === `${label}.wav`) {
            expect(media.mimeType).toBe("audio/wav");
            expect(await media.blob.text()).toBe(`bytes:${label}`);
            return item;
        }
    }
    throw new Error(`Missing export ${label}`);
}

function parsedSchedule(value: string): AudioSchedule {
    const parsed = JSON.parse(value) as AudioSchedule | {version: 1; schedule: AudioSchedule};
    return "version" in parsed ? parsed.schedule : parsed;
}

async function roundtrip(projectId: string) {
    const imported = await importProjectZip(await exportProjectZip(projectId));
    return {projectId: imported.id, snapshot: await getAudioProjectSnapshot(imported.id)};
}

describe("C04 full-row audio export fingerprints", () => {
    it.each(["v0", "v1"] as const)("keeps %s project/chapter current and metadata/clip stale through two real ZIPs", async format => {
        const {project, chapter, take, clip, job, segment} = await fixture();
        await save(project.id, "metadata-stale-project", format);
        await save(project.id, "metadata-stale-chapter", format, chapter.id);
        // Takes are immutable through the public UI; model an existing historical
        // row metadata revision without reducing the fingerprint to acoustic fields.
        await db.audioTakes.update(take.id, {name: "新版配音", revision: take.revision + 1});
        await save(project.id, "clip-stale-project", format);
        await save(project.id, "clip-stale-chapter", format, chapter.id);
        await patchAudioClip(project.id, clip.id, clip.revision, {trimStartSec: 0.25, gain: 0.7});
        await save(project.id, "current-project", format);
        await save(project.id, "current-chapter", format, chapter.id);
        const original = await getAudioProjectSnapshot(project.id);
        const originalSource = parsedSchedule((await findExport(original, "current-project")).fingerprint).sources[0];
        expect(originalSource).toMatchObject({projectId: project.id, segmentId: segment.id, revision: 2, name: "新版配音", provenance: {jobId: job.id}});
        let projectId = project.id;
        for (let pass = 0; pass < 3; pass++) {
            const snapshot = pass === 0 ? original : (await roundtrip(projectId)).snapshot;
            projectId = snapshot.takes[0].projectId;
            for (const label of ["current-project", "current-chapter", "metadata-stale-project", "metadata-stale-chapter", "clip-stale-project", "clip-stale-chapter"]) {
                const item = await findExport(snapshot, label);
                expect(getAudioExportFreshness(item, snapshot), `${label}, pass ${pass}`).toBe(label.startsWith("current") ? "current" : "stale");
            }
            const source = snapshot.takes[0];
            expect(await (await db.media.get(source.mediaId))!.blob.text()).toBe("source-bytes");
            expect(source.durationSec).toBe(5.5);
            if (pass === 0) continue;
            expect(source.id).not.toBe(take.id);
            expect(source.projectId).not.toBe(project.id);
            expect(source.segmentId).not.toBe(segment.id);
            expect(source.provenance?.jobId).not.toBe(job.id);
            const current = await findExport(snapshot, "current-chapter");
            const mapped = parsedSchedule(current.fingerprint);
            expect(mapped.sources[0]).toEqual(source);
            expect(mapped.clips[0]).toMatchObject({clipId: snapshot.clips[0].id, mediaId: source.mediaId});
            expect(Object.keys(mapped.chapterOffsets)).toEqual([current.chapterId]);
            expect(source.provenance).toMatchObject({taskId: "remote-task", clipId: "remote-clip", audioIndex: 1});
        }
    });

    it.each(["name", "revision"] as const)("does not erase a stale verdict caused only by source %s", async field => {
        const {project, take} = await fixture();
        await save(project.id, "stale", "v0");
        await db.audioTakes.update(take.id, field === "name" ? {name: "另一个名字"} : {revision: take.revision + 1});
        let projectId = project.id;
        for (let pass = 0; pass < 2; pass++) {
            const imported = await roundtrip(projectId);
            expect(getAudioExportFreshness(await findExport(imported.snapshot, "stale"), imported.snapshot)).toBe("stale");
            projectId = imported.projectId;
        }
    });

    it("preserves deleted chapter scope/title and missing chapter/clip IDs across two ZIPs", async () => {
        const {project, chapter, take} = await fixture();
        const removed = await addAudioChapter(project.id, {title: "已删除章节", order: 1});
        const track = await addAudioTrack(project.id, {chapterId: removed.id, role: "music", name: "配乐", order: 0, gain: 1, muted: false, solo: false});
        const detached = await addAudioTake(project.id, {...take, segmentId: undefined, name: "无台词素材"});
        const clip = await addAudioClip(project.id, {chapterId: removed.id, trackId: track.id, takeId: detached.id, startSec: 0, trimStartSec: 0, trimEndSec: 5, gain: 1, fadeInSec: 0, fadeOutSec: 0});
        await save(project.id, "deleted-chapter", "v0", removed.id);
        await deleteAudioChapter(project.id, removed.id, removed.revision);
        await save(project.id, "remaining-chapter", "v0", chapter.id);
        let projectId = project.id;
        for (let pass = 0; pass < 2; pass++) {
            const imported = await roundtrip(projectId);
            const item = await findExport(imported.snapshot, "deleted-chapter");
            expect(item).toMatchObject({scope: "chapter", chapterTitle: "已删除章节"});
            expect(item.chapterId).toBeUndefined();
            expect(getAudioExportFreshness(item, imported.snapshot)).toBe("stale");
            expect(Object.keys(parsedSchedule(item.fingerprint).chapterOffsets)).toContain(removed.id);
            expect(parsedSchedule(item.fingerprint).clips[0].clipId).toBe(clip.id);
            expect(getAudioExportFreshness(await findExport(imported.snapshot, "remaining-chapter"), imported.snapshot)).toBe("current");
            projectId = imported.projectId;
        }
    });

    it("mirrors optional missing-job repair for current sources while retaining historical stale evidence", async () => {
        const {project, take, job} = await fixture();
        await save(project.id, "current", "v0");
        const snapshot = await getAudioProjectSnapshot(project.id);
        const old = buildAudioSchedule(snapshot);
        const fullSource = {...snapshot.takes[0], provenance: {...snapshot.takes[0].provenance!, jobId: "previous-deleted-job"}};
        old.sources = [fullSource];
        await save(project.id, "stale", "v0", undefined, JSON.stringify(old));
        await db.audioGenerationJobs.delete(job.id);
        let projectId = project.id;
        for (let pass = 0; pass < 2; pass++) {
            const imported = await roundtrip(projectId);
            expect(imported.snapshot.takes[0].provenance?.jobId).toBeUndefined();
            expect(getAudioExportFreshness(await findExport(imported.snapshot, "current"), imported.snapshot)).toBe("current");
            expect(getAudioExportFreshness(await findExport(imported.snapshot, "stale"), imported.snapshot)).toBe("stale");
            expect(imported.snapshot.takes[0].name).toBe(take.name);
            projectId = imported.projectId;
        }
    });

    it.each(["v0", "v1"] as const)("keeps %s stale before outgoing and incoming allowlists drop newer metadata", async format => {
        for (const boundary of ["outgoing", "incoming"] as const) {
            for (const field of ["source", "provenance"] as const) {
                const {project, take} = await fixture();
                await save(project.id, "stale", format);
                const futureTake = field === "source" ? {...take, futureMetadata: "newer source state"}
                    : {...take, provenance: {...take.provenance!, futureMetadata: "newer provenance state"}};
                const original = await getAudioProjectSnapshot(project.id);
                original.takes = [futureTake];
                expect(getAudioExportFreshness(await findExport(original, "stale"), original)).toBe("stale");
                let projectId = project.id;
                if (boundary === "outgoing") await db.audioTakes.put(futureTake);
                else {
                    const zip = await JSZip.loadAsync(await (await exportProjectZip(project.id)).arrayBuffer());
                    const raw = JSON.parse(await zip.file("audioProject.json")!.async("string")) as {audioTakes: unknown[]};
                    raw.audioTakes = [futureTake];
                    zip.file("audioProject.json", JSON.stringify(raw));
                    projectId = (await importProjectZip(await zip.generateAsync({type: "blob"}))).id;
                    const imported = await getAudioProjectSnapshot(projectId);
                    expect(getAudioExportFreshness(await findExport(imported, "stale"), imported)).toBe("stale");
                }
                for (let pass = 0; pass < 2; pass++) {
                    const imported = await roundtrip(projectId);
                    expect(getAudioExportFreshness(await findExport(imported.snapshot, "stale"), imported.snapshot)).toBe("stale");
                    const stored = imported.snapshot.takes[0];
                    expect(stored).not.toHaveProperty("futureMetadata");
                    expect(stored.provenance).not.toHaveProperty("futureMetadata");
                    projectId = imported.projectId;
                }
                await db.delete();
                await db.open();
            }
        }
    });

    it("retains unknown/malformed/future fingerprints byte-for-byte across two ZIPs", async () => {
        const {project} = await fixture();
        const snapshot = await getAudioProjectSnapshot(project.id);
        const schedule = buildAudioSchedule(snapshot);
        const source = snapshot.takes[0];
        const invalid = [
            "historical unknown", "{", "null", "{}", JSON.stringify({...schedule, future: true}),
            JSON.stringify({...schedule, sources: [{...source, future: "metadata"}]}),
            JSON.stringify({...schedule, sources: [{...source, provenance: {...source.provenance, future: true}}]}),
            JSON.stringify({...schedule, sources: [{...source, revision: "2"}]}),
            JSON.stringify({...schedule, clips: [{...schedule.clips[0], envelope: [{time: 0, gain: "1"}]}]}),
            JSON.stringify(schedule).replace('"durationSec":5.5', '"durationSec":1e400'),
            JSON.stringify({version: 2, schedule}), JSON.stringify({version: 1, schedule, future: true})
        ];
        for (const [index, raw] of invalid.entries()) {
            expect(getAudioExportFreshness({fingerprint: raw}, snapshot)).toBe("unknown");
            await save(project.id, `unknown-${index}`, "v0", undefined, raw);
        }
        let projectId = project.id;
        for (let pass = 0; pass < 2; pass++) {
            const imported = await roundtrip(projectId);
            for (const [index, raw] of invalid.entries()) {
                const item = await findExport(imported.snapshot, `unknown-${index}`);
                expect(item.fingerprint).toBe(raw);
                expect(getAudioExportFreshness(item, imported.snapshot)).toBe("unknown");
            }
            projectId = imported.projectId;
        }
    });

    it("ignores object insertion order but retains source, clip, and envelope array order", async () => {
        const {project, take, clip} = await fixture();
        const second = await addAudioTake(project.id, {...take, mediaId: "second-source", name: "第二来源"}, {
            id: "second-source", projectId: project.id, filename: "second.wav", mimeType: "audio/wav", blob: new Blob(["second-source-bytes"])
        });
        await addAudioClip(project.id, {...clip, takeId: second.id});
        const snapshot = await getAudioProjectSnapshot(project.id);
        const schedule = buildAudioSchedule(snapshot);
        const reverseKeys = (value: unknown): unknown => {
            if (Array.isArray(value)) return value.map(reverseKeys);
            if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
            return value;
        };
        expect(getAudioExportFreshness({fingerprint: JSON.stringify(reverseKeys(schedule))}, snapshot)).toBe("current");
        const altered = structuredClone(schedule);
        altered.clips[0].envelope.reverse();
        expect(getAudioExportFreshness({fingerprint: JSON.stringify(altered)}, snapshot)).toBe("stale");
        for (const field of ["sources", "clips"] as const) {
            const reordered = structuredClone(schedule);
            expect(reordered[field]).toHaveLength(2);
            expect(reordered[field][0]).not.toEqual(reordered[field][1]);
            reordered[field].reverse();
            expect(getAudioExportFreshness({fingerprint: JSON.stringify(reordered)}, snapshot)).toBe("stale");
        }
    });

    it("supports recognized minimal v0 sources and preserves unmapped media/take IDs", async () => {
        const {project} = await fixture();
        const full = await getAudioProjectSnapshot(project.id);
        const minimal = {...full, takes: full.takes.map(({id, mediaId, durationSec, sampleRate, channels}) => ({id, mediaId, durationSec, sampleRate, channels}))};
        const legacy = JSON.stringify(buildAudioSchedule(minimal));
        expect(getAudioExportFreshness({fingerprint: legacy}, minimal)).toBe("current");
        const remapped = remapAudioExportFingerprint({fingerprint: legacy, projectId: project.id}, minimal, {records: new Map(), media: new Map(), projectId: "new-project"});
        expect(parsedSchedule(remapped)).toEqual(buildAudioSchedule(minimal));
        expect(getAudioExportFreshness({fingerprint: remapped}, minimal)).toBe("current");
    });
});
