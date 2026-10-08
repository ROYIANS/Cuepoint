import {useState} from "react";
import {createRoot} from "react-dom/client";
import {createMemoryHistory, createRootRoute, createRouter, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import Dexie, {type Transaction} from "dexie";
import {ContextUsageTrigger} from "@/components/agent/ContextUsagePanel";
import {ContextParameters} from "@/components/agent/ContextParameters";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {createChatThread} from "@/db/chat";
import {createProjectMemory} from "@/db/projectMemories";
import {contextPreviewTables, readAgentContextPreview, type ContextPreviewInput} from "@/db/agentContextPreview";
import type {ReferenceAttachment} from "@/domain/references";
import {GENERAL_AGENT_ID} from "@/domain/agent";

await db.delete(); await db.open();
const project = await createProject("Native project A");
const other = await createProject("Native project B");
const a = await createChatThread({projectId: project.id, title: "A"});
const b = await createChatThread({projectId: project.id, title: "B"});
const c = await createChatThread({projectId: other.id, title: "C"});
const {memory} = await createProjectMemory(project.id, {category: "convention", title: "Native memory", topicKey: "native", body: "OLD MEMORY", applicability: "", tags: [], inclusion: "project"});
const image = {referenceId: "native-image", revision: 1};
const blob = new Blob([Uint8Array.from([137, 80, 78, 71])], {type: "image/png"});
await db.media.add({id: "image-media", projectId: project.id, blob, mimeType: "image/png", filename: "image.png"});
await db.projectReferences.add({id: image.referenceId, projectId: project.id, mediaId: "image-media", digest: "fixture", kind: "image", filename: "image.png", mimeType: "image/png", size: blob.size, revision: 1, status: "ready", operationId: "done", coverage: {totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: 0, truncated: false}, warnings: [], createdAt: "2026-10-08", updatedAt: "2026-10-08"});

const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
function hold(key: string) {
    let release = () => {};
    const promise = new Promise<void>(resolve => {release = resolve;});
    gates.set(key, {promise, release});
}
function release(key: string) {gates.get(key)?.release(); gates.delete(key);}
const reads: Array<{identity: string; phase: string}> = [];
let failAgent = false;
const failRead = <T,>(row: T): T => {if (failAgent) throw new Error("native deliberate read failure"); return row;};
db.agents.hook("reading", failRead);
let choose = (_threadId: string | undefined, _projectId: string | undefined, _model: string, _draft: string, _attachments: ReferenceAttachment[]) => {};
let showParameters = (_threadId: string | undefined) => {};
let hideParameters = () => {};

function App() {
    const [target, setTarget] = useState<{threadId?: string; projectId?: string; model: string; draft: string; attachments: ReferenceAttachment[]}>({threadId: a.id, projectId: project.id, model: "gpt-4o", draft: "native draft", attachments: [image]});
    const [open, setOpen] = useState(false);
    const [parameters, setParameters] = useState<{threadId?: string}>();
    choose = (threadId, projectId, model, draft, attachments) => setTarget({threadId, projectId, model, draft, attachments});
    showParameters = threadId => setParameters({threadId}); hideParameters = () => setParameters(undefined);
    return <main className="agent-chat-root" data-owner={target.threadId ?? "home"}>
        <ContextUsageTrigger {...target} open={open} onOpenChange={setOpen}/>
        {parameters && <ContextParameters threadId={parameters.threadId} onBack={hideParameters}/>}
        <Toaster/>
    </main>;
}

async function coherent() {
    const request: ContextPreviewInput = {threadId: a.id, projectId: project.id, model: "unknown", draft: "consistency", attachments: [image], metadata: {source: "provider", vision: true}};
    await db.projects.update(project.id, {brief: "OLD PROJECT"});
    await db.chatThreads.update(a.id, {excludedMemoryIds: []});
    const observations: Array<{table: string; mode: string; stores: string[]; outerStores: string[]; tx: Transaction}> = [];
    let writer: Promise<void> | undefined;
    let writerStarted = false, writerFinished = false;
    const observe = (table: string) => <T,>(row: T): T => {
        const tx = Dexie.currentTransaction;
        let outer = tx;
        while (outer?.parent) outer = outer.parent;
        if (tx && outer?.storeNames.includes("agentRuns")) {
            observations.push({table, mode: tx.mode, stores: [...tx.storeNames], outerStores: [...outer.storeNames], tx});
            if (!writer && table === "projects") {
                writerStarted = true;
                writer = Dexie.ignoreTransaction(() => db.transaction("rw", [db.projects, db.projectMemories], async () => {
                    await db.projects.update(project.id, {brief: "NEW PROJECT"});
                    await db.projectMemories.update(memory.id, {body: "NEW MEMORY", revision: 2});
                })).then(() => {writerFinished = true;});
            }
        }
        return row;
    };
    const hooks = [db.projects, db.projectMemories, db.projectReferences, db.media].map(table => ({table, hook: observe(table.name)}));
    for (const {table, hook} of hooks) table.hook("reading", hook);
    let before;
    let finishedAtRead;
    try {before = await readAgentContextPreview(request); finishedAtRead = writerFinished;}
    finally {for (const {table, hook} of hooks) table.hook("reading").unsubscribe(hook);}
    await writer;
    const after = await readAgentContextPreview(request);
    return {before, after, writerStarted, finishedAtRead, writerFinished,
        observations: observations.map(({table, mode, stores, outerStores}) => ({table, mode, stores, outerStores})),
        oneNativeTransaction: new Set(observations.map(row => row.tx.idbtrans)).size === 1,
        expectedStores: contextPreviewTables().map(table => table.name)};
}

const api = {
    a: a.id, b: b.id, c: c.id, projectId: project.id, otherProjectId: other.id, memoryId: memory.id, image,
    reads, hold, release,
    async waitPreview(input: ContextPreviewInput, identity: string) {reads.push({identity, phase: "start"}); await gates.get(input.model)?.promise;},
    previewFinished(identity: string) {reads.push({identity, phase: "finish"});},
    async waitPolicy() {await gates.get("policy")?.promise;},
    async waitWrite() {await gates.get("write")?.promise;},
    choose(threadId: string | undefined, projectId: string | undefined, model = "unknown", draft = "native draft", attachments: ReferenceAttachment[] = []) {choose(threadId, projectId, model, draft, attachments);},
    parameters(threadId?: string) {showParameters(threadId);}, hideParameters() {hideParameters();},
    async deleteThread(id: string) {await db.chatThreads.delete(id);},
    async exclusions(id: string) {return (await db.chatThreads.get(id))?.excludedMemoryIds ?? [];},
    fail(value: boolean) {failAgent = value;},
    async refresh() {await db.agents.update(GENERAL_AGENT_ID, {updatedAt: new Date().toISOString()});},
    async policy(id: string) {return (await db.chatThreads.get(id))?.contextPolicy;},
    coherent,
    read(input: ContextPreviewInput) {return readAgentContextPreview(input);},
};
declare global {interface Window {d04: typeof api;}}
window.d04 = api;
const element = document.getElementById("root");
if (!element) throw new Error("missing root");
const router = createRouter({routeTree: createRootRoute({component: App}), history: createMemoryHistory({initialEntries: ["/"]})});
createRoot(element).render(<RouterProvider router={router}/>);
