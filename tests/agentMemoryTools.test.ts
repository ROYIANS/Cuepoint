import { importReferenceFile } from "@/lib/references/import";
import { removeProjectReference } from "@/db/references";
import { REFERENCE_TOOL_NAMES } from "@/lib/agent/referenceToolNames";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { createAgentTask } from "@/db/agentTasks";
import {
  createManualWrapup,
  saveWrapup,
  confirmWrapup,
} from "@/db/agentTaskWrapups";
import { saveTaskRecord } from "@/db/agentTaskRecords";
import { createProjectMemory, updateProjectMemory } from "@/db/projectMemories";
import { setThreadMemoryExcluded } from "@/db/memoryRetrieval";
import {
  createChatThread,
  createProject,
  deleteChatThread,
  deleteProject,
} from "@/db/repo";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import type { ConnectorConfig } from "@/domain/types";
import type { AgentToolContext } from "@/lib/agent/tools";
import { MEMORY_TOOLS, MEMORY_TOOL_NAMES } from "@/lib/agent/memoryTools";
import {
  BUILTIN_TOOLS,
  requiresToolApproval,
  validateToolCall,
} from "@/lib/agent/tools";
import { assembleSkills, DEFAULT_SKILL_IDS } from "@/lib/agent/skills";
import { createId } from "@/lib/ids";
const connector: ConnectorConfig = {
  id: "fixture",
  definitionId: "openai-compatible",
  baseUrl: "https://example.test/v1",
  apiKey: "SECRET_CONNECTOR_KEY",
  updatedAt: "2026-09-19",
};
const memoryInput = (body = "雨夜场景使用暖色灯光") => ({
  category: "lesson" as const,
  title: "雨夜灯光",
  topicKey: "lighting",
  body,
  applicability: "雨夜场景",
  tags: ["灯光"],
});
async function runFor(projectId?: string, conversation = false) {
  const thread = await createChatThread({ projectId });
  const run = await beginAgentRun({
    threadId: thread.id,
    connector,
    model: "model",
    content: "雨夜灯光",
    interactionMode: conversation ? "conversation" : "smart",
  });
  return run;
}
async function prepare(run: AgentRun, name: string, args: unknown) {
  const tool = MEMORY_TOOLS.find((item) => item.name === name)!;
  const context: AgentToolContext = {
    runId: run.id,
    threadId: run.threadId,
    callId: createId("call"),
    signal: new AbortController().signal,
  };
  const call: AgentToolCall = {
    id: context.callId,
    runId: run.id,
    threadId: run.threadId,
    providerCallId: context.callId,
    step: 1,
    order: 0,
    name,
    title: tool.title,
    arguments: JSON.stringify(args),
    effect: "read",
    highRisk: false,
    status: "running",
    createdAt: "2026-09-19",
    updatedAt: "2026-09-19",
  };
  await db.agentToolCalls.add(call);
  return {
    context,
    call,
    execute: () => tool.execute(tool.parseArguments(args), context),
  };
}
async function invoke(run: AgentRun, name: string, args: unknown) {
  const prepared = await prepare(run, name, args);
  return prepared.execute() as Promise<Record<string, unknown>>;
}
async function historicalTask(projectId: string) {
  const task = await createAgentTask({
    projectId,
    title: "雨夜灯光方案",
    goal: "完成雨夜灯光测试",
  });
  const draft = await createManualWrapup(task.id);
  const saved = await saveWrapup(
    task.id,
    draft.id,
    {
      ...draft.content,
      overview: "确认历史方案",
      lessons: [{ text: "雨夜灯光先试暖色", sourceIds: [] }],
    },
    draft.revision,
  );
  const summary = await confirmWrapup(task.id, saved.id, saved.revision);
  const record = await saveTaskRecord(task.id, {
    kind: "research",
    claim: "proposal",
    title: "雨夜参考",
    body: "记录正文".repeat(2000),
    sources: [],
  });
  return { task, summary, record };
}

