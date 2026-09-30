import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/repo";
import {prepareAudioGeneration, refreshAudioGeneration, submitAudioGeneration} from "@/lib/audioGeneration/runtime";
import {MAX_AUDIO_BYTES, MAX_JSON_BYTES} from "@/lib/resource/limits";
import type {ConnectorConfig} from "@/domain/types";

async function setup(kind: "audio" | "music") {
    const project = await createAudioMusicProject("bounded", kind);
    const connector = {id: "bounded-apimart", definitionId: "apimart", label: "", baseUrl: "https://api.apimart.ai/v1", apiKey: "secret", createdAt: "2026-09-30", updatedAt: "2026-09-30"} as ConnectorConfig;
    await db.connectors.add(connector);
    const input = kind === "audio" ? {kind: "speech" as const, text: "hello", voice: "alloy", speed: 1} : {kind: "music" as const, settings: {engine: "flowmusic" as const, soundPrompt: "piano", lyrics: "", title: ""}};
    const job = await prepareAudioGeneration({projectId: project.id, connectorId: connector.id, input});
    return {project, job};
}
function oversized(size: number, mime: string) {
    let remaining = size;
    const chunk = new Uint8Array(1024 * 1024);
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({pull(controller) {
        if (!remaining) return controller.close();
        const count = Math.min(remaining, chunk.length);
        controller.enqueue(chunk.subarray(0, count)); remaining -= count;
    }, cancel}, {highWaterMark: 0});
    return {response: new Response(body, {headers: {"content-type": mime, "content-length": "1"}}), body, cancel};
}
const decoded = {durationSec: 2, sampleRate: 48000, channels: 2};

describe("oversized responses retain paid recovery truth", () => {
    it.each(["audio", "music"] as const)("keeps %s submit uncertain with original intent and no replay or media writes", async kind => {
        const {project, job} = await setup(kind);
        const fixture = oversized(kind === "audio" ? MAX_AUDIO_BYTES + 1 : MAX_JSON_BYTES + 1, kind === "audio" ? "audio/wav" : "application/json");
        const fetchImpl = vi.fn<typeof fetch>(async () => fixture.response);
        const decode = vi.fn(async () => decoded);
        const first = await submitAudioGeneration(project.id, job.id, {fetchImpl, decode});
        expect(first.status).toBe("uncertain");
        expect(first.input).toEqual(job.input);
        expect(first.intentFingerprint).toBe(job.intentFingerprint);
        expect((await submitAudioGeneration(project.id, job.id, {fetchImpl, decode})).status).toBe("uncertain");
        expect((await refreshAudioGeneration(project.id, job.id, {fetchImpl, decode})).status).toBe("uncertain");
        expect(fetchImpl).toHaveBeenCalledOnce(); expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
        expect(decode).not.toHaveBeenCalled();
        for (const table of [db.media, db.audioTakes, db.musicWorks, db.audioClips]) expect(await table.count()).toBe(0);
        expect(fixture.cancel).toHaveBeenCalledOnce(); expect(fixture.body.locked).toBe(false);
    });
    it("checkpoints music task/results and retries only GET after an oversized CDN response", async () => {
        const {project, job} = await setup("music");
        const fixture = oversized(MAX_AUDIO_BYTES + 1, "audio/wav");
        let recovered = false;
        const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
            if (init?.method === "POST") return Response.json({code: 200, data: [{task_id: "remote"}]});
            if (String(url).includes("/music/tasks/")) return Response.json({code: 200, data: {id: "remote", status: "completed", result: {music: [{title: "Song", clip_id: "clip-1", audio_url: "https://cdn.example/song.wav"}]}}});
            expect(init?.headers).toBeUndefined(); expect(init?.credentials).toBe("omit");
            return recovered ? new Response(new Uint8Array([82, 73, 70, 70]), {headers: {"content-type": "audio/wav"}}) : fixture.response;
        });
        const decode = vi.fn(async () => decoded);
        await submitAudioGeneration(project.id, job.id, {fetchImpl, decode});
        const limited = await refreshAudioGeneration(project.id, job.id, {fetchImpl, decode});
        expect(limited.status).toBe("remote-completed"); expect(limited.taskIds).toEqual(["remote"]);
        expect(limited.results).toHaveLength(1); expect(limited.results[0].provenance.audioUrl).toBe("https://cdn.example/song.wav");
        expect(limited.error).toContain("32 MiB"); expect(decode).not.toHaveBeenCalled();
        expect(await db.media.count()).toBe(0); expect(await db.musicWorks.count()).toBe(0);
        const before = fetchImpl.mock.calls.length;
        recovered = true;
        expect((await refreshAudioGeneration(project.id, job.id, {fetchImpl, decode})).status).toBe("saved");
        expect(fetchImpl.mock.calls.slice(before)).toHaveLength(1);
        expect(String(fetchImpl.mock.calls[before][0])).toBe("https://cdn.example/song.wav");
        expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
        expect(await db.musicWorks.count()).toBe(1); expect(await db.media.count()).toBe(1);
        expect(fixture.cancel).toHaveBeenCalledOnce(); expect(fixture.body.locked).toBe(false);
    });
});
