import { describe, it, expect, vi } from "vitest";
import { db } from "@/db/database";
import { createProject, createChatThread } from "@/db/repo";
import {
  createProjectMemory,
  setProjectMemoryStatus,
  updateProjectMemory,
  deleteProjectMemory,
} from "@/db/projectMemories";
import {
  getMemorySelection,
  setThreadMemoryExcluded,
  getThreadMemoryExclusions,
} from "@/db/memoryRetrieval";
import {
  planMemorySelection,
  serializeMemoryEntries,
  memoryEnvelopeTokens,
} from "@/lib/memory/retrieval";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { startModelStep } from "@/db/agentTools";
import { refreshRunMemoryContext } from "@/lib/agent/memoryContext";
import { executeChatRun } from "@/lib/agent/runChat";
import { toResponseInput } from "@/lib/ai/responsesStream";
import { prepareRunContext } from "@/lib/agent/contextCompaction";
import { updateContextPolicy } from "@/db/contextSettings";
import { estimateContextUsage } from "@/lib/agent/contextUsage";
import type { ProjectMemory } from "@/domain/projectMemory";
import type { ConnectorConfig } from "@/domain/types";
const connector: ConnectorConfig = {
  id: "cx",
  definitionId: "openai-compatible",
  baseUrl: "https://example.test/v1",
  apiKey: "fixture",
  updatedAt: "2026-09-19",
};
async function memory(
  projectId: string,
  body = "雨夜镜头保持蓝色逆光",
  inclusion: "project" | "relevant" = "relevant",
) {
  return (
    await createProjectMemory(projectId, {
      category: "lesson",
      title: body,
      topicKey: body,
      body,
      applicability: "镜头创作",
      tags: ["雨夜"],
      inclusion,
    })
  ).memory;
}
async function fixture() {
  const project = await createProject("P"),
    thread = await createChatThread({ projectId: project.id });
  return { project, thread };
}
async function begin(threadId: string, content = "创作雨夜镜头") {
  return beginAgentRun({
    threadId,
    connector,
    model: "model",
    content,
    interactionMode: "conversation",
  });
}
const json = (content: string) =>
  Response.json({ choices: [{ message: { content }, finish_reason: "stop" }] });
