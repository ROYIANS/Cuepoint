import { preloadFixtureGroups } from "./helpers/toolDispatch";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { beginAgentRun } from "@/db/agentRuns";
import { updateGeneralAgentConfig } from "@/db/agentSettings";
import { addShot, createChatThread, createProject } from "@/db/repo";
import type { ConnectorConfig } from "@/domain/types";
import { reviewAndApproveGeneration } from "@/lib/agent/generationReview";
import { executeChatRun, resumeChatRun } from "@/lib/agent/runChat";
import type { GenerationSubmitArgs } from "@/lib/agent/generationProfiles";

const connector: ConnectorConfig = { id: "chat", definitionId: "openai-compatible", baseUrl: "https://chat.test/v1", apiKey: "fixture-key", updatedAt: "now" };
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=";
afterEach(() => vi.unstubAllGlobals());

async function pending() {
  await updateGeneralAgentConfig({ permissionMode: "full", enabledSkillIds: ["media-generation"] });
  await db.connectors.bulkPut([connector, { ...connector, id: "hub", definitionId: "aihubmix", baseUrl: "https://hub.test/v1" }]);
  const project = await createProject("恢复确认");
  const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
  const shot = await addShot(project.id, episode.id);
  const thread = await createChatThread();
  const run = await preloadFixtureGroups(await beginAgentRun({ threadId: thread.id, connector, model: "chat", content: "生成图片" }), ["media-generation"]);
  const args: GenerationSubmitArgs = { connectorId: "hub", model: "gpt-image-2", target: { kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame" }, prompt: "AI 原始画面", inputs: [], parameters: { size: "auto" } };
  const original = JSON.stringify(args);
  await executeChatRun(run, connector.apiKey, new AbortController(), vi.fn(async () => Response.json({ choices: [{ message: { content: "", tool_calls: [{ id: "call", type: "function", function: { name: "submit_generation", arguments: original } }] }, finish_reason: "tool_calls" }] })));
  const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
  expect(call.status).toBe("awaiting_approval");
  return { run, call, original, reviewed: { ...args, prompt: "用户确认的画面", parameters: { size: "1536x1024" } }, expected: { arguments: original, revision: call.preview!.revision! } };
}

describe("generation confirmation persistence", () => {
  it("rolls back approval and override together on storage failure and allows one later confirmation", async () => {
    const f = await pending();
    const originalRun = await db.agentRuns.get(f.run.id);
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const fail = (changes: Record<string, unknown>) => { if (changes.status === "approved") throw new Error("approval storage failed"); };
    db.agentToolCalls.hook("updating", fail);
    try { await expect(reviewAndApproveGeneration(f.run.id, f.call.id, f.reviewed, f.expected)).rejects.toThrow("approval storage failed"); }
    finally { db.agentToolCalls.hook("updating").unsubscribe(fail); }
    expect(await db.agentToolCalls.get(f.call.id)).toEqual(f.call);
    expect(await db.agentRuns.get(f.run.id)).toEqual(originalRun);
    expect(await db.agentGenerationJobs.count()).toBe(0);
    expect(network).not.toHaveBeenCalled();
    await reviewAndApproveGeneration(f.run.id, f.call.id, f.reviewed, f.expected);
    const approved = (await db.agentToolCalls.get(f.call.id))!;
    expect(approved).toMatchObject({ status: "approved", decision: "approve" });
    expect(JSON.parse(approved.generationOverride!.arguments)).toEqual(f.reviewed);
    await expect(reviewAndApproveGeneration(f.run.id, f.call.id, f.reviewed, f.expected)).rejects.toThrow("已处理");
  });

  it("survives database reopen after confirmation and executes the saved user request exactly once", async () => {
    const f = await pending();
    const paid = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe("https://hub.test/ai/v1/images/generations");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({ prompt: f.reviewed.prompt, size: "1536x1024" });
      return Response.json({ id: "paid", object: "image", model: "gpt-image-2", status: "completed", output: [{ index: 0, type: "file", b64_json: png }] });
    });
    vi.stubGlobal("fetch", paid);
    await reviewAndApproveGeneration(f.run.id, f.call.id, f.reviewed, f.expected);
    db.close(); await db.open();
    expect(paid).not.toHaveBeenCalled();
    const next = vi.fn(async () => Response.json({ choices: [{ message: { content: "已保存" }, finish_reason: "stop" }] }));
    await resumeChatRun(f.run.id, connector.apiKey, new AbortController(), next);
    expect(paid).toHaveBeenCalledTimes(1);
    const completed = (await db.agentToolCalls.get(f.call.id))!;
    expect(completed).toMatchObject({ status: "completed", arguments: f.original });
    expect(JSON.parse(completed.generationOverride!.arguments)).toEqual(f.reviewed);
    expect(await db.agentGenerationJobs.count()).toBe(1);
    expect(await db.media.count()).toBe(1);
    await expect(resumeChatRun(f.run.id, connector.apiKey, new AbortController(), next)).rejects.toThrow();
    expect(paid).toHaveBeenCalledTimes(1);
  });
});
