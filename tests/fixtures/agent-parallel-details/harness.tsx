import {createRoot} from "react-dom/client";
import {useState} from "react";
import {createRootRoute, createRoute, createRouter, createBrowserHistory, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {AppFrame} from "@/app/layout/AppFrame";
import {ShotDetailsProvider, ShotDetailLink} from "@/app/details/ShotDetails";
import {LobeChatTheme} from "@/features/agent/ui/LobeChatTheme";
import {AgentChatPage} from "@/features/agent/ui/AgentChatPage";
import {AgentActivityNavigationProvider} from "@/features/agent/ui/AgentActivityNavigation";
import {AgentRunDetails} from "@/features/agent/ui/AgentRunDetails";
import {CreatedEntityLinks} from "@/features/agent/ui/CreatedEntityLinks";
import {GenerationReview} from "@/features/agent/ui/GenerationReview";
import {AgentGenerationResults} from "@/features/agent/ui/AgentGenerationResults";
import {ProjectImageSources} from "@/features/agent/ui/ProjectImageSources";
import {TaskWrapup} from "@/features/agent/ui/TaskWrapup";
import {createAgentTaskForThread} from "@/features/agent/commands/agentTasks";
import {createManualWrapup, saveWrapup} from "@/features/agent/commands/agentTaskWrapups";
import {ThinkingPanel} from "@/features/agent/ui/ThinkingPanel";
import type {AgentRun, AgentToolCall} from "@/features/agent/models/agent";
import {createChatThread, updateChatThread} from "@/features/agent/commands/chat";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {addShot, patchShot} from "@/features/video/commands/shots";
import "@/ui/theme.css";

// Only transport is controlled. The real Agent session, core loop, writer,
// Web Lock, product queries and video commands execute unchanged.
const at = "2026-10-15T00:00:00.000Z";
const connector = {id: "parallel-offline", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const, label: "Offline acceptance",
    baseUrl: "https://parallel.fixture.test/v1", apiKey: "offline-fixture-only", updatedAt: at};
await db.open();
await db.connectors.put(connector);
const project = await createProject("Parallel shot acceptance");
const episode = (await db.episodes.where("projectId").equals(project.id).toArray())[0];
const shots = [await addShot(project.id, episode.id), await addShot(project.id, episode.id), await addShot(project.id, episode.id)];
for (const [index, shot] of shots.entries()) await patchShot(shot.id, {shotNumber: `P${index + 1}`, content: `Original shot ${index + 1}`, durationSec: 3 + index});
await db.episodes.update(episode.id, {shotFilters: {statuses: ["approved"], beatIds: [], gaps: []}});
const filters = (await db.episodes.get(episode.id))?.shotFilters;
const thread = await createChatThread({title: "Retained running conversation", projectId: project.id, connectorId: connector.id, model: "gpt-4o"});
await updateChatThread(thread.id, {interactionMode: "conversation"});
const task = await createAgentTaskForThread(thread.id, {title: "Acceptance task", goal: "Inspect without interruption", projectId: project.id, plan: []});
const href = (index: number) => `/p/${encodeURIComponent(project.id)}/e/${encodeURIComponent(episode.id)}/shots?shot=${encodeURIComponent(shots[index].id)}`;
for (let index = 0; index < 18; index++) await db.chatMessages.put({id: `parallel-history-${index}`, threadId: thread.id,
    role: index % 2 ? "assistant" : "user", status: "complete", createdAt: `2026-10-14T00:${String(index).padStart(2, "0")}:00.000Z`,
    content: index === 17 ? `[Transcript shot](${href(0)}) · [External reference](https://example.com/parallel)\n\n` + "Historical answer. ".repeat(35) : `History ${index}. ` + "Preserved reading context. ".repeat(35)});
const run: AgentRun = {id: "parallel-surface-run", threadId: thread.id, projectId: project.id, agentId: "agent_general",
    agentSnapshot: {name: "Acceptance", instructions: "Offline fixture"}, userMessageId: "parallel-history-16", assistantMessageId: "parallel-history-17",
    model: "gpt-4o", connector, taskId: task.id, requestMessages: [], status: "completed", checkpoint: 1, createdAt: at, updatedAt: at};
const call: AgentToolCall = {id: "parallel-surface-call", runId: run.id, threadId: thread.id, providerCallId: "fixture-call", step: 1, order: 0,
    name: "shot_update", title: "更新镜头", arguments: "{}", status: "completed", effect: "write", highRisk: false, requiresConfirmation: false,
    preview: {summary: "Preview shot", changes: ["Fixture preview"], target: {href: href(0), label: "Preview shot"}},
    result: JSON.stringify({items: shots.map((shot, index) => ({id: shot.id, kind: "shot", ownerId: project.id, episodeId: episode.id, target: {href: href(index), label: `Receipt shot ${index + 1}`}}))}), createdAt: at, updatedAt: at};
const generationCall: AgentToolCall = {...call, id: "parallel-generation-review", name: "generate_image", status: "awaiting_approval",
    preview: {...call.preview!, revision: "fixture-revision", target: {href: href(0), label: "Review shot"}},
    arguments: JSON.stringify({connectorId: connector.id, model: "gpt-image-2", prompt: "Offline proposal; never submitted", target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shots[0].id, slot: "firstFrame"}})};
