import {afterEach, describe, expect, it, vi} from "vitest";
import Dexie from "dexie";
import {db} from "@/platform/product/store";
import {browserDatabase} from "@/platform/storage/browserDatabase";
import {createBrowserProductStore} from "@/platform/storage/browser";
import {UnknownCommitError} from "@/platform/storage/errors";
import type {ProductStore} from "@/platform/storage/types";
import {createChatThread, updateChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun, finishAgentRun} from "@/features/agent/commands/agentRuns";
import {resumeAgentRun} from "@/features/agent/commands/agentTools";
import {readAgentAdmission} from "@/features/agent/queries/agentAdmission";
import {updateGeneralAgentConfig} from "@/features/agent/commands/agentSettings";
import {deleteChatThread} from "@/features/agent/commands/lifecycle";
import {contextPreviewTables, readAgentContextPreview} from "@/features/agent/commands/agentContextPreview";
import {getOfferedToolNames, MAX_LOADED_TOOLS} from "@/features/agent/runtime/toolLoading";
import {prepareSkillImport} from "@/features/agent/skills/runtime/package";
import {installSkill, setInstalledSkillEnabled, uninstallSkill, updateInstalledSkill} from "@/features/agent/skills/commands/installations";
import {getInstalledSkillCatalogue, loadInstalledSkill} from "@/features/agent/skills/queries/installedSkills";
import {SKILL_CATALOGUE_KEY, skillBodyKey, skillManifestKey, skillRetentionKey} from "@/features/agent/skills/runtime/records";
import {createProject} from "@/features/projects/commands/projects";
import {deleteProject} from "@/features/projects/commands/lifecycle";
import * as visionCapability from "@/features/settings/models/visionCapability";
import type {ConnectorConfig} from "@/features/settings/models/connector";
import type {SkillRetention} from "@/features/agent/skills/models/installedSkill";
import {interceptStoreTable} from "./helpers/storeFaults";

const connector: ConnectorConfig = {id: "skill-runs", definitionId: "openai-compatible", protocol: "openai-compatible",
    baseUrl: "https://example.test/v1", apiKey: "fixture", updatedAt: "2026-10-16"};
const model = "unknown-model";
function candidate(body = "PRIVATE_SKILL_BODY", name = "creative-workflow") {
    const bytes = (text: string) => new TextEncoder().encode(text);
    return prepareSkillImport(name, [{path: "SKILL.md", bytes: bytes(`---\nname: ${name}\ndescription: Workflow metadata\n---\n${body}`)},
        {path: "references/steps.md", bytes: bytes("PRIVATE_RESOURCE_BODY")}]);
}
async function install(enabled = true, store: ProductStore = db) {
    const catalogue = await getInstalledSkillCatalogue(store);
    return installSkill({operationId: "install-workflow", catalogueRevision: catalogue.revision, candidate: candidate(), enabled}, store);
}
async function retention(revision: string): Promise<SkillRetention | undefined> {
    return (await db.deviceSettings.get(skillRetentionKey(revision)))?.value as SkillRetention | undefined;
}
async function begin(threadId: string, store: ProductStore = db) {
    return beginAgentRun({threadId, connector, model, content: "Apply the workflow"}, store);
}
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(yes => {resolve = yes;}); return {promise, resolve};}
afterEach(() => vi.restoreAllMocks());

