import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { getGeneralAgentConfig, updateGeneralAgentConfig } from "@/db/agentSettings";
import { beginAgentRun } from "@/db/agentRuns";
import { createChatThread } from "@/db/repo";
import { GENERAL_AGENT_ID } from "@/domain/agent";

const skills = ["project-references", "project-memory", "workspace", "planning", "business-read", "story-edit", "asset-edit", "media-generation", "ip-management", "material-library"];

describe("foundational skill defaults", () => {
  it("persists all default capabilities for new installations", async () => {
    expect(await getGeneralAgentConfig()).toMatchObject({ enabledSkillIds: skills, skillDefaultsVersion: 2, permissionMode: "ask" });
    expect((await db.agents.get(GENERAL_AGENT_ID))?.enabledSkillIds).toEqual(skills);
  });

  it("upgrades legacy settings once while retaining unrelated preferences", async () => {
    await db.agents.put({ id: GENERAL_AGENT_ID, name: "我的助手", instructions: "保留创作约定", permissionMode: "assist",
      enabledSkillIds: ["workspace", "planning"], updatedAt: "2026-09-18" });
    const upgraded = await getGeneralAgentConfig();
    expect(upgraded).toMatchObject({ name: "我的助手", instructions: "保留创作约定", permissionMode: "assist", enabledSkillIds: skills, skillDefaultsVersion: 2 });
    expect(await db.agents.get(GENERAL_AGENT_ID)).toEqual(upgraded);
    db.close(); await db.open();
    expect(await getGeneralAgentConfig()).toEqual(upgraded);
  });

  it("preserves later opt-outs across reloads, including switching every skill off", async () => {
    await getGeneralAgentConfig();
    await updateGeneralAgentConfig({ enabledSkillIds: ["workspace", "business-read"] });
    db.close(); await db.open();
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual(["workspace", "business-read"]);
    await updateGeneralAgentConfig({ enabledSkillIds: [] });
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual([]);
  });

  it("adds new groups once without undoing old opt-outs", async () => {
    await db.agents.put({ id: GENERAL_AGENT_ID, name: "助手", instructions: "", enabledSkillIds: ["workspace"], skillDefaultsVersion: 1, updatedAt: "2026-09-21" });
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual(["workspace", "ip-management", "material-library"]);
    await db.agents.update(GENERAL_AGENT_ID, { enabledSkillIds: [], skillDefaultsVersion: 1 });
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual([]);
  });

  it("does not expand frozen tool permissions on an existing run", async () => {
    await updateGeneralAgentConfig({ enabledSkillIds: ["workspace", "planning"] });
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, model: "fixture", content: "继续整理",
      connector: { id: "fixture", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture-key", updatedAt: "2026-09-19" } });
    await db.agents.update(GENERAL_AGENT_ID, { skillDefaultsVersion: undefined });
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual(skills);
    expect((await db.agentRuns.get(run.id))?.enabledToolNames).toEqual(["workspace_overview", "update_run_plan"]);
  });
});
