import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { db } from "@/db/database";
import { createAudioMusicProject, collectMediaIds, deleteMediaIfOrphan } from "@/db/repo";
import { addAudioSpeaker, addAudioSegment, patchAudioSpeaker } from "@/db/audio";
import { prepareAudioGeneration, submitAudioGeneration, refreshAudioGeneration } from "@/lib/audioGeneration/runtime";
import { validateSpeechReference } from "@/lib/audioGeneration/reference";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import type { AudioGenerationInput } from "@/domain/audioGeneration";

const bytes = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69]);
const wav = () => new Blob([bytes], { type: "audio/wav" });
const decode = async () => ({ durationSec: 2, sampleRate: 48000, channels: 1 });
const preset = (): AudioGenerationInput => ({ kind: "speech", text: "原稿", voice: "mimo_default", speed: 1, mimo: { mode: "preset", instruction: "轻声" } });
const response = (final_text_preview?: string) => Response.json({ choices: [{ finish_reason: "stop", message: { audio: { data: btoa(String.fromCharCode(...bytes)) }, ...(final_text_preview ? { final_text_preview } : {}) } }] });
async function setup() {
  const project = await createAudioMusicProject("MiMo 配音", "audio");
  await db.connectors.add({ id: "mimo-test", definitionId: "mimo", label: "", baseUrl: "https://api.xiaomimimo.com/v1", apiKey: "secret-test-key", createdAt: "2026-09-22", updatedAt: "2026-09-22" });
  const prepare = (input: AudioGenerationInput) => prepareAudioGeneration({ projectId: project.id, connectorId: "mimo-test", input });
  const sample = async (id: string, blob = wav(), projectId = project.id) => { await db.media.add({ id, projectId, filename: "参考.wav", mimeType: blob.type, blob }); return id; };
  return { project, prepare, sample };
}

