import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import Dexie from "dexie";
import {isValidElement} from "react";
import {ContextUsageTrigger, ContextUsagePanel} from "@/components/agent/ContextUsagePanel";
import {MemoryContextDetails} from "@/components/agent/MemoryContextDetails";

const host = vi.hoisted(() => ({result: undefined as unknown, queries: [] as Array<() => Promise<unknown>>}));
vi.mock("react", async () => ({...await vi.importActual<typeof import("react")>("react"),
    useMemo: (compute: () => unknown) => compute(), useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("dexie-react-hooks", () => ({useLiveQuery: (query: () => Promise<unknown>) => {host.queries.push(query); return host.result;}}));
function nodes(tree: unknown): unknown[] {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!isValidElement<{children?: unknown}>(tree)) return [];
    return [tree, ...nodes(tree.props.children)];
}
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {createChatThread, appendChatMessage} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {createAgentTaskForThread} from "@/db/agentTasks";
import {getGeneralAgentConfig} from "@/db/agentSettings";
import {GENERAL_AGENT_ID} from "@/domain/agent";
import {contextPreviewIdentity, contextPreviewTables, readAgentContextPreview, type ContextPreviewInput} from "@/db/agentContextPreview";
import {getTaskContext} from "@/lib/agent/taskContext";
import {getMemorySelection} from "@/db/memoryRetrieval";
import {selectReferenceContext, referenceSelectionCharacterBudget} from "@/lib/agent/referenceContext";
import {DEFAULT_CONTEXT_POLICY} from "@/lib/agent/contextPolicy";

const connector = {id: "cx", definitionId: "openai-compatible", baseUrl: "https://example.test/v1", apiKey: "fixture", updatedAt: "2026-10-08"};
const input: ContextPreviewInput = {draft: "test preview", model: "unknown", attachments: [], metadata: {source: "provider", vision: true}};
function ready(value: Awaited<ReturnType<typeof readAgentContextPreview>>) {
    expect(value.status).toBe("ready");
    if (value.status !== "ready") throw new Error(JSON.stringify(value));
    return value.facts;
}
async function source(projectId: string, kind: "image" | "text" = "text") {
    const blob = new Blob(["reference pixels or text"], {type: kind === "image" ? "image/png" : "text/plain"});
    await db.media.add({id: "source-media", projectId, blob, mimeType: blob.type, filename: "source"});
    await db.projectReferences.add({id: "source", projectId, mediaId: "source-media", digest: "digest", kind,
        filename: "source", mimeType: blob.type, size: blob.size, revision: 1, status: "ready", operationId: "done",
        coverage: {totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 5, truncated: false}, warnings: [], createdAt: "2026-10-08", updatedAt: "2026-10-08"});
    if (kind === "text") await db.referenceChunks.add({id: "chunk", projectId, referenceId: "source", revision: 1, index: 0, text: "facts", locator: {kind: "lines", start: 1, end: 1}});
    return {referenceId: "source", revision: 1};
}

async function fixture(kind: "video" | "audio" | "music" = "video") {
    const project = await createProject("D04");
    await db.projects.update(project.id, {kind});
    const thread = await createChatThread({projectId: project.id});
    return {project, thread, request: {...input, threadId: thread.id, projectId: project.id}};
}
beforeEach(async () => {await getGeneralAgentConfig();});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe("coherent production context preview", () => {
    it("loads real empty home/intake facts while distinguishing required missing identities", async () => {
        const home = ready(await readAgentContextPreview(input));
        expect(home.messages).toEqual([]); expect(home.previewPolicy).toEqual(DEFAULT_CONTEXT_POLICY);
        expect(home.taskContext?.task).toBeUndefined(); expect(home.selectedReferences).toBeUndefined();
        expect(home.available).toBe(true);
        const {request} = await fixture();
        expect(ready(await readAgentContextPreview(request)).taskContext?.task).toBeUndefined();
        expect(await readAgentContextPreview({...input, threadId: "missing", projectId: request.projectId})).toMatchObject({status: "missing", entity: "thread"});
        expect(await readAgentContextPreview({...input, projectId: "missing"})).toMatchObject({status: "missing", entity: "project"});
        await db.agents.delete(GENERAL_AGENT_ID);
        expect(await readAgentContextPreview(input)).toMatchObject({status: "missing", entity: "agent"});
    });

    it.each(["video", "audio", "music"] as const)("joins actual nested %s readers in the complete readonly store scope", async kind => {
        const {request, project} = await fixture(kind);
        const transactions = new Set<import("dexie").Transaction>();
        const observe = <T>(row: T): T => {const tx = Dexie.currentTransaction; if (tx) transactions.add(tx); return row;};
        db.projects.hook("reading", observe); db.chatThreads.hook("reading", observe);
        db.projectMemories.hook("reading", observe);
        try {
            const facts = ready(await readAgentContextPreview(request));
            expect(facts.taskContext?.projectContext?.projectId).toBe(project.id);
            expect(facts.memorySelection?.selectedCount).toBe(0);
            expect(facts.taskContext?.projectContext).toEqual(await import("@/lib/agent/projectContext").then(module => module.getProjectContext(project.id)));
            // Check stores and shared native transaction before unrelated comparison reads.
            const previewTransactions = [...transactions].filter(tx => tx.storeNames.includes("agentRuns"));
            expect(previewTransactions.length).toBeGreaterThan(0);
            expect(new Set(previewTransactions.map(tx => tx.idbtrans)).size).toBe(1);
            for (const tx of previewTransactions) {
                expect(tx.mode).toBe("readonly");
                expect([...tx.storeNames].sort()).toEqual(contextPreviewTables().map(table => table.name).sort());
            }
        } finally {
            db.projects.hook("reading").unsubscribe(observe); db.chatThreads.hook("reading").unsubscribe(observe);
            db.projectMemories.hook("reading").unsubscribe(observe);
        }
    });

    it("rejects a foreign task/run or requested project and never falls back from a missing thread", async () => {
        const {request, thread} = await fixture(); const other = await createProject("foreign");
        expect(await readAgentContextPreview({...request, projectId: other.id})).toMatchObject({status: "unavailable"});
        const task = await createAgentTaskForThread(thread.id, { title: "goal", goal: "scope"});
        await db.agentTasks.update(task.id, {projectId: other.id});
        expect(await readAgentContextPreview(request)).toMatchObject({status: "unavailable"});
        await db.agentTasks.delete(task.id);
        const run = await beginAgentRun({threadId: thread.id, connector, model: "unknown", content: "frozen"});
        await db.agentRuns.update(run.id, {projectId: other.id});
        expect(await readAgentContextPreview(request)).toMatchObject({status: "unavailable"});
    });

    it("preserves the shared execution selectors, policy, bounded task assembly and current reference budget", async () => {
        const {request, thread} = await fixture();
        await db.chatThreads.update(thread.id, {contextPolicy: {...DEFAULT_CONTEXT_POLICY, customContextTokens: 8192}});
        await appendChatMessage({threadId: thread.id, role: "user", content: "Earlier question"});
        await createAgentTaskForThread(thread.id, { title: "Test goal", goal: "Test goal"});
        const facts = ready(await readAgentContextPreview(request));
        const config = await db.agents.get(GENERAL_AGENT_ID);
        expect(facts.taskContext).toEqual(await getTaskContext(thread.id, config?.instructions ?? "", thread.taskMode, undefined, request.projectId));
        expect(facts.memorySelection).toEqual(await getMemorySelection({projectId: thread.projectId ?? "", threadId: thread.id, draft: request.draft, recentUserTurns: ["Earlier question"], taskTitle: facts.taskContext?.task?.title, taskGoal: facts.taskContext?.task?.goal, capacity: 8192}));
        expect(facts.selectedReferences).toEqual(await selectReferenceContext(thread.projectId, [], referenceSelectionCharacterBudget(8192)));
        const run = await beginAgentRun({threadId: thread.id, connector, model: request.model, content: request.draft});
        expect(run.context?.policy).toEqual(facts.previewPolicy);
        expect(run.projectContext).toEqual(facts.taskContext?.projectContext);
        expect(run.memorySelection).toEqual(facts.memorySelection);
    });

    it("reports DB failures without default/empty facts, and identities cover every actual request input", async () => {
        vi.spyOn(db.agents, "get").mockRejectedValueOnce(new Error("fixture read failure"));
        expect(await readAgentContextPreview(input)).toEqual({identity: contextPreviewIdentity(input), status: "error", message: "fixture read failure"});
        const identity = contextPreviewIdentity(input);
        for (const changed of [{threadId: "B"}, {projectId: "B"}, {draft: "changed"}, {model: "changed"}, {metadata: {source: "provider" as const, vision: false}}, {attachments: [{referenceId: "ref", revision: 2}]}, {interactionMode: "conversation" as const}, {providerId: "changed"}]) {
            expect(contextPreviewIdentity({...input, ...changed})).not.toBe(identity);
        }
        expect(ready(await readAgentContextPreview({...input, interactionMode: "conversation"})).taskContext?.taskToolNames).toEqual([]);
    });

    it.each(["withdrawn", "revised", "pending", "foreign-source", "foreign-media"])("preserves actual reference rejection: %s", async scenario => {
        const {request, project} = await fixture(); const attachment = await source(project.id);
        if (scenario === "withdrawn") await db.projectReferences.update("source", {status: "unavailable"});
        if (scenario === "revised") await db.projectReferences.update("source", {revision: 2});
        if (scenario === "pending") await db.projectReferences.update("source", {status: "parsing"});
        if (scenario === "foreign-source") await db.projectReferences.update("source", {projectId: "foreign"});
        if (scenario === "foreign-media") await db.media.update("source-media", {projectId: "foreign"});
        const result = await readAgentContextPreview({...request, attachments: [attachment]});
        expect(result.status).toBe("error"); expect(result).not.toHaveProperty("facts");
        if (result.status !== "error") throw new Error("missing reference error");
        await expect(selectReferenceContext(project.id, [attachment], 4096)).rejects.toThrow(result.message);
    });

    it("selects actual complete chunks/owned image metadata and rejects unsupported vision without treating text as vision", async () => {
        const {request, project} = await fixture(); const attachment = await source(project.id);
        const text = ready(await readAgentContextPreview({...request, metadata: {source: "provider", vision: false}, attachments: [attachment]}));
        expect(text.selectedReferences?.coverage?.[0]?.includedChunkIndices).toEqual([0]);
        await db.projectReferences.update("source", {kind: "image", mimeType: "image/png"});
        await db.media.update("source-media", {mimeType: "image/png", blob: new Blob(["actual-pixels"], {type: "image/png"})});
        const rejected = await readAgentContextPreview({...request, metadata: {source: "provider", vision: false}, attachments: [attachment]});
        expect(rejected).toMatchObject({status: "error", message: expect.stringContaining("不支持图片")});
        const accepted = ready(await readAgentContextPreview({...request, attachments: [attachment]}));
        expect(accepted.selectedReferences?.images?.[0]).toMatchObject({mediaId: "source-media", projectId: project.id});
        expect(JSON.stringify(accepted.selectedReferences)).not.toContain("data:image");
    });

    it("reads saved runs without live project/memory/reference fallback including legacy optional fields", async () => {
        const {thread, request, project} = await fixture();
        const run = await beginAgentRun({threadId: thread.id, connector, model: "unknown", content: "Frozen request"});
        await db.agentRuns.update(run.id, {memorySelection: undefined, projectContext: undefined, context: undefined});
        await db.projects.delete(project.id);
        const facts = ready(await readAgentContextPreview({...request, attachments: [{referenceId: "deleted", revision: 1}]}));
        expect(facts.activeRun?.requestMessages).toEqual(run.requestMessages);
        expect(facts.available).toBe(false); expect(facts.taskContext).toBeUndefined();
        expect(facts.memorySelection).toBeUndefined(); expect(facts.selectedReferences).toBeUndefined();
        expect(facts.activeRun?.projectContext).toBeUndefined();
    });
});


describe("actual context trigger and presentational panel", () => {
    it("never adopts a later live summary threshold for a saved run whose frozen summaryId is absent", async () => {
        vi.stubGlobal("document", {querySelector: () => null});
        const {request, thread} = await fixture();
        await db.chatThreads.update(thread.id, {contextPolicy: {...DEFAULT_CONTEXT_POLICY, customContextTokens: 8192}});
        const earlier = await appendChatMessage({threadId: thread.id, role: "user", content: "Earlier question"});
        const run = await beginAgentRun({threadId: thread.id, connector, model: request.model, content: request.draft});
        expect(run.context?.summaryId).toBeUndefined();
        await db.contextCompactions.add({id: "later-summary", threadId: thread.id, runId: run.id, status: "completed",
            coverage: [{id: earlier.id, role: "user", content: "Earlier question"}], input: [], policy: DEFAULT_CONTEXT_POLICY,
            connector: run.connector, model: request.model, content: "Later live summary", beforeTokens: 99,
            createdAt: "2026-10-08", updatedAt: "2026-10-08", activatedAt: "2026-10-08"});
        host.result = await readAgentContextPreview(request); host.queries = [];
        const tree = nodes(ContextUsageTrigger({...request, modelMetadata: {unknown: request.metadata}, open: true, onOpenChange: vi.fn()}));
        const panel = tree.find(node => isValidElement(node) && node.type === ContextUsagePanel);
        if (!isValidElement<Parameters<typeof ContextUsagePanel>[0]>(panel)) throw new Error("actual saved panel absent");
        const snapshot = panel.props.snapshot;
        expect(snapshot.activeRun?.requestMessages).toEqual(run.requestMessages);
        expect(snapshot.budget?.threshold).toBe(4096);
        expect(snapshot.lastRecord).toBeUndefined();
        expect(snapshot.selectedCount).toBe(run.context?.history.length);
    });

    it("shares the same ready result with panel/memory details and hides retained ready/error/empty results for every identity", async () => {
        vi.stubGlobal("document", {querySelector: () => null});
        const {request} = await fixture();
        const read = await readAgentContextPreview(request);
        host.result = read; host.queries = [];
        const props = {...request, modelMetadata: {unknown: request.metadata}, open: true, onOpenChange: vi.fn()};
        const tree = nodes(ContextUsageTrigger(props));
        const panel = tree.find(node => isValidElement(node) && node.type === ContextUsagePanel);
        if (!isValidElement<Parameters<typeof ContextUsagePanel>[0]>(panel)) throw new Error("actual panel absent");
        const snapshot = panel.props.snapshot;
        const memory = tree.find(node => isValidElement(node) && node.type === MemoryContextDetails);
        if (!isValidElement<Parameters<typeof MemoryContextDetails>[0]>(memory)) throw new Error("memory details absent");
        expect(snapshot.status).toBe("ready");
        expect(memory.props.selection).toBe(ready(read).memorySelection);
        ContextUsagePanel(panel.props);
        expect(host.queries).toHaveLength(1);
        expect(snapshot.memorySelection).toBe(memory.props.selection);
        for (const result of [read, {identity: read.identity, status: "error", message: "old error"}, {identity: read.identity, status: "missing", entity: "project"}]) {
            host.result = result;
            for (const changes of [{draft: "new draft"}, {threadId: "B"}, {projectId: "other"}, {model: "other"},
                {modelMetadata: {unknown: {source: "provider" as const, vision: false}}},
                {interactionMode: "conversation" as const}, {attachments: [{referenceId: "other", revision: 2}]}]) {
            const changed = nodes(ContextUsageTrigger({...props, ...changes}));
            const changedPanel = changed.find(node => isValidElement(node) && node.type === ContextUsagePanel);
            if (!isValidElement<Parameters<typeof ContextUsagePanel>[0]>(changedPanel)) throw new Error("changed panel absent");
            expect(changedPanel.props.snapshot.status).toBe("loading");
            expect(changedPanel.props.snapshot.usage).toBeUndefined();
            expect(changedPanel.props.snapshot.error).toBeUndefined();
            expect(changedPanel.props.snapshot.percent).toBeUndefined();
            }
        }
    });
});
