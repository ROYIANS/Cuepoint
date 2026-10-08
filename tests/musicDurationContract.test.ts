import {registeredTools} from "./helpers/registeredTools";
import JSZip from "jszip";
import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {createChatThread} from "@/db/chat";
import {addMusicDraft, addMusicWork, patchMusicDraft, patchMusicWork} from "@/db/music";
import {prepareAudioGenerationJob} from "@/db/audioGeneration";
import {beginAgentRun} from "@/db/agentRuns";
import {saveToolPreview, saveToolRound, transitionToolCall} from "@/db/agentTools";
import {defaultMusicSettings, type MusicSettings} from "@/domain/music";
import type {AgentRun} from "@/domain/agent";
import type {AgentToolContext} from "@/lib/agent/tools";
import {MUSIC_TOOLS as MUSIC_TOOLS_DEFINITIONS} from "@/lib/agent/musicTools";
import {musicSettingsSchema, musicWireInput, validateGenerationInput} from "@/lib/audioGeneration/input";
import {prepareAudioGeneration} from "@/lib/audioGeneration/runtime";
import {submitApimartMusic, type MusicInput} from "@/lib/ai/apimartAudio";
import {exportProjectZip, importProjectZip} from "@/lib/projectPackage";
const MUSIC_TOOLS = registeredTools(MUSIC_TOOLS_DEFINITIONS);


const engines = ["flowmusic", "suno"] as const;
const credentials = {baseUrl: "https://api.apimart.ai/v1", apiKey: "fixture"};
const connector = {id: "api", definitionId: "apimart", ...credentials, updatedAt: "2026-09-30"};
const tool = (name: string) => MUSIC_TOOLS.find(entry => entry.name === name)!;
function settings(engine: MusicSettings["engine"], duration?: number): MusicSettings {
    if (engine === "flowmusic") return {engine, soundPrompt: "钢琴", lyrics: "", title: "歌", lengthSec: duration};
    return {engine, version: "v6", custom: true, instrumental: false, prompt: "歌词", title: "歌", style: "钢琴", negativeTags: "", durationSec: duration};
}
function wire(engine: MusicSettings["engine"], duration: number): MusicInput {
    if (engine === "flowmusic") return {model: engine, sound_prompt: "钢琴", lyrics: "", title: "歌", length: duration};
    return {model: engine, version: "v6", custom: true, instrumental: false, prompt: "歌词", title: "歌", style: "钢琴", negative_tags: "", duration};
}
async function begin(projectId: string) {
    const thread = await createChatThread({projectId});
    const run = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "保存音乐"});
    const ready = {...run, permissionMode: "full" as const, enabledToolNames: MUSIC_TOOLS.map(entry => entry.name), toolLoading: undefined};
    await db.agentRuns.put(ready);
    return ready;
}
function context(run: AgentRun, callId = "read"): AgentToolContext {
    return {runId: run.id, threadId: run.threadId, callId, projectId: run.projectId, signal: new AbortController().signal};
}
async function preparedCall(run: AgentRun, raw: unknown, name = "music_save_draft") {
    const definition = tool(name);
    const args = definition.parseArguments(raw);
    await saveToolRound(run.id, "", [{id: "provider-call", type: "function", function: {name: definition.name, arguments: JSON.stringify(raw)}}], [{title: definition.title, effect: definition.effect, atomic: true, highRisk: false}]);
    const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray()).at(-1)!;
    const ctx = context(run, call.id);
    const preview = await definition.prepare!(args, ctx);
    await saveToolPreview(run.id, call.id, preview);
    await transitionToolCall(run.id, call.id, ["pending"], "running");
    return {definition, args, ctx: {...ctx, preview}, call};
}
async function snapshot() {
    return {
        projects: await db.projects.toArray(), drafts: await db.musicDrafts.toArray(), works: await db.musicWorks.toArray(),
        media: await db.media.toArray(), jobs: await db.audioGenerationJobs.toArray(), calls: await db.agentToolCalls.toArray(),
        records: await db.agentTaskRecords.toArray(), recordVersions: await db.agentTaskRecordVersions.toArray(),
    };
}
async function work(projectId: string, value: MusicSettings, mediaId = "song") {
    return addMusicWork(projectId, {mediaId, title: "歌", notes: "", favorite: false, lyrics: "词", settings: value, durationSec: 30.5, sampleRate: 48000, channels: 2},
        {id: mediaId, projectId, filename: "song.wav", mimeType: "audio/wav", blob: new Blob(["audio"], {type: "audio/wav"})});
}

