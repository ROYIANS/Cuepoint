import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { AtomicToolRollbackError, resumeAgentRun, transitionToolCall } from "@/db/agentTools";
import { prepareGenerationBatch } from "@/db/agentGenerationBatches";
import { addShot, createChatThread, createProject } from "@/db/repo";
import { generationSubmitSchema } from "@/lib/agent/generationProfiles";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import { recoverAbandonedRuns, type ThreadLockManager } from "@/lib/agent/runOwnership";
import { preloadFixtureGroups, saveFixtureToolRound } from "./helpers/toolDispatch";

const chat = { id: "chat", name: "Chat", definitionId: "openai-compatible", baseUrl: "https://chat.test/v1", apiKey: "fixture", updatedAt: "now" };
const locks: ThreadLockManager = { request: async (_name, _options, callback) => callback({}) };
const answer = () => Response.json({ choices: [{ message: { content: "草稿已准备，等待确认" }, finish_reason: "stop" }] });
async function fixture() {
  await updateGeneralAgentConfig({ enabledSkillIds: ["media-generation"], permissionMode: "full" });
  await db.connectors.put({ ...chat, id: "images", definitionId: "apimart", baseUrl: "https://images.test/v1" });
  const project = await createProject("场景参考");
  const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
  const shot = await addShot(project.id, episode.id);
  const thread = await createChatThread();
  const run = await preloadFixtureGroups(await beginAgentRun({ threadId: thread.id, connector: chat, model: "fixture", content: "准备三张图片" }), ["media-generation"]);
  const candidate = generationSubmitSchema.parse({ connectorId: "images", model: "gpt-image-2.5-flare", prompt: "安静的街道", parameters: { size: "9:16", resolution: "2k", quality: "high" }, target: { projectId: project.id, episodeId: episode.id, entityId: shot.id, kind: "shot", slot: "firstFrame" } });
  return { run, thread, candidate };
}
const response = (candidate: unknown, id: string) => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id, type: "function", function: { name: "prepare_generation_batch", arguments: JSON.stringify({ title: "三组参考", candidates: [candidate] }) } }] }, finish_reason: "tool_calls" }] });
async function savedCall(f: Awaited<ReturnType<typeof fixture>>) {
  await saveFixtureToolRound(f.run.id, "", [{ id: "prepare", type: "function", function: { name: "prepare_generation_batch", arguments: JSON.stringify({ title: "参考", candidates: [f.candidate] }) } }], [{ title: "准备批量生成", effect: "bookkeeping", highRisk: false, atomic: true }]);
  const call = (await db.agentToolCalls.where("runId").equals(f.run.id).first())!;
  await transitionToolCall(f.run.id, call.id, ["pending"], "running");
  return { call, context: { runId: f.run.id, threadId: f.thread.id, callId: call.id, signal: new AbortController().signal } };
}