describe("installed skills frozen with actual run admission", () => {
    it("pins metadata in the same transaction without reading content and offers fixed helpers within the cap", async () => {
        const installed = await install(), thread = await createChatThread();
        const readKeys: string[] = [], txIds = new Set<string>();
        const reads = interceptStoreTable(db, "deviceSettings", "get", async (tx, args, next) => {
            const key = String(args[0]); if (key.startsWith("agentSkills.")) {readKeys.push(key); txIds.add(tx.transactionId);} return next();
        });
        const writes = interceptStoreTable(db, "agentRuns", "add", async (tx, args, next) => {
            txIds.add(tx.transactionId);
            expect(args[0]).toMatchObject({installedSkills: {version: 1, entries: [{skillId: installed.skillId, revision: installed.revision}]}});
            expect((await tx.deviceSettings.get(skillRetentionKey(installed.revision)))?.value).toMatchObject({runReferences: 1});
            return next();
        });
        const run = await begin(thread.id); reads.mockRestore(); writes.mockRestore();
        expect(txIds.size).toBe(1);
        expect(readKeys.every(key => key === SKILL_CATALOGUE_KEY || key.startsWith("agentSkills.retention."))).toBe(true);
        expect(run.installedSkills?.entries).toHaveLength(1);
        expect(run.skillInstructions).toContain("Workflow metadata");
        expect(JSON.stringify(run.requestMessages)).not.toContain("PRIVATE_SKILL_BODY");
        expect(JSON.stringify(run.requestMessages)).not.toContain("PRIVATE_RESOURCE_BODY");
        const offered = getOfferedToolNames(run);
        expect(offered).toEqual(expect.arrayContaining(["load_skill", "read_skill_resource"]));
        expect(offered.length).toBeLessThanOrEqual(MAX_LOADED_TOOLS);
        expect(run.toolLoading?.foundationToolNames).toEqual(expect.arrayContaining(["load_skill", "read_skill_resource"]));
    });

    it("rolls a reached late run write failure back together with pins and both message writes", async () => {
        const installed = await install(), thread = await createChatThread();
        let reached = false;
        const fault = interceptStoreTable(db, "agentRuns", "add", async (tx, _args, _next) => {
            reached = true;
            expect((await tx.deviceSettings.get(skillRetentionKey(installed.revision)))?.value).toMatchObject({runReferences: 1});
            expect(await tx.chatMessages.where("threadId").equals(thread.id).count()).toBe(2);
            throw new Error("late actual run fault");
        });
        await expect(begin(thread.id)).rejects.toThrow("late actual run fault"); fault.mockRestore();
        expect(reached).toBe(true); expect((await retention(installed.revision))?.runReferences).toBe(0);
        expect(await db.agentRuns.count()).toBe(0); expect(await db.chatMessages.count()).toBe(0);
    });

    it("does not retain twice when duplicate reserved admission identities fail", async () => {
        const installed = await install(), thread = await createChatThread();
        const input = {threadId: thread.id, connector, model, content: "One admitted message", admission: {runId: "run_same", userMessageId: "message_same", assistantMessageId: "assistant_same"}};
        const run = await beginAgentRun(input);
        await finishAgentRun(run.id, "failed");
        await expect(beginAgentRun(input)).rejects.toThrow();
        expect(await db.agentRuns.count()).toBe(1); expect((await retention(installed.revision))?.runReferences).toBe(1);
        expect(await db.chatMessages.count()).toBe(2);
    });

    it("reconciles a lost admission reply from persisted identities without retaining a second time", async () => {
        const installed = await install(), thread = await createChatThread();
        const input = {threadId: thread.id, connector, model, content: "Saved before the reply was lost",
            admission: {runId: "run_lost", userMessageId: "message_lost", assistantMessageId: "assistant_lost"}};
        const original = db.transaction.bind(db);
        let lost = false;
        const uncertain = vi.spyOn(db, "transaction").mockImplementation(async (mode, scope, callback) => {
            const result = await original(mode, scope, callback);
            if (!lost && mode === "rw") {lost = true; throw new UnknownCommitError("lost-admission", "fixture");}
            return result;
        });
        await expect(beginAgentRun(input)).rejects.toBeInstanceOf(UnknownCommitError);
        const proof = await readAgentAdmission(input); uncertain.mockRestore();
        expect(proof).toMatchObject({status: "accepted", run: {id: input.admission.runId, installedSkills: {entries: [{revision: installed.revision}]}}});
        expect(await db.agentRuns.count()).toBe(1); expect(await db.chatMessages.count()).toBe(2);
        expect((await retention(installed.revision))?.runReferences).toBe(1);
    });

    it("propagates an explicitly supplied ProductStore through admission and deletion", async () => {
        if (!browserDatabase) throw new Error("browser fixture required");
        const supplied = createBrowserProductStore(browserDatabase);
        await install(true, supplied);
        const thread = await createChatThread(undefined, supplied);
        // Finish catalogue preparation first; its existing device model owner is independent.
        await visionCapability.resolveVisionCapability(model, connector.definitionId);
        const escape = vi.spyOn(db, "transaction").mockImplementation(() => {throw new Error("escaped supplied transaction");});
        const run = await begin(thread.id, supplied);
        await deleteChatThread(thread.id, supplied);
        expect(escape).not.toHaveBeenCalled(); escape.mockRestore();
        expect(await supplied.agentRuns.get(run.id)).toBeUndefined();
        expect((await retention(run.installedSkills!.entries[0].revision))?.runReferences).toBe(0);
    });

    it("keeps exact retry bytes after update, disable, uninstall and same-name reinstall", async () => {
        const installed = await install(), thread = await createChatThread(), run = await begin(thread.id);
        const newer = candidate("NEW_BODY");
        await updateInstalledSkill({operationId: "update-workflow", catalogueRevision: 1, skillId: installed.skillId, expectedRevision: installed.revision, candidate: newer});
        await setInstalledSkillEnabled({operationId: "disable-workflow", catalogueRevision: 2, skillId: installed.skillId, expectedRevision: newer.manifest.revision, enabled: false});
        const newThread = await createChatThread(), disabled = await begin(newThread.id);
        expect(disabled.installedSkills).toEqual({version: 1, entries: []}); expect(disabled.enabledToolNames).not.toContain("load_skill");
        await uninstallSkill({operationId: "uninstall-workflow", catalogueRevision: 3, skillId: installed.skillId, expectedRevision: newer.manifest.revision});
        const replacement = await installSkill({operationId: "reinstall-workflow", catalogueRevision: 4, candidate: candidate("REINSTALLED_BODY"), enabled: true});
        expect(replacement.skillId).not.toBe(installed.skillId);
        await finishAgentRun(run.id, "failed");
        const retry = await beginAgentRun({threadId: thread.id, connector, model, retryOfRunId: run.id});
        expect(retry.installedSkills).toEqual(run.installedSkills);
        expect(retry.requestMessages).toEqual(run.context?.baseMessages);
        expect(retry.enabledToolNames).toEqual(run.enabledToolNames); expect(retry.skillInstructions).toBe(run.skillInstructions);
        expect((await loadInstalledSkill(retry.installedSkills!.entries[0])).body).toBe("PRIVATE_SKILL_BODY");
        expect((await retention(installed.revision))?.runReferences).toBe(2);
        expect((await retention(replacement.revision))?.runReferences).toBe(0);
    });

    it("resumes an existing run without incrementing its retained revision again", async () => {
        const installed = await install(), thread = await createChatThread(), run = await begin(thread.id);
        await db.agentRuns.update(run.id, {hasToolCalls: true});
        await finishAgentRun(run.id, "interrupted");
        const resumed = await resumeAgentRun(run.id);
        expect(resumed.installedSkills).toEqual(run.installedSkills); expect((await retention(installed.revision))?.runReferences).toBe(1);
    });

    it("keeps legacy retries absent and never discovers newly installed guidance", async () => {
        const thread = await createChatThread(), initial = await begin(thread.id);
        expect(initial.installedSkills).toEqual({version: 1, entries: []});
        const legacy = {...initial}; delete legacy.installedSkills;
        await db.agentRuns.put(legacy); await finishAgentRun(initial.id, "failed");
        const installed = await install();
        const retry = await beginAgentRun({threadId: thread.id, connector, model, retryOfRunId: initial.id});
        expect(retry).not.toHaveProperty("installedSkills"); expect(retry.enabledToolNames).not.toContain("load_skill");
        expect((await retention(installed.revision))?.runReferences).toBe(0);
    });

    it("conversation admission and implicit thread-mode preview never even read the installed catalogue", async () => {
        const thread = await createChatThread(); await updateChatThread(thread.id, {interactionMode: "conversation"});
        await db.deviceSettings.put({key: SKILL_CATALOGUE_KEY, value: {version: 999}, updatedAt: "2026-10-16"});
        const keys: string[] = [];
        const reads = interceptStoreTable(db, "deviceSettings", "get", async (_tx, args, next) => {keys.push(String(args[0])); return next();});
        const preview = await readAgentContextPreview({threadId: thread.id, draft: "Only chat", attachments: [], model});
        expect(preview.status).toBe("ready");
        if (preview.status !== "ready") throw new Error("missing preview");
        expect(preview.facts.installedSkills).toBeUndefined(); expect(preview.facts.skillSurface.enabledToolNames).toEqual([]);
        const run = await begin(thread.id); reads.mockRestore();
        expect(run.installedSkills).toBeUndefined(); expect(run.enabledToolNames).toEqual([]); expect(run.skillInstructions).toBe("");
        expect(keys.some(key => key.startsWith("agentSkills."))).toBe(false);
    });

    it("fails a retry on missing retained records without substituting the latest installation", async () => {
        const installed = await install(), thread = await createChatThread(), run = await begin(thread.id);
        await finishAgentRun(run.id, "failed");
        await db.deviceSettings.delete(skillRetentionKey(installed.revision));
        await expect(beginAgentRun({threadId: thread.id, connector, model, retryOfRunId: run.id})).rejects.toThrow();
        expect(await db.agentRuns.count()).toBe(1); expect(await db.chatMessages.count()).toBe(2);
    });
});

