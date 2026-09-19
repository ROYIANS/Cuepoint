import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createProject, createChatThread } from "@/db/repo";
import { beginAgentRun, finishAgentRun } from "@/db/agentRuns";
import { appendToolResults } from "@/db/agentTools";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { removeProjectReference } from "@/db/references";
import { executeChatRun } from "@/lib/agent/runChat";
import { selectReferenceContext, referenceSelectionCharacterBudget } from "@/lib/agent/referenceContext";
import { REFERENCE_TOOLS } from "@/lib/agent/referenceTools";
import { buildContextMessages, budgetContext, selectContextHistory } from "@/lib/agent/contextPlanner";
import { materializeChatMessages, materializeResponseItems } from "@/lib/ai/referenceWire";
import { resolveVisionCapability } from "@/lib/ai/visionCapability";
import { toResponseInput } from "@/lib/ai/responsesStream";
import type { ConnectorConfig } from "@/domain/types";
import type { ProjectReference } from "@/domain/references";
import type { ContextCompaction } from "@/domain/context";
const connector: ConnectorConfig = { id: "cx", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "test-secret", updatedAt: "2026-09-19" };
async function source(projectId: string, id: string, kind: "text" | "image" = "text", texts = ["资料正文"]) {
  const mediaId = `media-${id}`, mimeType = kind === "image" ? "image/png" : "text/plain", blob = new Blob([kind === "image" ? "actual-pixels" : texts.join("\n")], { type: mimeType });
  await db.media.add({ id: mediaId, projectId, mimeType, filename: `${id}.${kind === "image" ? "png" : "txt"}`, blob });
  const reference: ProjectReference = { id, projectId, mediaId, digest: `digest-${id}`, kind, filename: `${id}.${kind === "image" ? "png" : "txt"}`, mimeType, size: blob.size, revision: 1, status: "ready", operationId: "done", coverage: { totalUnits: texts.length, processedUnits: texts.length, emptyUnits: [], characters: texts.join("").length, truncated: false }, warnings: [], createdAt: "2026-09-19", updatedAt: "2026-09-19" };
  await db.projectReferences.add(reference);
  if (kind === "text") await db.referenceChunks.bulkAdd(texts.map((text, index) => ({ id: `${id}-${index}`, projectId, referenceId: id, revision: 1, index, text, locator: { kind: "lines" as const, start: index + 1, end: index + 1 } })));
  return { referenceId: id, revision: 1 };
}
async function begin(projectId: string, attachments: Array<{ referenceId: string; revision: number }> = [], model = "vision-test") {
  const thread = await createChatThread({ projectId });
  return beginAgentRun({ threadId: thread.id, connector, model, content: "查看资料", attachments, modelMetadata: { source: "provider", vision: true } });
}
const chatAnswer = () => Response.json({ choices: [{ message: { content: "已查看" }, finish_reason: "stop" }] });
const responseAnswer = () => Response.json({ status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "已查看", annotations: [] }] }] });

