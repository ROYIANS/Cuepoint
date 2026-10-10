import {afterEach, describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createChatThread} from "@/db/chat";
import {createAudioMusicProject, createProject} from "@/db/projects";
import {addCharacter, patchCharacter} from "@/db/assets";
import {addEpisode, firstEpisode} from "@/db/episodes";
import {getAudioProjectSnapshot} from "@/db/audio";
import {patchMusicDraft} from "@/db/music";
import {beginAgentRun} from "@/db/agentRuns";
import {AtomicToolRollbackError, executeAtomicTool} from "@/db/agentTools";
import {defaultMusicSettings} from "@/domain/music";
import type {AgentRun, AgentToolCall} from "@/domain/agent";
import type {ConnectorConfig} from "@/domain/types";
import {BUSINESS_TOOLS} from "@/lib/agent/businessTools";
import {AUDIO_TOOLS} from "@/lib/agent/audioTools";
import {MUSIC_TOOLS} from "@/lib/agent/musicTools";
import {AUDIO_GENERATION_TOOLS} from "@/lib/agent/audioGenerationTools";
import type {AgentToolContext} from "@/lib/agent/tools";
import {ToolRecoveryError, toolFailureResult, readToolRecoveryFailure} from "@/lib/agent/toolErrors";
import {createId} from "@/lib/ids";
import {registeredTools} from "./helpers/registeredTools";
import {executeChatRun} from "@/lib/agent/runChat";
import {withFinalReviewFixture} from "./helpers/finalReviewFixture";

const tools = registeredTools([...BUSINESS_TOOLS, ...AUDIO_TOOLS, ...MUSIC_TOOLS, ...AUDIO_GENERATION_TOOLS]);
afterEach(() => vi.unstubAllGlobals());
const connector: ConnectorConfig = {id: "owner-fixture", definitionId: "openai-compatible", baseUrl: "https://fixture.invalid/v1", apiKey: "fixture", updatedAt: "2026-10-10"};
function tool(name: string) {
    const definition = tools.find(entry => entry.name === name);
    if (!definition) throw new Error(`Missing fixture tool ${name}`);
    return definition;
}
async function begin(projectId?: string) {
    const thread = await createChatThread({projectId});
    const initial = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "继续创作"});
    const run = {...initial, permissionMode: "full" as const, enabledToolNames: tools.map(entry => entry.name), toolLoading: undefined};
    await db.agentRuns.put(run);
    return run;
}
function context(run: AgentRun, callId = "read"): AgentToolContext {
    return {runId: run.id, threadId: run.threadId, callId, signal: new AbortController().signal};
}
async function prepare(run: AgentRun, name: string, raw: unknown) {
    const definition = tool(name), args = definition.parseArguments(raw), ctx = context(run, createId("call"));
    ctx.preview = await definition.prepare?.(args, ctx);
    const call: AgentToolCall = {
        id: ctx.callId, runId: run.id, threadId: run.threadId, providerCallId: ctx.callId, step: 1, order: 0,
        name, title: definition.title, arguments: JSON.stringify(raw), effect: definition.effect,
        highRisk: definition.highRisk(args), atomic: definition.atomic, preview: ctx.preview,
        status: "running", createdAt: "2026-10-10", updatedAt: "2026-10-10",
    };
    await db.agentToolCalls.add(call);
    return {args, ctx, call, execute: () => definition.execute(args, ctx)};
}
async function recovery(operation: Promise<unknown>, certainty: "not_started" | "rolled_back" = "not_started") {
    return operation.catch(cause => toolFailureResult(cause, certainty));
}