describe("C02 integer music settings across real consumers", () => {
    it("advertises optional integer durations with the engine's exact bounds", () => {
        const parameters = tool("music_save_draft").parameters as {properties: {settings: {anyOf: {properties: Record<string, unknown>; required: string[]}[]}}};
        const [flow, suno] = parameters.properties.settings.anyOf;
        expect(flow.properties.lengthSec).toEqual({type: "integer", minimum: 1, maximum: 240});
        expect(suno.properties.durationSec).toEqual({type: "integer", minimum: 10, maximum: 360});
        expect(flow.required).not.toContain("lengthSec");
        expect(suno.required).not.toContain("durationSec");
    });

    it.each([["flowmusic", 1], ["flowmusic", 240], ["suno", 10], ["suno", 360]] as const)("accepts %s boundary %s at repository, tools, generation and wire", async (engine, duration) => {
        const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id), value = settings(engine, duration);
        const draft = await addMusicDraft(project.id, {settings: value});
        await patchMusicDraft(project.id, draft.id, draft.revision, {settings: value});
        expect((await work(project.id, value)).settings).toEqual(value);
        const call = await preparedCall(run, {projectId: project.id, settings: value});
        expect(await call.definition.execute(call.args, call.ctx)).toMatchObject({settings: value, writeReceipt: {entries: [{kind: "music_draft"}]}});
        expect((await db.agentToolCalls.get(call.call.id))?.status).toBe("completed");
        expect(validateGenerationInput({kind: "music", settings: value})).toEqual({kind: "music", settings: value});
        expect(musicWireInput(value)).toEqual(wire(engine, duration));
        const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({code: 200, data: [{task_id: "task"}]}));
        expect(await submitApimartMusic(credentials, musicWireInput(value), {fetchImpl})).toEqual({ok: true, taskIds: ["task"]});
        expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual(wire(engine, duration));
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    const invalid = engines.flatMap(engine => {
        const bounds = engine === "flowmusic" ? [0, 241] : [9, 361];
        return [...bounds, 30.5, NaN, Infinity, -Infinity].map(duration => ({engine, duration}));
    });
    it.each(invalid)("rejects $engine/$duration before domain writes, ledger or network", async ({engine, duration}) => {
        const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id);
        const valid = settings(engine, 30), bad = settings(engine, duration);
        const draft = await addMusicDraft(project.id, {settings: valid});
        const call = await preparedCall(run, {projectId: project.id, id: draft.id, revision: draft.revision, settings: valid});
        const raw = {projectId: project.id, id: draft.id, revision: draft.revision, settings: bad};
        const before = await snapshot();
        await expect(addMusicDraft(project.id, {settings: bad})).rejects.toThrow();
        await expect(patchMusicDraft(project.id, draft.id, draft.revision, {settings: bad})).rejects.toThrow();
        await expect(work(project.id, bad)).rejects.toThrow();
        await expect(prepareAudioGenerationJob(project.id, {intentId: "bad", input: {kind: "music", settings: bad}, connector: {id: connector.id, provider: "apimart", baseUrl: connector.baseUrl}, source: {kind: "manual"}})).rejects.toThrow();
        expect(() => call.definition.parseArguments(raw)).toThrow();
        await expect(call.definition.prepare!(raw, call.ctx)).rejects.toThrow();
        await expect(call.definition.execute(raw, call.ctx)).rejects.toThrow();
        expect(musicSettingsSchema.safeParse(bad).success).toBe(false);
        expect(() => musicWireInput(bad)).toThrow();
        expect(() => validateGenerationInput({kind: "music", settings: bad})).toThrow();
        const fetchImpl = vi.fn<typeof fetch>();
        expect(await submitApimartMusic(credentials, wire(engine, duration), {fetchImpl})).toMatchObject({ok: false, kind: "validation"});
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(await snapshot()).toEqual(before);
    });

    it.each(engines.flatMap(engine => ["parse", "prepare", "execute"].map(phase => ({engine, phase}))))("$engine/$phase rejects fractional tool arguments before an atomic write", async ({engine, phase}) => {
        const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id);
        const call = await preparedCall(run, {projectId: project.id, settings: settings(engine, 30)});
        const raw = {projectId: project.id, settings: settings(engine, 30.5)};
        const before = await snapshot();
        if (phase === "parse") expect(() => call.definition.parseArguments(raw)).toThrow(/integer|整数/);
        if (phase === "prepare") await expect(call.definition.prepare!(raw, call.ctx)).rejects.toThrow(/integer|整数/);
        if (phase === "execute") await expect(call.definition.execute(raw, call.ctx)).rejects.toThrow(/integer|整数/);
        expect(await snapshot()).toEqual(before);
    });

    it.each(engines)("keeps incomplete %s drafts without a duration saveable, while generation requires text", async engine => {
        const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id);
        const value = defaultMusicSettings(engine);
        expect((await addMusicDraft(project.id, {settings: value})).settings).toEqual(value);
        const call = await preparedCall(run, {projectId: project.id, settings: value});
        await call.definition.execute(call.args, call.ctx);
        expect(() => validateGenerationInput({kind: "music", settings: value})).toThrow(/描述|歌词/);
        expect(musicWireInput(settings(engine))).not.toHaveProperty(engine === "flowmusic" ? "length" : "duration");
    });

    it("retains Suno simple mode omission of custom-only fields, but still rejects an invalid stored duration", () => {
        const custom = settings("suno", 30);
        if (custom.engine !== "suno") throw new Error("fixture");
        expect(musicWireInput({...custom, custom: false})).toEqual({model: "suno", version: "v6", custom: false, instrumental: false, prompt: "歌词"});
        expect(() => musicWireInput({...custom, custom: false, durationSec: 30.5})).toThrow();
    });
});

