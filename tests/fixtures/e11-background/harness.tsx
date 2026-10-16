import {manualQuitGuards} from "@/app/drafts/manualQuitGuards";
import {createApplicationQuit} from "@/app/lifecycle/applicationQuit";
import {createEffectAdmission} from "@/platform/runtime/effectAdmission";
import type {DesktopLifecycleEvent, DesktopLifecycleAction} from "@/platform/runtime/desktopLifecycle";
import {chatDrafts} from "@/features/agent/runtime/chatDraftStore";
import {useState} from "react";
import {useManualDraftDeparture} from "@/app/drafts/useManualDraftGuard";
import {createRoot} from "react-dom/client";
import {createRootRoute, createRoute, createRouter, createBrowserHistory, Outlet, RouterProvider, useLocation, useParams} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {AppFrame} from "@/app/layout/AppFrame";
import {AgentChatPage} from "@/features/agent/ui/AgentChatPage";
import {LobeChatTheme} from "@/features/agent/ui/LobeChatTheme";
import {SettingsPage} from "@/features/settings/ui/SettingsPage";
import {ProjectHomePage} from "@/app/workspace/ProjectHomePage";
import {AgentGenerationBatches} from "@/features/agent/ui/AgentGenerationBatches";
import {db} from "@/platform/product/store";
import {agentExecution} from "@/features/agent/runtime/agentExecution";
import {createChatThread} from "@/features/agent/commands/chat";
import {beginAgentRun, finishAgentRun} from "@/features/agent/commands/agentRuns";
import {createAgentTask} from "@/features/agent/commands/agentTasks";
import {TaskWrapup} from "@/features/agent/ui/TaskWrapup";
import {pauseForApproval, transitionToolCall} from "@/features/agent/commands/agentTools";
import {prepareGenerationBatch, readGenerationBatch, confirmGenerationBatch} from "@/features/agent/commands/agentGenerationBatches";
import {createProject} from "@/features/projects/commands/projects";
import {addShot} from "@/features/video/commands/shots";
import {saveFixtureToolRound} from "../../helpers/toolDispatch";
import "@/ui/theme.css";

await db.open();
await agentExecution.initialize();
const at = new Date().toISOString();
const connector = {id: "e11-chat", definitionId: "openai-compatible" as const, protocol: "openai-compatible" as const,
    baseUrl: "https://e11-chat.fixture/v1", apiKey: "offline-only", updatedAt: at};
