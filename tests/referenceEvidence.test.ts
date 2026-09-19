import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { prepareTaskWrapup } from "@/lib/agent/taskWrapup";
import { saveTaskRecord } from "@/db/agentTaskRecords";
import { REFERENCE_TOOLS } from "@/lib/agent/referenceTools";
import type { ConnectorConfig } from "@/domain/types";
import type { ThreadLockManager } from "@/lib/agent/runOwnership";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createProject } from "@/db/repo";
import { createAgentTask } from "@/db/agentTasks";
import { createManualWrapup, getTaskWrapupState } from "@/db/agentTaskWrapups";
import { collectReferenceEvidence, toolReferenceAttachments, referenceToolSummary } from "@/lib/agent/referenceEvidence";
import type { ProjectReference } from "@/domain/references";

async function source(projectId: string) {
  const id = crypto.randomUUID();
  const row: ProjectReference = { id, projectId, mediaId: `media-${id}`, digest: id, filename: "剧本.txt", mimeType: "text/plain", size: 6, kind: "text", revision: 1, status: "ready", operationId: id, coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 2, truncated: false }, warnings: [], createdAt: "2026-09-19", updatedAt: "2026-09-19" };
  await db.media.add({ id: row.mediaId, projectId, filename: row.filename, mimeType: row.mimeType, blob: new Blob(["剧本"]) });
  await db.projectReferences.add(row);
  return row;
}

describe("reference task evidence", () => {
  it("only reads owned structured tool reference descriptors", () => {
    const valid = { referenceId: "ref", revision: 1 };
    expect(toolReferenceAttachments(JSON.stringify({ referenceInput: { projectId: "p", references: [valid, { referenceId: "x", revision: 0 }, null] } }), "p")).toEqual([valid]);
    expect(toolReferenceAttachments(JSON.stringify({ referenceInput: { projectId: "foreign", references: [valid] } }), "p")).toEqual([]);
    expect(toolReferenceAttachments(JSON.stringify({ text: "referenceId ref", references: [valid] }), "p")).toEqual([]);
    expect(toolReferenceAttachments("invalid", "p")).toEqual([]);
  });

  it("deduplicates sources, hides foreign metadata and distinguishes revision/missing bytes", async () => {
    const project = await createProject("项目");
    const foreign = await createProject("其他项目");
    const own = await source(project.id), other = await source(foreign.id);
    const refs = [{ referenceId: own.id, revision: 1 }, { referenceId: own.id, revision: 1 }, { referenceId: other.id, revision: 1 }];
    const collected = await collectReferenceEvidence(project.id, refs);
    expect(collected).toHaveLength(2);
    expect(collected[0].evidence.available).toBe(true);
    expect(collected[0].evidence.supportsResult).toBeUndefined();
    expect(JSON.stringify(collected[1])).not.toContain(other.filename);
    expect(collected[1].evidence.available).toBe(false);
    expect((await collectReferenceEvidence(project.id, [{ referenceId: own.id, revision: 2 }]))[0].evidence.available).toBe(false);
    await db.media.delete(own.mediaId);
    expect((await collectReferenceEvidence(project.id, refs))[0].evidence.available).toBe(false);
  });

  it("projects reference read evidence without cached prose and builds fresh summary requests after withdrawal", async () => {
    const project = await createProject("项目");
    const task = await createAgentTask({ projectId: project.id, title: "参考研究", goal: "总结", acceptanceCriteria: [] });
    const ref = await source(project.id);
    const connector: ConnectorConfig = { id: "summary", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-09-19" };
    const run = await beginAgentRun({ threadId: task.threadId, connector, model: "model", content: "人工说明保留" });
    const attachment = { referenceId: ref.id, revision: ref.revision };
    const result = JSON.stringify({ chunks: [{ text: "WITHDRAWN_RAW_BODY", index: 0 }], results: [{ excerpt: "WITHDRAWN_SEARCH_EXCERPT" }], referenceInput: { projectId: project.id, references: [attachment], coverage: [{ ...attachment, kind: "text", includedChunkIndices: [0], totalChunks: 1, includedCharacters: 18, partial: false }] } });
    for (const [index, tool] of REFERENCE_TOOLS.entries()) {
      await db.agentToolCalls.add({ id: `reference-${index}`, providerCallId: `reference-${index}`, threadId: run.threadId, runId: run.id, step: 1, order: index, name: tool.name, title: tool.title, arguments: "{}", effect: "read", highRisk: false, status: "completed", result, createdAt: run.createdAt, updatedAt: run.createdAt });
      const projected = referenceToolSummary(tool.name, result, project.id);
      expect(projected).toMatchObject({ references: [attachment], coverage: [{ includedChunkIndices: [0] }] });
      expect(JSON.stringify(projected)).not.toContain("WITHDRAWN_");
    }
    await finishAgentRun(run.id, "completed", { content: "历史转述保留" });
    await saveTaskRecord(task.id, { kind: "research", claim: "proposal", title: "人工记录", body: "人工记录原文保留", sources: [] });
    const old = await createManualWrapup(task.id);
    // Even a pre-fix saved snapshot cannot become the input of a new AI summary.
    await db.agentTaskWrapups.update(old.id, { snapshot: { ...old.snapshot, evidence: old.snapshot.evidence.map((item) => item.kind === "tool" ? { ...item, body: "OLD_SNAPSHOT_RAW_BODY" } : item) } });
    await db.projectReferences.update(ref.id, { status: "unavailable" });
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body);
      expect(body).not.toContain("WITHDRAWN_"); expect(body).not.toContain("OLD_SNAPSHOT_RAW_BODY");
      expect(body).toContain("人工说明保留"); expect(body).toContain("历史转述保留"); expect(body).toContain("人工记录原文保留");
      return Response.json({ choices: [{ message: { content: JSON.stringify({ overview: "已整理历史过程", results: [], acceptance: [], decisions: [], lessons: [], unresolved: [] }) }, finish_reason: "stop" }] });
    });
    const locks: ThreadLockManager = { async request(_name, _options, callback) { return callback({}); } };
    await prepareTaskWrapup(task.id, connector, "model", new AbortController(), fetcher, undefined, undefined, locks);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await db.agentTaskWrapups.get(old.id))?.snapshot.evidence.some((item) => item.body === "OLD_SNAPSHOT_RAW_BODY")).toBe(true);
  });

  it("invalidates saved wrapup when an attached reference is withdrawn without rewriting history", async () => {
    const project = await createProject("剧本项目");
    const task = await createAgentTask({ projectId: project.id, title: "调研", goal: "分析剧本", plan: [] });
    const ref = await source(project.id);
    await db.chatMessages.add({ id: "reference-message", threadId: task.threadId, role: "user", content: "", createdAt: "2026-09-19", attachments: [{ referenceId: ref.id, revision: 1 }] });
    const draft = await createManualWrapup(task.id);
    const evidence = draft.snapshot.evidence.find(item => item.kind === "reference");
    expect(evidence?.reference).toEqual({ projectId: project.id, referenceId: ref.id, revision: 1 });
    expect(evidence?.available).toBe(true);
    expect((await getTaskWrapupState(task.id)).stale).toBe(false);
    await db.projectReferences.update(ref.id, { status: "unavailable" });
    const after = await getTaskWrapupState(task.id);
    expect(after.stale).toBe(true);
    expect(after.currentEvidence.find(item => item.id === evidence!.id)?.available).toBe(false);
    expect(after.latest?.snapshot.evidence.find(item => item.id === evidence!.id)?.available).toBe(true);
  });
});
