import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { patchAudioGenerationJob } from "@/db/audioGeneration";
import { observeAudioTask } from "@/lib/audioGeneration/observations";
import { snapshotAudioPackage } from "@/lib/audioProjectPackage";
import { deleteMusicWork } from "@/db/music";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import {createAudioMusicProject} from "@/db/projects";
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


describe("B05 durable task identity recovery", () => {
  it("stores duplicate provider IDs once, then queries and downloads each unique task once", async () => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "POST") return Response.json({ code: 200, data: ["early", "late", "early"].map(task_id => ({ task_id })) });
      if (String(url).includes("/music/tasks/")) {
        const id = new URL(String(url)).pathname.split("/").at(-1)!;
        return complete(id, [`https://cdn.example/${id}.wav`]);
      }
      return wav();
    });
    const submitted = await submitAudioGeneration(project.id, job.id, { fetchImpl });
    expect(submitted.taskIds).toEqual(["early", "late"]);
    expect((await db.audioGenerationJobs.get(job.id))!.taskIds).toEqual(submitted.taskIds);
    const saved = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(saved.status).toBe("saved");
    expect(saved.taskObservations?.map(row => row.taskId)).toEqual(["early", "late"]);
    expect(await db.musicWorks.count()).toBe(2);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes("/music/tasks/"))).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("recovers duplicate legacy submissions with absent observations using only one GET per unique ID", async () => {
    const { project, job } = await prepared();
    await db.audioGenerationJobs.update(job.id, { status: "submitted", taskIds: ["old", "old", "sibling"] });
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      expect(init?.method).not.toBe("POST");
      if (String(url).includes("/music/tasks/")) {
        const checkpoint = (await db.audioGenerationJobs.get(job.id))!;
        expect(checkpoint.taskIds).toEqual(["old", "sibling"]);
        const id = new URL(String(url)).pathname.split("/").at(-1)!;
        return complete(id, [`https://cdn.example/${id}.wav`]);
      }
      return wav();
    });
    const saved = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(saved.status).toBe("saved");
    expect(saved.taskObservations?.map(row => row.taskId)).toEqual(["old", "sibling"]);
    expect(await db.musicWorks.count()).toBe(2);
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes("/music/tasks/"))).toHaveLength(2);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("checkpoints legacy unique IDs before GET, preserving verified evidence and downloads through processing and retry", async () => {
    const { project, job } = await prepared();
    const observations = [
      observeAudioTask("early", "completed", "2026-09-22T00:00:00.000Z"),
      observeAudioTask("late", "processing", "2026-09-22T00:00:00.000Z"),
    ];
    const results = [{ key: "early:1", title: "existing result", provenance: { provider: "apimart" as const, model: "flowmusic", taskId: "early", audioIndex: 1, audioUrl: "https://cdn.example/early.wav" } }];
    await db.audioGenerationJobs.update(job.id, { status: "submitted", taskIds: ["early", "early", "late", "late"], taskObservations: observations, results });
    let lateStatus = "processing";
    let downloads = 0;
    let queries = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      expect(init?.method).not.toBe("POST");
      if (String(url).includes("/music/tasks/")) {
        const checkpoint = (await db.audioGenerationJobs.get(job.id))!;
        expect(checkpoint.taskIds).toEqual(["early", "late"]);
        if (queries++ === 0) {
          expect(checkpoint.revision).toBe(job.revision + 1);
          expect(checkpoint.taskObservations).toEqual(observations);
          expect(checkpoint.results).toEqual(results);
          expect(checkpoint.input).toEqual(job.input);
          expect(checkpoint.source).toEqual(job.source);
          expect(checkpoint.connector).toEqual(job.connector);
        }
        const id = new URL(String(url)).pathname.split("/").at(-1)!;
        if (id === "early" || lateStatus === "completed") return complete(id, [`https://cdn.example/${id}.wav`]);
        if (lateStatus === "query-failed") throw new Error("temporary query failure");
        return Response.json({ code: 200, data: { id, status: lateStatus } });
      }
      downloads++;
      return wav();
    });
    const running = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(running.status).toBe("running");
    expect(running.taskObservations?.map(row => row.taskId)).toEqual(["early", "late"]);
    expect(running.results[0].title).toBe("existing result");
    expect(await db.musicWorks.count()).toBe(1);
    expect(queries).toBe(2);
    expect(downloads).toBe(1);
    const savedSibling = running.results[0];
    const previous = running.taskObservations![1].lastVerified;
    lateStatus = "query-failed";
    const failedQuery = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(failedQuery.taskObservations![1]).toMatchObject({ status: "query-failed", lastVerified: previous });
    expect(failedQuery.results[0]).toEqual(savedSibling);
    expect(downloads).toBe(1);
    lateStatus = "completed";
    const saved = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(saved.status).toBe("saved");
    expect(saved.results[0]).toEqual(savedSibling);
    expect(saved.taskObservations?.map(row => row.status)).toEqual(["completed", "completed"]);
    expect(await db.musicWorks.count()).toBe(2);
    expect(queries).toBe(6);
    expect(downloads).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(8);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it.each([
    ["."], [".."], [""], ["  "], ["x".repeat(513)], ["task\u0000"], ["task\u007f"], ["task\ud800"], ["task\udc00"],
    Array.from({ length: 101 }, (_, i) => `task-${i}`),
  ])("rejects malformed legacy IDs locally, preserving history (%j)", async (...taskIds) => {
    const { project, job } = await prepared();
    await db.audioGenerationJobs.update(job.id, { status: "submitted", taskIds });
    const before = await db.audioGenerationJobs.get(job.id);
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(refreshAudioGeneration(project.id, job.id, { fetchImpl, decode })).rejects.toThrow("音乐任务 ID");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await db.audioGenerationJobs.get(job.id)).toEqual(before);
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["valid", "."], ["valid", ".."], ["valid", ""], ["valid", "  "], ["valid", "x".repeat(513)],
    ["valid", "bad\n"], ["valid", "task\ud800"], ["valid", "task\udc00"], Array.from({ length: 101 }, (_, i) => `task-${i}`),
  ])("keeps malformed paid success uncertain, never auto-submitting again (%j)", async (...taskIds) => {
    const { project, job } = await prepared();
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ code: 200, data: taskIds.map(task_id => ({ task_id })) }));
    const uncertain = await submitAudioGeneration(project.id, job.id, { fetchImpl });
    expect(uncertain).toMatchObject({ status: "uncertain", taskIds: [], results: [] });
    expect(uncertain.error).toBeTruthy();
    expect(uncertain.claim).toBeTruthy();
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect((await db.audioGenerationJobs.get(job.id))!.source).toEqual(job.source);
  });

  it.each(["signal", "independent", "malformed"])("retains uncertain paid JSON %s failure with exactly one POST", async mode => {
    const { project, job } = await prepared();
    const controller = new AbortController();
    const response = Response.json({});
    vi.spyOn(response, "json").mockImplementation(async () => {
      if (mode === "signal") controller.abort();
      if (mode === "independent") throw Object.assign(new Error("cancelled"), { name: "AbortError" });
      throw new SyntaxError("broken JSON");
    });
    const fetchImpl = vi.fn<typeof fetch>(async () => response);
    const uncertain = await submitAudioGeneration(project.id, job.id, { fetchImpl, signal: controller.signal });
    expect(uncertain).toMatchObject({ status: "uncertain", taskIds: [] });
    await submitAudioGeneration(project.id, job.id, { fetchImpl });
    await refreshAudioGeneration(project.id, job.id, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
  });
});

