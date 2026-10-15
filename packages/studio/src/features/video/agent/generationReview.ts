import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {commitGenerationReview, type GenerationReviewExpected, readGenerationReviewCall} from "../../agent/commands/agentTools";
import {generationSubmitSchema} from "./generationProfiles";
import {prepareAgentGeneration} from "./generationRuntime";
import {targetRevision} from "../../../platform/data/revision";

/** Purely local preparation and approval; never submits, queries, or uploads media. */
export async function reviewAndApproveGeneration(
    runId: string, callId: string, rawArgs: unknown, expected: GenerationReviewExpected, store?: ProductStore
): Promise<void> {
    const db = store ?? productDb;
    const call = await readGenerationReviewCall(runId, callId, expected, db);
    const original = generationSubmitSchema.parse(JSON.parse(call.arguments));
    const reviewed = generationSubmitSchema.parse(rawArgs);
    if (targetRevision({target: original.target, inputs: original.inputs}) !== targetRevision({
        target: reviewed.target,
        inputs: reviewed.inputs
    })) throw new Error("确认时不能变更生成目标或输入素材，请重新发起任务");
    const context = {runId, threadId: call.threadId, callId, signal: new AbortController().signal};
    // Recompute the original preview as well: user parameter edits must not approve
    // an unseen target/input/configuration mutation that occurred while reviewing.
    const before = await prepareAgentGeneration(original, context, db);
    if (before.revision !== expected.revision) throw new Error("生成目标、参考素材或原配置已变化，请重新准备请求");
    const preview = await prepareAgentGeneration(reviewed, context, db);
    const after = await prepareAgentGeneration(original, context, db);
    if (after.revision !== expected.revision) throw new Error("生成目标或参考素材在确认期间发生变化，请重新准备请求");
    await commitGenerationReview(runId, callId, {arguments: JSON.stringify(reviewed), preview}, expected, db);
}
