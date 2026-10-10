import {db} from "@/db/database";
import type {AudioGenerationJob} from "@/domain/audioGeneration";
import type {AudioGenerationBatch} from "@/domain/audioGenerationBatch";
import {targetRevision} from "@/lib/productionRevision";

/** Retries retain their real preparation root; a retry marker alone is no origin proof. */
function hasPreparationOrigin(batch: AudioGenerationBatch, call: {id: string; result?: string}): boolean | Promise<boolean> {
    const visited = new Set<string>();
    // Bound read work. Excessively long/cyclic/missing history remains unverified.
    function inspect(current: AudioGenerationBatch | undefined, depth: number): boolean | Promise<boolean> {
        if (!current || depth >= 100 || visited.has(current.id) || current.projectId !== batch.projectId || current.chapterId !== batch.chapterId || current.dormant ||
            targetRevision(current.owner) !== targetRevision(batch.owner)) return false;
        visited.add(current.id);
        if (current.sourceCallId !== undefined) {
            if (current.sourceCallId !== call.id) return false;
            let result: unknown;
            try { result = JSON.parse(call.result ?? "null"); } catch { return false; }
            return !!result && typeof result === "object" && !Array.isArray(result) &&
                "batchId" in result && result.batchId === current.id && "projectId" in result && result.projectId === current.projectId &&
                "chapterId" in result && result.chapterId === current.chapterId;
        }
        if (!current.retrySourceBatchId) return false;
        // Return the Dexie chain itself: an extra resolved native async hop can
        // complete an owning read transaction on the no-task/root-only path.
        return db.audioGenerationBatches.get(current.retrySourceBatchId).then(next => inspect(next, depth + 1));
    }
    return inspect(batch, 0);
}

/** Read-only origin proof shared by task sources and final review. It does not prove an output exists. */
export async function ownedAgentAudioBatchJob(job: AudioGenerationJob, expected: {runId: string; threadId: string; projectId: string; taskId?: string}): Promise<boolean> {
    if (job.dormant || job.source.kind !== "batch" || job.source.owner.kind !== "agent" || job.input.kind !== "speech") return false;
    const source = job.source, owner = source.owner;
    if (owner.kind !== "agent" || owner.runId !== expected.runId || owner.threadId !== expected.threadId || owner.taskId !== expected.taskId || job.projectId !== expected.projectId) return false;
    const batch = await db.audioGenerationBatches.get(source.batchId), item = await db.audioGenerationBatchItems.get(source.itemId);
    const run = await db.agentRuns.get(owner.runId), call = await db.agentToolCalls.get(owner.callId);
    const thread = await db.chatThreads.get(owner.threadId);
    if (!run || !thread || run.projectId !== job.projectId || thread.projectId !== job.projectId || run.threadId !== owner.threadId || run.taskId !== owner.taskId ||
        !call || call.runId !== run.id || call.threadId !== owner.threadId || call.name !== "prepare_audio_generation_batch" || call.status !== "completed" || call.atomic !== true || call.effect !== "write" ||
        !batch || batch.projectId !== job.projectId || batch.dormant || !batch.confirmedAt || !batch.itemIds.includes(source.itemId) || !batch.confirmedItemIds.includes(source.itemId) ||
        targetRevision(batch.owner) !== targetRevision(owner) ||
        !item || item.projectId !== job.projectId || item.batchId !== batch.id || item.chapterId !== batch.chapterId || !item.included || item.state !== "linked" ||
        item.segmentId !== job.input.segmentId || item.jobId !== job.id || item.intentId !== job.intentId ||
        targetRevision(item.snapshot.input) !== targetRevision(job.input) || targetRevision(item.snapshot.connector) !== targetRevision(job.connector)) return false;
    const origin = hasPreparationOrigin(batch, call);
    if (!(typeof origin === "boolean" ? origin : await origin)) return false;
    if (owner.taskId) {
        const task = await db.agentTasks.get(owner.taskId);
        if (!task || task.threadId !== owner.threadId || task.projectId !== job.projectId) return false;
    }
    return true;
}
