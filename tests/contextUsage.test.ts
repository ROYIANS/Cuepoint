import { describe, expect, it } from "vitest";
import { estimateContextUsage, estimateTokens, summarizeContextRows } from "../packages/studio/src/features/agent/runtime/contextUsage";
import { buildContextMessages, selectContextHistory } from "@/features/agent/runtime/contextPlanner";
import { DEFAULT_CONTEXT_POLICY } from "@/features/agent/runtime/contextPolicy";
import type {ChatMessage} from "./../packages/studio/src/features/agent/models/chat";

describe("context preview", () => {
  it("shares eligible history rules with sending and trims the draft", () => {
    const history = [
      { id: "u", role: "user", content: "question", status: "complete" },
      { id: "bad", role: "assistant", content: "partial", status: "interrupted" },
      { id: "stream", role: "assistant", content: "live", status: "streaming" },
      { id: "legacy", role: "assistant", content: "old" },
    ].map((message) => ({ threadId: "t", createdAt: "2026-09-18", ...message })) as ChatMessage[];
    expect(buildContextMessages("system", "skills", selectContextHistory(history, DEFAULT_CONTEXT_POLICY), "  draft  ")).toEqual([
      { role: "system", content: "system\nskills" }, { role: "user", content: "question" },
      { role: "assistant", content: "old" }, { role: "user", content: "draft" },
    ]);
    expect(buildContextMessages("", "", [], " ")).toEqual([{ role: "system", content: "" }]);
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
    expect(withTools.categories[1].tokens).toBe(base.categories[1].tokens);
    expect(withTools.categories.find(item => item.id === "tool-schemas")!.tokens).toBeGreaterThan(0);
    expect(withTools.categories[2].tokens).toBeGreaterThan(4);
    expect(withTools.categories.find((item) => item.id === "results")!.tokens).toBeGreaterThan(4);
    expect(withTools.total).toBe(withTools.categories.reduce((sum, item) => sum + item.tokens, 0));
  });

  it("handles Unicode and empty text without counting UTF-16 surrogates twice", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("中文")).toBe(3);
    expect(estimateTokens("😀")).toBe(2);
  });
});

describe("context popover rows", () => {
    const cat = (id: string, tokens: number) => ({id, label: id, tokens, color: "#000"});
    it("merges categories into at most five non-zero rows and folds request structure into the system row", () => {
        const rows = summarizeContextRows([
            cat("assistant", 100), cat("envelope", 20), cat("skills", 5), cat("tool-schemas", 50),
            cat("messages", 300), cat("summary", 40), cat("results", 0), cat("memory", 10), cat("references", 15),
        ]);
        expect(rows.map(row => [row.label, row.tokens])).toEqual([
            ["系统指令", 120], ["工具", 55], ["对话", 340], ["记忆与参考", 25],
        ]);
        expect(rows.reduce((sum, row) => sum + row.tokens, 0)).toBe(540);
    });
    it("returns no rows when everything is zero", () => {
        expect(summarizeContextRows([cat("assistant", 0)])).toEqual([]);
    });
});
