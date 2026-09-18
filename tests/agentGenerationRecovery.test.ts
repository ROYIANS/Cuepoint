import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { db } from "@/db/database";
import { beginAgentRun, interruptThreadRuns } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { markRunningToolsUnknown, resumeAgentRun, saveToolRound, transitionToolCall } from "@/db/agentTools";
import { createChatThread } from "@/db/repo";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import type { AgentGenerationJob } from "@/domain/agentGeneration";
import type { ConnectorConfig } from "@/domain/types";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import type { AgentToolDefinition } from "@/lib/agent/tools";
import { ToolPendingError } from "@/lib/agent/toolErrors";

const connector: ConnectorConfig = { id: "fixture", name: "fixture", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fake-key", updatedAt: "2026-09-19" };
const name = "fixture_generation";

async function begin(): Promise<AgentRun> {
  await updateGeneralAgentConfig({ permissionMode: "full" });
  const thread = await createChatThread();
  const run = await beginAgentRun({ threadId: thread.id, connector, model: "fixture-model", content: "生成场景" });
  await db.agentRuns.update(run.id, { enabledToolNames: [name] });
  return { ...run, enabledToolNames: [name] };
}

function jobFor(call: Pick<AgentToolCall, "id" | "runId" | "threadId">, patch: Partial<AgentGenerationJob> = {}): AgentGenerationJob {
  return {
    version: 1, id: `job-${call.id}`, runId: call.runId, threadId: call.threadId, callId: call.id,
    projectId: "project", connectorId: "fixture", provider: "apimart", baseUrl: "https://example.test/v1",
    model: "fixture-image", kind: "image", target: { kind: "scene", projectId: "project", entityId: "scene", slot: "wide" },
    baseRevision: "revision", sourceRevisions: [], parameters: {}, inputs: [], fingerprint: "fingerprint",
    status: "submitting", createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z", ...patch,
  };
}

async function claimedCall(run: AgentRun, recovery: AgentToolCall["recovery"] = "generation") {
  await saveToolRound(run.id, "", [{ id: "provider-call", type: "function", function: { name, arguments: "{}" } }], [{ title: "生成场景", effect: "network", highRisk: false, recovery }]);
  const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
  await transitionToolCall(run.id, call.id, ["pending"], "running");
  return call;
}

function tool(execute: AgentToolDefinition["execute"], recovery: AgentToolCall["recovery"] = "generation"): AgentToolDefinition {
  return { name, title: "生成场景", description: "Generation runtime fixture", effect: "network", recovery,
    parameters: { type: "object", properties: {}, additionalProperties: false }, parseArguments: (raw) => z.object({}).strict().parse(raw), highRisk: () => false, execute };
}
const callResponse = () => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "provider-call", type: "function", function: { name, arguments: "{}" } }] }, finish_reason: "tool_calls" }] });
const answer = () => Response.json({ choices: [{ message: { content: "结果已保存" }, finish_reason: "stop" }] });

