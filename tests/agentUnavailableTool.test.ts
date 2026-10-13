import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {beginAgentRun} from "@/db/agentRuns";
import {updateGeneralAgentConfig} from "@/db/agentSettings";
import {createChatThread} from "@/db/chat";

import {executeChatRun} from "@/lib/agent/runChat";
import type {ConnectorConfig} from "@/domain/types";

const connector: ConnectorConfig = {id: "unavailable-tool", name: "test", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "secret", updatedAt: "2026-01-01"};

async function begin() {
    await updateGeneralAgentConfig({permissionMode: "ask", enabledSkillIds: ["workspace", "planning", "business-read", "story-edit", "asset-edit"]});
    const thread = await createChatThread();
    return beginAgentRun({threadId: thread.id, connector, model: "model", content: "检查环境"});
}

const wireCall = (name: string, id = "call-1", args = "{}") => ({id, type: "function" as const, function: {name, arguments: args}});
const toolRound = (calls: ReturnType<typeof wireCall>[]) => Response.json({
    choices: [{message: {content: "", tool_calls: calls}, finish_reason: "tool_calls"}]
});
const answer = () => Response.json({choices: [{message: {content: "完成"}, finish_reason: "stop"}]});

describe("a model-named tool this request cannot run", () => {
    it("is recorded as one failed call instead of failing the whole run", async () => {
        const run = await begin();
        const bodies: Array<{messages: Array<{role: string; content: string; tool_call_id?: string}>}> = [];
        let requests = 0;
        const fetcher = vi.fn(async (_url, init) => {
            requests++;
            bodies.push(JSON.parse(String(init?.body)));
            // An unregistered name arrives in the first round, a valid call in the second.
            if (requests === 1) return toolRound([wireCall("definitely_not_a_tool")]);
            if (requests === 2) return toolRound([wireCall("workspace_overview", "call-2")]);
            return answer();
        });

        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);

        expect(await db.agentRuns.get(run.id)).toMatchObject({status: "completed"});
        const calls = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).sort((a, b) => a.step - b.step || a.order - b.order);
        expect(calls).toHaveLength(2);
        expect(calls[0]).toMatchObject({name: "definitely_not_a_tool", status: "failed", effect: "read", highRisk: false});
        expect(calls[0].requiresConfirmation).toBeUndefined();
        expect(calls[0].preview).toBeUndefined();
        expect(calls[1]).toMatchObject({name: "workspace_overview", status: "completed"});

        // The failure reached the model as an ordinary tool result within the same run.
        const fedBack = bodies[1].messages.filter((message) => message.role === "tool");
        expect(fedBack.map((message) => message.tool_call_id)).toEqual(["call-1", "call-2"].slice(0, fedBack.length));
        const failureEnvelope = JSON.parse(fedBack[0].content);
        expect(failureEnvelope).toMatchObject({code: "TOOL_NOT_AVAILABLE", executed: false});
        expect(failureEnvelope.error).toContain("definitely_not_a_tool");
        expect(failureEnvelope.availableTools).toEqual(expect.arrayContaining(["workspace_overview", "update_run_plan", "load_tool_groups"]));
        // Bounded disclosure: no registry internals, no registry names outside this offer.
        expect(failureEnvelope.availableTools).not.toContain("project_create");
        expect(JSON.stringify(failureEnvelope)).not.toContain("registry");
    });

    it("records an offered-but-currently-unloaded name as a failed call too", async () => {
        // project_create is inside the frozen ceiling but outside this round's offer.
        const run = await begin();
        expect(run.enabledToolNames).toContain("project_create");
        let requests = 0;
        const fetcher = vi.fn(async () => ++requests === 1 ? toolRound([wireCall("project_create")]) : answer());

        await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);

        expect(requests).toBe(2);
        expect(await db.agentRuns.get(run.id)).toMatchObject({status: "completed"});
        const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
        expect(call).toMatchObject({name: "project_create", status: "failed"});
        expect(await db.projects.count()).toBe(0);
        expect(call.result).toContain("TOOL_NOT_AVAILABLE");
    });

    it("keeps the ledger envelope check that still rejects forged or duplicate rounds", async () => {
        const run = await begin();
        const {saveToolRound, startModelStep} = await import("@/db/agentTools");
        await startModelStep(run.id, 32);
        await expect(saveToolRound(run.id, "", [wireCall("business_search", "forged")], [{title: "search", effect: "read", highRisk: false}]))
            .rejects.toThrow("本轮未提供");
        expect(await db.agentToolCalls.where("runId").equals(run.id).count()).toBe(0);
    });
});
