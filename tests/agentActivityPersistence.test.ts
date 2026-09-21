import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { saveToolRound } from "@/db/agentTools";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { createChatThread } from "@/db/repo";
import { executeChatRun } from "@/lib/agent/runChat";
import { buildRunActivity } from "@/lib/agent/runPresentation";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = { id: "activity-test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-09-21" };

describe("public tool-round activity persistence", () => {
  it("rolls back both the tool ledger and public snapshot if the run write fails", async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "test-model", content: "检查工作区" });
    const failure = vi.spyOn(db.agentRuns, "update").mockRejectedValueOnce(new Error("activity storage failure"));
    try {
      await expect(saveToolRound(run.id, "准备检查", [{ id: "call", type: "function", function: { name: "workspace_overview", arguments: "{}" } }], [{ title: "检查工作区", effect: "read", highRisk: false }], undefined, { reasoning: "公开思考" })).rejects.toThrow("activity storage failure");
    } finally { failure.mockRestore(); }
    expect(await db.agentToolCalls.where("runId").equals(run.id).count()).toBe(0);
    expect(await db.agentRuns.get(run.id)).toEqual(run);
  });

  it.each(["chat-completions", "responses"] as const)("preserves chronological public output through final answer for %s", async (protocol) => {
    await updateGeneralAgentConfig({ enabledSkillIds: ["workspace"] });
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector, model: protocol === "responses" ? "gpt-5.6-luna" : "test-model", content: "检查工作区" });
    expect(run.protocol).toBe(protocol);
    let requestCount = 0;
    const fetchImpl: typeof fetch = async () => {
      requestCount += 1;
      const isToolRound = requestCount < 3;
      const content = isToolRound ? `过程 ${requestCount}` : "最终答复";
      const reasoning = isToolRound ? `公开思考 ${requestCount}` : "最终思考";
      if (protocol === "responses") return Response.json({ id: `response-${requestCount}`, status: "completed", output: [
        { type: "reasoning", summary: [{ type: "summary_text", text: reasoning }], encrypted_content: "provider-opaque-secret" },
        { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: content, annotations: [] }] },
        ...(isToolRound ? [{ type: "function_call", call_id: `call-${requestCount}`, name: "workspace_overview", arguments: "{}", status: "completed" }] : []),
      ] });
      return Response.json({ choices: [{ message: { content, reasoning_content: reasoning, ...(isToolRound ? { tool_calls: [{ id: `call-${requestCount}`, type: "function", function: { name: "workspace_overview", arguments: "{}" } }] } : {}) }, finish_reason: isToolRound ? "tool_calls" : "stop" }] });
    };
    await executeChatRun(run, connector.apiKey, new AbortController(), fetchImpl);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.status).toBe("completed");
    expect(saved.activitySteps).toMatchObject([
      { step: 1, content: "过程 1", reasoning: "公开思考 1" },
      { step: 2, content: "过程 2", reasoning: "公开思考 2" },
    ]);
    expect(await db.chatMessages.get(run.assistantMessageId)).toMatchObject({ content: "最终答复", reasoning: "最终思考" });
    const activity = buildRunActivity(saved, await db.agentToolCalls.where("runId").equals(run.id).toArray());
    expect(activity.map((item) => item.kind)).toEqual(["reasoning", "text", "tools", "reasoning", "text", "tools"]);
    expect(JSON.stringify(activity)).not.toMatch(/最终答复|最终思考|provider-opaque-secret/);
    if (protocol === "responses") expect(JSON.stringify(saved.responseItems)).toContain("provider-opaque-secret");
  });
});
