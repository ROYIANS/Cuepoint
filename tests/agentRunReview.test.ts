import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { createChatThread, updateChatThread } from "@/db/repo";
import type { ConnectorConfig } from "@/domain/types";

const connector: ConnectorConfig = {
  id: "review", name: "review", definitionId: "openai-compatible",
  baseUrl: "https://example.test/v1", apiKey: "test-key", updatedAt: "2026-09-18T00:00:00Z",
};

describe("Agent run conversation titles", () => {
  it.each(["新话题", "新对话"])("names an existing %s when its first request starts", async (title) => {
    const thread = await createChatThread({ title });
    await beginAgentRun({ threadId: thread.id, connector, model: "test", content: "  帮我写\n 一个场景  " });
    expect((await db.chatThreads.get(thread.id))?.title).toBe("帮我写 一个场景");
  });

  it("preserves user titles and does not rename on retry", async () => {
    const thread = await createChatThread({ title: "自定义标题" });
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "test", content: "first" });
    expect((await db.chatThreads.get(thread.id))?.title).toBe("自定义标题");
    await finishAgentRun(run.id, "failed", { content: "" }, "network error");
    await updateChatThread(thread.id, { title: "新话题" });
    await beginAgentRun({ threadId: thread.id, connector, model: "test", retryOfRunId: run.id });
    expect((await db.chatThreads.get(thread.id))?.title).toBe("新话题");
  });
});
