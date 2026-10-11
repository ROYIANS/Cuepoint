import {afterEach, describe, expect, it, vi} from "vitest";
import Dexie from "dexie";
import {db} from "@/db/database";
import {beginAgentRun} from "@/db/agentRuns";
import {resolveAgentToolApproval} from "@/db/agentTools";
import {createChatThread} from "@/db/chat";
import {createAudioMusicProject, createProject} from "@/db/projects";
import {bindProjectIp, createIpProfile, setIpArchived, updateIpProfile} from "@/db/ipProfiles";
import {createFileMaterial} from "@/db/materials";
import {addAudioClip, addAudioSegment, addAudioTake, getAudioProjectSnapshot, patchAudioClip, patchAudioSegment} from "@/db/audio";
import {applyAudioArrangementProposal, previewAudioArrangement, saveAudioArrangementProposal} from "@/db/audioArrangement";
import {executeChatRun, resumeChatRun} from "@/lib/agent/runChat";
import {BUILTIN_TOOLS, requiresToolApproval} from "@/lib/agent/tools";
import {getProjectContext} from "@/lib/agent/projectContext";
import {readWriteReceipt} from "@/lib/agent/writeReceipt";
import {withFinalReviewFixture} from "./helpers/finalReviewFixture";
import type {AgentRun} from "@/domain/agent";
import type {ConnectorConfig} from "@/domain/types";

// These are the shared product's actual registered entries and durable Dexie
// commands. Native HTTP, WebKit persistence and system UI have separate gates.
const names = ["ip_set_archived", "audio_place_take", "audio_edit_clip", "audio_split_clip", "audio_remove_clip", "audio_revert_arrangement"] as const;
type ToolName = typeof names[number];
const connector: ConnectorConfig = {id: "registered-parity", definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://fixture.invalid/v1", apiKey: "fixture", updatedAt: "2026-10-11"};
const tool = (name: ToolName) => {
    const registered = BUILTIN_TOOLS.find(row => row.name === name);
    if (!registered) throw new Error(`Unregistered tool: ${name}`);
    return registered;
};

function reply(protocol: AgentRun["protocol"], name?: ToolName, args?: unknown) {
    if (protocol === "responses") return Response.json({status: "completed", output: name
        ? [{type: "function_call", call_id: "provider-call", name, arguments: JSON.stringify(args)}]
        : [{type: "message", role: "assistant", content: [{type: "output_text", text: "操作结果已记录。"}]}]});
    return Response.json({choices: [{message: name
        ? {content: "", tool_calls: [{id: "provider-call", type: "function", function: {name, arguments: JSON.stringify(args)}}]}
        : {content: "操作结果已记录。"}, finish_reason: name ? "tool_calls" : "stop"}]});
}

async function begin(name: ToolName, projectId: string, protocol: AgentRun["protocol"] = "chat-completions") {
    const thread = await createChatThread({projectId});
    const initial = await beginAgentRun({threadId: thread.id, connector, model: "fixture", content: "按预览执行这个明确操作"});
    const run: AgentRun = {...initial, protocol, permissionMode: "ask", enabledToolNames: [name], toolLoading: undefined};
    await db.agentRuns.put(run);
    return run;
}

async function paused(name: ToolName, projectId: string, args: unknown, protocol?: AgentRun["protocol"]) {
    const run = await begin(name, projectId, protocol);
    const fetcher = vi.fn<typeof fetch>(async () => reply(run.protocol, name, args));
    await executeChatRun(run, connector.apiKey, new AbortController(), fetcher);
    const calls = await db.agentToolCalls.where("runId").equals(run.id).toArray();
    expect(calls).toHaveLength(1);
    expect(calls[0], calls[0].error).toMatchObject({name, status: "awaiting_approval", atomic: true, effect: "write"});
    expect(calls[0].preview?.revision).toBeTruthy();
    expect(calls[0].preview?.changes.length).toBeGreaterThan(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    return {run, call: calls[0]};
}

async function settle(run: AgentRun) {
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), withFinalReviewFixture(async () => reply(run.protocol)));
}

