import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {beginAgentRun} from "@/db/agentRuns";
import {AtomicToolRollbackError} from "@/db/agentTools";
import {createChatThread} from "@/db/chat";
import {addEpisode, firstEpisode, updateEpisodeDraft} from "@/db/episodes";
import {createProject} from "@/db/projects";
import {addShots, patchShot} from "@/db/shots";
import type {AgentRun, AgentToolCall, AgentWireToolCall} from "@/domain/agent";
import {type ConnectorConfig, normalizeEpisodeStory, type StoryBeat} from "@/domain/types";
import {BUSINESS_TOOLS} from "@/lib/agent/businessTools";
import {targetRevision} from "@/lib/agent/businessStore";
import {executeChatRun} from "@/lib/agent/runChat";
import type {AgentToolContext} from "@/lib/agent/tools";
import {readWriteReceipt} from "@/lib/agent/writeReceipt";
import {registeredTools} from "./helpers/registeredTools";
import {withFinalReviewFixture} from "./helpers/finalReviewFixture";

const connector: ConnectorConfig = {id: "film-impact-fixture", definitionId: "openai-compatible", baseUrl: "https://film-impact.invalid/v1", apiKey: "not-real", updatedAt: "2026-10-10"};
const tool = registeredTools(BUSINESS_TOOLS).find(definition => definition.name === "episode_update")!;
const originalScript = "ALPHA\nBETA";
const replacementScript = "ALPHA\nGAMMA";

function beat(id: string, scriptRange?: StoryBeat["scriptRange"]): StoryBeat {
    return {id, title: `Title ${id}`, content: `Preserve ${id}`, characterIds: [], timeOfDay: "夜", ...(scriptRange ? {scriptRange} : {})};
}

async function fixture() {
    const project = await createProject("Film impact");
    const episode = (await firstEpisode(project.id))!;
    const beats = [
        beat("retained-range", {start: 0, end: 5, excerpt: "ALPHA"}),
        beat("invalidated-range", {start: 6, end: 10, excerpt: "BETA"}),
        beat("unassociated"),
        beat("already-malformed", {start: 1.5, end: 4, excerpt: "LPH"}),
        beat("already-mismatching", {start: 0, end: 5, excerpt: "OMEGA"}),
    ];
    await db.episodes.put({...episode, story: {logline: "Original logline", script: originalScript, beats}});
    const shots = await addShots(project.id, episode.id, 2, {beatId: "invalidated-range"});
    await patchShot(shots[0].id, {content: "Manual shot text", notes: "Manual notes", durationSec: 7, status: "ready"});
    return {project, episode: (await db.episodes.get(episode.id))!};
}

async function begin(projectId: string, protocol: AgentRun["protocol"] = "chat-completions") {
    const thread = await createChatThread({projectId});
    const initial = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "修改剧本，保留镜头"});
    const run: AgentRun = {...initial, protocol, permissionMode: "full", enabledToolNames: [tool.name], toolLoading: undefined};
    await db.agentRuns.put(run);
    return run;
}

async function prepare(projectId: string, episodeId: string, patch: {script?: string; title?: string; logline?: string}) {
    const run = await begin(projectId);
    // Omitted ownerId exercises the current durable project binding, not a test-only owner default.
    const raw = {id: episodeId, patch};
    const args = tool.parseArguments(raw);
    const callId = crypto.randomUUID();
    const context: AgentToolContext = {runId: run.id, threadId: run.threadId, callId, signal: new AbortController().signal};
    context.preview = await tool.prepare!(args, context);
    const call: AgentToolCall = {id: callId, providerCallId: callId, runId: run.id, threadId: run.threadId, step: 1, order: 0, name: tool.name, title: tool.title, arguments: JSON.stringify(raw), effect: tool.effect, highRisk: tool.highRisk(args), atomic: tool.atomic, preview: context.preview, status: "running", createdAt: run.createdAt, updatedAt: run.createdAt};
    await db.agentToolCalls.add(call);
    return {run, call, context, execute: () => tool.execute(args, context) as Promise<Record<string, unknown>>};
}

async function shotSnapshot() {
    return (await db.shots.toArray()).sort((a, b) => a.id.localeCompare(b.id)).map(shot => ({id: shot.id, bytes: JSON.stringify(shot), revision: targetRevision(shot)}));
}

