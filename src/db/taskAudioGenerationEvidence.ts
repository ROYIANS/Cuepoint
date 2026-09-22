import type { AgentTask, AgentToolCall } from "@/domain/agent";
import type { AudioGenerationJob } from "@/domain/audioGeneration";
import { inspectAudioGenerationOutputs } from "@/lib/audioGeneration/outputEvidence";
import { describeAudioGeneration } from "@/lib/audioGeneration/presentation";
import { db } from "./database";

type TaskOwner = Pick<AgentTask, "id" | "threadId">;
export const SOUND_GENERATION_TOOLS = ["audio_generate_speech", "music_generate", "audio_generation_check"] as const;

/** Origin belongs to the submitting task, never to a later status-reading call. */
export async function ownedTaskAudioGenerationJob(task: TaskOwner, job: AudioGenerationJob): Promise<boolean> {
  if (job.source.kind !== "agent" || job.dormant) return false;
  const current = await db.agentTasks.get(task.id);
  const run = await db.agentRuns.get(job.source.runId);
  const call = await db.agentToolCalls.get(job.source.callId);
  let args: unknown;
  try { args = JSON.parse(call?.arguments ?? "null"); } catch { return false; }
  return !!current && current.threadId === task.threadId && current.projectId === job.projectId &&
    !!run && run.taskId === task.id && run.threadId === task.threadId && run.projectId === job.projectId &&
    !!call && call.runId === run.id && call.threadId === task.threadId && call.decision === "approve" && call.requiresConfirmation === true &&
    !!args && typeof args === "object" && "projectId" in args && args.projectId === job.projectId &&
    call.name === (job.input.kind === "speech" ? "audio_generate_speech" : "music_generate");
}

export async function taskAudioGenerationSource(task: TaskOwner, job: AudioGenerationJob) {
  if (!await ownedTaskAudioGenerationJob(task, job)) throw new Error("声音生成来源不属于当前任务或项目");
  const outputs = await inspectAudioGenerationOutputs(job);
  const presentation = describeAudioGeneration(job);
  const available = outputs.availableCount > 0;
  // A partial output is inspectable, but cannot certify the whole generation.
  const supportsResult = outputs.allAvailable && ["saved", "target-conflict"].includes(job.status);
  const applied = supportsResult && (outputs.selectedCount > 0 || outputs.timelineClipCount > 0);
  const input = job.input;
  const target = input.kind === "speech"
    ? { segmentId: input.segmentId, segmentRevision: input.segmentRevision }
    : { draftId: input.draftId, draftRevision: input.draftRevision };
  const body = JSON.stringify({
    jobId: job.id, projectId: job.projectId, kind: input.kind, revision: job.revision,
    source: job.source, status: job.status, statusLabel: presentation.label,
    checkedAt: presentation.checkedAt, target,
    taskObservations: job.taskObservations?.slice(0, 100).map(({ taskId, checkedAt, status, lastVerified }) => ({ taskId, checkedAt, status, lastVerified: lastVerified ? { status: lastVerified.status, observedAt: lastVerified.observedAt } : undefined })),
    outputs, available, supportsResult, appliedToCurrentTarget: applied,
    note: "来源保留原提交执行；读取不代表本轮提交。远端完成、当前本地成果和选用/入轨分别核实；未试听，不能据此判断声音质量。",
  });
  return { id: job.id, label: `${input.kind === "speech" ? "配音" : "音乐"} · ${job.connector.provider}`, available, applied, supportsResult, body };
}

/** Read-only validation of a saved sound tool result against its current durable job. */
export async function taskAudioToolSource(task: TaskOwner, call: AgentToolCall) {
  if (!(SOUND_GENERATION_TOOLS as readonly string[]).includes(call.name)) return undefined;
  let value: unknown;
  try { value = JSON.parse(call.result ?? "null"); } catch { return undefined; }
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") return undefined;
  const job = await db.audioGenerationJobs.get(value.id);
  if (!job || !await ownedTaskAudioGenerationJob(task, job)) return undefined;
  if (call.name !== "audio_generation_check" && (job.source.kind !== "agent" || job.source.callId !== call.id)) return undefined;
  if (call.name === "audio_generation_check") {
    let args: unknown;
    try { args = JSON.parse(call.arguments); } catch { return undefined; }
    if (!args || typeof args !== "object" || !("jobId" in args) || args.jobId !== job.id || !("projectId" in args) || args.projectId !== job.projectId) return undefined;
  }
  return taskAudioGenerationSource(task, job);
}