await db.connectors.put(connector);
await db.connectors.put({...connector, id: "e11-image", definitionId: "apimart", baseUrl: "https://e11-image.fixture/v1"});
const project = await createProject("E11 retained work");
const a = await createChatThread({title: "E11 thread A", connectorId: connector.id, model: "gpt-4o", projectId: project.id});
const b = await createChatThread({title: "E11 thread B", connectorId: connector.id, model: "gpt-4o", projectId: project.id});
const c = await createChatThread({title: "E11 generation C", connectorId: connector.id, model: "gpt-4o", projectId: project.id});
const wrapupTask = await createAgentTask({projectId: project.id, title: "E11 wrapup", goal: "Review existing records", acceptanceCriteria: [], plan: []});
const encoder = new TextEncoder();
const requests: Array<{text: string; aborted: boolean; optimisticVisible: boolean; stream?: ReadableStreamDefaultController<Uint8Array>}> = [];
const wrapup = {requests: 0, aborted: false, release: () => {}};
const wrapupGate = new Promise<void>(resolve => {wrapup.release = resolve;});
const generation: Array<{method: string; url: string; aborted: boolean}> = [];
let releaseGeneration!: () => void;
const generationGate = new Promise<void>(resolve => {releaseGeneration = resolve;});
const chunk = (text: string) => encoder.encode(`data: ${JSON.stringify({choices: [{index: 0, delta: {content: text}, finish_reason: null}]})}\n\n`);
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith(connector.baseUrl)) {
        if (url.endsWith("/models")) return Response.json({data: [{id: "gpt-4o", object: "model"}]});
        const body = JSON.parse(String(init?.body));
        if (String(body.messages[0]?.content).includes("任务验收记录助手")) {
            wrapup.requests++;
            init?.signal?.addEventListener("abort", () => {wrapup.aborted = true;}, {once: true});
            await wrapupGate;
            return Response.json({choices: [{message: {content: JSON.stringify({overview: "E11 retained AI summary", results: [], acceptance: [], decisions: [], lessons: [], unresolved: []})}, finish_reason: "stop"}]});
        }
        const request = {text: JSON.stringify(body.messages), aborted: false,
            optimisticVisible: [...document.querySelectorAll(".agent-user-bubble")].some(node => node.textContent?.includes(String(body.messages.filter((message: {role: string}) => message.role === "user").at(-1)?.content))), stream: undefined as ReadableStreamDefaultController<Uint8Array> | undefined};
        requests.push(request);
        init?.signal?.addEventListener("abort", () => {request.aborted = true; request.stream?.error(new DOMException("Stopped", "AbortError")); request.stream = undefined;}, {once: true});
        return new Response(new ReadableStream<Uint8Array>({start(stream) {request.stream = stream; stream.enqueue(chunk("Original live answer. "));}}), {headers: {"content-type": "text/event-stream"}});
    }
    if (url.startsWith("https://e11-image.fixture")) {
        const request = {method: init?.method ?? "GET", url, aborted: false}; generation.push(request);
        init?.signal?.addEventListener("abort", () => {request.aborted = true;}, {once: true});
        if (init?.method === "POST") return Response.json({code: 200, data: [{task_id: "e11-paid-once", status: "submitted"}]});
        await generationGate;
        return Response.json({code: 200, data: {id: "e11-paid-once", status: "completed", result: {images: [{url: "https://e11-output.fixture/result.png"}]}}});
    }
    if (url.startsWith("https://e11-output.fixture")) return new Response(Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII="), char => char.charCodeAt(0)), {headers: {"content-type": "image/png"}});
    return realFetch(input, init);
};
let generationRun: string | undefined;
function BatchSurface() {return generationRun ? <AgentGenerationBatches runId={generationRun}/> : null;}
const root = createRootRoute({component: () => <AppFrame contentScroll="hidden"><LobeChatTheme><Outlet/></LobeChatTheme><Toaster/></AppFrame>});
const agent = createRoute({getParentRoute: () => root, path: "/agent", component: () => {
    const params = useParams({strict: false}); const location = useLocation();
    return <AgentChatPage threadId={"threadId" in params ? params.threadId as string : undefined} view={location.pathname === "/agent/tasks" ? "tasks" : undefined}/>;
}});
const home = createRoute({getParentRoute: () => agent, path: "/"});
const chat = createRoute({getParentRoute: () => agent, path: "$threadId"});
const tasks = createRoute({getParentRoute: () => agent, path: "tasks"});
const noop = () => {};
let setOverlayPending = (_value: boolean) => {};
function ManualOverlay() {
    const [dirty, setDirty] = useState(true), [pending, setPending] = useState(true);
    setOverlayPending = setPending;
    const guard = useManualDraftDeparture(dirty, pending, () => setDirty(false), {route: false});
    return <><p>Retained local editor</p>{guard.confirmation}</>;
}
const overlayRoute = createRoute({getParentRoute: () => root, path: "/manual-overlay", component: ManualOverlay});
const wrapupRoute = createRoute({getParentRoute: () => root, path: "/wrapup", component: () => <TaskWrapup task={wrapupTask}
    modelSelection={{connector, model: "gpt-4o"}} busy={false} onEditingChange={noop} onPendingChange={noop}/>});