describe("local memory selection", () => {
  it("prioritizes explicit project policy, supports Chinese followups and rejects unrelated/foreign/unreviewed memory", async () => {
    const { project } = await fixture(),
      other = await createProject("Other");
    const wide = await memory(project.id, "所有画面保留字幕安全区", "project"),
      relevant = await memory(project.id),
      foreign = await memory(other.id),
      irrelevant = await memory(project.id, "沙漠黄沙质感");
    const rows = [
      wide,
      relevant,
      foreign,
      { ...irrelevant, tags: [], applicability: "沙漠" },
    ];
    const selected = planMemorySelection({
      projectId: project.id,
      draft: "继续完善",
      recentUserTurns: ["创作雨夜镜头"],
      memories: rows,
    });
    expect(selected.entries.map((e) => e.id)).toEqual([wide.id, relevant.id]);
    expect(
      planMemorySelection({
        projectId: project.id,
        draft: "完全无关",
        memories: rows,
      }).entries.map((e) => e.id),
    ).toEqual([wide.id]);
    expect(
      planMemorySelection({
        projectId: project.id,
        draft: "雨夜",
        memories: [
          { ...relevant, status: "pending_review" },
          { ...wide, reviewedAt: undefined },
        ],
        excludedIds: [],
      }).entries,
    ).toEqual([]);
  });
  it("bounds whole entries with exact envelope overhead, max eight and ten percent known safe input budget", async () => {
    const project = await createProject("P");
    const row = await memory(project.id, "色调", "project");
    const rows = Array.from({ length: 12 }, (_, i) => ({
      ...row,
      id: `m${i}`,
      title: `规则${i}`,
      body: `规则${i}`,
    }));
    const large = planMemorySelection({
      projectId: project.id,
      draft: "",
      memories: rows,
    });
    expect(large.entries).toHaveLength(8);
    expect(large.omittedCount).toBe(4);
    expect(large.estimatedTokens).toBe(
      memoryEnvelopeTokens(serializeMemoryEntries(large.entries)),
    );
    const small = planMemorySelection({
      projectId: project.id,
      draft: "",
      memories: rows,
      capacity: 4096,
    });
    expect(small.budget).toBeLessThanOrEqual(328);
    expect(small.estimatedTokens).toBeLessThanOrEqual(small.budget);
    const huge = planMemorySelection({
      projectId: project.id,
      draft: "",
      memories: [{ ...row, body: "中".repeat(8000) }],
    });
    expect(huge.entries).toHaveLength(0);
    expect(huge.omittedCount).toBe(1);
  });
  it("is deterministic across storage ordering and does not leak long source evidence into automatic envelopes", async () => {
    const project = await createProject("P"),
      a = await memory(project.id, "雨夜A"),
      b = await memory(project.id, "雨夜B");
    const first = planMemorySelection({
        projectId: project.id,
        draft: "雨夜",
        memories: [a, b],
      }),
      second = planMemorySelection({
        projectId: project.id,
        draft: "雨夜",
        memories: [b, a],
      });
    expect(first).toEqual(second);
    const row = {
      ...a,
      source: {
        kind: "summary",
        projectId: project.id,
        threadId: "t",
        taskId: "task",
        summaryId: "s",
        summaryRevision: 2,
        itemKind: "lesson",
        itemIndex: 0,
        itemText: "原始",
        taskTitle: "任务",
        confirmedAt: "now",
        excerpt: "snapshot",
        evidence: [
          {
            id: "e",
            label: "证据",
            body: "PRIVATE_LONG_EVIDENCE",
            truncated: false,
          },
        ],
      },
    } as ProjectMemory;
    const selection = planMemorySelection({
      projectId: project.id,
      draft: "雨夜",
      memories: [row],
    });
    expect(selection.envelope).not.toContain("PRIVATE_LONG_EVIDENCE");
    expect(selection.entries[0].source).toEqual(row.source);
  });
});
describe("thread policy and request layers", () => {
  it("persists reversible scoped exclusions, permits clearing deleted IDs, never changes project memory", async () => {
    const { project, thread } = await fixture(),
      row = await memory(project.id),
      other = await createProject("Other"),
      foreign = await memory(other.id);
    await expect(
      setThreadMemoryExcluded(thread.id, project.id, foreign.id, true),
    ).rejects.toThrow("项目");
    await setThreadMemoryExcluded(thread.id, project.id, row.id, true);
    expect(
      (
        await getMemorySelection({
          projectId: project.id,
          threadId: thread.id,
          draft: "雨夜",
        })
      ).entries,
    ).toEqual([]);
    expect((await db.projectMemories.get(row.id))?.status).toBe("active");
    db.close();
    await db.open();
    expect(await getThreadMemoryExclusions(thread.id, project.id)).toEqual([
      row.id,
    ]);
    await deleteProjectMemory(project.id, row.id, 1);
    await setThreadMemoryExcluded(thread.id, project.id, row.id, false);
    expect(await getThreadMemoryExclusions(thread.id, project.id)).toEqual([]);
  });
  it.each(["chat-completions", "responses"] as const)(
    "freezes original %s request and step audit while removing excluded memory from upcoming effective input",
    async (protocol) => {
      const { project, thread } = await fixture(),
        row = await memory(project.id, "雨夜蓝光", "project"),
        run = await begin(thread.id);
      await db.agentRuns.update(run.id, { protocol });
      const first = await startModelStep(run.id, 32);
      expect(first.memoryAudit?.[0].selection.entries[0].id).toBe(row.id);
      const tail = { role: "assistant" as const, content: "已处理" };
      await db.agentRuns.update(run.id, {
        continuationMessages: [...run.requestMessages, tail],
        ...(protocol === "responses"
          ? {
              responseItems: [
                ...toResponseInput(run.requestMessages),
                {
                  type: "reasoning",
                  id: "opaque",
                  encrypted_content: "opaque-bytes",
                },
                ...toResponseInput([tail]),
              ],
            }
          : {}),
      });
      await setThreadMemoryExcluded(thread.id, project.id, row.id, true);
      const refreshed = await refreshRunMemoryContext(run.id);
      expect(refreshed.requestMessages).toEqual(run.requestMessages);
      expect(
        refreshed.continuationMessages?.some((m) =>
          m.content.includes("雨夜蓝光"),
        ),
      ).toBe(false);
      expect(refreshed.continuationMessages?.at(-1)).toEqual(tail);
      if (protocol === "responses")
        expect(refreshed.responseItems).toContainEqual({
          type: "reasoning",
          id: "opaque",
          encrypted_content: "opaque-bytes",
        });
      const next = await startModelStep(run.id, 32);
      expect(next.memoryAudit?.[0]).toEqual(first.memoryAudit?.[0]);
      expect(next.memoryAudit?.[1].selection.entries).toEqual([]);
    },
  );
  it("uses actual HTTP input and dispatch audit without extra model calls; a checkpoint failure blocks submission", async () => {
    const { project, thread } = await fixture(),
      row = await memory(project.id),
      run = await begin(thread.id);
    let body = "";
    const fetcher = vi.fn(async (_url, init) => {
      body = String(init?.body);
      return json("完成");
    });
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(body).toContain(row.body);
    const saved = (await db.agentRuns.get(run.id))!;
    expect(saved.memoryAudit?.[0].selection.envelope).toBe(
      run.memorySelection?.envelope,
    );
    const next = await begin(thread.id),
      blocked = vi.fn(async () => json("bad"));
    const spy = vi
      .spyOn(db.agentRuns, "put")
      .mockRejectedValueOnce(new Error("storage fail"));
    await executeChatRun(
      next,
      connector.apiKey,
      new AbortController(),
      blocked,
    );
    spy.mockRestore();
    expect(blocked).not.toHaveBeenCalled();
  });
  it("refreshes the actual second HTTP request after a memory correction without replaying settled tool calls", async () => {
    const { project, thread } = await fixture(),
      row = await memory(project.id, "OLD_RAIN_RULE", "project");
    const run = await beginAgentRun({
      threadId: thread.id,
      connector,
      model: "model",
      content: "雨夜镜头",
    });
    await db.agentRuns.update(run.id, {
      enabledToolNames: ["workspace_overview"],
    });
    const requests: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) {
        await updateProjectMemory(
          project.id,
          row.id,
          {
            category: row.category,
            title: row.title,
            topicKey: row.topicKey,
            body: "CORRECTED_RAIN_RULE",
            applicability: row.applicability,
            tags: row.tags,
            inclusion: "project",
          },
          1,
        );
        return Response.json({
          choices: [
            {
              message: {
                content: "",
                tool_calls: [
                  {
                    id: "read-1",
                    type: "function",
                    function: { name: "workspace_overview", arguments: "{}" },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        });
      }
      return json("完成");
    });
    await executeChatRun(
      (await db.agentRuns.get(run.id))!,
      connector.apiKey,
      new AbortController(),
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(requests[0])).toContain("OLD_RAIN_RULE");
    const secondMessages = requests[1].messages as Array<{ content: string }>;
    const secondLayer = secondMessages.find((m) =>
      m.content?.startsWith("[项目记忆 ·"),
    )!;
    expect(secondLayer.content).toContain("CORRECTED_RAIN_RULE");
    expect(secondLayer.content).not.toContain('"body":"OLD_RAIN_RULE"');
    const calls = await db.agentToolCalls
      .where("runId")
      .equals(run.id)
      .toArray();
    expect(calls).toHaveLength(1);
    expect(calls[0].status).toBe("completed");
    const saved = (await db.agentRuns.get(run.id))!;
    expect(
      saved.memoryAudit?.map((a) => a.selection.entries[0].revision),
    ).toEqual([1, 2]);
    expect(saved.requestMessages).toEqual(run.requestMessages);
  });
  it("an audit checkpoint persistence failure prevents HTTP and leaves no fictitious dispatched step", async () => {
    const { project, thread } = await fixture();
    await memory(project.id, "雨夜", "project");
    const run = await begin(thread.id),
      fetcher = vi.fn(async () => json("bad"));
    const original = db.agentRuns.put.bind(db.agentRuns);
    const spy = vi
      .spyOn(db.agentRuns, "put")
      .mockImplementation(((value: typeof run) =>
        value.modelStep === 1
          ? Promise.reject(new Error("audit storage failed"))
          : original(value)) as typeof db.agentRuns.put);
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    spy.mockRestore();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.memoryAudit).toEqual([]);
  });
  it("retry keeps original config/history but revalidates corrected or disabled memory at next boundary", async () => {
    const { project, thread } = await fixture(),
      row = await memory(project.id),
      run = await begin(thread.id);
    await finishAgentRun(run.id, "failed", { content: "failed" });
    await setProjectMemoryStatus(project.id, row.id, "disabled", 1);
    const retry = await beginAgentRun({
      threadId: thread.id,
      connector,
      model: "model",
      retryOfRunId: run.id,
    });
    expect(retry.requestMessages).toEqual(run.context!.baseMessages);
    expect(retry.memorySelection?.entries).toHaveLength(1);
    const upcoming = await refreshRunMemoryContext(retry.id);
    expect(upcoming.memorySelection?.entries).toEqual([]);
    expect(run.memorySelection?.entries).toHaveLength(1);
  });
  it("compaction preserves corrected independent memory and original requests without restoring stale memory", async () => {
    const { project, thread } = await fixture(),
      row = await memory(project.id, "RAIN_RULE", "project");
    await updateContextPolicy(thread.id, {
      autoCompress: true,
      limitHistory: false,
      historyMessageCount: 20,
      customContextTokens: 10000,
    });
    await db.chatMessages.bulkAdd(
      Array.from({ length: 8 }, (_, i) => ({
        id: `h${i}`,
        threadId: thread.id,
        role: i % 2 ? ("assistant" as const) : ("user" as const),
        content: "x".repeat(3600),
        status: "complete" as const,
        createdAt: new Date(1000 + i).toISOString(),
      })),
    );
    const run = await begin(thread.id);
    await updateProjectMemory(
      project.id,
      row.id,
      {
        category: row.category,
        title: row.title,
        topicKey: row.topicKey,
        body: "NEW_RULE",
        applicability: row.applicability,
        tags: row.tags,
        inclusion: "project",
      },
      1,
    );
    const refreshed = await refreshRunMemoryContext(run.id);
    expect(refreshed.memorySelection?.entries[0].body).toBe("NEW_RULE");
    const compacted = await prepareRunContext(
      run.id,
      [],
      connector.apiKey,
      new AbortController().signal,
      vi.fn(async () => json("历史已整理")),
    );
    expect(compacted.context?.summaryId).toBeDefined();
    expect(
      compacted.continuationMessages?.filter((m) =>
        m.content.startsWith("[项目记忆 ·"),
      ),
    ).toHaveLength(1);
    expect(JSON.stringify(compacted.continuationMessages)).toContain(
      "NEW_RULE",
    );
    expect(compacted.requestMessages).toEqual(run.requestMessages);
    const usage = estimateContextUsage({
      instructions: compacted.agentSnapshot.instructions,
      skillInstructions: "",
      messages: compacted.continuationMessages!,
      tools: [],
    });
    expect(
      usage.categories.find((c) => c.id === "memory")?.tokens,
    ).toBeGreaterThan(0);
  });
});
