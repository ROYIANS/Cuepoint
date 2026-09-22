import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject } from "@/db/repo";
import { addAudioSegment, patchAudioSegment } from "@/db/audio";
import { prepareAudioGeneration, submitAudioGeneration, refreshAudioGeneration } from "@/lib/audioGeneration/runtime";
import type { ConnectorConfig } from "@/domain/types";

async function setup(kind: "audio" | "music") {
  const project = await createAudioMusicProject("声音", kind);
  const connector = { id: "apimart-test", definitionId: "apimart", label: "", baseUrl: "https://api.apimart.ai/v1", apiKey: "secret", createdAt: "2026-09-22", updatedAt: "2026-09-22" } as ConnectorConfig;
  await db.connectors.add(connector);
  return { project, connector };
}
const decode = async () => ({ durationSec: 2, sampleRate: 48000, channels: 2 });
const binary = () => new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "Content-Type": "audio/wav" } });

describe("project-owned audio generation", () => {
  it("claims one paid speech request across concurrent submits and retains a usable take", async () => {
    const { project, connector } = await setup("audio");
    const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id, input: { kind: "speech", text: "hello", voice: "alloy", speed: 1 } });
    const fetchImpl = vi.fn<typeof fetch>(async () => binary());
    const jobs = await Promise.all([submitAudioGeneration(project.id, job.id, { fetchImpl, decode }), submitAudioGeneration(project.id, job.id, { fetchImpl, decode })]);
    expect(jobs.map(j => j.status)).toEqual(["saved", "saved"]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(await db.audioTakes.count()).toBe(1);
    expect(await db.media.count()).toBe(1);
    expect(JSON.stringify(await db.audioGenerationJobs.get(job.id))).not.toContain("secret");
  });
  it("keeps uncertain submissions without retrying paid requests", async () => {
    const { project, connector } = await setup("music");
    const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id, input: { kind: "music", settings: { engine: "flowmusic", soundPrompt: "piano", lyrics: "", title: "" } } });
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error("connection lost"); });
    expect((await submitAudioGeneration(project.id, job.id, { fetchImpl })).status).toBe("uncertain");
    expect((await refreshAudioGeneration(project.id, job.id, { fetchImpl })).status).toBe("uncertain");
    expect((await submitAudioGeneration(project.id, job.id, { fetchImpl })).status).toBe("uncertain");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("resumes downloaded speech bytes after decoder failure without another POST", async () => {
    const { project, connector } = await setup("audio");
    const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id, input: { kind: "speech", text: "hello", voice: "alloy", speed: 1 } });
    const fetchImpl = vi.fn<typeof fetch>(async () => binary());
    expect((await submitAudioGeneration(project.id, job.id, { fetchImpl, decode: async () => { throw new Error("temporary decode failure"); } })).status).toBe("remote-completed");
    expect((await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode })).status).toBe("saved");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(await db.media.count()).toBe(1);
  });
  it("recovers failed music downloads using saved result URLs, keeping all works", async () => {
    const { project, connector } = await setup("music");
    const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id, input: { kind: "music", settings: { engine: "flowmusic", soundPrompt: "piano", lyrics: "", title: "" } } });
    let broken = true;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "remote" }] });
      if (String(url).includes("/music/tasks/")) return Response.json({ code: 200, data: { id: "remote", status: "completed", result: { music: [1, 2, 3].map(i => ({ title: `Song ${i}`, clip_id: `clip-${i}`, audio_url: `https://cdn.example/${i}.wav` })) } } });
      if (broken) throw new Error("offline");
      expect(init?.headers).toBeUndefined();
      return binary();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    expect((await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode })).status).toBe("remote-completed");
    broken = false;
    expect((await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode })).status).toBe("saved");
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect((await db.musicWorks.toArray()).sort((a, b) => a.title.localeCompare(b.title)).map(w => [w.title, w.provenance?.audioIndex])).toEqual([["Song 1", 1], ["Song 2", 2], ["Song 3", 3]]);
  });
  it("rejects stale targets and changed credentials before network effects", async () => {
    const { project, connector } = await setup("audio");
    const chapter = await db.audioChapters.where("projectId").equals(project.id).first();
    const segment = await addAudioSegment(project.id, { chapterId: chapter!.id, text: "old", notes: "", order: 0 });
    const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id, input: { kind: "speech", text: "old", voice: "alloy", speed: 1, segmentId: segment.id, segmentRevision: segment.revision } });
    await patchAudioSegment(project.id, segment.id, segment.revision, { text: "new" });
    const fetchImpl = vi.fn<typeof fetch>(async () => binary());
    await expect(submitAudioGeneration(project.id, job.id, { fetchImpl })).rejects.toThrow("修改");
    expect(fetchImpl).not.toHaveBeenCalled();
    const next = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id, input: { kind: "speech", text: "other", voice: "alloy", speed: 1 } });
    const result = await submitAudioGeneration(project.id, next.id, { fetchImpl, beforeSubmit: async () => { await db.connectors.update(connector.id, { apiKey: "changed" }); } });
    expect(result.status).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