describe("durable contextual business ownership", () => {
    it.each(["character", "scene", "prop", "style"])("defaults %s creation without altering original arguments or saved envelopes", async kind => {
        const project = await createProject("当前项目"), run = await begin(project.id);
        const raw = {fields: {name: "实际新建"}}, pending = await prepare(run, `${kind}_create`, raw);
        expect(pending.args).toEqual(raw);
        const result = await pending.execute();
        expect(result).toMatchObject({record: {projectId: project.id, name: "实际新建"}, writeReceipt: {entries: [{ownerId: project.id}]}});
        expect(pending.args).toEqual(raw);
        expect((await db.agentToolCalls.get(pending.call.id))?.arguments).toBe(JSON.stringify(raw));
        expect(await pending.execute()).toEqual(result);
    });

    it("defaults business lists, detail and text pages while retaining explicit studio reads", async () => {
        const project = await createProject("当前项目"), run = await begin(project.id);
        const character = await addCharacter(project.id), studio = await addCharacter("studio");
        await patchCharacter(character.id, {bio: "保存的简介"});
        const read = async (name: string, raw: unknown) => tool(name).execute(tool(name).parseArguments(raw), context(run));
        expect(await read("business_search", {kind: "character"})).toMatchObject({items: [{id: character.id}], total: 1});
        expect(await read("business_detail", {kind: "character", id: character.id})).toMatchObject({data: {record: {id: character.id, projectId: project.id}}});
        expect(await read("business_read_text", {kind: "character", id: character.id, field: "bio"})).toMatchObject({text: "保存的简介"});
        expect(await read("business_detail", {kind: "character", ownerId: "studio", id: studio.id})).toMatchObject({data: {record: {id: studio.id, projectId: "studio"}}});
    });

    it("keeps explicit owner and foreign target conflicts, with no write or guessed repair", async () => {
        const project = await createProject("当前项目"), foreign = await createProject("其他项目"), run = await begin(project.id);
        const character = await addCharacter(foreign.id);
        expect(await recovery(prepare(run, "character_create", {ownerId: foreign.id}))).toMatchObject({code: "PROJECT_SCOPE_MISMATCH", executed: false, effectCertainty: "not_started"});
        expect(await recovery(prepare(run, "character_update", {id: character.id, patch: {name: "越界"}}))).toMatchObject({code: "TARGET_SCOPE_MISMATCH", executed: false});
        expect(await recovery(prepare(run, "character_create", {ownerId: "studio"}))).toMatchObject({code: "PROJECT_SCOPE_MISMATCH"});
        expect(await db.characters.count()).toBe(1);
        expect((await db.characters.get(character.id))?.name).not.toBe("越界");
    });

    it("requires explicit projectless owners and preserves standalone studio creation", async () => {
        await createProject("不能自动猜测这个项目");
        const run = await begin();
        expect(await recovery(prepare(run, "character_create", {}))).toMatchObject({code: "PROJECT_REQUIRED"});
        const pending = await prepare(run, "character_create", {ownerId: "studio", fields: {name: "工作室角色"}});
        expect(await pending.execute()).toMatchObject({record: {projectId: "studio"}});
        expect((await db.agentRuns.get(run.id))?.projectId).toBeUndefined();
        expect(await db.characters.count()).toBe(1);
    });

    it("requires a selected episode and rejects foreign episodes without inferring the first", async () => {
        const project = await createProject("当前剧集"), foreign = await createProject("其他项目"), run = await begin(project.id);
        const episode = (await firstEpisode(project.id))!, other = (await firstEpisode(foreign.id))!;
        await addEpisode(project.id);
        const read = tool("business_search");
        expect(await recovery(read.execute(read.parseArguments({kind: "beat"}), context(run)))).toMatchObject({code: "EPISODE_REQUIRED"});
        expect(await recovery(prepare(run, "beat_create", {episodeId: other.id}))).toMatchObject({code: "EPISODE_SCOPE_MISMATCH"});
        expect(await recovery(prepare(run, "shot_create", {episodeId: "missing"}))).toMatchObject({code: "TARGET_NOT_FOUND"});
        expect(() => tool("beat_create").parseArguments({})).toThrow();
        const pending = await prepare(run, "beat_create", {episodeId: episode.id, fields: {title: "明确分集"}});
        expect(await pending.execute()).toMatchObject({record: {projectId: project.id, episodeId: episode.id}});
        expect(await db.shots.count()).toBe(0);
    });

    it("revalidates stale previews and scope changes before mutation and retains typed rollback causes", async () => {
        const project = await createProject("当前项目"), other = await createProject("另一个项目"), run = await begin(project.id);
        const character = await addCharacter(project.id);
        const pending = await prepare(run, "character_update", {id: character.id, patch: {name: "审批内容"}});
        await patchCharacter(character.id, {name: "手动新内容"});
        expect(await recovery(pending.execute(), "rolled_back")).toMatchObject({code: "STALE_TOOL_PREVIEW", effectCertainty: "rolled_back", executed: false});
        expect((await db.characters.get(character.id))?.name).toBe("手动新内容");
        const create = await prepare(run, "character_create", {fields: {name: "旧范围审批"}});
        await db.chatThreads.update(run.threadId, {projectId: other.id});
        await db.agentRuns.update(run.id, {projectId: other.id});
        expect(await recovery(create.execute(), "rolled_back")).toMatchObject({code: "STALE_TOOL_PREVIEW", effectCertainty: "rolled_back"});
        expect(await db.characters.count()).toBe(1);
    });

    it("uses the newly created project's durable binding at the next tool boundary", async () => {
        const run = await begin(), creation = await prepare(run, "project_create", {name: "持续创作"});
        const created = await creation.execute();
        const bound = await db.agentRuns.get(run.id);
        expect(bound?.createdProjectBinding?.callId).toBe(creation.call.id);
        const next = await prepare(run, "character_create", {fields: {name: "无需重复项目ID"}});
        expect(await next.execute()).toMatchObject({record: {projectId: bound?.projectId}});
        expect(created).toMatchObject({id: bound?.projectId});
        expect(run.projectId).toBeUndefined();
        expect((await db.agentToolCalls.get(next.call.id))?.arguments).toBe('{"fields":{"name":"无需重复项目ID"}}');
    });
});