const sorted = <T extends {id: string}>(rows: T[]) => rows.sort((a, b) => a.id.localeCompare(b.id));
async function audioState(projectId: string) {
    const snapshot = await getAudioProjectSnapshot(projectId);
    return {...snapshot, clips: sorted(snapshot.clips), proposals: sorted(await db.audioArrangementProposals.where("projectId").equals(projectId).toArray()), project: await db.projects.get(projectId)};
}

async function audioFixture() {
    const project = await createAudioMusicProject("注册工具声音项目", "audio");
    const initial = await getAudioProjectSnapshot(project.id), chapter = initial.chapters[0], track = initial.tracks[0];
    const sources = [];
    for (let index = 0; index < 2; index++) {
        const segment = await addAudioSegment(project.id, {chapterId: chapter.id, text: `原稿${index}`, notes: "保留原稿", order: index});
        const mediaId = `registered-source-${index}`;
        await db.media.add({id: mediaId, projectId: project.id, filename: `${index}.wav`, mimeType: "audio/wav", blob: new Blob([`source-bytes-${index}`], {type: "audio/wav"})});
        const take = await addAudioTake(project.id, {segmentId: segment.id, mediaId, name: `版本${index}`, source: "upload", durationSec: 10, sampleRate: 48000, channels: 1, textSnapshot: segment.text});
        sources.push({segment, take});
    }
    const manual = await addAudioClip(project.id, {chapterId: chapter.id, trackId: track.id, takeId: sources[1].take.id, startSec: 20, trimStartSec: 0, trimEndSec: 2, gain: .6, fadeInSec: .1, fadeOutSec: .2});
    return {project, chapter, track, sources, manual};
}

type AudioFixture = Awaited<ReturnType<typeof audioFixture>>;
async function assertSources(f: AudioFixture, selected?: string, chapterReplaced = false) {
    expect(sorted(await db.audioTakes.where("projectId").equals(f.project.id).toArray())).toEqual(sorted(f.sources.map(row => row.take)));
    for (const [index, source] of f.sources.entries()) {
        expect(await db.audioSegments.get(source.segment.id)).toMatchObject({text: source.segment.text, notes: source.segment.notes, ...(index === 0 && selected ? {selectedTakeId: selected} : {})});
        if (!(index === 0 && selected)) expect((await db.audioSegments.get(source.segment.id))?.selectedTakeId).toBeUndefined();
        expect(await (await db.media.get(source.take.mediaId))!.blob.text()).toBe(`source-bytes-${index}`);
    }
    const manual = await db.audioClips.get(f.manual.id);
    if (chapterReplaced) {
        // The existing whole-chapter replace command increments every surviving
        // row's revision. Content, source, position and fades remain exact.
        expect(manual).toEqual({...f.manual, revision: f.manual.revision + 1, updatedAt: expect.any(String)});
    } else expect(manual).toEqual(f.manual);
    expect(await db.media.count()).toBe(2);
}

interface Scenario {
    projectId: string;
    args: Record<string, unknown>;
    state: () => Promise<unknown>;
    assertApplied: (result: unknown) => Promise<void>;
}

