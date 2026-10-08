import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject } from "@/db/repo";
import { addAudioSegment, patchAudioSegment } from "@/db/audio";
import { prepareAudioGeneration, submitAudioGeneration, refreshAudioGeneration } from "@/lib/audioGeneration/runtime";
import { patchAudioGenerationJob } from "@/db/audioGeneration";
import type { AudioTaskObservation } from "@/domain/audioGeneration";
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


async function musicJob() {
  const { project, connector } = await setup("music");
  const draft = (await db.musicDrafts.where("projectId").equals(project.id).first())!;
  const job = await prepareAudioGeneration({ projectId: project.id, connectorId: connector.id,
    input: { kind: "music", draftId: draft.id, draftRevision: draft.revision,
      settings: { engine: "flowmusic", soundPrompt: "approved piano", lyrics: "", title: "Approved" } } });
  return { project, connector, job, draft };
}
const taskResponse = (id: string, status: string) => Response.json({ code: 200, data: { id, status,
  ...(status === "completed" ? { result: { music: [{ title: id, audio_url: `https://cdn.example/${id}.wav` }] } } : {}) } });

describe("truthful music task observations", () => {
  it("keeps pending submitted, records processing, and never reuses changed draft settings or POSTs", async () => {
    const { project, job, draft } = await musicJob();
    let status = "pending";
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => init?.method === "POST"
      ? Response.json({ code: 200, data: [{ task_id: "remote" }] }) : taskResponse("remote", status));
    const submitted = await submitAudioGeneration(project.id, job.id, { fetchImpl });
    expect(submitted.taskObservations).toBeUndefined();
    await db.musicDrafts.update(draft.id, { revision: draft.revision + 1, settings: { ...draft.settings, soundPrompt: "changed later" } });
    const pending = await refreshAudioGeneration(project.id, job.id, { fetchImpl });
    expect(pending.status).toBe("submitted");
    expect(pending.taskObservations?.[0]).toMatchObject({ taskId: "remote", status: "pending", lastVerified: { status: "pending" } });
    status = "processing";
    const running = await refreshAudioGeneration(project.id, job.id, { fetchImpl });
    expect(running.status).toBe("running");
    expect(running.taskObservations?.[0]).toMatchObject({ status: "processing", lastVerified: { status: "processing" } });
    expect(running.input).toEqual(job.input);
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it.each(["unknown", "network", "protocol", "connection"])("retains previous processing only as historical after %s", async failure => {
    const { project, connector, job } = await musicJob();
    let failed = false;
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "remote" }] });
      if (!failed) return taskResponse("remote", "processing");
      if (failure === "network") throw new Error("offline");
      if (failure === "protocol") return Response.json({ nonsense: "secret" });
      return taskResponse("remote", "unrecognized-secret");
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const running = await refreshAudioGeneration(project.id, job.id, { fetchImpl });
    const old = running.taskObservations![0].lastVerified;
    failed = true;
    if (failure === "connection") await db.connectors.delete(connector.id);
    const result = await refreshAudioGeneration(project.id, job.id, { fetchImpl });
    expect(result.status).toBe("submitted");
    expect(result.taskObservations![0]).toMatchObject({ status: failure === "unknown" ? "unknown" : "query-failed", lastVerified: old });
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result.taskObservations)).not.toContain("secret");
    expect(result.error).not.toContain("unrecognized-secret");
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("persists completed siblings before another query and saves their media while pending siblings wait", async () => {
    const { project, job } = await musicJob();
    let laterStatus = "pending";
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "early" }, { task_id: "later" }] });
      if (String(url).includes("/music/tasks/early")) return taskResponse("early", "completed");
      if (String(url).includes("/music/tasks/later")) {
        const checkpoint = (await db.audioGenerationJobs.get(job.id))!;
        expect(checkpoint.taskObservations?.find(row => row.taskId === "early")?.status).toBe("completed");
        expect(checkpoint.results[0].provenance.taskId).toBe("early");
        return taskResponse("later", laterStatus);
      }
      return binary();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const partial = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(partial.status).toBe("submitted");
    expect(await db.musicWorks.count()).toBe(1);
    expect(partial.taskObservations?.map(row => row.status)).toEqual(["completed", "pending"]);
    laterStatus = "completed";
    expect((await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode })).status).toBe("saved");
    expect(await db.musicWorks.count()).toBe(2);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("keeps each sibling state and downloaded works when another query fails, then recovers without duplicate works", async () => {
    const { project, job } = await musicJob();
    let recovered = false;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: ["done", "bad", "lost", "active"].map(task_id => ({ task_id })) });
      if (String(url).includes("/music/tasks/")) {
        const id = String(url).split("/music/tasks/")[1].split("?")[0];
        if (id === "bad") return taskResponse(id, "failed");
        if (id === "lost" && !recovered) throw new Error("query offline");
        return taskResponse(id, id === "active" && !recovered ? "processing" : "completed");
      }
      return binary();
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const partial = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(partial.status).toBe("running");
    expect(partial.taskObservations?.map(row => row.status)).toEqual(["completed", "failed", "query-failed", "processing"]);
    expect(await db.musicWorks.count()).toBe(1);
    recovered = true;
    const completed = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(completed.status).toBe("failed");
    expect(completed.taskObservations?.map(row => row.status)).toEqual(["completed", "failed", "completed", "completed"]);
    expect(await db.musicWorks.count()).toBe(3);
    await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(await db.musicWorks.count()).toBe(3);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("preserves partial observations on Stop and never invents a processing state for unchecked siblings", async () => {
    const { project, job } = await musicJob();
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: [{ task_id: "first" }, { task_id: "second" }] });
      expect(String(url)).toContain("/music/tasks/first");
      controller.abort();
      return taskResponse("first", "completed");
    });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const stopped = await refreshAudioGeneration(project.id, job.id, { fetchImpl, signal: controller.signal });
    expect(stopped.status).toBe("submitted");
    expect(stopped.taskObservations?.map(row => row.status)).toEqual(["completed", "query-failed"]);
    expect(stopped.results).toHaveLength(1);
    expect(await db.musicWorks.count()).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    { taskId: "foreign" }, { checkedAt: "not-a-time" }, { checkedAt: "2026-02-30T00:00:00.000Z" },
    { status: "invented" }, { apiKey: "secret" }, { lastVerified: { status: "processing", observedAt: "2027-01-01T00:00:00.000Z" } },
    { status: "completed", lastVerified: { status: "pending", observedAt: "2026-09-22T00:00:00.000Z" } },
  ])("rejects invalid persisted observation %j without changing job revision", async invalid => {
    const { project, job } = await musicJob();
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ code: 200, data: [{ task_id: "remote" }] }));
    const submitted = await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const observation = { taskId: "remote", status: "unknown", checkedAt: "2026-09-22T00:00:00.000Z", ...invalid } as AudioTaskObservation;
    await expect(patchAudioGenerationJob(project.id, job.id, submitted.revision, { taskObservations: [observation] })).rejects.toThrow();
    expect((await db.audioGenerationJobs.get(job.id))?.revision).toBe(submitted.revision);
  });

  it("rejects duplicate task observations and accepts absent legacy observations", async () => {
    const { project, job } = await musicJob();
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ code: 200, data: [{ task_id: "remote" }] }));
    const submitted = await submitAudioGeneration(project.id, job.id, { fetchImpl });
    const observation: AudioTaskObservation = { taskId: "remote", status: "unknown", checkedAt: "2026-09-22T00:00:00.000Z" };
    await expect(patchAudioGenerationJob(project.id, job.id, submitted.revision, { taskObservations: [observation, observation] })).rejects.toThrow();
    expect((await patchAudioGenerationJob(project.id, job.id, submitted.revision, { error: "legacy" })).taskObservations).toBeUndefined();
  });
});