describe("sound editing defaults and effect certainty", () => {
    it.each(["audio", "music"] as const)("resolves omitted %s write project IDs without changing saved arguments", async kind => {
        const project = await createAudioMusicProject("声音项目", kind), other = await createAudioMusicProject("其他作品", kind), run = await begin(project.id);
        const name = kind === "audio" ? "audio_update" : "music_save_draft";
        const chapter = kind === "audio" ? (await getAudioProjectSnapshot(project.id)).chapters[0] : undefined;
        const raw = chapter ? {kind: "chapter", id: chapter.id, revision: chapter.revision, patch: {title: "新标题"}} : {settings: defaultMusicSettings()};
        const pending = await prepare(run, name, raw);
        expect(pending.args).not.toHaveProperty("projectId");
        expect(await pending.execute()).toMatchObject({projectId: project.id, writeReceipt: {entries: [{ownerId: project.id}]}});
        expect((await db.agentToolCalls.get(pending.call.id))?.arguments).toBe(JSON.stringify(raw));
        expect(await recovery(prepare(run, name, {...raw, projectId: other.id}))).toMatchObject({code: "PROJECT_SCOPE_MISMATCH"});
        const unbound = await begin();
        expect(await recovery(prepare(unbound, name, raw))).toMatchObject({code: "PROJECT_REQUIRED"});
    });

    it("preserves typed causes across atomic rollback and never classifies arbitrary prose or unknown effects as safe", async () => {
        const project = await createProject("当前项目"), run = await begin(project.id), pending = await prepare(run, "character_create", {});
        const cause = new ToolRecoveryError("STALE_TOOL_PREVIEW", "目标已变化");
        const error = await executeAtomicTool(pending.ctx, async () => {await addCharacter(project.id); throw cause;}).catch(failure => failure);
        expect(error).toBeInstanceOf(AtomicToolRollbackError);
        expect(error.cause).toBe(cause);
        expect(toolFailureResult(error, "rolled_back")).toMatchObject({code: "STALE_TOOL_PREVIEW", executed: false, effectCertainty: "rolled_back"});
        expect(toolFailureResult(cause, "unknown")).toMatchObject({executed: "unknown", effectCertainty: "unknown"});
        expect(toolFailureResult(cause, "unknown")?.recovery).toContain("不得");
        expect(toolFailureResult(new Error("目标已变化，请重试"), "not_started")).toBeUndefined();
        expect(await db.characters.count()).toBe(0);
        expect((await db.agentToolCalls.get(pending.call.id))?.status).toBe("running");
    });

    it.each(["audio", "music"] as const)("prepares omitted %s generation ownership and refuses unapproved submission without provider calls", async kind => {
        const project = await createAudioMusicProject("声音项目", kind), run = await begin(project.id);
        await db.connectors.put({...connector, id: "apimart-fixture", definitionId: "apimart"});
        const initialDraft = kind === "music" ? (await db.musicDrafts.where("projectId").equals(project.id).first())! : undefined;
        const draft = initialDraft ? await patchMusicDraft(project.id, initialDraft.id, initialDraft.revision, {settings: {...defaultMusicSettings("flowmusic"), soundPrompt: "轻柔钢琴"}}) : undefined;
        const raw = draft ? {connectorId: "apimart-fixture", draftId: draft.id, draftRevision: draft.revision} : {connectorId: "apimart-fixture", text: "你好", voice: "alloy", speed: 1};
        const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", fetcher);
        const pending = await prepare(run, draft ? "music_generate" : "audio_generate_speech", raw);
        expect(pending.ctx.preview?.summary).toContain("付费");
        expect(pending.args).not.toHaveProperty("projectId");
        await expect(pending.execute()).rejects.toBeInstanceOf(AtomicToolRollbackError);
        expect(await db.audioGenerationJobs.count()).toBe(0);
        expect(fetcher).not.toHaveBeenCalled();
        expect((await db.agentToolCalls.get(pending.call.id))?.arguments).toBe(JSON.stringify(raw));
    });

    it("reads only typed bounded recovery envelopes and preserves unknown without a safe execution claim", () => {
        const source = new ToolRecoveryError("TARGET_NOT_FOUND", "当前目标不存在");
        const known = toolFailureResult(source, "not_started"), unknown = toolFailureResult(source, "unknown");
        expect(readToolRecoveryFailure(JSON.stringify(known))).toEqual(known);
        expect(readToolRecoveryFailure(JSON.stringify(unknown))).toEqual(unknown);
        for (const invalid of [{error: "当前目标不存在"}, {...unknown, executed: false}, {...known, code: "untrusted"}, {...known, error: "x".repeat(2049)}]) {
            expect(readToolRecoveryFailure(JSON.stringify(invalid))).toBeUndefined();
        }
    });
});

