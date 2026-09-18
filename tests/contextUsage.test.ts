import { describe, expect, it } from "vitest";
import { buildAgentRequestMessages, estimateContextUsage, estimateTokens } from "../src/lib/agent/contextUsage";
import type { ChatMessage } from "../src/domain/types";

describe("context preview", () => {
  it("shares eligible history rules with sending and trims the draft", () => {
    const history = [
      { id: "u", role: "user", content: "question", status: "complete" },
      { id: "bad", role: "assistant", content: "partial", status: "interrupted" },
      { id: "stream", role: "assistant", content: "live", status: "streaming" },
      { id: "legacy", role: "assistant", content: "old" },
    ].map((message) => ({ threadId: "t", createdAt: "2026-09-18", ...message })) as ChatMessage[];
    expect(buildAgentRequestMessages("system", "skills", history, "  draft  ")).toEqual([
      { role: "system", content: "system\nskills" }, { role: "user", content: "question" },
      { role: "assistant", content: "old" }, { role: "user", content: "draft" },
    ]);
    expect(buildAgentRequestMessages("", "", [], " ")).toEqual([{ role: "system", content: "" }]);
  });

  it("counts tool arguments, results and schemas once and splits system skills", () => {
    const base = estimateContextUsage({ instructions: "system", skillInstructions: "skill", tools: [], messages: [{ role: "system", content: "system\nskill" }] });
    expect(base.categories[0].tokens).toBe(estimateTokens("system") + 4);
    expect(base.categories[1].tokens).toBe(estimateTokens("skill"));
    const withTools = estimateContextUsage({ instructions: "system", skillInstructions: "skill", tools: [{ type: "function", function: { name: "test", description: "test schema", parameters: {} } }], messages: [
      { role: "system", content: "system\nskill" },
      { role: "assistant", content: "", tool_calls: [{ id: "call", type: "function", function: { name: "test", arguments: '{"title":"测试"}' } }] },
      { role: "tool", content: '{"result":"保存成功"}', tool_call_id: "call" },
    ] });
    expect(withTools.categories[0].tokens).toBe(base.categories[0].tokens);
    expect(withTools.categories[1].tokens).toBeGreaterThan(base.categories[1].tokens);
    expect(withTools.categories[2].tokens).toBeGreaterThan(4);
    expect(withTools.categories[3].tokens).toBeGreaterThan(4);
    expect(withTools.total).toBe(withTools.categories.reduce((sum, item) => sum + item.tokens, 0));
  });

  it("handles Unicode and empty text without counting UTF-16 surrogates twice", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("中文")).toBe(3);
    expect(estimateTokens("😀")).toBe(2);
  });
});
