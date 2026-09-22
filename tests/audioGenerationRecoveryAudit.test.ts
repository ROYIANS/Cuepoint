import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { deleteMusicWork } from "@/db/music";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import { createAudioMusicProject } from "@/db/repo";
import { prepareAudioGeneration, submitAudioGeneration, refreshAudioGeneration } from "@/lib/audioGeneration/runtime";
import { getApimartMusicTask } from "@/lib/ai/apimartAudio";

const credentials = { id: "audit-api", definitionId: "apimart" as const, protocol: "openai-compatible" as const, baseUrl: "https://api.apimart.ai/v1", apiKey: "audit-secret", updatedAt: "2026-09-22" };
const decode = async () => ({ durationSec: 1, sampleRate: 48000, channels: 1 });
const wav = () => new Response(new Uint8Array([82,73,70,70,36,0,0,0,87,65,86,69,102,109,116,32]), { headers: { "Content-Type": "application/octet-stream" } });
async function prepared() {
  const project = await createAudioMusicProject("recovery", "music");
  await db.connectors.add(credentials);
  const job = await prepareAudioGeneration({ projectId: project.id, connectorId: credentials.id, input: { kind: "music", settings: { engine: "flowmusic", soundPrompt: "piano", lyrics: "", title: "" } } });
  return { project, job };
}
const complete = (id: string, urls: string[]) => Response.json({ code: 200, data: { id, status: "completed", result: { music: urls.map((url, i) => ({ audio_url: url, title: `${id}:${i}` })) } } });

describe("audio generation recovery integration audit", () => {
  it("saves a successful task even when a later task from the same submission fails", async () => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "good" }, { task_id: "bad" }] });
      if (String(url).includes("/music/tasks/good")) return complete("good", ["https://cdn.example/good.wav"]);
      if (String(url).includes("/music/tasks/bad")) return Response.json({ code: 200, data: { id: "bad", status: "failed", error: { message: "provider failure" } } });
      return wav();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const state = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(state.results.some((r) => r.provenance.taskId === "good")).toBe(true);
    expect(await db.musicWorks.count()).toBe(1);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
  it("downloads healthy siblings when one result URL is unavailable", async () => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "both" }] });
      if (String(url).includes("/music/tasks/")) return complete("both", ["https://cdn.example/bad.wav", "https://cdn.example/good.wav"]);
      if (String(url).includes("bad.wav")) return new Response("expired", { status: 404 });
      return wav();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const state = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(state.results).toHaveLength(2);
    expect(await db.musicWorks.count()).toBe(1);
    expect((await db.musicWorks.toArray())[0].provenance?.audioIndex).toBe(2);
  });
  it("keeps an extensionless WAV response as WAV rather than mislabeling MP3", async () => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "wav" }] });
      if (String(url).includes("/music/tasks/")) return complete("wav", ["https://cdn.example/download?id=123"]);
      return wav();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect((await db.media.toArray())[0]).toMatchObject({ mimeType: "audio/wav" });
  });
  it("preserves diagnostics on an unknown remote status for explicit recovery", async () => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => init?.method === "POST"
      ? Response.json({ code: 200, data: [{ task_id: "future" }] })
      : Response.json({ code: 200, data: { id: "future", status: "provider-new-status" } }));
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const state = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(state.taskIds).toEqual(["future"]);
    expect(state.error).toBeTruthy();
  });
  it("rechecks unfinished siblings after reload during a partial download", async () => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "early" }, { task_id: "late" }] });
      if (String(url).includes("/music/tasks/early")) return complete("early", ["https://cdn.example/early.wav"]);
      if (String(url).includes("/music/tasks/late")) return complete("late", ["https://cdn.example/late.wav"]);
      return wav();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    // Persisted checkpoint after early finished while late was still processing,
    // followed by a tab reload before downloadResults restores `running`.
    await db.audioGenerationJobs.update(job.id, { status: "downloading", results: [{ key: "early:1", title: "early", provenance: { provider: "apimart", model: "flowmusic", taskId: "early", audioIndex: 1, audioUrl: "https://cdn.example/early.wav" } }] });
    const state = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(state.results.some((result) => result.provenance.taskId === "late")).toBe(true);
    expect(await db.musicWorks.count()).toBe(2);
  });
  it("retains deleted-work tombstones while recovering siblings and round-tripping history", async () => {
    const { project, job } = await prepared();
    let secondReady = false;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "pair" }] });
      if (String(url).includes("/music/tasks/")) return complete("pair", ["https://cdn.example/first.wav", "https://cdn.example/second.wav"]);
      if (!secondReady && String(url).includes("second.wav")) return new Response("temporary", { status: 503 });
      return wav();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    const first = (await db.musicWorks.toArray())[0];
    expect(first.provenance?.audioIndex).toBe(1);
    await deleteMusicWork(project.id, first.id, first.revision);
    const tombstone = (await db.audioGenerationJobs.get(job.id))!.results[0];
    expect(tombstone).toMatchObject({ deleted: true, mediaId: first.mediaId });
    expect(tombstone.workId).toBeUndefined();
    secondReady = true;
    const recovered = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(recovered.status).toBe("saved");
    const works = await db.musicWorks.toArray();
    expect(works).toHaveLength(1);
    expect(works[0].provenance?.audioIndex).toBe(2);
    expect(await db.media.get(first.mediaId)).toBeTruthy();
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const history = (await db.audioGenerationJobs.where("projectId").equals(imported.id).first())!;
    expect(history.results[0]).toMatchObject({ deleted: true });
    expect(history.taskObservations).toEqual(recovered.taskObservations);
    expect(history.dormant).toBe(true);
    const historicalFetch = vi.fn<typeof fetch>();
    await refreshAudioGeneration(imported.id, history.id, { fetchImpl: historicalFetch });
    expect(historicalFetch).not.toHaveBeenCalled();
    expect(history.results[0].workId).toBeUndefined();
    expect(await db.musicWorks.where("projectId").equals(imported.id).count()).toBe(1);
  });
  it("retains valid siblings and original result positions around a malformed result", async () => {
    const result = await getApimartMusicTask(credentials, "mixed", { fetchImpl: vi.fn(async () => Response.json({ code: 200, data: { id: "mixed", status: "completed", result: { music: [
      { audio_url: "https://cdn.example/1.wav" }, { title: "missing-url" }, { audio_url: "https://cdn.example/3.wav" },
    ] } } })) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.task.tracks.map((track) => track.audioIndex)).toEqual([1, 3]);
  });
});