describe("local batch preparation recovery", () => {
  it("returns image parameter guidance to the model and accepts a corrected call in the same run", async () => {
    const f = await fixture();
    const wrong = { ...f.candidate, parameters: { aspectRatio: "9:16", mode: "text", quality: "high", resolution: "2k" } };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(wrong, "wrong"))
      .mockImplementationOnce(async (_url, init) => {
        const messages = JSON.parse(String(init?.body)).messages as Array<{ role: string; content: string }>;
        expect(messages.at(-1)?.role).toBe("tool");
        expect(messages.at(-1)?.content).toContain("parameters.size");
        expect(await db.agentGenerationBatches.count()).toBe(0);
        return response(f.candidate, "corrected");
      }).mockImplementationOnce(async () => answer());
    await executeChatRun(f.run, chat.apiKey, new AbortController(), fetcher);
    const calls = await db.agentToolCalls.where("runId").equals(f.run.id).sortBy("step");
    expect(calls.map(call => call.status)).toEqual(["failed", "completed"]);
    expect(calls[0].arguments).toContain('"aspectRatio":"9:16"');
    expect((await db.agentRuns.get(f.run.id))?.status).toBe("completed");
    expect(await db.agentGenerationBatches.count()).toBe(1);
    expect(await db.agentGenerationJobs.count()).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith(chat.baseUrl))).toBe(true);
  });

  it("classifies snapshot failures as local preparation failures without creating partial batches", async () => {
    const f = await fixture(), { context } = await savedCall(f);
    const missing = { ...f.candidate, connectorId: "deleted-connector" };
    await expect(prepareGenerationBatch("参考", [f.candidate, missing], context)).rejects.toBeInstanceOf(AtomicToolRollbackError);
    expect(await db.agentGenerationBatches.count()).toBe(0);
    expect(await db.agentGenerationBatchItems.count()).toBe(0);
    expect(await db.agentGenerationJobs.count()).toBe(0);
  });

  it("repairs a parked historical unknown on startup and resumes its original conversation", async () => {
    const f = await fixture(), { call } = await savedCall(f);
    await db.agentToolCalls.update(call.id, { status: "unknown", error: "操作结果尚不确定" });
    await finishAgentRun(f.run.id, "failed");
    await recoverAbandonedRuns(locks);
    const recovered = (await db.agentToolCalls.get(call.id))!;
    expect(recovered.status).toBe("failed");
    expect(recovered.arguments).toBe(call.arguments);
    expect(JSON.parse(recovered.result!)).toMatchObject({ code: "BATCH_PREPARATION_NOT_COMMITTED", submitted: false });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(f.candidate, "fixed")).mockImplementationOnce(async () => answer());
    await resumeChatRun(f.run.id, chat.apiKey, new AbortController(), fetcher);
    expect((await db.agentRuns.get(f.run.id))?.status).toBe("completed");
    expect(await db.chatThreads.count()).toBe(1);
    expect(await db.agentGenerationBatches.count()).toBe(1);
    expect(await db.agentGenerationJobs.count()).toBe(0);
  });

  it("rolls back candidate writes when persisting the completed tool result fails", async () => {
    const f = await fixture(), { call, context } = await savedCall(f);
    const original = db.agentToolCalls.update.bind(db.agentToolCalls);
    const failure = vi.spyOn(db.agentToolCalls, "update").mockImplementation(async (key, changes) => {
      if (typeof changes === "object" && changes.status === "completed") throw new Error("ledger write failed");
      return original(key, changes);
    });
    try {
      await expect(prepareGenerationBatch("参考", [f.candidate], context)).rejects.toBeInstanceOf(AtomicToolRollbackError);
    } finally { failure.mockRestore(); }
    expect(await db.agentGenerationBatches.count()).toBe(0);
    expect(await db.agentGenerationBatchItems.count()).toBe(0);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("running");
  });

  it("reuses an existing batch without recreating it and keeps recovery idempotent", async () => {
    const f = await fixture(), { call, context } = await savedCall(f);
    const result = await prepareGenerationBatch("参考", [f.candidate], context) as { batchId: string };
    await db.agentToolCalls.update(call.id, { status: "unknown", result: undefined });
    await finishAgentRun(f.run.id, "failed");
    await recoverAbandonedRuns(locks);
    const recovered = (await db.agentToolCalls.get(call.id))!;
    expect(recovered.status).toBe("completed");
    expect(JSON.parse(recovered.result!).batchId).toBe(result.batchId);
    await recoverAbandonedRuns(locks);
    expect(await db.agentToolCalls.get(call.id)).toEqual(recovered);
    await resumeChatRun(f.run.id, chat.apiKey, new AbortController(), vi.fn(async () => answer()));
    expect(await db.agentGenerationBatches.count()).toBe(1);
    expect(await db.agentGenerationBatchItems.count()).toBe(1);
    expect(await db.agentGenerationJobs.count()).toBe(0);
  });

  it("leaves foreign evidence and actual network uncertainty blocked", async () => {
    const f = await fixture(), { call, context } = await savedCall(f);
    const result = await prepareGenerationBatch("参考", [f.candidate], context) as { batchId: string };
    await db.agentGenerationBatches.update(result.batchId, { threadId: "foreign" });
    await db.agentToolCalls.update(call.id, { status: "unknown", result: undefined });
    await finishAgentRun(f.run.id, "failed");
    await recoverAbandonedRuns(locks);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("unknown");
    await expect(resumeAgentRun(f.run.id)).rejects.toThrow("不确定");
    await db.agentToolCalls.update(call.id, { name: "submit_generation", effect: "network", atomic: false });
    await recoverAbandonedRuns(locks);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("unknown");
    await expect(resumeAgentRun(f.run.id)).rejects.toThrow("不确定");
  });

  it("does not touch another tab's execution or cancelled history", async () => {
    const f = await fixture(), { call } = await savedCall(f);
    await db.agentToolCalls.update(call.id, { status: "unknown" });
    await finishAgentRun(f.run.id, "failed");
    await recoverAbandonedRuns({ request: async (_name, _options, callback) => callback(null) });
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("unknown");
    await db.agentRuns.update(f.run.id, { status: "cancelled" });
    await recoverAbandonedRuns(locks);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("unknown");
  });
});