function impact(ownerId: string, episodeId: string, retainedShotIds: string[], invalidatedBeatRangeIds: string[] = ["invalidated-range"]) {
    return {version: 1, ownerId, episodeId, invalidatedBeatRangeIds, invalidatedBeatRangeCount: invalidatedBeatRangeIds.length, omittedBeatRangeIds: 0, retainedShotIds: [...retainedShotIds].sort(), retainedShotCount: retainedShotIds.length, omittedShotIds: 0, semanticSynchronization: "not_performed"};
}

afterEach(() => vi.restoreAllMocks());

describe("atomic film script source-range impact", () => {
    it("reports only newly invalidated valid ranges and preserves every shot byte and revision", async () => {
        const {project, episode} = await fixture();
        const sibling = await addEpisode(project.id);
        await addShots(project.id, sibling.id, 1);
        const foreign = await createProject("Foreign film");
        const foreignEpisode = (await firstEpisode(foreign.id))!;
        await addShots(foreign.id, foreignEpisode.id, 1);
        const foreignShot = (await addShots(foreign.id, foreignEpisode.id, 1))[0];
        // An imported malformed foreign FK must not leak through an episode-only query.
        await db.shots.update(foreignShot.id, {episodeId: episode.id});
        const before = await shotSnapshot();
        const owned = (await db.shots.where("episodeId").equals(episode.id).toArray()).filter(shot => shot.projectId === project.id).map(shot => shot.id);
        const pending = await prepare(project.id, episode.id, {script: replacementScript});
        expect(pending.context.preview?.changes.join(" ")).toContain("不自动同步它们的内容或顺序");
        const result = await pending.execute();
        expect(result.scriptImpact).toEqual(impact(project.id, episode.id, owned));
        expect(JSON.stringify(result.scriptImpact)).not.toContain(foreignShot.id);
        const afterStory = normalizeEpisodeStory((await db.episodes.get(episode.id))?.story);
        expect(afterStory.script).toBe(replacementScript);
        expect(afterStory.beats).toEqual(normalizeEpisodeStory(episode.story).beats.map(item => item.id === "invalidated-range" ? {...item, scriptRange: undefined} : item));
        expect(await shotSnapshot()).toEqual(before);
        expect(readWriteReceipt(result.writeReceipt)?.entries).toEqual([expect.objectContaining({kind: "episode", operation: "updated", id: episode.id, ownerId: project.id})]);
        expect(await db.agentToolCalls.get(pending.call.id)).toMatchObject({status: "completed", result: JSON.stringify(result)});
    });

    it("reports zero invalidations for an unchanged script and does not count already malformed ranges", async () => {
        const {project, episode} = await fixture();
        const before = await shotSnapshot();
        const result = await (await prepare(project.id, episode.id, {script: originalScript})).execute();
        expect(result.scriptImpact).toEqual(impact(project.id, episode.id, before.map(shot => shot.id), []));
        expect(await shotSnapshot()).toEqual(before);
        expect(normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).beats.filter(item => item.scriptRange).map(item => item.id)).toEqual(["retained-range", "invalidated-range"]);
    });

    it("does not let a retained range mask another invalidated legacy beat with the same explicit ID", async () => {
        const {project, episode} = await fixture();
        const beats = [
            beat("legacy-shared-id", {start: 0, end: 5, excerpt: "ALPHA"}),
            beat("legacy-shared-id", {start: 6, end: 10, excerpt: "BETA"}),
        ];
        await db.episodes.put({...episode, story: {...episode.story, beats}});
        const shots = await shotSnapshot();
        const result = await (await prepare(project.id, episode.id, {script: replacementScript})).execute();
        expect(result.scriptImpact).toEqual(impact(project.id, episode.id, shots.map(shot => shot.id), ["legacy-shared-id"]));
        expect(normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).beats).toEqual([
            beats[0], {...beats[1], scriptRange: undefined},
        ]);
        expect(await shotSnapshot()).toEqual(shots);
    });

    it.each([{title: "New title"}, {logline: "New logline"}])("does not claim script impact for a scalar-only patch %j", async patch => {
        const {project, episode} = await fixture();
        const pending = await prepare(project.id, episode.id, patch);
        expect(pending.context.preview?.changes.join(" ")).not.toContain("不自动同步");
        const result = await pending.execute();
        expect(result).not.toHaveProperty("scriptImpact");
        expect(readWriteReceipt(result.writeReceipt)?.entries[0]).toMatchObject({kind: "episode", operation: "updated"});
        expect(normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).script).toBe(originalScript);
    });

    it("bounds range and shot IDs at 40 while retaining exact deterministic totals and omissions", async () => {
        const {project, episode} = await fixture();
        const beats = Array.from({length: 47}, (_, index) => beat(`range-${String(46 - index).padStart(2, "0")}`, {start: 0, end: 5, excerpt: "ALPHA"}));
        await db.episodes.put({...episode, story: {...episode.story, beats}});
        await addShots(project.id, episode.id, 43);
        const before = await shotSnapshot();
        const result = await (await prepare(project.id, episode.id, {script: "DELTA\nBETA"})).execute();
        expect(result.scriptImpact).toEqual({version: 1, ownerId: project.id, episodeId: episode.id, invalidatedBeatRangeIds: beats.slice(0, 40).map(item => item.id), invalidatedBeatRangeCount: 47, omittedBeatRangeIds: 7, retainedShotIds: before.map(shot => shot.id).sort().slice(0, 40), retainedShotCount: 45, omittedShotIds: 5, semanticSynchronization: "not_performed"});
        expect(JSON.stringify(result).length).toBeLessThan(65536);
        expect(await shotSnapshot()).toEqual(before);
    });

    it("returns the exact historical saved impact after reload and later manual edits", async () => {
        const {project, episode} = await fixture();
        const pending = await prepare(project.id, episode.id, {script: replacementScript});
        const result = await pending.execute();
        const savedResult = (await db.agentToolCalls.get(pending.call.id))!.result;
        await updateEpisodeDraft(episode.id, {script: "Manual replacement"});
        const [shot] = await addShots(project.id, episode.id, 1);
        await patchShot(shot.id, {content: "Later manual shot"});
        const manualEpisode = await db.episodes.get(episode.id), manualShots = await shotSnapshot();
        db.close(); await db.open();
        expect(await pending.execute()).toEqual(result);
        expect((await db.agentToolCalls.get(pending.call.id))?.result).toBe(savedResult);
        expect(await db.episodes.get(episode.id)).toEqual(manualEpisode);
        expect(await shotSnapshot()).toEqual(manualShots);
    });

    it("uses the committed transaction's current retained-shot set after a manual shot edit or addition", async () => {
        const {project, episode} = await fixture();
        const pending = await prepare(project.id, episode.id, {script: replacementScript});
        const [added] = await addShots(project.id, episode.id, 1);
        await patchShot(added.id, {notes: "Added after preview"});
        const current = await shotSnapshot();
        const result = await pending.execute();
        expect(result.scriptImpact).toEqual(impact(project.id, episode.id, current.map(shot => shot.id)));
        expect(await shotSnapshot()).toEqual(current);
    });

    it.each([{script: "Newer manual script"}, {title: "Newer manual title"}])("rejects a stale episode preview %j without storing an impact or overwriting newer content", async patch => {
        const {project, episode} = await fixture();
        const pending = await prepare(project.id, episode.id, {script: replacementScript});
        await updateEpisodeDraft(episode.id, patch);
        const current = await db.episodes.get(episode.id), shots = await shotSnapshot();
        await expect(pending.execute()).rejects.toThrow("目标或影响范围已变化");
        expect(await db.episodes.get(episode.id)).toEqual(current);
        expect(await shotSnapshot()).toEqual(shots);
        expect(await db.agentToolCalls.get(pending.call.id)).toEqual(pending.call);
    });

    it("rolls back the script, normalization and project touch when the final ledger save fails", async () => {
        const {project, episode} = await fixture();
        const pending = await prepare(project.id, episode.id, {script: replacementScript});
        const currentEpisode = await db.episodes.get(episode.id), currentProject = await db.projects.get(project.id), shots = await shotSnapshot();
        vi.spyOn(db.agentToolCalls, "update").mockRejectedValueOnce(new Error("Film ledger disk failure"));
        await expect(pending.execute()).rejects.toBeInstanceOf(AtomicToolRollbackError);
        expect(await db.episodes.get(episode.id)).toEqual(currentEpisode);
        expect(await db.projects.get(project.id)).toEqual(currentProject);
        expect(await shotSnapshot()).toEqual(shots);
        expect(await db.agentToolCalls.get(pending.call.id)).toEqual(pending.call);
    });

    it("rolls back when historical legacy IDs make the actual enriched result exceed the ledger budget", async () => {
        const {project, episode} = await fixture();
        await db.episodes.put({...episode, story: {...episode.story, beats: Array.from({length: 40}, (_, index) => beat(`${index}-${"x".repeat(2000)}`, {start: 0, end: 5, excerpt: "ALPHA"}))}});
        const pending = await prepare(project.id, episode.id, {script: replacementScript.replace("ALPHA", "DELTA")});
        const current = await db.episodes.get(episode.id), currentProject = await db.projects.get(project.id);
        await expect(pending.execute()).rejects.toThrow("写入回执过大");
        expect(await db.episodes.get(episode.id)).toEqual(current);
        expect(await db.projects.get(project.id)).toEqual(currentProject);
        expect(await db.agentToolCalls.get(pending.call.id)).toEqual(pending.call);
    });
});