const provenanceCall: AgentToolCall = {...call, name: "discover_project_images", result: JSON.stringify({candidates: [{id: "parallel-image", projectName: project.name,
    entityLabel: "Provenance shot", slotLabel: "首帧", source: "current", available: false, target: {href: href(0), label: "Provenance shot"}}]})};
await db.agentGenerationJobs.put({version: 1, id: "parallel-job", runId: run.id, threadId: thread.id, callId: call.id, projectId: project.id,
    connectorId: connector.id, provider: "apimart", baseUrl: "https://offline.invalid", model: "gpt-image-2", kind: "image",
    target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shots[0].id, slot: "firstFrame"}, baseRevision: "fixture", sourceRevisions: [],
    parameters: {}, inputs: [], fingerprint: "fixture-history", status: "failed", error: "Offline historical result; no submission", createdAt: at, updatedAt: at});

await db.agentRuns.put(run);
await db.agentToolCalls.put(call);
const wrapup = await createManualWrapup(task.id);
const entityEvidence = wrapup.snapshot.evidence.find(source => source.kind === "entity" && source.available && source.href === href(0));
if (!entityEvidence) throw new Error("Fixture must contain real shot evidence before rendering wrap-up");
await saveWrapup(task.id, wrapup.id, {...wrapup.content, overview: "Offline accepted evidence", decisions: [{text: "Inspect shot evidence", sourceIds: [entityEvidence.id]}]}, wrapup.revision);

