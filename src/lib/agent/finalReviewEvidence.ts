import {db} from "@/db/database";
import type {AgentRun, AgentToolCall} from "@/domain/agent";
import type {AudioGenerationJob} from "@/domain/audioGeneration";
import type {FinalReviewEvidence, FinalReviewSnapshot} from "@/domain/agentFinalReview";
import {inspectAudioGenerationOutputs} from "@/lib/audioGeneration/outputEvidence";
import {ownedAgentAudioBatchJob} from "@/lib/audioGeneration/batchEvidence";
import {inspectTaskGenerationOutput} from "@/db/taskGenerationEvidence";
import {targetRevision} from "@/lib/productionRevision";
import {describeRunWrites} from "./runWriteOutcomes";

const MAX_EVIDENCE = 40;
const MAX_JOBS = 20;

export const finalReviewTables = () => [db.agentRuns, db.agentToolCalls, db.chatThreads, db.chatMessages, db.agentTasks, db.projects,
    db.audioGenerationJobs, db.audioTakes, db.musicWorks, db.media, db.audioSegments, db.audioChapters, db.audioTracks, db.audioClips,
    db.agentGenerationJobs, db.shots, db.episodes, db.characters, db.scenes, db.props, db.styles,
    db.audioGenerationBatches, db.audioGenerationBatchItems];

function ownsApprovedSubmission(run: AgentRun, calls: readonly AgentToolCall[], callId: string, name: string): AgentToolCall | undefined {
    return calls.find(call => call.id === callId && call.runId === run.id && call.threadId === run.threadId &&
        call.name === name && call.effect === "network" && call.requiresConfirmation && call.decision === "approve" &&
        ["completed", "failed", "unknown"].includes(call.status));
}

function submittedToProject(call: AgentToolCall, projectId: string): boolean {
    try {
        const raw: unknown = JSON.parse(call.arguments);
        return !!raw && typeof raw === "object" && !(Array.isArray(raw)) &&
            (!("projectId" in raw) || raw.projectId === projectId);
    } catch { return false; }
}

/** Batch preparation is origin only; actual durable confirmation and paid job linkage are required. */
async function audioSubmissionOrigin(run: AgentRun, calls: readonly AgentToolCall[], job: AudioGenerationJob): Promise<{call: AgentToolCall; fingerprint?: string} | undefined> {
    const source = job.source;
    if (job.dormant || job.projectId !== run.projectId) return;
    if (source.kind === "agent") {
        const call = source.runId === run.id ? ownsApprovedSubmission(run, calls, source.callId,
            job.input.kind === "speech" ? "audio_generate_speech" : "music_generate") : undefined;
        return call && submittedToProject(call, job.projectId) ? {call} : undefined;
    }
    if (source.kind !== "batch" || source.owner.kind !== "agent" || source.owner.runId !== run.id ||
        source.owner.threadId !== run.threadId || source.owner.taskId !== run.taskId) return;
    if (!await ownedAgentAudioBatchJob(job, {runId: run.id, threadId: run.threadId, projectId: job.projectId, taskId: run.taskId})) return;
    const owner = source.owner;
    const batch = await db.audioGenerationBatches.get(source.batchId), item = await db.audioGenerationBatchItems.get(source.itemId);
    const call = calls.find(row => row.id === owner.callId && row.runId === run.id && row.threadId === run.threadId &&
        row.name === "prepare_audio_generation_batch" && row.status === "completed" && row.effect === "write" && row.atomic);
    if (!batch || !item || !call) return;
    return {call, fingerprint: targetRevision({batch, item})};
}