function reply(protocol: AgentRun["protocol"], calls: AgentWireToolCall[] = []) {
    const text = "剧本已保存，一处原文范围失效，原镜头保留。未同步镜头内容。";
    return protocol === "responses" ? Response.json({id: "film-reply", status: "completed", output: calls.length ? calls.map(call => ({type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments, status: "completed"})) : [{type: "message", role: "assistant", status: "completed", content: [{type: "output_text", text, annotations: []}]}]})
        : Response.json({choices: [{message: {content: calls.length ? "" : text, ...(calls.length ? {tool_calls: calls} : {})}, finish_reason: calls.length ? "tool_calls" : "stop"}]});
}

describe("film impact actual protocol continuation", () => {
    it.each(["chat-completions", "responses"] as const)("supplies the committed historical impact and ordinary write receipt on %s", async protocol => {
        const {project, episode} = await fixture();
        const run = await begin(project.id, protocol);
        const originalRequests = structuredClone(run.requestMessages), shots = await shotSnapshot();
        const bodies: Record<string, unknown>[] = [];
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
            const body = JSON.parse(String(init?.body)); bodies.push(body);
            if (bodies.length === 1) return reply(protocol, [{id: "film-update", type: "function", function: {name: tool.name, arguments: JSON.stringify({id: episode.id, patch: {script: replacementScript}})}}]);
            const result = protocol === "responses"
                ? JSON.parse((body.input as Array<{type?: string; call_id?: string; output?: string}>).find(item => item.type === "function_call_output" && item.call_id === "film-update")!.output!)
                : JSON.parse((body.messages as Array<{role: string; tool_call_id?: string; content: string}>).find(item => item.role === "tool" && item.tool_call_id === "film-update")!.content);
            expect(result.scriptImpact).toEqual(impact(project.id, episode.id, shots.map(shot => shot.id)));
            expect(readWriteReceipt(result.writeReceipt)?.entries[0]).toMatchObject({kind: "episode", operation: "updated", id: episode.id});
            expect(normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).script).toBe(replacementScript);
            expect(await shotSnapshot()).toEqual(shots);
            return reply(protocol);
        });
        await executeChatRun(run, connector.apiKey, new AbortController(), withFinalReviewFixture(fetcher));
        const saved = (await db.agentRuns.get(run.id))!;
        expect(saved.status).toBe("completed");
        expect(saved.requestMessages).toEqual(originalRequests);
        expect(await db.agentToolCalls.where("runId").equals(run.id).toArray()).toEqual([expect.objectContaining({name: tool.name, status: "completed"})]);
        expect(await db.chatMessages.where("threadId").equals(run.threadId).filter(message => message.role === "user").count()).toBe(1);
        expect(bodies.length).toBeGreaterThanOrEqual(2);
        expect(await shotSnapshot()).toEqual(shots);
    });
});