describe("run retention across real lifecycle and concurrent boundaries", () => {
    it("serializes an update behind the captured admission and keeps that old revision pinned", async () => {
        const installed = await install(), thread = await createChatThread(), held = deferred<void>(), entered = deferred<void>();
        let intercepted = false;
        const read = interceptStoreTable(db, "deviceSettings", "get", async (tx, args, next) => {
            const value = await next();
            if (!intercepted && args[0] === SKILL_CATALOGUE_KEY && tx.mode === "rw") {
                intercepted = true; entered.resolve(); await tx.waitFor(held.promise);
            }
            return value;
        });
        const pending = begin(thread.id); await entered.promise;
        // Model a separate UI event rather than inheriting the captured Dexie callback's zone.
        const newer = candidate("AFTER_ADMISSION"), updating = Dexie.ignoreTransaction(() => updateInstalledSkill({operationId: "concurrent-update", catalogueRevision: 1,
            skillId: installed.skillId, expectedRevision: installed.revision, candidate: newer}));
        held.resolve(); const run = await pending; await updating; read.mockRestore();
        expect(run.installedSkills?.entries[0].revision).toBe(installed.revision);
        expect((await retention(installed.revision))?.runReferences).toBe(1);
        expect((await retention(installed.revision))?.currentReferences).toBe(0);
        const next = await begin((await createChatThread()).id);
        expect(next.installedSkills?.entries[0].revision).toBe(newer.manifest.revision);
    });

    it("selects the latest catalogue only after external preparation and cannot resurrect a deleted thread", async () => {
        const installed = await install(), thread = await createChatThread();
        const resolve = visionCapability.resolveVisionCapability;
        vi.spyOn(visionCapability, "resolveVisionCapability").mockImplementationOnce(async (...args) => {
            const value = await resolve(...args);
            await setInstalledSkillEnabled({operationId: "during-preparation", catalogueRevision: 1, skillId: installed.skillId, expectedRevision: installed.revision, enabled: false});
            return value;
        });
        const run = await begin(thread.id); expect(run.installedSkills?.entries).toEqual([]);
        expect((await retention(installed.revision))?.runReferences).toBe(0);
        const doomed = await createChatThread();
        vi.spyOn(visionCapability, "resolveVisionCapability").mockImplementationOnce(async (...args) => {
            const value = await resolve(...args); await deleteChatThread(doomed.id); return value;
        });
        await expect(begin(doomed.id)).rejects.toThrow("对话不存在");
        expect(await db.agentRuns.where("threadId").equals(doomed.id).count()).toBe(0);
    });

    it("retains pins when a project is deleted, then collects only when its real owning thread is deleted", async () => {
        const installed = await install(), project = await createProject("Retain recorded conversation"), thread = await createChatThread({projectId: project.id});
        const run = await begin(thread.id);
        await uninstallSkill({operationId: "remove-current", catalogueRevision: 1, skillId: installed.skillId, expectedRevision: installed.revision});
        await deleteProject(project.id);
        expect(await db.chatThreads.get(thread.id)).toBeDefined(); expect(await db.agentRuns.get(run.id)).toBeDefined();
        expect((await retention(installed.revision))?.runReferences).toBe(1);
        expect((await loadInstalledSkill(run.installedSkills!.entries[0])).body).toBe("PRIVATE_SKILL_BODY");
        await deleteChatThread(thread.id);
        expect(await db.agentRuns.get(run.id)).toBeUndefined(); expect(await db.deviceSettings.get(skillManifestKey(installed.revision))).toBeUndefined();
        expect(await db.deviceSettings.get(skillBodyKey(installed.revision))).toBeUndefined(); expect(await retention(installed.revision)).toBeUndefined();
        expect((await getInstalledSkillCatalogue()).retainedRevisions).toEqual([]);
    });

    it("rolls a reached late thread deletion fault back together with released pins and collected content", async () => {
        const installed = await install(), thread = await createChatThread(), run = await begin(thread.id);
        await uninstallSkill({operationId: "remove-before-delete", catalogueRevision: 1, skillId: installed.skillId, expectedRevision: installed.revision});
        let reached = false;
        const fault = interceptStoreTable(db, "chatThreads", "delete", async (tx, _args, _next) => {
            reached = true;
            expect(await tx.agentRuns.get(run.id)).toBeUndefined(); expect(await tx.deviceSettings.get(skillBodyKey(installed.revision))).toBeUndefined();
            throw new Error("late thread deletion fault");
        });
        await expect(deleteChatThread(thread.id)).rejects.toThrow("late thread deletion fault"); fault.mockRestore();
        expect(reached).toBe(true); expect(await db.agentRuns.get(run.id)).toBeDefined();
        expect((await retention(installed.revision))?.runReferences).toBe(1); expect(await db.deviceSettings.get(skillBodyKey(installed.revision))).toBeDefined();
        await deleteChatThread(thread.id); expect(await retention(installed.revision)).toBeUndefined();
    });
});