describe("C02 history remains readable and repairable", () => {
    it.each(engines)("rechecks %s work reuse before executing a new draft write", async engine => {
        const project = await createAudioMusicProject("音乐", "music"), run = await begin(project.id);
        const originalWork = await work(project.id, settings(engine, 30));
        const call = await preparedCall(run, {projectId: project.id, id: originalWork.id, revision: originalWork.revision}, "music_reuse_work");
        // A legacy row is encountered at execute time even if the original preview was valid.
        await db.musicWorks.update(originalWork.id, {settings: settings(engine, 30.5)});
        const before = await snapshot();
        await expect(call.definition.execute(call.args, call.ctx)).rejects.toThrow(/integer|整数/);
        expect(await snapshot()).toEqual(before);
    });

    it.each(engines)("preserves fractional %s draft/work history through actual ZIP and permits repair/metadata", async engine => {
        const project = await createAudioMusicProject("历史音乐", "music"), initial = settings(engine, 30), legacy = settings(engine, 30.5);
        const draft = await addMusicDraft(project.id, {settings: initial});
        const originalWork = await work(project.id, initial);
        // Existing data predates the integer rule. Raw writes here only seed that history.
        await db.musicDrafts.update(draft.id, {settings: legacy});
        await db.musicWorks.update(originalWork.id, {settings: legacy});
        const run = await begin(project.id), reader = tool("music_read");
        for (const [kind, id] of [["drafts", draft.id], ["works", originalWork.id]] as const) {
            expect(await reader.execute({projectId: project.id, kind, id}, context(run))).toMatchObject({items: [{id, settings: legacy}]});
        }
        await db.connectors.put(connector);
        const before = await snapshot();
        await expect(prepareAudioGeneration({projectId: project.id, connectorId: connector.id, input: {kind: "music", settings: legacy, draftId: draft.id, draftRevision: draft.revision}})).rejects.toThrow(/integer|整数/);
        expect(await snapshot()).toEqual(before);
        await expect(tool("music_reuse_work").prepare!({projectId: project.id, id: originalWork.id, revision: originalWork.revision}, context(run))).rejects.toThrow(/integer|整数/);
        await patchMusicWork(project.id, originalWork.id, originalWork.revision, {title: "旧作品重命名"});
        const metadata = await preparedCall(run, {projectId: project.id, id: originalWork.id, revision: originalWork.revision + 1, patch: {notes: "历史参数", favorite: true}}, "music_update_work");
        expect(await metadata.definition.execute(metadata.args, metadata.ctx)).toMatchObject({settings: legacy, writeReceipt: {entries: [{kind: "music_work", operation: "updated"}]}});
        expect((await db.musicWorks.get(originalWork.id))?.settings).toEqual(legacy);
        const imported = await importProjectZip(await exportProjectZip(project.id));
        const importedDraft = (await db.musicDrafts.where("projectId").equals(imported.id).toArray()).find(row => row.settings.engine === engine && row.settings.title === "歌")!;
        const importedWork = (await db.musicWorks.where("projectId").equals(imported.id).toArray())[0];
        expect(importedDraft.settings).toEqual(legacy);
        expect(importedWork).toMatchObject({settings: legacy, title: "旧作品重命名", notes: "历史参数", favorite: true, durationSec: 30.5});
        expect(importedWork.mediaId).not.toBe(originalWork.mediaId);
        expect(await db.media.get(importedWork.mediaId)).toMatchObject({projectId: imported.id});
        await expect(addMusicDraft(imported.id, {settings: importedDraft.settings})).rejects.toThrow(/整数/);
        await expect(patchMusicDraft(imported.id, importedDraft.id, importedDraft.revision, {settings: importedDraft.settings})).rejects.toThrow(/整数/);
        await patchMusicWork(imported.id, importedWork.id, importedWork.revision, {favorite: false});
        await patchMusicDraft(imported.id, importedDraft.id, importedDraft.revision, {settings: initial});
        const repaired = (await db.musicDrafts.get(importedDraft.id))!;
        expect(repaired.settings).toEqual(initial);
        expect(repaired.revision).toBe(importedDraft.revision + 1);
        expect(musicWireInput(repaired.settings)).toEqual(wire(engine, 30));
        const secondImport = await importProjectZip(await exportProjectZip(imported.id));
        expect((await db.musicWorks.where("projectId").equals(secondImport.id).toArray())[0].settings).toEqual(legacy);
    });

    it.each([
        {engine: "flowmusic" as const, change: {lengthSec: 241}, error: /时长/},
        {engine: "flowmusic" as const, change: {bpm: "0"}, error: /BPM/},
        {engine: "suno" as const, change: {durationSec: 9}, error: /时长/},
        {engine: "suno" as const, change: {title: "字".repeat(81)}, error: /长度/},
    ].flatMap(fixture => ["draft", "work"].map(kind => ({...fixture, kind}))))("legacy ZIP exception still validates $kind bounds and other settings: $change", async ({engine, change, error, kind}) => {
        const project = await createAudioMusicProject("音乐", "music");
        const draft = await addMusicDraft(project.id, {settings: settings(engine, 30)});
        const originalWork = await work(project.id, settings(engine, 30));
        const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
        const raw = JSON.parse(await zip.file("audioProject.json")!.async("string"));
        const rows = kind === "draft" ? raw.musicDrafts : raw.musicWorks;
        const rowId = kind === "draft" ? draft.id : originalWork.id;
        rows.find((row: {id: string}) => row.id === rowId).settings = {...settings(engine, 30.5), ...change};
        zip.file("audioProject.json", JSON.stringify(raw));
        const before = await snapshot();
        await expect(importProjectZip(await zip.generateAsync({type: "blob"}))).rejects.toThrow(error);
        expect(await snapshot()).toEqual(before);
    });
});
