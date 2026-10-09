import {createElement, type ReactNode} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import {CreatedEntityLinks} from "@/components/agent/CreatedEntityLinks";
import {toolReferenceAttachments} from "@/lib/agent/referenceEvidence";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {addCharacter} from "@/db/assets";
import {firstEpisode} from "@/db/episodes";
import {addShot} from "@/db/shots";
import {executeAtomicTool} from "@/db/agentTools";
import {withBusinessWriteReceipt} from "@/lib/agent/businessWriteReceipt";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {getRow, navigation, summarize, targetRevision} from "@/lib/agent/businessStore";
import {BUSINESS_TOOLS} from "@/lib/agent/businessTools";
import {readWriteReceipt} from "@/lib/agent/writeReceipt";
import type {AgentToolCall} from "@/domain/agent";
import type {AgentToolContext} from "@/lib/agent/tools";
import {registeredTools} from "./helpers/registeredTools";

vi.mock("@tanstack/react-router", () => ({
    Link: ({to, children}: {to: string; children: ReactNode}) => createElement("a", {href: to}, children),
    useNavigate: () => vi.fn(),
}));
const connector = {id: "typed-fixture", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const, baseUrl: "https://fixture.invalid/v1", apiKey: "local", updatedAt: "2026-10-09"};
const call: AgentToolCall = {id: "created", runId: "run", threadId: "thread", providerCallId: "wire", step: 1, order: 0, name: "shot_create", title: "创建镜头", arguments: "{}", effect: "write", highRisk: false, status: "completed", createdAt: "", updatedAt: ""};

describe("E07 owned tool result boundaries", () => {
    it("renders only bounded structured local links and keeps preview deduplication", () => {
        const items = [null, 5, [], {target: null}, {target: []}, {target: {href: "//foreign.test", label: "foreign"}}, {target: {href: "javascript:alert(1)", label: "unsafe"}}, {target: {href: "/bad", label: {text: "compound"}}}, {target: {href: "/p/preview", label: "preview"}}, {target: {href: "/p/owned", label: "原文 <&"}}, {target: {href: "/p/owned", label: "最终名称"}}];
        const result = JSON.stringify({items: [...items, ...Array.from({length: 9}, () => null), {target: {href: "/p/outside-limit", label: "late"}}]});
        const rendered = renderToStaticMarkup(createElement(CreatedEntityLinks, {call: {...call, result, preview: {summary: "preview", changes: [], target: {href: "/p/preview", label: "preview"}}}}));
        expect(rendered).toContain('href="/p/owned"');
        expect(rendered).toContain("最终名称");
        expect(rendered.match(/<a /g)).toHaveLength(1);
        expect(rendered).not.toMatch(/foreign|unsafe|compound|preview|outside-limit/);
        for (const result of ["invalid", "null", "[]", '"text"', '{"items":[{"target":{"href":7,"label":"bad"}}]}']) {
            expect(renderToStaticMarkup(createElement(CreatedEntityLinks, {call: {...call, result}}))).toBe("");
        }
    });

    it.each([null, [], "text", 5, {referenceInput: null}, {referenceInput: []}, {referenceInput: {projectId: "foreign", references: [{referenceId: "secret", revision: 1}]}}, {referenceInput: {projectId: "p", references: {referenceId: "r", revision: 1}}}])("ignores malformed or foreign reference envelopes %j", (value) => {
        expect(toolReferenceAttachments(JSON.stringify(value), "p")).toEqual([]);
    });
    it("requires actual attachment fields without coercing revision or interpreting prose", () => {
        const valid = {referenceId: "r", revision: 2};
        expect(toolReferenceAttachments(JSON.stringify({referenceInput: {projectId: "p", references: [valid, {referenceId: "r", revision: "2"}, {referenceId: {id: "r"}, revision: 2}, {referenceId: "x", revision: 1.5}, {referenceId: "x".repeat(121), revision: 1}, [valid], null]}, text: "referenceId secret"}), "p")).toEqual([valid]);
    });

    it("executes a reviewed write on a corrupt display field with exact raw revision and replay", async () => {
        const project = await createProject("Owned"), character = await addCharacter(project.id);
        await db.table("characters").update(character.id, {name: {broken: true}, bio: ["compound"], notes: "作者备注".repeat(100)});
        const row = await getRow("character", character.id, project.id);
        expect(summarize("character", row)).toMatchObject({id: character.id, label: character.id, excerpt: "作者备注".repeat(100).slice(0, 300)});
        expect(navigation("character", row).href).toBe(`/p/${project.id}/assets/characters/${character.id}`);
        const thread = await createChatThread({projectId: project.id});
        const initial = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "修改备注"});
        await db.agentRuns.update(initial.id, {permissionMode: "full", toolLoading: undefined});
        const tool = registeredTools(BUSINESS_TOOLS).find(item => item.name === "character_update")!;
        const args = tool.parseArguments({ownerId: project.id, id: character.id, patch: {notes: "新备注"}});
        const context: AgentToolContext = {projectId: project.id, runId: initial.id, threadId: thread.id, callId: "typed-write", signal: new AbortController().signal};
        context.preview = await tool.prepare!(args, context);
        await db.agentToolCalls.add({...call, id: context.callId, name: tool.name, title: tool.title, atomic: true, runId: initial.id, threadId: thread.id, arguments: JSON.stringify(args), preview: context.preview, status: "running"});
        const result = await tool.execute(args, context);
        const saved = await getRow("character", character.id, project.id);
        const receipt = readWriteReceipt((result as Record<string, unknown>).writeReceipt)!;
        expect(saved.name).toEqual({broken: true});
        expect(saved.notes).toBe("新备注");
        expect(receipt.entries[0]).toMatchObject({id: character.id, ownerId: project.id, label: character.id, revision: targetRevision(saved)});
        expect(await tool.execute(args, context)).toEqual(result);
        expect(JSON.parse((await db.agentToolCalls.get(context.callId))!.result!)).toEqual(result);
    });

    it.each([undefined, null, {}, [], [null]])("rolls back a write rather than issuing a receipt for malformed batch targets %j", async (items) => {
        const project = await createProject("Owned"), episode = (await firstEpisode(project.id))!;
        const thread = await createChatThread({projectId: project.id});
        const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "创建镜头"});
        const context: AgentToolContext = {projectId: project.id, runId: run.id, threadId: thread.id, callId: "corrupt-batch", signal: new AbortController().signal};
        const ledger = {...call, id: context.callId, runId: run.id, threadId: thread.id, atomic: true, status: "running" as const};
        await db.agentToolCalls.add(ledger);
        await expect(executeAtomicTool(context, async () => {
            await addShot(project.id, episode.id);
            return withBusinessWriteReceipt("shot_create", {ownerId: project.id, episodeId: episode.id}, {items});
        })).rejects.toThrow("业务写入结果缺少");
        expect(await db.shots.count()).toBe(0);
        expect(await db.agentToolCalls.get(context.callId)).toEqual(ledger);
        expect(await db.projects.get(project.id)).toEqual(project);
    });

    it("retains empty and legacy scalar label semantics and distinct caps", async () => {
        const project = await createProject("Owned"), character = await addCharacter(project.id);
        for (const [name, label] of [["", ""], [0, "0"], [false, "false"], ["长".repeat(240), "长".repeat(200)]] as const) {
            await db.table("characters").update(character.id, {name});
            const row = await getRow("character", character.id, project.id);
            expect(summarize("character", row).label).toBe(label);
            expect(navigation("character", row).label).toBe(`角色 · ${label.slice(0, 120)}`);
        }
    });
});