describe("coherent installed metadata in the actual context preview", () => {
    it("uses one finite readonly transaction and shares the admitted definitions/instructions without hydrating content", async () => {
        const installed = await install(), thread = await createChatThread();
        await updateGeneralAgentConfig({enabledSkillIds: []});
        const keys: string[] = [], ids = new Set<string>();
        const reads = interceptStoreTable(db, "deviceSettings", "get", async (tx, args, next) => {keys.push(String(args[0])); ids.add(tx.transactionId); expect(tx.mode).toBe("r"); return next();});
        const result = await readAgentContextPreview({threadId: thread.id, draft: "Apply the workflow", attachments: [], model});
        reads.mockRestore(); expect(result.status).toBe("ready");
        if (result.status !== "ready") throw new Error("missing preview");
        expect(keys.filter(key => key.startsWith("agentSkills."))).toEqual([SKILL_CATALOGUE_KEY]); expect(ids.size).toBe(1);
        expect(contextPreviewTables().map(table => table.name)).toContain("deviceSettings");
        expect((await retention(installed.revision))?.runReferences).toBe(0);
        const run = await begin(thread.id);
        expect(result.facts.skillSurface).toEqual({enabledToolNames: run.enabledToolNames, toolLoading: run.toolLoading, skillInstructions: run.skillInstructions});
        expect(result.facts.installedSkills).toEqual(run.installedSkills);
        expect(run.enabledToolNames).toEqual(["load_skill", "read_skill_resource"]);
    });

    it("uses frozen saved metadata and absent legacy fields without reading today's broken catalogue", async () => {
        const installed = await install(), thread = await createChatThread(), run = await begin(thread.id);
        await db.deviceSettings.put({key: SKILL_CATALOGUE_KEY, value: {version: 999}, updatedAt: "2026-10-16"});
        const reads = interceptStoreTable(db, "deviceSettings", "get", async (_tx, args, next) => {
            if (String(args[0]).startsWith("agentSkills.")) throw new Error("saved preview read live skill catalogue"); return next();
        });
        const input = {threadId: thread.id, draft: "Current draft", attachments: [], model};
        const saved = await readAgentContextPreview(input);
        expect(saved.status).toBe("ready");
        if (saved.status !== "ready") throw new Error("missing preview");
        expect(saved.facts.installedSkills?.entries[0].revision).toBe(installed.revision);
        expect(saved.facts.skillSurface.skillInstructions).toBe(run.skillInstructions);
        const legacy = {...run}; delete legacy.installedSkills;
        await db.agentRuns.put(legacy);
        const legacyPreview = await readAgentContextPreview(input); reads.mockRestore();
        expect(legacyPreview.status).toBe("ready");
        if (legacyPreview.status !== "ready") throw new Error("missing legacy preview");
        expect(legacyPreview.facts.installedSkills).toBeUndefined(); expect(legacyPreview.facts.skillSurface.skillInstructions).toBe(run.skillInstructions);
    });
});