describe("B05 task identity storage and package boundaries", () => {
  it.each([
    ["duplicate", "duplicate"], ["."], [".."], [""], ["  "], ["x".repeat(513)], ["bad\n"], ["bad\u007f"], ["task\ud800"], ["task\udc00"],
    Array.from({ length: 101 }, (_, i) => `task-${i}`),
  ])("rejects malformed IDs even without observations in storage, snapshot and import (%j)", async (...taskIds) => {
    const { project, job } = await prepared();
    // Valid empty prepared music job round trips before testing the malformed boundary.
    const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
    const raw = JSON.parse(await zip.file("audioProject.json")!.async("string"));
    expect(raw.audioGenerationJobs[0].taskIds).toEqual([]);
    await expect(patchAudioGenerationJob(project.id, job.id, job.revision, { taskIds })).rejects.toThrow("音乐任务 ID");
    expect(await db.audioGenerationJobs.get(job.id)).toEqual(job);
    raw.audioGenerationJobs[0].taskIds = taskIds;
    zip.file("audioProject.json", JSON.stringify(raw));
    const before = await Promise.all(db.tables.map(table => table.toArray()));
    await expect(importProjectZip(await zip.generateAsync({ type: "blob" }))).rejects.toThrow("音乐任务 ID");
    expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
    await db.audioGenerationJobs.update(job.id, { taskIds });
    await expect(snapshotAudioPackage(project.id)).rejects.toThrow("音乐任务 ID");
  });

  it("rejects sparse task ID arrays at the actual storage boundary", async () => {
    const { project, job } = await prepared();
    const taskIds = Array<string>(2);
    taskIds[1] = "valid";
    await expect(patchAudioGenerationJob(project.id, job.id, job.revision, { taskIds })).rejects.toThrow("音乐任务 ID");
    expect(await db.audioGenerationJobs.get(job.id)).toEqual(job);
  });

  it("keeps prepared speech empty task IDs compatible with strict storage and ZIP import", async () => {
    const project = await createAudioMusicProject("speech", "audio");
    await db.connectors.add(credentials);
    const job = await prepareAudioGeneration({ projectId: project.id, connectorId: credentials.id, input: { kind: "speech", text: "你好", voice: "alloy", speed: 1 } });
    expect(job.taskIds).toEqual([]);
    const patched = await patchAudioGenerationJob(project.id, job.id, job.revision, { taskIds: [] });
    expect(patched.taskObservations).toBeUndefined();
    const imported = await importProjectZip(await exportProjectZip(project.id));
    expect((await db.audioGenerationJobs.where("projectId").equals(imported.id).first())!).toMatchObject({ taskIds: [], dormant: true, status: "prepared" });
  });
});