let surface = (value: string) => {void value;};
function SurfacePalette() {
    const [name, setName] = useState("");
    surface = setName;
    if (!name) return null;
    const element = name === "flat" ? <CreatedEntityLinks call={call} includePreview/>
        : name === "single" ? <CreatedEntityLinks call={{...call, result: JSON.stringify({target: {href: href(0), label: "Single historical shot"}})}} includePreview collapseDetails/>
        : name === "hash" ? <ThinkingPanel active reasoning={`[Native hash shot](#${href(0)})`}/>
        : name === "collapsed" ? <CreatedEntityLinks call={call} includePreview collapseDetails/>
        : name === "preview" ? <AgentRunDetails run={{...run, status: "running"}} message={{id: run.assistantMessageId, threadId: thread.id, role: "assistant", content: "", status: "streaming", createdAt: at}} calls={[call]} busy={false} onAction={() => undefined}/>
        : name === "review" ? <GenerationReview call={generationCall} busy={false} onAction={() => undefined}/>
        : name === "result" ? <AgentGenerationResults runId={run.id}/>
        : name === "provenance" ? <ProjectImageSources call={provenanceCall}/>
        : name === "wrapup" ? <TaskWrapup task={task} busy onEditingChange={() => undefined} onPendingChange={() => undefined}/>
        : name === "activity" ? <AgentRunDetails run={{...run, status: "running", activitySteps: [{step: 1, content: `[Activity shot](${href(0)})`}]}} message={{id: run.assistantMessageId, threadId: thread.id, role: "assistant", content: "", status: "streaming", createdAt: at}} calls={[]} busy={false} onAction={() => undefined}/>
        : name === "reasoning" ? <ThinkingPanel active reasoning={`[Reasoning shot](${href(0)})`}/>
        : <><ShotDetailLink href={href(0)}>Shot A</ShotDetailLink><ShotDetailLink href={href(1)}>Shot B</ShotDetailLink><ShotDetailLink href={href(2)}>Shot C</ShotDetailLink>
            <ShotDetailLink href={`/p/${project.id}/e/${episode.id}/shots?shot=missing`}>Missing shot</ShotDetailLink>
            <ShotDetailLink href={`/p/foreign/e/${episode.id}/shots?shot=${shots[0].id}`}>Foreign shot</ShotDetailLink></>;
    return <div data-acceptance-surface={name} style={{maxHeight: 220, overflow: "auto", flexShrink: 0, padding: 8, borderBottom: "1px solid var(--border)"}}>
        <AgentActivityNavigationProvider threadId={thread.id}>{element}</AgentActivityNavigationProvider></div>;
}
function Harness() {
    return <AppFrame contentScroll="hidden"><ShotDetailsProvider><LobeChatTheme><div style={{display: "flex", flexDirection: "column", height: "100%", minHeight: 0}}>
        <SurfacePalette/><div style={{flex: "1 1 auto", minHeight: 0}}><AgentChatPage threadId={thread.id}/></div>
    </div></LobeChatTheme></ShotDetailsProvider><Toaster/></AppFrame>;
}
const root = createRootRoute({component: Harness});
const route = createRoute({getParentRoute: () => root, path: "agent/$threadId"});
window.history.replaceState(null, "", `/agent/${thread.id}`);
const router = createRouter({routeTree: root.addChildren([route]), history: createBrowserHistory()});
const saveGates = new Map<string, {promise: Promise<void>; release: () => void}>();
const manualWrites: Array<{id: string; fields: string[]}> = [];
const holdSave = (field: string) => {let release!: () => void; const promise = new Promise<void>(resolve => {release = resolve;}); saveGates.set(field, {promise, release});};
Object.assign(window, {__parallelBeforeSave: async (id: string, patch: Record<string, unknown>, baseline?: unknown) => {
    if (!baseline) return;
    manualWrites.push({id, fields: Object.keys(patch)});
    for (const field of Object.keys(patch)) await saveGates.get(field)?.promise;
}});
const encoder = new TextEncoder();
const requests: Array<{url: string; method: string; aborted: boolean}> = [];
let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
let sequence = 0;
const emit = (text: string) => {
    stream?.enqueue(encoder.encode(`data: ${JSON.stringify({id: "parallel-stream", object: "chat.completion.chunk", choices: [{index: 0, delta: {content: text}, finish_reason: null}]})}\n\n`));
    return ++sequence;
};
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://parallel.fixture.test/")) return realFetch(input, init);
    if (url.endsWith("/models")) return Response.json({data: [{id: "gpt-4o", object: "model"}]});
    if (!url.endsWith("/chat/completions") || init?.method !== "POST") throw new Error("Unexpected offline transport: " + url);
    const request = {url, method: init.method, aborted: false};
    requests.push(request);
    init.signal?.addEventListener("abort", () => {request.aborted = true; stream?.error(new DOMException("Aborted", "AbortError")); stream = undefined;}, {once: true});
    return new Response(new ReadableStream<Uint8Array>({start(controller) {stream = controller; emit("Live stream begins. ");}, cancel() {stream = undefined;}}), {headers: {"content-type": "text/event-stream"}});
};
Object.assign(window, {parallel: {db, project, episode, shots, thread, href, requests, filters,
    surface: (name: string) => surface(name), emit, manualWrites, holdSave,
    releaseSave: (field: string) => {saveGates.get(field)?.release(); saveGates.delete(field);},
    finish: () => {stream?.enqueue(encoder.encode('data: {"id":"parallel-stream","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')); stream?.close(); stream = undefined;},
    current: async () => ({route: router.history.location.pathname, runs: await db.agentRuns.where("threadId").equals(thread.id).toArray(), requests, sequence}),
    remotePatch: (index: number, patch: Parameters<typeof patchShot>[1]) => patchShot(shots[index].id, patch),
    navigate: (to: string) => router.navigate({to})}});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