const settings = createRoute({getParentRoute: () => root, path: "/settings", component: () => <SettingsPage onSectionChange={() => undefined}/>});
const projectRoute = createRoute({getParentRoute: () => root, path: "/p/$projectId", component: () => <ProjectHomePage projectId={projectRoute.useParams().projectId}/>});
const batchRoute = createRoute({getParentRoute: () => root, path: "/batch", component: BatchSurface});
window.history.replaceState(null, "", `/agent/${a.id}`);
const errors: string[] = [];
const router = createRouter({defaultErrorComponent: ({error}) => {const failure = error instanceof Error ? error.stack ?? error.message : String(error); errors.push(failure); return <pre role="alert">{failure}</pre>;}, routeTree: root.addChildren([agent.addChildren([home, chat, tasks]), settings, projectRoute, batchRoute, wrapupRoute, overlayRoute]), history: createBrowserHistory()});
const quitActions: DesktopLifecycleAction[] = [];
const quitAdmission = createEffectAdmission();
const quitEvent = (phase: DesktopLifecycleEvent["phase"], intentId: string | null): DesktopLifecycleEvent => ({version: 1, phase, intentId, session: null, visible: true, focused: true});
const quit = createApplicationQuit({async request(action) {quitActions.push(action); return quitEvent("running", null);}, async subscribe() {return () => {};}}, manualQuitGuards, {
    closeAdmission: () => quitAdmission.close(), stopAgent: () => agentExecution.shutdown(), stopReferences: () => chatDrafts.shutdown(),
    stopDesktopImports: async () => {}, stopNativeEffects: async () => {}, disposeMcp: async () => ({status: "drained"}), closeStorage: async () => {},
});
let creationGate: Promise<void> | undefined, releaseCreation: (() => void) | undefined, creationEntered = false;
const control = {holdCreation() {
        creationEntered = false;
        creationGate = new Promise<void>(resolve => {releaseCreation = resolve;});
        Object.assign(globalThis, {__e11BeforeCreate: async () => {creationEntered = true; await creationGate;}});
    }, releaseCreation() {releaseCreation?.(); Object.assign(globalThis, {__e11BeforeCreate: undefined});}, creationEntered: () => creationEntered,
    db, a, b, c, project, requests, generation, releaseGeneration, errors, wrapup, wrapupTask,
    setOverlayPending: (value: boolean) => setOverlayPending(value),
    quit: {actions: quitActions, needsDecision: () => manualQuitGuards.needsDecision(), admissionOpen: () => quitAdmission.open,
        emit: (phase: DesktopLifecycleEvent["phase"], intentId: string | null) => quit.handle(quitEvent(phase, intentId)), done: () => quit.done},
    execution: (threadId: string) => ({active: agentExecution.snapshot(threadId).active, kind: agentExecution.snapshot(threadId).kind}),
    route: () => router.history.location.pathname,
    navigate: (to: string) => router.navigate({to}),
    emit(index: number, text: string) {requests[index].stream?.enqueue(chunk(text));},
    finish(index: number) {const request = requests[index]; request.stream?.enqueue(encoder.encode('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')); request.stream?.close(); request.stream = undefined;},
    async prepareApproval() {
        const thread = await createChatThread({title: "E11 saved approval", connectorId: connector.id, model: "gpt-4o"});
        const run = await beginAgentRun({threadId: thread.id, connector, model: "gpt-4o", content: "E11 explicit approval", interactionMode: "smart"});
        await saveFixtureToolRound(run.id, "", [{id: "e11-approve", type: "function", function: {name: "workspace_overview", arguments: "{}"}}], [{title: "查看工作区概览", effect: "read", highRisk: false, atomic: false}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
        await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval"); await pauseForApproval(run.id);
        return {threadId: thread.id, runId: run.id, callId: call.id};
    },
    async prepareBatch() {
        const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
        const shot = await addShot(project.id, episode.id);
        const run = await beginAgentRun({threadId: c.id, connector, model: "gpt-4o", content: "Prepare controlled generation"});
        const candidates = [{connectorId: "e11-image", model: "gpt-image-2" as const, prompt: "controlled", parameters: {}, inputs: [],
            target: {kind: "shot" as const, projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame" as const}}];
        await saveFixtureToolRound(run.id, "", [{id: "e11-batch-call", type: "function", function: {name: "prepare_generation_batch", arguments: JSON.stringify({title: "E11 real batch", candidates})}}], [{title: "Batch", effect: "bookkeeping", highRisk: false, atomic: true}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).first())!;
        await transitionToolCall(run.id, call.id, ["pending"], "running");
        const prepared = await prepareGenerationBatch("E11 real batch", candidates, {runId: run.id, threadId: c.id, callId: call.id, signal: new AbortController().signal}) as {batchId: string};
        await finishAgentRun(run.id, "completed", {content: "Batch ready for review"});
        const view = await readGenerationBatch(prepared.batchId, c.id);
        await confirmGenerationBatch(prepared.batchId, c.id, view.batch.revision, new AbortController().signal);
        generationRun = run.id;
        return prepared.batchId;
    }
};
Object.assign(window, {e11: control});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
