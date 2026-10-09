import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {AUDIO_TRANSACTION_TABLES} from "@/db/audioShared";
import {createAudioMusicProject} from "@/db/projects";
import {prepareAudioGenerationJob} from "@/db/audioGeneration";
import {insertAudioPackage, parseAudioPackage, remapAudioPackage, snapshotAudioPackage} from "@/lib/audioProjectPackage";

async function prepared() {
    const project = await createAudioMusicProject("music", "music");
    const job = await prepareAudioGenerationJob(project.id, {intentId: "local-intent", input: {kind: "music", settings: {engine: "flowmusic", soundPrompt: "piano", title: "", lyrics: ""}}, connector: {id: "local-provider", provider: "apimart", baseUrl: "https://fixture.invalid"}, source: {kind: "manual"}});
    return {project, job};
}

describe("E07 audio package owned shape and compatibility boundary", () => {
    it("preserves root parse/remap API, sanitizes claims and restores dormant history without network", async () => {
        const {project, job} = await prepared();
        await db.table("audioGenerationJobs").update(job.id, {claim: {token: "live-claim"}, source: {kind: "agent", runId: "live-run", threadId: "live-thread", callId: "live-call"}});
        const stored = await db.audioGenerationJobs.get(job.id);
        const snapshot = await snapshotAudioPackage(project.id);
        expect(snapshot.audioGenerationJobs[0]).toMatchObject({source: {kind: "manual"}, dormant: true});
        expect(JSON.stringify(snapshot)).not.toMatch(/live-claim|live-run|live-thread|live-call/);
        expect(await db.audioGenerationJobs.get(job.id)).toEqual(stored);
        const parsed = parseAudioPackage(snapshot, project.id, "music")!;
        const destination = await createAudioMusicProject("restored", "music");
        const remapped = remapAudioPackage(parsed, destination.id, new Map())!;
        expect(remapped.audioGenerationJobs[0].id).not.toBe(job.id);
        expect(remapped.audioGenerationJobs[0]).toMatchObject({projectId: destination.id, dormant: true, source: {kind: "manual"}, connector: {id: "imported", provider: "apimart", baseUrl: ""}});
        const fetcher = vi.fn();
        vi.stubGlobal("fetch", fetcher);
        try {
            await db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => { await insertAudioPackage(remapped); });
            expect((await db.audioGenerationJobs.get(remapped.audioGenerationJobs[0].id))?.dormant).toBe(true);
            expect(fetcher).not.toHaveBeenCalled();
        } finally {vi.unstubAllGlobals();}
    });

    it.each([{input: {kind: "music", settings: []}}, {connector: {provider: "foreign"}}, {results: [{key: "x", title: "x", provenance: {provider: "apimart", model: "flowmusic"}, mediaId: {id: "foreign"}}]}])("rejects malformed persisted job properties before packaging %j", async (patch) => {
        const {project, job} = await prepared();
        await db.table("audioGenerationJobs").update(job.id, patch);
        const before = await db.audioGenerationJobs.get(job.id);
        await expect(snapshotAudioPackage(project.id)).rejects.toThrow();
        expect(await db.audioGenerationJobs.get(job.id)).toEqual(before);
        expect(await db.musicDrafts.where("projectId").equals(project.id).count()).toBe(1);
    });

    it("rolls back package associations when a structurally valid result points at foreign media", async () => {
        const {project, job} = await prepared();
        const foreign = await createAudioMusicProject("foreign", "music");
        await db.media.add({id: "foreign-audio", projectId: foreign.id, filename: "foreign.wav", mimeType: "audio/wav", blob: new Blob(["foreign"])});
        await db.audioGenerationJobs.update(job.id, {results: [{key: "task:1", title: "saved", mediaId: "foreign-audio", provenance: {provider: "apimart", model: "flowmusic", taskId: "task", audioIndex: 1}}]});
        const snapshot = await snapshotAudioPackage(project.id);
        const destination = await createAudioMusicProject("destination", "music");
        const remapped = remapAudioPackage(parseAudioPackage(snapshot, project.id, "music"), destination.id, new Map([["foreign-audio", "foreign-audio"]]))!;
        const beforeDrafts = await db.musicDrafts.toArray(), beforeJobs = await db.audioGenerationJobs.toArray();
        await expect(db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => { await insertAudioPackage(remapped); })).rejects.toThrow("媒体归属无效");
        expect(await db.musicDrafts.toArray()).toEqual(beforeDrafts);
        expect(await db.audioGenerationJobs.toArray()).toEqual(beforeJobs);
        expect((await db.media.get("foreign-audio"))?.projectId).toBe(foreign.id);
    });
});