describe("generation recovery proof", () => {
  const cases: Array<{ label: string; patch?: Partial<AgentGenerationJob>; missing?: boolean; resumable: boolean }> = [
    { label: "no saved job", missing: true, resumable: false },
    { label: "submitting without remote identity", patch: { status: "submitting" }, resumable: false },
    { label: "unknown submission", patch: { status: "unknown" }, resumable: false },
    { label: "known failed job without remote identity", patch: { status: "failed", error: "供应商明确拒绝请求" }, resumable: true },
    { label: "unknown multi-task response", patch: { status: "unknown", providerTaskId: "remote-1", providerTaskIds: ["remote-1", "remote-2"] }, resumable: false },
    { label: "same-call remote identity", patch: { status: "submitted", providerTaskId: "remote-1" }, resumable: true },
    { label: "downloaded local result", patch: { status: "downloaded", result: { kind: "image", mediaId: "owned-media" } }, resumable: true },
    { label: "foreign run", patch: { runId: "another-run", providerTaskId: "remote-1" }, resumable: false },
    { label: "foreign thread", patch: { threadId: "another-thread", providerTaskId: "remote-1" }, resumable: false },
    { label: "foreign call", patch: { callId: "another-call", providerTaskId: "remote-1" }, resumable: false },
  ];
  it.each(cases)("reconciles $label without issuing requests", async ({ patch, missing, resumable }) => {
    const run = await begin(); const call = await claimedCall(run);
    if (!missing) await db.agentGenerationJobs.add(jobFor(call, patch));
    db.close(); await db.open();
    await interruptThreadRuns(run.threadId);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe(resumable ? "pending" : "unknown");
    expect((await db.agentRuns.get(run.id))?.status).toBe("interrupted");
    if (resumable) expect((await resumeAgentRun(run.id)).status).toBe("running");
    else await expect(resumeAgentRun(run.id)).rejects.toThrow("不确定");
  });

  it("retains the approval decision for a known remote job during runtime interruption", async () => {
    const run = await begin(); const call = await claimedCall(run);
    await db.agentToolCalls.update(call.id, { decision: "approve" });
    await db.agentGenerationJobs.add(jobFor(call, { status: "running", providerTaskId: "remote-1" }));
    await markRunningToolsUnknown(run.id);
    expect(await db.agentToolCalls.get(call.id)).toMatchObject({ status: "approved", decision: "approve" });
  });

  it("allows code-declared repeatable queries to recover without a generation submission", async () => {
    const run = await begin(); const call = await claimedCall(run, "repeatable");
    await interruptThreadRuns(run.threadId);
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("pending");
    expect(await db.agentGenerationJobs.count()).toBe(0);
    expect((await resumeAgentRun(run.id)).status).toBe("running");
  });
});

describe("parked generation tool runtime", () => {
  it("parks on a known job and resumes its same call without spending model steps on polling", async () => {
    const run = await begin(); let submissionCount = 0;
    const execute = vi.fn<AgentToolDefinition["execute"]>(async (_args, context) => {
      const existing = await db.agentGenerationJobs.where("callId").equals(context.callId).first();
      if (!existing) {
        submissionCount += 1;
        await db.agentGenerationJobs.add(jobFor({ id: context.callId, runId: context.runId, threadId: context.threadId }, { status: "submitted", providerTaskId: "same-remote-job" }));
        throw new ToolPendingError("任务仍在生成，请稍后继续");
      }
      expect(existing.providerTaskId).toBe("same-remote-job");
      return { jobId: existing.id, mediaId: "fixture-result" };
    });
    const definition = tool(execute);
    const initialFetch = vi.fn(async () => callResponse());
    await executeChatRun(run, connector.apiKey, new AbortController(), initialFetch, [definition]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "interrupted", modelStep: 1, error: "任务仍在生成，请稍后继续" });
    expect(call.status).toBe("pending");
    expect(call.result).toBeUndefined();
    expect(initialFetch).toHaveBeenCalledTimes(1);
    db.close(); await db.open();
    const finalFetch = vi.fn(async () => answer());
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), finalFetch, [definition]);
    expect(await db.agentRuns.get(run.id)).toMatchObject({ status: "completed", modelStep: 2 });
    expect((await db.agentToolCalls.get(call.id))?.status).toBe("completed");
    expect(await db.agentToolCalls.where("runId").equals(run.id).count()).toBe(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(submissionCount).toBe(1);
    expect(finalFetch).toHaveBeenCalledTimes(1);
  });

  it("does not trust ToolPendingError alone as proof that a submission can be resumed", async () => {
    const run = await begin();
    const execute = vi.fn(async () => { throw new ToolPendingError("未收到任务标识"); });
    const definition = tool(execute);
    await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => callResponse()), [definition]);
    expect((await db.agentRuns.get(run.id))?.status).toBe("interrupted");
    expect((await db.agentToolCalls.where("runId").equals(run.id).toArray())[0].status).toBe("unknown");
    await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), vi.fn(async () => answer()), [definition])).rejects.toThrow("不确定");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