/** Caller owns a consistent transaction. Only bounded validated facts enter model input. */
export async function collectFinalReviewSnapshot(run: AgentRun): Promise<FinalReviewSnapshot> {
    const calls = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).sort((a, b) => a.step - b.step || a.order - b.order || a.id.localeCompare(b.id));
    const owned = calls.filter(call => call.threadId === run.threadId);
    const writes = describeRunWrites(run, owned);
    const evidence: FinalReviewEvidence[] = writes.entries.slice(0, 20).map((entry, index) => ({
        ref: `w${index}`, kind: "write", callId: entry.callId, entityKind: entry.kind, operation: entry.operation,
        id: entry.id, ownerId: entry.ownerId, ...(entry.revision === undefined ? {} : {revision: entry.revision})
    }));
    let omitted = writes.total - evidence.length;
    if (run.projectId) {
        const jobs = (await db.audioGenerationJobs.where("projectId").equals(run.projectId).toArray())
            .filter(job => !job.dormant && (job.source.kind === "agent" && job.source.runId === run.id ||
                job.source.kind === "batch" && job.source.owner.kind === "agent" && job.source.owner.runId === run.id)).sort((a, b) => a.id.localeCompare(b.id));
        omitted += jobs.slice(MAX_JOBS).reduce((sum, job) => sum + job.results.length, 0);
        for (const job of jobs.slice(0, MAX_JOBS)) {
            const origin = await Promise.resolve(audioSubmissionOrigin(run, owned, job));
            if (!origin) continue;
            const {call} = origin;
            const outputs = await Promise.resolve(inspectAudioGenerationOutputs(job, {limit: 40}));
            omitted += outputs.omitted;
            for (const item of outputs.results) {
                if (evidence.length >= MAX_EVIDENCE) { omitted++; continue; }
                evidence.push({ref: `o${evidence.length}`, kind: "output", callId: call.id, jobId: job.id, resultKey: item.key,
                    mediaId: item.mediaId, available: item.available,
                    ...(item.available ? {selected: item.selected, placed: item.timelineClipCount > 0} : {}),
                    fingerprint: targetRevision({jobRevision: job.revision, status: job.status, originFingerprint: origin.fingerprint, item: {
                        key: item.key, availability: item.availability, outputFingerprint: item.outputFingerprint,
                        placementRevision: item.placementRevision, media: item.media
                    }})});
            }
        }
    }
    const pictureJobs = (await db.agentGenerationJobs.where("runId").equals(run.id).toArray())
        .filter(job => job.threadId === run.threadId && job.projectId === run.projectId && !job.batchId).sort((a, b) => a.id.localeCompare(b.id));
    omitted += Math.max(0, pictureJobs.length - MAX_JOBS);
    for (const job of pictureJobs.slice(0, MAX_JOBS)) {
        const call = job.callId ? ownsApprovedSubmission(run, owned, job.callId, "submit_generation") : undefined;
        if (!call || job.target.projectId !== run.projectId) continue;
        if (evidence.length >= MAX_EVIDENCE) { omitted++; continue; }
        const output = await Promise.resolve(inspectTaskGenerationOutput(job));
        evidence.push({ref: `o${evidence.length}`, kind: "output", callId: call.id, jobId: job.id,
            mediaId: output.media?.id, available: output.available, ...(output.available ? {placed: output.applied} : {}),
            fingerprint: targetRevision({status: job.status, result: job.result, available: output.available, applied: output.applied,
                media: output.media ? {id: output.media.id, owner: output.media.projectId, size: output.media.blob.size, mimeType: output.media.mimeType} : null})});
    }
    const task = run.taskId ? await db.agentTasks.get(run.taskId) : undefined;
    const project = run.projectId ? await db.projects.get(run.projectId) : undefined;
    return {
        fingerprint: targetRevision({evidence, omitted, calls: calls.map(call => ({id: call.id, status: call.status, updatedAt: call.updatedAt})),
            project: project ?? null, task: task ?? null}),
        evidence, omitted, uncoveredWriteCalls: writes.uncoveredCalls,
        unresolvedCalls: calls.filter(call => call.threadId !== run.threadId || !["completed", "failed", "rejected"].includes(call.status)).length
    };
}
