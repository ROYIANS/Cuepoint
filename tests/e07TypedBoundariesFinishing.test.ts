import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {saveAgentFinishingCheck} from "@/db/agentFinishingCheck";
import type {AgentPlanItem, AgentToolCall} from "@/domain/agent";

const plan: AgentPlanItem[] = [{id: "remaining", title: "继续创作", status: "pending"}];
const connector = {id: "typed-finishing", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const, baseUrl: "https://fixture.invalid/v1", apiKey: "local", updatedAt: "2026-10-09"};
async function eligible() {
    const thread = await createChatThread();
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "继续创作"});
    await db.agentRuns.update(run.id, {modelStep: 2, enabledToolNames: ["update_run_plan"], toolLoading: undefined, plan});
    const call: AgentToolCall = {id: "typed-plan", runId: run.id, threadId: thread.id, providerCallId: "typed-wire", step: 1, order: 0, name: "update_run_plan", title: "计划", effect: "bookkeeping", atomic: true, highRisk: false, status: "completed", arguments: JSON.stringify({steps: plan}), result: JSON.stringify({plan}), createdAt: run.createdAt, updatedAt: run.createdAt};
    await db.agentToolCalls.add(call);
    return {run, call};
}

describe("E07 finishing checkpoint unknown plan envelopes", () => {
    it.each([null, [], "plan", {plan: [null]}, {plan: [{id: 7, title: "x", status: "pending"}]}, {plan: [{id: "x", title: [], status: "pending"}]}, {plan: [{id: "x", title: "x", status: {value: "pending"}}]}, {plan: [{...plan[0], extra: "unvalidated"}]}])("leaves checkpoint and run untouched for malformed saved result %j", async (value) => {
        const {run, call} = await eligible();
        await db.agentToolCalls.update(call.id, {result: JSON.stringify(value)});
        const before = await db.agentRuns.get(run.id);
        expect(await saveAgentFinishingCheck(run.id, 2, {content: "尚未完成"})).toBe(false);
        expect(await db.agentRuns.get(run.id)).toEqual(before);
        expect((await db.agentToolCalls.get(call.id))?.result).toBe(JSON.stringify(value));
    });
    it.each([null, [], {steps: [false]}, {steps: [{...plan[0], status: "unsupported"}]}])("does not consume a checkpoint on malformed plan arguments %j", async (value) => {
        const {run, call} = await eligible();
        await db.agentToolCalls.update(call.id, {arguments: JSON.stringify(value)});
        expect(await saveAgentFinishingCheck(run.id, 2, {content: "尚未完成"})).toBe(false);
        expect((await db.agentRuns.get(run.id))?.finishingCheck).toBeUndefined();
        await db.agentToolCalls.update(call.id, {arguments: JSON.stringify({steps: plan})});
        expect(await saveAgentFinishingCheck(run.id, 2, {content: "尚未完成"})).toBe(true);
    });
    it("rejects corrupt stored plan members before shared typed validation", async () => {
        const {run} = await eligible();
        await db.table("agentRuns").update(run.id, {plan: [{id: {value: "remaining"}, title: "继续创作", status: "pending"}]});
        const before = await db.agentRuns.get(run.id);
        expect(await saveAgentFinishingCheck(run.id, 2, {content: "尚未完成"})).toBe(false);
        expect(await db.agentRuns.get(run.id)).toEqual(before);
    });
});