describe("MiMo durable speech generation", () => {
  it("submits once and recovers optimized text and raw bytes without changing manuscript", async () => {
    const { project, prepare } = await setup();
    const chapter = (await db.audioChapters.where("projectId").equals(project.id).first())!;
    const segment = await addAudioSegment(project.id, { chapterId: chapter.id, order: 0, text: "原稿", notes: "" });
    const job = await prepare({ kind: "speech", text: segment.text, voice: "", speed: 1, segmentId: segment.id, segmentRevision: segment.revision, mimo: { mode: "design", instruction: "温暖女声", optimizeTextPreview: true } });
    const fetchImpl = vi.fn<typeof fetch>(async () => response("润色后的播报稿"));
    const submitted = await submitAudioGeneration(project.id, job.id, { fetchImpl, decode: async () => { throw new Error("decode interrupted"); } });
    expect(submitted.status).toBe("remote-completed");
    expect(submitted.results[0].finalTextPreview).toBe("润色后的播报稿");
    expect(await db.media.count()).toBe(1);
    const saved = await refreshAudioGeneration(project.id, job.id, { fetchImpl, decode });
    await submitAudioGeneration(project.id, job.id, { fetchImpl, decode });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(saved.status).toBe("saved");
    expect(await db.audioTakes.get(saved.results[0].takeId!)).toMatchObject({ textSnapshot: "润色后的播报稿", provenance: { provider: "mimo", model: "mimo-v2.5-tts-voicedesign" } });
    expect((await db.audioSegments.get(segment.id))?.text).toBe("原稿");
    expect(JSON.stringify(saved)).not.toContain("secret-test-key");
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const importedJob = (await db.audioGenerationJobs.where("projectId").equals(imported.id).first())!;
    expect(importedJob.results[0].finalTextPreview).toBe("润色后的播报稿");
    expect(await db.audioTakes.get(importedJob.results[0].takeId!)).toMatchObject({ textSnapshot: "润色后的播报稿", provenance: { provider: "mimo" } });
  });
  it("never replays ambiguous preset POSTs", async () => {
    const { project, prepare } = await setup();
    const job = await prepare(preset());
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error("offline"); });
    const outcomes = await Promise.all([submitAudioGeneration(project.id, job.id, { fetchImpl }), submitAudioGeneration(project.id, job.id, { fetchImpl })]);
    expect(outcomes.map(row => row.status)).toEqual(["uncertain", "uncertain"]);
    expect((await refreshAudioGeneration(project.id, job.id, { fetchImpl })).status).toBe("uncertain");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("rejects mode, provider, sample ownership, disguised MIME and size before creating a job", async () => {
    const { prepare, sample } = await setup();
    const foreign = await createAudioMusicProject("别的项目", "audio");
    await sample("foreign", wav(), foreign.id);
    await sample("fake", new Blob(["not WAV"], { type: "audio/wav" }));
    await sample("huge", new Blob([new Uint8Array(8 * 1024 * 1024)], { type: "audio/wav" }));
    for (const referenceMediaId of ["foreign", "fake", "huge", "missing"]) {
      await expect(prepare({ kind: "speech", text: "稿", voice: "", speed: 1, mimo: { mode: "clone", instruction: "", referenceMediaId } })).rejects.toThrow();
    }
    await expect(prepare({ kind: "speech", text: "稿", voice: "alloy", speed: 1 })).rejects.toThrow("APIMart");
    await expect(prepare({ ...preset(), speed: 2 } as AudioGenerationInput)).rejects.toThrow("语速");
    await expect(prepare({ kind: "speech", text: "稿", voice: "", speed: 1, mimo: { mode: "design", instruction: "" } })).rejects.toThrow();
    expect(await db.audioGenerationJobs.count()).toBe(0);
  });
  it("freezes clone bytes and blocks a changed reference before any POST", async () => {
    const { project, sample, prepare } = await setup();
    const referenceMediaId = await sample("reference");
    const job = await prepare({ kind: "speech", text: "稿", voice: "", speed: 1, mimo: { mode: "clone", instruction: "", referenceMediaId } });
    const previous = await validateSpeechReference(project.id, job.input.kind === "speech" ? job.input : {});
    expect(job.referenceFingerprint).toBe(previous?.fingerprint);
    await db.media.update(referenceMediaId, { blob: new Blob([bytes, new Uint8Array([0])], { type: "audio/wav" }) });
    const fetchImpl = vi.fn<typeof fetch>(async () => response());
    await expect(submitAudioGeneration(project.id, job.id, { fetchImpl, decode })).rejects.toThrow("已变化");
    expect(fetchImpl).not.toHaveBeenCalled();
    await db.media.update(referenceMediaId, { blob: wav() });
    const changedDuringReview = await submitAudioGeneration(project.id, job.id, { fetchImpl, decode, beforeSubmit: async () => {
      await db.media.update(referenceMediaId, { blob: new Blob([bytes, new Uint8Array([1])], { type: "audio/wav" }) });
    } }).catch(error => error as Error);
    expect(changedDuringReview instanceof Error ? changedDuringReview.message : changedDuringReview.error).toContain("已变化");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("retains speaker and job samples across GC and ZIP with remapped IDs and dormant history", async () => {
    const { project, sample, prepare } = await setup();
    const speakerReference = await sample("speaker-reference"), jobReference = await sample("job-reference");
    const speaker = await addAudioSpeaker(project.id, { name: "旁白", voice: "", speed: 1, mimo: { mode: "clone", instruction: "自然", referenceMediaId: speakerReference } });
    const job = await prepare({ kind: "speech", text: "稿", voice: "", speed: 1, mimo: { mode: "clone", instruction: "", referenceMediaId: jobReference } });
    expect(await collectMediaIds(project.id)).toEqual(new Set([speakerReference, jobReference]));
    await deleteMediaIfOrphan(speakerReference); await deleteMediaIfOrphan(jobReference);
    expect(await db.media.count()).toBe(2);
    const zip = await exportProjectZip(project.id);
    const contents = await JSZip.loadAsync(zip);
    expect(await contents.file("audioProject.json")!.async("string")).not.toContain("secret-test-key");
    const imported = await importProjectZip(zip);
    const importedSpeaker = (await db.audioSpeakers.where("projectId").equals(imported.id).first())!;
    expect(importedSpeaker.mimo?.referenceMediaId).not.toBe(speakerReference);
    const importedJob = (await db.audioGenerationJobs.where("projectId").equals(imported.id).first())!;
    expect(importedJob).toMatchObject({ dormant: true, connector: { id: "imported", provider: "mimo", baseUrl: "" } });
    expect(importedJob.input.kind === "speech" && importedJob.input.mimo?.referenceMediaId).not.toBe(jobReference);
    expect(await collectMediaIds(imported.id)).toHaveLength(2);
    const fetchImpl = vi.fn<typeof fetch>(async () => response());
    expect((await submitAudioGeneration(imported.id, importedJob.id, { fetchImpl })).id).toBe(importedJob.id);
    expect(fetchImpl).not.toHaveBeenCalled();
    const updated = await patchAudioSpeaker(project.id, speaker.id, speaker.revision, { mimo: undefined, voice: "alloy" });
    expect(updated.mimo).toBeUndefined();
    expect(job.input.kind === "speech" && job.input.mimo?.referenceMediaId).toBe(jobReference);
  });
});