async function ipScenario(archived = true): Promise<Scenario> {
    const ip = await createIpProfile({name: "共享创作 IP", positioning: "归档时不再作为背景"});
    const project = await createProject("保留关联项目");
    await bindProjectIp(project.id, ip.id);
    const material = await createFileMaterial(new File(["retained-material-bytes"], "reference.txt", {type: "text/plain"}), {kind: "ip", id: ip.id});
    if (!archived) await setIpArchived(ip.id, true);
    const revision = (await db.ipProfiles.get(ip.id))!.revision;
    const originalProject = await db.projects.get(project.id), link = await db.projectIpLinks.get(project.id), version = await db.materialVersions.where("materialId").equals(material.id).first();
    return {
        projectId: project.id, args: {id: ip.id, expectedRevision: revision, archived},
        state: async () => ({ip: await db.ipProfiles.get(ip.id), link: await db.projectIpLinks.get(project.id), project: await db.projects.get(project.id), material: await db.libraryMaterials.get(material.id), versions: await db.materialVersions.toArray()}),
        assertApplied: async result => {
            expect(result).toMatchObject({id: ip.id, archived, revision: revision + 1});
            expect(await db.ipProfiles.get(ip.id)).toMatchObject({archived, revision: revision + 1, positioning: ip.positioning});
            expect(await db.projects.get(project.id)).toEqual(originalProject);
            expect(await db.projectIpLinks.get(project.id)).toEqual(link);
            expect(await db.libraryMaterials.get(material.id)).toEqual(material);
            const currentVersion = await db.materialVersions.get(version!.id);
            expect(currentVersion).toEqual(version);
            expect(currentVersion?.payload.type === "file" && await currentVersion.payload.blob.text()).toBe("retained-material-bytes");
            expect(JSON.parse((await getProjectContext(project.id)).content).ip).toEqual(archived ? null : expect.objectContaining({id: ip.id}));
        }
    };
}

async function scenario(name: ToolName): Promise<Scenario> {
    if (name === "ip_set_archived") return ipScenario();
    const f = await audioFixture(), common = {projectId: f.project.id, state: () => audioState(f.project.id)};
    const identity = {chapterId: f.chapter.id, trackId: f.track.id, takeId: f.sources[0].take.id};
    if (name === "audio_place_take") return {
        ...common, args: {...identity, startSec: 2, trimStartSec: 1, trimEndSec: 7},
        assertApplied: async result => {
            expect(result).toMatchObject({...identity, projectId: f.project.id, startSec: 2, trimStartSec: 1, trimEndSec: 7, gain: 1, fadeInSec: 0, fadeOutSec: 0, revision: 1});
            const {writeReceipt, ...row} = result as {id: string; writeReceipt: unknown};
            expect(readWriteReceipt(writeReceipt)).toBeDefined();
            expect(await db.audioClips.get(row.id)).toEqual(row);
            expect(await db.audioClips.count()).toBe(2);
            await assertSources(f);
        }
    };
    if (name === "audio_revert_arrangement") {
        await patchAudioSegment(f.project.id, f.sources[0].segment.id, f.sources[0].segment.revision, {selectedTakeId: f.sources[0].take.id});
        const proposal = await previewAudioArrangement(f.project.id, f.chapter.id, {segmentIds: [f.sources[0].segment.id], trackId: f.track.id});
        await saveAudioArrangementProposal(proposal);
        const receipt = await applyAudioArrangementProposal(f.project.id, proposal.id, proposal.revision);
        expect(receipt.added).toHaveLength(1);
        return {
            ...common, args: {proposalId: proposal.id, revision: 2},
            assertApplied: async result => {
                expect(result).toMatchObject({proposalId: proposal.id, projectId: f.project.id, removedClipIds: receipt.added.map(row => row.id)});
                expect(await db.audioArrangementProposals.get(proposal.id)).toMatchObject({revision: 3, state: "applied", reverted: true});
                expect(await db.audioClips.toArray()).toEqual([f.manual]);
                await assertSources(f, f.sources[0].take.id);
            }
        };
    }
    const clip = await addAudioClip(f.project.id, {...identity, startSec: 2, trimStartSec: 1, trimEndSec: 7, gain: 1, fadeInSec: .5, fadeOutSec: .5});
    const args = {id: clip.id, revision: clip.revision};
    if (name === "audio_edit_clip") return {
        ...common, args: {...args, patch: {startSec: 4, trimStartSec: 2, trimEndSec: 8, gain: .25, fadeInSec: .2, fadeOutSec: .3}},
        assertApplied: async result => {
            expect(result).toMatchObject({id: clip.id, projectId: f.project.id, takeId: clip.takeId, revision: 2, startSec: 4, trimStartSec: 2, trimEndSec: 8, gain: .25, fadeInSec: .2, fadeOutSec: .3});
            const {writeReceipt, ...row} = result as {id: string; writeReceipt: unknown};
            expect(readWriteReceipt(writeReceipt)).toBeDefined();
            expect(await db.audioClips.get(clip.id)).toEqual(row);
            expect(await db.audioClips.count()).toBe(2);
            await assertSources(f);
        }
    };
    if (name === "audio_split_clip") return {
        ...common, args: {...args, timeSec: 5},
        assertApplied: async result => {
            expect(result).toBeInstanceOf(Array);
            const parts = result as Array<{id: string; startSec: number; trimStartSec: number; trimEndSec: number; fadeInSec: number; fadeOutSec: number}>;
            expect(parts).toHaveLength(2);
            expect(parts.map(row => [row.startSec, row.trimStartSec, row.trimEndSec, row.fadeInSec, row.fadeOutSec])).toEqual([[2, 1, 4, .5, 0], [5, 4, 7, 0, .5]]);
            expect(parts[0].id).toBe(clip.id);
            expect(parts[1].id).not.toBe(clip.id);
            expect(await db.audioClips.bulkGet(parts.map(row => row.id))).toEqual(parts);
            expect(await db.audioClips.count()).toBe(3);
            await assertSources(f, undefined, true);
        }
    };
    return {
        ...common, args,
        assertApplied: async result => {
            expect(result).toMatchObject({removedClipId: clip.id});
            expect(await db.audioClips.get(clip.id)).toBeUndefined();
            expect(await db.audioClips.toArray()).toEqual([f.manual]);
            await assertSources(f);
        }
    };
}