describe("actual runtime typed recovery serialization", () => {
    it.each(["preparation", "read", "atomic_rollback", "unknown_write"] as const)("preserves %s certainty and immutable original calls without automatic replay", async boundary => {
        const project = await createProject("当前项目"), other = await createProject("其他项目"), run = await begin(project.id);
        const character = await addCharacter(project.id);
        const name = boundary === "read" ? "business_detail" : boundary === "atomic_rollback" ? "character_update" : "character_create";
        const raw = boundary === "read" ? {kind: "character", id: "missing"}
            : boundary === "atomic_rollback" ? {id: character.id, patch: {name: "旧预览"}}
            : boundary === "preparation" ? {ownerId: other.id, fields: {name: "越界"}} : {fields: {name: "不确定调用"}};
        const original = tool(name), execute = vi.fn(original.execute);
        if (boundary === "atomic_rollback") execute.mockImplementation(async (args, ctx) => {
            await patchCharacter(character.id, {name: "用户后续编辑"});
            return original.execute(args, ctx);
        });
        if (boundary === "unknown_write") execute.mockImplementation(async () => {throw new ToolRecoveryError("TARGET_NOT_FOUND", "实际效果无法证明");});
        let rounds = 0;
        const fetcher = vi.fn<typeof fetch>(async () => ++rounds === 1
            ? Response.json({choices: [{message: {content: "", tool_calls: [{id: "owned-call", type: "function", function: {name, arguments: JSON.stringify(raw)}}]}, finish_reason: "tool_calls"}]})
            : Response.json({choices: [{message: {content: "已保留失败与恢复记录"}, finish_reason: "stop"}]}));
        await executeChatRun(run, connector.apiKey, new AbortController(), withFinalReviewFixture(fetcher), tools.map(entry => entry.name === name ? {...entry, execute} : entry));
        const saved = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
        expect(saved.arguments).toBe(JSON.stringify(raw));
        expect(await db.characters.count()).toBe(1);
        if (boundary === "unknown_write") {
            expect(saved).toMatchObject({status: "unknown"});
            expect(saved.result).toBeUndefined();
            expect(fetcher).toHaveBeenCalledTimes(1);
            expect((await db.agentRuns.get(run.id))?.finalReview).toBeUndefined();
        } else {
            const result = readToolRecoveryFailure(saved.result);
            expect(saved.status).toBe("failed");
            expect(result).toMatchObject({executed: false, effectCertainty: boundary === "atomic_rollback" ? "rolled_back" : "not_started",
                code: boundary === "atomic_rollback" ? "STALE_TOOL_PREVIEW" : boundary === "read" ? "TARGET_NOT_FOUND" : "PROJECT_SCOPE_MISMATCH"});
            expect(fetcher).toHaveBeenCalledTimes(2);
            expect((await db.agentRuns.get(run.id))?.finalReview?.status).toBe("checked");
        }
        expect(execute).toHaveBeenCalledTimes(boundary === "preparation" ? 0 : 1);
        expect((await db.characters.get(character.id))?.name).toBe(boundary === "atomic_rollback" ? "用户后续编辑" : character.name);
    });
});