describe("scoped memory and historical source tools", () => {
  it("registers strict read-only tools in the default optional skill and normal permission ledger", () => {
    expect(DEFAULT_SKILL_IDS).toContain("project-memory");
    expect(assembleSkills(["project-memory"]).enabledToolNames).toEqual([
      ...MEMORY_TOOL_NAMES,
    ]);
    expect(assembleSkills([]).enabledToolNames).not.toContain("memory_read");
    for (const name of MEMORY_TOOL_NAMES) {
      const tool = BUILTIN_TOOLS.find((item) => item.name === name)!;
      expect(tool.effect).toBe("read");
      expect(requiresToolApproval("ask", tool, {})).toBe(false);
      expect(() => validateToolCall(name, "{}", [])).toThrow("未启用");
    }
    const search = MEMORY_TOOLS[0];
    for (const args of [
      { query: "" },
      { query: "x", limit: 9 },
      { query: "x", limit: 1.5 },
      { query: "x", projectId: "foreign" },
      { query: "x".repeat(501) },
    ])
      expect(() => search.parseArguments(args)).toThrow();
    expect(() =>
      MEMORY_TOOLS[1].parseArguments({
        id: "id",
        expectedRevision: 1,
        contentLimit: 6001,
      }),
    ).toThrow();
    expect(() =>
      MEMORY_TOOLS[3].parseArguments({
        taskId: "task",
        source: { type: "run", id: "id" },
      }),
    ).toThrow();
  });
  it("rechecks project, smart mode, frozen enabled names and genuine running call ownership", async () => {
    const project = await createProject("P");
    for (const run of [await runFor(), await runFor(project.id, true)])
      await expect(
        invoke(run, "memory_search", { query: "雨夜" }),
      ).rejects.toThrow("智能");
    const run = await runFor(project.id),
      prepared = await prepare(run, "memory_search", { query: "雨夜" });
    await db.agentRuns.update(run.id, { enabledToolNames: [] });
    await expect(prepared.execute()).rejects.toThrow("智能");
    await db.agentRuns.update(run.id, {
      enabledToolNames: [...MEMORY_TOOL_NAMES],
    });
    await db.agentToolCalls.update(prepared.call.id, { threadId: "foreign" });
    await expect(prepared.execute()).rejects.toThrow("智能");
    await db.agentToolCalls.update(prepared.call.id, {
      threadId: run.threadId,
    });
    await db.chatThreads.update(run.threadId, { projectId: "foreign" });
    await expect(prepared.execute()).rejects.toThrow("归属");
  });
  it("searches only eligible owned memories, respects exclusions, limits and relevance, and returns stale reads without body", async () => {
    const p = await createProject("P"),
      foreign = await createProject("Q");
    const rows = [];
    for (let i = 0; i < 11; i++)
      rows.push(
        (
          await createProjectMemory(p.id, {
            ...memoryInput(`雨夜灯光方案 ${i}`),
            topicKey: `lighting-${i}`,
          })
        ).memory,
      );
    await createProjectMemory(foreign.id, memoryInput("雨夜 FOREIGN_SECRET"));
    for (const [index, status] of [
      "disabled",
      "superseded",
      "pending_review",
    ].entries())
      await db.projectMemories.update(rows[index].id, {
        status: status as "disabled",
      });
    await db.projectMemories.update(rows[3].id, { reviewedAt: undefined });
    const run = await runFor(p.id);
    await setThreadMemoryExcluded(run.threadId, p.id, rows[4].id, true);
    const search = await invoke(run, "memory_search", {
      query: "雨夜",
      limit: 2,
    });
    expect(search.total).toBe(6);
    expect(search.items).toHaveLength(2);
    expect(JSON.stringify(search)).not.toContain("FOREIGN_SECRET");
    expect(
      (await invoke(run, "memory_search", { query: "spaceship zebra" })).items,
    ).toEqual([]);
    for (const row of rows.slice(0, 5))
      expect(
        (await invoke(run, "memory_read", { id: row.id, expectedRevision: 1 }))
          .status,
      ).toBe("unavailable");
    const target = rows[5];
    await updateProjectMemory(
      p.id,
      target.id,
      { ...memoryInput("更新后的雨夜灯光"), topicKey: target.topicKey },
      1,
    );
    const changed = await invoke(run, "memory_read", {
      id: target.id,
      expectedRevision: 1,
    });
    expect(changed).toMatchObject({ status: "stale", revision: 2 });
    expect(changed).not.toHaveProperty("content");
    expect(
      (await invoke(run, "memory_read", { id: target.id, expectedRevision: 2 }))
        .content,
    ).toBe("更新后的雨夜灯光");
    const pending = await prepare(run, "memory_read", {
      id: target.id,
      expectedRevision: 2,
    });
    await setThreadMemoryExcluded(run.threadId, p.id, target.id, true);
    expect(await pending.execute()).toMatchObject({ status: "unavailable" });
  });
  it("pages memory bodies and retains active independent memory when its source task is deleted", async () => {
    const p = await createProject("P"),
      past = await historicalTask(p.id),
      row = (await createProjectMemory(p.id, memoryInput("雨".repeat(7500))))
        .memory;
    await db.projectMemories.update(row.id, {
      source: {
        kind: "summary",
        projectId: p.id,
        taskId: past.task.id,
        threadId: past.task.threadId,
        summaryId: past.summary.id,
        summaryRevision: past.summary.revision,
        itemKind: "lesson",
        itemIndex: 0,
        itemText: past.summary.content.lessons[0].text,
        taskTitle: past.task.title,
        confirmedAt: past.summary.confirmedAt!,
        excerpt: "摘录",
        evidence: [],
      },
    });
    await deleteChatThread(past.task.threadId);
    const run = await runFor(p.id),
      first = await invoke(run, "memory_read", {
        id: row.id,
        expectedRevision: 1,
      });
    expect((first.content as string).length).toBe(6000);
    expect(first.nextOffset).toBe(6000);
    expect(first.source).toMatchObject({ state: "missing" });
    const last = await invoke(run, "memory_read", {
      id: row.id,
      expectedRevision: 1,
      contentOffset: 6000,
    });
    expect((last.content as string).length).toBe(1500);
    expect(last.nextOffset).toBeNull();
  });
  it("searches past-task indices only and excludes foreign/current tasks and unconfirmed summaries", async () => {
    const p = await createProject("P"),
      q = await createProject("Q"),
      past = await historicalTask(p.id);
    await historicalTask(q.id);
    const current = await createAgentTask({
      projectId: p.id,
      title: "雨夜当前",
      goal: "当前目标",
    });
    const run = await beginAgentRun({
      threadId: current.threadId,
      connector,
      model: "model",
      content: "雨夜",
    });
    const result = await invoke(run, "project_history_search", {
      query: "雨夜",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        taskId: past.task.id,
        sources: expect.arrayContaining([
          expect.objectContaining({ type: "summary", id: past.summary.id }),
          expect.objectContaining({ type: "record", id: past.record.id }),
        ]),
      }),
    ]);
    await db.chatMessages.add({
      id: "hidden-search",
      threadId: past.task.threadId,
      role: "user",
      content: "TRANSCRIPT_ONLY",
      status: "complete",
      createdAt: "2026-09-19",
    });
    expect(
      (
        await invoke(run, "project_history_search", {
          query: "TRANSCRIPT_ONLY",
        })
      ).items,
    ).toEqual([]);
    await db.agentTaskWrapups.update(past.summary.id, {
      confirmedAt: undefined,
    });
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: past.task.id,
          source: { type: "summary", id: past.summary.id },
        })
      ).status,
    ).toBe("unavailable");
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: current.id,
          source: { type: "record", id: past.record.id },
        })
      ).status,
    ).toBe("unavailable");
  });
  it("pages confirmed summary/working record content with exact version and source ownership checks", async () => {
    const p = await createProject("P"),
      q = await createProject("Q"),
      past = await historicalTask(p.id),
      foreign = await historicalTask(q.id),
      run = await runFor(p.id);
    const read = (
      taskId: string,
      type: string,
      id: string,
      extra: Record<string, unknown> = {},
    ) =>
      invoke(run, "project_history_read", {
        taskId,
        source: { type, id },
        ...extra,
      });
    expect(await read(past.task.id, "summary", past.summary.id)).toMatchObject({
      status: "available",
      verification: "historically_confirmed",
      revision: past.summary.revision,
    });
    expect(
      await read(foreign.task.id, "summary", foreign.summary.id),
    ).toMatchObject({ status: "unavailable" });
    expect(await read(past.task.id, "record", foreign.record.id)).toMatchObject(
      { status: "unavailable" },
    );
    const page = await read(past.task.id, "record", past.record.id, {
      contentOffset: 5990,
      contentLimit: 40,
    });
    expect(page.content).toBe(past.record.body.slice(5990, 6030));
    expect(page.nextOffset).toBe(6030);
    await saveTaskRecord(
      past.task.id,
      {
        kind: "research",
        claim: "proposal",
        title: "修订",
        body: "新版本",
        sources: [],
      },
      { id: past.record.id, expectedRevision: 1 },
    );
    expect(
      await read(past.task.id, "record", past.record.id, {
        expectedRevision: 1,
      }),
    ).toMatchObject({ status: "stale", revision: 2 });
    expect(
      await read(past.task.id, "record", past.record.id, {
        revision: 1,
        contentLimit: 50,
      }),
    ).toMatchObject({ revision: 1, content: past.record.body.slice(0, 50) });
    await db.agentTaskRecordVersions
      .where("[recordId+revision]")
      .equals([past.record.id, 1])
      .modify({ taskId: foreign.task.id });
    expect(
      await read(past.task.id, "record", past.record.id, { revision: 1 }),
    ).toMatchObject({ status: "unavailable" });
  });
  it("returns public complete messages and settled tool results without reasoning, arguments or nested credential fields", async () => {
    const p = await createProject("P"),
      past = await historicalTask(p.id),
      run = await runFor(p.id);
    const oldRun = await beginAgentRun({
      threadId: past.task.threadId,
      connector,
      model: "model",
      content: "来源消息",
    });
    await db.agentRuns.update(oldRun.id, {
      status: "completed",
      responseItems: [
        { type: "reasoning", encrypted_content: "SECRET_ENCRYPTED" },
      ] as never,
    });
    await db.chatMessages.add({
      id: "public",
      threadId: past.task.threadId,
      runId: oldRun.id,
      role: "assistant",
      content: "公开回答".repeat(2000),
      reasoning: "SECRET_REASONING",
      status: "complete",
      createdAt: "2026-09-19",
    });
    const result = await invoke(run, "project_history_read", {
      taskId: past.task.id,
      source: { type: "message", id: "public" },
    });
    expect((result.content as string).length).toBe(6000);
    expect(JSON.stringify(result)).not.toContain("SECRET_");
    expect(result.verification).toBe("assistant_statement_unverified");
    const call = (
      await prepare(oldRun, "memory_search", { query: "SECRET_ARGUMENT" })
    ).call;
    await db.agentToolCalls.update(call.id, {
      status: "failed",
      name: "character_create",
      result: JSON.stringify({
        ok: false,
        body: "public result",
        nested: {
          apiKey: "SECRET_KEY",
          encrypted_content: "SECRET_ENCRYPTED",
          reasoning: "SECRET_REASONING",
          kept: "public",
        },
      }),
      error: "SECRET_RAW_PROVIDER_ERROR",
    });
    const tool = await invoke(run, "project_history_read", {
      taskId: past.task.id,
      source: { type: "tool", id: call.id },
    });
    expect(tool.toolStatus).toBe("failed");
    expect(tool.content).toContain("public result");
    expect(JSON.stringify(tool)).not.toContain("SECRET_");
    await db.agentToolCalls.update(call.id, { name: "memory_read" });
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: past.task.id,
          source: { type: "tool", id: call.id },
        })
      ).status,
    ).toBe("unavailable");
    await db.agentToolCalls.update(call.id, { name: "character_create" });
    await db.agentToolCalls.update(call.id, { status: "unknown" });
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: past.task.id,
          source: { type: "tool", id: call.id },
        })
      ).status,
    ).toBe("unavailable");
    await db.chatMessages.update("public", { runId: undefined });
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: past.task.id,
          source: { type: "message", id: "public" },
        })
      ).status,
    ).toBe("unavailable");
    await db.chatMessages.update("public", { runId: oldRun.id });
    await db.chatMessages.update("public", { status: "streaming" });
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: past.task.id,
          source: { type: "message", id: "public" },
        })
      ).status,
    ).toBe("unavailable");
  });
  it("cannot replay withdrawn reference text through historical tool-result reads", async () => {
    const project = await createProject("P");
    const past = await historicalTask(project.id);
    const oldRun = await beginAgentRun({ threadId: past.task.threadId, connector, model: "model", content: "读取资料" });
    const source = await importReferenceFile(project.id, new File(["WITHDRAWN_SOURCE_TEXT"], "private.txt"));
    const { call } = await prepare(oldRun, "memory_search", { query: "source" });
    const cached = JSON.stringify({
      chunks: [{ text: "WITHDRAWN_SOURCE_TEXT", index: 0 }],
      referenceInput: { projectId: project.id, references: [{ referenceId: source.id, revision: source.revision }] },
    });
    await db.agentToolCalls.update(call.id, { status: "completed", result: cached });
    await removeProjectReference(project.id, source.id);
    const run = await runFor(project.id);
    for (const name of REFERENCE_TOOL_NAMES) {
      await db.agentToolCalls.update(call.id, { name });
      const result = await invoke(run, "project_history_read", { taskId: past.task.id, source: { type: "tool", id: call.id } });
      expect(result.status).toBe("unavailable");
      expect(JSON.stringify(result)).not.toContain("WITHDRAWN_SOURCE_TEXT");
    }
  });
  it("rejects spoofed source run ownership and late reads after source/project deletion", async () => {
    const p = await createProject("P"),
      past = await historicalTask(p.id),
      run = await runFor(p.id);
    await db.chatMessages.add({
      id: "spoof",
      threadId: past.task.threadId,
      runId: run.id,
      role: "user",
      content: "foreign run content",
      status: "complete",
      createdAt: "2026-09-19",
    });
    expect(
      (
        await invoke(run, "project_history_read", {
          taskId: past.task.id,
          source: { type: "message", id: "spoof" },
        })
      ).status,
    ).toBe("unavailable");
    const pending = await prepare(run, "project_history_read", {
      taskId: past.task.id,
      source: { type: "record", id: past.record.id },
    });
    await deleteChatThread(past.task.threadId);
    expect(await pending.execute()).toMatchObject({ status: "unavailable" });
    const search = await prepare(run, "memory_search", { query: "雨夜" });
    await deleteProject(p.id);
    await expect(search.execute()).rejects.toThrow("项目");
  });
});
