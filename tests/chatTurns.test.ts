import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/domain/types";
import { buildChatTurns, getActiveTurnIndex, turnExcerpt, MAX_VISIBLE_TURNS, MIN_TURNS_FOR_NAVIGATION } from "@/lib/agent/chatTurns";

function message(id: string, role: ChatMessage["role"], content: string, status?: ChatMessage["status"]): ChatMessage {
  return { id, threadId: "thread", role, content, status, createdAt: "2026-09-21T00:00:00.000Z" };
}

describe("chat turn navigation", () => {
  it("keeps the compact rail threshold and visible cap explicit", () => {
    expect(MIN_TURNS_FOR_NAVIGATION).toBe(5);
    expect(MAX_VISIBLE_TURNS).toBe(10);
  });
  it("groups assistant retries under stable user anchors and excludes system/orphan messages", () => {
    expect(buildChatTurns([
      message("system", "system", "hidden prompt"), message("orphan", "assistant", "old text"),
      message("first", "user", "第一个问题"), message("failed", "assistant", "部分输出", "error"),
      message("retry", "assistant", "重试的最终答复", "complete"),
      message("second", "user", "第二个问题"), message("answer", "assistant", "第二轮答复"),
    ])).toEqual([
      { id: "first", question: "第一个问题", answer: "重试的最终答复" },
      { id: "second", question: "第二个问题", answer: "第二轮答复" },
    ]);
  });
  it("keeps attachment-only and pending turns reachable without exposing reasoning", () => {
    const pending = { ...message("reply", "assistant", "", "streaming"), reasoning: "内部思考" };
    expect(buildChatTurns([message("question", "user", ""), pending])).toEqual([
      { id: "question", question: "附件消息", answer: "正在处理…" },
    ]);
    expect(buildChatTurns([message("q", "user", "提问")])[0].answer).toBe("等待答复");
  });
  it("turns markdown into bounded plain excerpts without splitting emoji", () => {
    expect(turnExcerpt("## 标题\n**文本**与 [链接](https://example.com)\n```js\nsecret();\n```"))
      .toBe("标题 文本与 链接 [代码]");
    expect(turnExcerpt("😀😀😀", 2)).toBe("😀😀…");
  });
  it("tracks the preceding anchor while reading a long answer and handles edges", () => {
    expect(getActiveTurnIndex([], 200)).toBe(-1);
    expect(getActiveTurnIndex([100, 400, 900], 0)).toBe(0);
    expect(getActiveTurnIndex([100, 400, 900], 399)).toBe(0);
    expect(getActiveTurnIndex([100, 400, 900], 400)).toBe(1);
    expect(getActiveTurnIndex([100, 400, 900], 899)).toBe(1);
    expect(getActiveTurnIndex([100, 400, 900], 1000)).toBe(2);
  });
});