describe("bounded project references and native same-model vision", () => {
  it("selects only attached documents, freezes exact chunk coverage and makes truncation explicit", async () => {
    const project = await createProject("A"), a = await source(project.id, "selected", "text", ["first", "second", "third"]);
    await source(project.id, "unselected", "text", ["DO_NOT_AUTO_INJECT"]);
    const selected = await selectReferenceContext(project.id, [a], 7);
    expect(selected?.coverage?.[0]).toMatchObject({ includedChunkIndices: [0], totalChunks: 3, partial: true, includedCharacters: 5 });
    expect(selected?.envelope).toContain("first"); expect(selected?.envelope).not.toContain("second"); expect(selected?.envelope).not.toContain("DO_NOT_AUTO_INJECT");
    expect(selected?.envelope).toContain("仅读取以上范围");
    const run = await begin(project.id, [a]);
    expect(JSON.stringify(run.requestMessages)).not.toContain("DO_NOT_AUTO_INJECT");
    const message = await db.chatMessages.get(run.userMessageId);
    expect(message?.attachments).toEqual([a]);
  });
  it("rejects foreign, withdrawn, wrong-version, parsing, duplicate and projectless attachments before creating messages", async () => {
    const a = await createProject("A"), b = await createProject("B"), ref = await source(a.id, "private");
    for (const [owner, attachments] of [[b.id, [ref]], [a.id, [{ ...ref, revision: 2 }]], [a.id, [ref, ref]]] as const) await expect(selectReferenceContext(owner, [...attachments])).rejects.toThrow();
    await expect(selectReferenceContext(undefined, [ref])).rejects.toThrow("绑定项目");
    await db.projectReferences.update(ref.referenceId, { status: "parsing" });
    await expect(begin(a.id, [ref])).rejects.toThrow("尚未解析"); expect(await db.chatMessages.count()).toBe(0);
    await db.projectReferences.update(ref.referenceId, { status: "unavailable" });
    await expect(selectReferenceContext(a.id, [ref])).rejects.toThrow("已移除");
  });
  it("requires verified visual support rather than inferring it from names", async () => {
    expect(await resolveVisionCapability("unrecognized-image-supermodel")).toMatchObject({ supported: false, source: "unknown" });
    expect(await resolveVisionCapability("gpt-6-astra", "openai-compatible")).toMatchObject({ supported: true, source: "model-bank" });
    expect(await resolveVisionCapability("gpt-6-astra", "openai-compatible", { source: "provider", vision: false })).toEqual({ supported: false, source: "provider" });
    const p = await createProject("P"), image = await source(p.id, "image", "image"), thread = await createChatThread({ projectId: p.id });
    await expect(beginAgentRun({ threadId: thread.id, connector, model: "unknown", content: "look", attachments: [image] })).rejects.toThrow("尚未确认");
    expect(await db.chatMessages.count()).toBe(0);
  });
  it.each(["chat-completions", "responses"] as const)("sends actual pixels with selected text via %s and persists no base64", async (protocol) => {
    const p = await createProject("P"), image = await source(p.id, "image", "image"), text = await source(p.id, "text", "text", ["FILE_TEXT"]), run = await begin(p.id, [image, text]);
    await db.agentRuns.update(run.id, { protocol });
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe(run.model);
      const wire = JSON.stringify(body);
      expect(wire).toContain("data:image/png;base64,YWN0dWFsLXBpeGVscw=="); expect(wire).toContain("FILE_TEXT");
      expect(wire).not.toContain('"referenceInput"'); expect(wire).not.toContain('"sourceToolCallId"');
      expect(wire).toContain(protocol === "responses" ? '"input_image"' : '"image_url"');
      return protocol === "responses" ? responseAnswer() : chatAnswer();
    });
    await executeChatRun((await db.agentRuns.get(run.id))!, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
    const stored = JSON.stringify([await db.agentRuns.toArray(), await db.chatMessages.toArray(), await db.agentToolCalls.toArray()]);
    expect(stored).not.toContain("data:image"); expect(stored).not.toContain("test-secret");
    expect((await db.agentRuns.get(run.id))?.referenceAudit?.[0].inputs[0].references).toEqual([image, text]);
  });
  it.each(["chat-completions", "responses"] as const)("pairs read_project_image result with next %s same-model image input and preserves opaque reasoning", async (protocol) => {
    await updateGeneralAgentConfig({ enabledSkillIds: ["project-references"] });
    const p = await createProject("P"), run = await begin(p.id);
    // Generated images need no reference-library row.
    await db.media.add({ id: "generated", projectId: p.id, filename: "result.png", mimeType: "image/png", blob: new Blob(["actual-pixels"]) });
    await db.agentRuns.update(run.id, { protocol });
    const bodies: any[] = [];
    const call = { id: "read-call", type: "function", function: { name: "read_project_image", arguments: '{"mediaId":"generated"}' } };
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)); bodies.push(body);
      if (bodies.length === 1) return protocol === "responses" ? Response.json({ status: "completed", output: [{ type: "reasoning", summary: [], encrypted_content: "keep-opaque" }, { type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments }] }) : Response.json({ choices: [{ message: { content: "", tool_calls: [call] }, finish_reason: "tool_calls" }] });
      return protocol === "responses" ? responseAnswer() : chatAnswer();
    });
    await executeChatRun((await db.agentRuns.get(run.id))!, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(bodies.every((body) => body.model === run.model)).toBe(true);
    expect(JSON.stringify(bodies[0])).not.toContain("data:image");
    expect(JSON.stringify(bodies[1])).toContain("data:image/png;base64,YWN0dWFsLXBpeGVscw==");
    if (protocol === "responses") {
      expect(bodies[1].input).toContainEqual({ type: "reasoning", summary: [], encrypted_content: "keep-opaque" });
      const outputAt = bodies[1].input.findIndex((item: any) => item.type === "function_call_output" && item.call_id === call.id);
      expect(bodies[1].input[outputAt + 1].content[1].type).toBe("input_image");
    } else {
      const outputAt = bodies[1].messages.findIndex((item: any) => item.role === "tool" && item.tool_call_id === call.id);
      expect(bodies[1].messages[outputAt + 1].content[1].type).toBe("image_url");
    }
    const saved = (await db.agentRuns.get(run.id))!;
    await db.agentRuns.update(run.id, { status: "running" });
    await appendToolResults(run.id); await appendToolResults(run.id);
    expect((await db.agentRuns.get(run.id))?.continuationMessages).toEqual(saved.continuationMessages);
  });
  it("blocks withdrawn prepared references before any HTTP including retry", async () => {
    const p = await createProject("P"), ref = await source(p.id, "gone", "image"), run = await begin(p.id, [ref]);
    await finishAgentRun(run.id, "failed");
    const retry = await beginAgentRun({ threadId: run.threadId, connector, model: run.model, retryOfRunId: run.id });
    expect(retry.context?.selectedReferences).toEqual(run.context?.selectedReferences);
    await removeProjectReference(p.id, ref.referenceId);
    const fetcher = vi.fn(async () => chatAnswer());
    await executeChatRun(retry, connector.apiKey, new AbortController(), fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect((await db.agentRuns.get(retry.id))?.status).toBe("failed");
  });
  it("retains source coverage through summaries without replaying historic pixels, estimates live pixels separately", async () => {
    const p = await createProject("P"), ref = await source(p.id, "historic", "image"), run = await begin(p.id, [ref]);
    await finishAgentRun(run.id, "completed", { content: "图中内容说明" });
    const policy = { autoCompress: true, limitHistory: false, historyMessageCount: 20 };
    const history = selectContextHistory(await db.chatMessages.where("threadId").equals(run.threadId).sortBy("createdAt"), policy);
    const summary: ContextCompaction = { id: "summary", threadId: run.threadId, runId: run.id, status: "completed", coverage: history, input: [], policy, connector: run.connector, model: run.model, content: "历史摘要", beforeTokens: 3000, createdAt: "a", updatedAt: "b", activatedAt: "b" };
    const messages = buildContextMessages("system", "", history, "继续", summary);
    expect(messages.flatMap((message) => message.referenceInput?.images ?? [])).toHaveLength(0);
    expect(messages.flatMap((message) => message.referenceInput?.references ?? [])).toEqual([ref]);
    expect(budgetContext(run.requestMessages, []).estimatedTokens).toBeGreaterThan(4096);
    const scope = { projectId: p.id, model: run.model, visionCapability: run.visionCapability };
    expect(JSON.stringify(await materializeResponseItems(toResponseInput(messages), scope))).not.toContain("data:image");
    await removeProjectReference(p.id, ref.referenceId);
    await expect(materializeChatMessages(messages, scope)).rejects.toThrow("已移除");
  });
  it.each(["source", "thread"] as const)("rechecks %s withdrawal after asynchronous image encoding and before HTTP", async (target) => {
    const p = await createProject("P"), ref = await source(p.id, "race", "image"), run = await begin(p.id, [ref]);
    const original = Blob.prototype.arrayBuffer;
    const spy = vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementationOnce(async function (this: Blob) {
      const bytes = await original.call(this);
      if (target === "source") await removeProjectReference(p.id, ref.referenceId);
      else await db.chatThreads.delete(run.threadId);
      return bytes;
    });
    const fetcher = vi.fn(async () => chatAnswer());
    try { await executeChatRun(run, connector.apiKey, new AbortController(), fetcher); }
    finally { spy.mockRestore(); }
    expect(fetcher).not.toHaveBeenCalled();
    expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
  });
  it("rejects the eleventh queued tool image before poisoning the next request", async () => {
    const p = await createProject("P"), ref = await source(p.id, "limit", "image"), run = await begin(p.id);
    const context = { runId: run.id, threadId: run.threadId, callId: "current", signal: new AbortController().signal };
    const tool = REFERENCE_TOOLS.find((tool) => tool.name === "read_project_image")!;
    const result = await tool.execute({ mediaId: `media-${ref.referenceId}` }, context);
    await db.agentToolCalls.bulkAdd(Array.from({ length: 10 }, (_, index) => ({ id: `tool-${index}`, providerCallId: `wire-${index}`, runId: run.id, threadId: run.threadId, step: 1, order: index, name: tool.name, title: tool.title, arguments: '{}', effect: "read" as const, highRisk: false, status: "completed" as const, result: JSON.stringify(result), createdAt: "a", updatedAt: "a" })));
    await expect(tool.execute({ mediaId: `media-${ref.referenceId}` }, context)).rejects.toThrow("10 张");
    expect((await db.agentRuns.get(run.id))?.requestMessages).toEqual(run.requestMessages);
  });
  it("allows an explicitly re-added image source while preserving rejection of old descriptors", async () => {
    const p = await createProject("P"), old = await source(p.id, "old", "image"), run = await begin(p.id);
    const oldSelection = (await selectReferenceContext(p.id, [old]))!;
    const original = (await db.projectReferences.get(old.referenceId))!;
    // Business usage keeps the same immutable media alive after library withdrawal.
    await db.projectReferences.update(old.referenceId, { status: "unavailable" });
    const fresh = { referenceId: "fresh", revision: 1 };
    await db.projectReferences.add({ ...original, id: fresh.referenceId, status: "ready", createdAt: "2026-09-20" });
    const selection = (await selectReferenceContext(p.id, [fresh]))!;
    const scope = { projectId: p.id, model: run.model, visionCapability: run.visionCapability };
    await expect(materializeChatMessages([{ role: "user", content: "old", referenceInput: oldSelection }], scope)).rejects.toThrow("已移除");
    expect(JSON.stringify(await materializeChatMessages([{ role: "user", content: "fresh", referenceInput: selection }], scope))).toContain("data:image");
    const tool = REFERENCE_TOOLS.find((tool) => tool.name === "read_project_image")!;
    const result = await tool.execute({ mediaId: original.mediaId }, { runId: run.id, threadId: run.threadId, callId: "c", signal: new AbortController().signal }) as any;
    expect(result.referenceInput.references).toEqual([fresh]);
    const oldRaw = { projectId: p.id, references: [], images: oldSelection.images!.map(({ reference: _ref, ...image }) => image) };
    await expect(materializeChatMessages([{ role: "user", content: "old raw", referenceInput: oldRaw }], scope)).rejects.toThrow("已撤下");
  });
  it("uses the same bounded reference preparation for draft previews and sent requests", async () => {
    const p = await createProject("P"), reference = await source(p.id, "preview", "text", ["a".repeat(3000), "b".repeat(3000)]);
    const preview = await selectReferenceContext(p.id, [reference], referenceSelectionCharacterBudget(40000));
    const thread = await createChatThread({ projectId: p.id });
    const run = await beginAgentRun({ threadId: thread.id, connector, model: "preview-model", content: "preview", attachments: [reference], modelMetadata: { source: "provider", contextWindow: 40000 } });
    expect(run.context?.selectedReferences).toEqual(preview);
    expect(preview?.coverage?.[0]).toMatchObject({ includedChunkIndices: [0], partial: true, includedCharacters: 3000 });
    expect(referenceSelectionCharacterBudget(undefined)).toBe(12000);
    expect(referenceSelectionCharacterBudget(1000000)).toBe(12000);
  });
  it("scopes search/read and prevents cross-owner generated image access", async () => {
    const p = await createProject("P"), foreign = await createProject("foreign"), a = await source(p.id, "a", "text", ["alpha", "beta"]), b = await source(foreign.id, "b", "image"), run = await begin(p.id);
    const context = { runId: run.id, threadId: run.threadId, callId: "c", signal: new AbortController().signal };
    const search = REFERENCE_TOOLS.find((tool) => tool.name === "project_reference_search")!;
    const found = await search.execute({ query: "", limit: 10 }, context) as any;
    expect(found.results.map((item: any) => item.referenceId)).toEqual([a.referenceId]);
    const read = REFERENCE_TOOLS.find((tool) => tool.name === "project_reference_read")!;
    const readResult = await read.execute({ ...a, start: 1, limit: 1 }, context) as any;
    expect(readResult.referenceInput.coverage[0]).toMatchObject({ includedChunkIndices: [1], partial: true });
    expect(readResult.chunks[0].text).toBe("beta");
    const image = REFERENCE_TOOLS.find((tool) => tool.name === "read_project_image")!;
    await expect(image.execute({ mediaId: `media-${b.referenceId}` }, context)).rejects.toThrow("不属于");
    await expect(read.execute({ ...b }, context)).rejects.toThrow("不属于");
  });
});
