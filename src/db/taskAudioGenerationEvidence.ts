import type {AgentTask, AgentToolCall} from "@/domain/agent";
import type {AudioGenerationJob} from "@/domain/audioGeneration";
import {type AudioOutputEvidence, inspectAudioGenerationOutputs} from "@/lib/audioGeneration/outputEvidence";
import {describeAudioGeneration} from "@/lib/audioGeneration/presentation";
import {db} from "./database";
import {ownedAgentAudioBatchJob} from "@/lib/audioGeneration/batchEvidence";

type TaskOwner = Pick<AgentTask, "id" | "threadId">;
export const SOUND_GENERATION_TOOLS = ["audio_generate_speech", "music_generate", "audio_generation_check"] as const;

/** Origin belongs to the submitting task, never to a later status-reading call. */
export async function ownedTaskAudioGenerationJob(task: TaskOwner, job: AudioGenerationJob): Promise<boolean> {
    if (job.dormant || job.source.kind === "manual") return false;
    if (job.source.kind === "batch") {
        const source = job.source;
        if (source.owner.kind !== "agent") return false;
        return ownedAgentAudioBatchJob(job, {runId: source.owner.runId, threadId: task.threadId, projectId: job.projectId, taskId: task.id});
    }
    const current = await db.agentTasks.get(task.id);
    const run = await db.agentRuns.get(job.source.runId);
    const call = await db.agentToolCalls.get(job.source.callId);
    let args: unknown;
    try {
        args = JSON.parse(call?.arguments ?? "null");
    } catch {
        return false;
    }
    return !!current && current.threadId === task.threadId && current.projectId === job.projectId &&
        !!run && run.taskId === task.id && run.threadId === task.threadId && run.projectId === job.projectId &&
        !!call && call.runId === run.id && call.threadId === task.threadId && call.decision === "approve" && call.requiresConfirmation === true &&
        !!args && typeof args === "object" && (!("projectId" in args) || args.projectId === job.projectId) &&
        call.name === (job.input.kind === "speech" ? "audio_generate_speech" : "music_generate");
}

function describeSource(job: AudioGenerationJob, outputs: AudioOutputEvidence, resultKey?: string) {
    const presentation = describeAudioGeneration(job);
    const available = outputs.availableCount > 0;
    // A partial output is inspectable, but cannot certify the whole generation.
    const supportsResult = resultKey === undefined
        ? outputs.allAvailable && ["saved", "target-conflict"].includes(job.status)
        : outputs.results.length === 1 && outputs.results[0].key === resultKey && outputs.results[0].available;
    const applied = supportsResult && (outputs.selectedCount > 0 || outputs.timelineClipCount > 0);
    const input = job.input;
    const target = input.kind === "speech"
        ? {segmentId: input.segmentId, segmentRevision: input.segmentRevision}
        : {draftId: input.draftId, draftRevision: input.draftRevision};
    const resultTaskId = resultKey === undefined ? undefined : job.results.find(result => result.key === resultKey)?.provenance.taskId;
    const observations = resultKey === undefined ? job.taskObservations?.slice(0, 100)
        : job.taskObservations?.filter(observation => observation.taskId === resultTaskId).slice(0, 1);
    const body = JSON.stringify({
        jobId: job.id, resultKey, projectId: job.projectId, kind: input.kind, revision: job.revision,
        source: job.source, status: job.status, statusLabel: presentation.label,
        checkedAt: presentation.checkedAt, target,
        taskObservations: observations?.map(({
                                                                       taskId,
                                                                       checkedAt,
                                                                       status,
                                                                       lastVerified
                                                                   }) => ({
            taskId,
            checkedAt,
            status,
            lastVerified: lastVerified ? {status: lastVerified.status, observedAt: lastVerified.observedAt} : undefined
        })),
        taskObservationCoverage: {
            total: job.taskObservations?.length ?? 0, included: observations?.length ?? 0,
            omitted: (job.taskObservations?.length ?? 0) - (observations?.length ?? 0)
        },
        outputs, available, supportsResult, appliedToCurrentTarget: applied,
        note: resultKey === undefined
            ? "来源保留原提交执行；读取不代表本轮提交。远端完成、当前本地成果和选用/入轨分别核实；未试听，不能据此判断声音质量。"
            : "仅支持此结果当前本地保存的声音文件，不证明整批生成或任务完成。原提交归属保留，选用和入轨独立核实；未试听，不能判断声音质量。",
    });
    return {
        id: job.id,
        resultKey,
        label: `${input.kind === "speech" ? "配音" : "音乐"} · ${job.connector.provider}${resultKey === undefined ? " · 整批" : ` · ${outputs.results[0]?.title || resultKey}`}`,
        available,
        applied,
        supportsResult,
        body
    };
}

export async function taskAudioGenerationSource(task: TaskOwner, job: AudioGenerationJob, resultKey?: string) {
    if (!await Promise.resolve(ownedTaskAudioGenerationJob(task, job))) throw new Error("声音生成来源不属于当前任务或项目");
    if (resultKey !== undefined && (!resultKey.trim() || resultKey.length > 512 || job.results.filter(result => result.key === resultKey).length !== 1)) throw new Error("声音结果键无效、不存在或不唯一，请重新读取来源");
    const outputs = await Promise.resolve(inspectAudioGenerationOutputs(job, {resultKey}));
    return describeSource(job, outputs, resultKey);
}

/** All individual identities enter wrap-up fingerprints, including results beyond UI coverage. */
export async function taskAudioGenerationOutputSources(task: TaskOwner, job: AudioGenerationJob) {
    if (!await Promise.resolve(ownedTaskAudioGenerationJob(task, job))) throw new Error("声音生成来源不属于当前任务或项目");
    const sources: ReturnType<typeof describeSource>[] = [];
    const counts = new Map<string, number>();
    for (const result of job.results) counts.set(result.key, (counts.get(result.key) ?? 0) + 1);
    for (let offset = 0; offset < job.results.length; offset += 100) {
        const page = await Promise.resolve(inspectAudioGenerationOutputs(job, {offset}));
        for (const result of page.results) {
            if (counts.get(result.key) !== 1 || !result.key.trim() || result.key.length > 512) continue;
            sources.push(describeSource(job, {
                ...page, results: [result], included: 1, omitted: page.total - 1,
                availableCount: result.available ? 1 : 0, selectedCount: result.selected ? 1 : 0,
                timelineClipCount: result.timelineClipCount, allAvailable: page.total === 1 && result.available
            }, result.key));
        }
    }
    return sources;
}

/** Read-only validation of a saved sound tool result against its current durable job. */
export async function taskAudioToolSource(task: TaskOwner, call: AgentToolCall) {
    if (!(SOUND_GENERATION_TOOLS as readonly string[]).includes(call.name)) return undefined;
    let value: unknown;
    try {
        value = JSON.parse(call.result ?? "null");
    } catch {
        return undefined;
    }
    if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") return undefined;
    const job = await db.audioGenerationJobs.get(value.id);
    if (!job || !await ownedTaskAudioGenerationJob(task, job)) return undefined;
    if (call.name !== "audio_generation_check" && (job.source.kind !== "agent" || job.source.callId !== call.id)) return undefined;
    if (call.name === "audio_generation_check") {
        let args: unknown;
        try {
            args = JSON.parse(call.arguments);
        } catch {
            return undefined;
        }
        if (!args || typeof args !== "object" || Array.isArray(args) || !("jobId" in args) || args.jobId !== job.id || "projectId" in args && args.projectId !== job.projectId) return undefined;
    }
    return taskAudioGenerationSource(task, job);
}