function assertReceipt(name: ToolName, result: unknown, projectId: string) {
    const receipt = readWriteReceipt((result as {writeReceipt?: unknown}).writeReceipt);
    if (name === "ip_set_archived" || name === "audio_split_clip") {
        // Existing implementations return their exact result without an explicit
        // direct-target receipt. Do not manufacture receipt coverage in the test.
        expect(receipt).toBeUndefined();
        return;
    }
    expect(receipt?.entries).toHaveLength(1);
    expect(receipt?.entries[0]).toMatchObject({kind: "audio_clip", ownerId: projectId, operation: name === "audio_place_take" ? "created" : name === "audio_edit_clip" ? "updated" : "deleted"});
}

afterEach(() => vi.restoreAllMocks());

describe("shared registered tools used by the full desktop product", () => {
    it("retains mandatory archive and arrangement-revert review in every permission mode", () => {
        for (const name of ["ip_set_archived", "audio_revert_arrangement"] as const) {
            for (const mode of ["ask", "assist", "full"] as const) expect(requiresToolApproval(mode, tool(name), {})).toBe(true);
        }
    });

    for (const protocol of ["chat-completions", "responses"] as const) {
        it.each(names)(`${protocol} approves %s, records the real effect, and does not repeat it after a failed next request`, async name => {
            const f = await scenario(name), before = await f.state();
            const {run, call} = await paused(name, f.projectId, f.args, protocol);
            expect(await f.state()).toEqual(before);
            await resolveAgentToolApproval(run.id, call.id, "approve");
            await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => new Response("provider unavailable", {status: 500}));
            const completed = (await db.agentToolCalls.get(call.id))!;
            expect(completed.status, completed.error).toBe("completed");
            const result: unknown = JSON.parse(completed.result!);
            await f.assertApplied(result);
            assertReceipt(name, result, f.projectId);
            const applied = await f.state();
            expect((await db.agentRuns.get(run.id))?.status).toBe("failed");
            await settle(run);
            expect((await db.agentRuns.get(run.id))?.status).toBe("completed");
            expect(await f.state()).toEqual(applied);
            expect(await db.agentToolCalls.where("runId").equals(run.id).count()).toBe(1);
            expect((await db.agentToolCalls.get(call.id))?.result).toBe(completed.result);
        });
    }

    it.each(names)("rejecting %s leaves all business rows intact", async name => {
        const f = await scenario(name), before = await f.state();
        const {run, call} = await paused(name, f.projectId, f.args);
        await resolveAgentToolApproval(run.id, call.id, "reject");
        await settle(run);
        expect(await f.state()).toEqual(before);
        expect(await db.agentToolCalls.get(call.id)).toMatchObject({status: "rejected", decision: "reject", result: expect.stringContaining("用户拒绝")});
    });

    it.each(names)("late ledger failure rolls %s and its project/proposal changes back together", async name => {
        const f = await scenario(name), before = await f.state();
        const {run, call} = await paused(name, f.projectId, f.args);
        await resolveAgentToolApproval(run.id, call.id, "approve");
        const original = db.agentToolCalls.update.bind(db.agentToolCalls);
        let failed = false, changedBeforeLedger = false;
        const fault = vi.spyOn(db.agentToolCalls, "update").mockImplementation((...args) => Dexie.Promise.resolve().then(async () => {
            const patch = args[1];
            if (!failed && "status" in patch && patch.status === "completed") {
                failed = true;
                changedBeforeLedger = JSON.stringify(await f.state()) !== JSON.stringify(before);
                throw new Error("fixture ledger unavailable after business mutation");
            }
            return original(...args);
        }));
        try { await settle(run); } finally { fault.mockRestore(); }
        expect(failed).toBe(true);
        expect(changedBeforeLedger).toBe(true);
        expect(await f.state()).toEqual(before);
        expect(await db.agentToolCalls.get(call.id)).toMatchObject({status: "failed", error: expect.stringContaining("ledger unavailable")});
    });

    it("restores an archived IP through the same registered entry and re-enables its project facts", async () => {
        const f = await ipScenario(false), {run, call} = await paused("ip_set_archived", f.projectId, f.args);
        await resolveAgentToolApproval(run.id, call.id, "approve");
        await settle(run);
        expect((await db.agentToolCalls.get(call.id))?.status).toBe("completed");
        await f.assertApplied(JSON.parse((await db.agentToolCalls.get(call.id))!.result!));
    });

    it.each(["ip_set_archived", "audio_edit_clip", "audio_revert_arrangement"] as const)("a manual edit invalidates frozen %s approval without losing the manual edit", async name => {
        const f = await scenario(name), {run, call} = await paused(name, f.projectId, f.args);
        if (name === "ip_set_archived") await updateIpProfile(String(f.args.id), {voice: "手动修改"}, Number(f.args.expectedRevision));
        else {
            const clip = name === "audio_edit_clip" ? (await db.audioClips.get(String(f.args.id)))! : (await db.audioClips.where("projectId").equals(f.projectId).first())!;
            await patchAudioClip(f.projectId, clip.id, clip.revision, {gain: .3});
        }
        const edited = await f.state();
        await resolveAgentToolApproval(run.id, call.id, "approve");
        await settle(run);
        expect(await db.agentToolCalls.get(call.id)).toMatchObject({status: "failed"});
        expect(await f.state()).toEqual(edited);
    });

    it.each(names.filter(name => name !== "ip_set_archived"))("%s cannot cross the durable bound project", async name => {
        const f = await scenario(name), foreign = await createAudioMusicProject("其他项目", "audio"), before = await f.state();
        const run = await begin(name, f.projectId);
        const definition = tool(name), args = definition.parseArguments({...f.args, projectId: foreign.id});
        await expect(definition.prepare!(args, {runId: run.id, threadId: run.threadId, callId: "scope-check", projectId: f.projectId, signal: new AbortController().signal})).rejects.toThrow("projectId 与绑定项目不一致");
        expect(await f.state()).toEqual(before);
        expect(await db.agentToolCalls.count()).toBe(0);
    });
});
