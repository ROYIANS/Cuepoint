import {useState} from "react";
import {createRoot} from "react-dom/client";
import {createBrowserHistory, createRootRoute, createRoute, createRouter, RouterProvider} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {addShot} from "@/db/shots";
import {createChatThread} from "@/db/chat";
import {beginAgentRun} from "@/db/agentRuns";
import {transitionToolCall} from "@/db/agentTools";
import {prepareGenerationBatch, readGenerationBatch} from "@/db/agentGenerationBatches";
import {updateGeneralAgentConfig} from "@/db/agentSettings";
import {GenerationReview} from "@/components/agent/GenerationReview";
import {AgentGenerationBatches} from "@/components/agent/AgentGenerationBatches";
import {ProjectSettingsPanel} from "@/components/workspace/ProjectSettingsPanel";
import {defaultImageGeneration, defaultVideoGeneration} from "@/domain/output";
import type {AgentToolCall} from "@/domain/agent";
import type {GenerationSubmitArgs} from "@/lib/agent/generationProfiles";
import {executeChatRun} from "@/lib/agent/runChat";
import {preloadFixtureGroups, saveFixtureToolRound} from "../../helpers/toolDispatch";
import "@/styles.css";
import "@/components/agent/agentChat.css";

// An isolated random-port origin. No provider transport is used by the rendered actions.
await db.delete(); await db.open();
await updateGeneralAgentConfig({permissionMode: "full", enabledSkillIds: ["media-generation"]});
const project = await createProject("D06 controls");
const episode = await db.episodes.where("projectId").equals(project.id).first();
if (!episode) throw new Error("fixture episode missing");
const shot = await addShot(project.id, episode.id);
const connections = [
    {id: "hub", definitionId: "aihubmix", label: "Hub account"},
    {id: "mart", definitionId: "apimart", label: "Mart account"},
].map(item => ({...item, baseUrl: "https://no-provider.invalid/v1", apiKey: item.id === "keyless" ? "" : "fixture-only", updatedAt: "fixture"}));
await db.connectors.bulkPut(connections);
const connector = {id: "chat", definitionId: "openai-compatible", baseUrl: "https://no-chat.invalid/v1", apiKey: "fixture-only", updatedAt: "fixture"};
await db.connectors.put(connector);
const thread = await createChatThread();
const run = await preloadFixtureGroups(await beginAgentRun({threadId: thread.id, connector, model: "chat", content: "生成图片"}), ["media-generation"]);
const image: GenerationSubmitArgs = {connectorId: "hub", model: "gpt-image-2", prompt: "AI original prompt", parameters: {}, inputs: [], target: {kind: "shot", projectId: project.id, episodeId: episode.id, entityId: shot.id, slot: "firstFrame"}};
let chatFixtureCalls = 0;
await executeChatRun(run, connector.apiKey, new AbortController(), async () => {
    chatFixtureCalls++;
    return Response.json({choices: [{message: {content: "", tool_calls: [{id: "native-image", type: "function", function: {name: "submit_generation", arguments: JSON.stringify(image)}}]}, finish_reason: "tool_calls"}]});
});
const originalCall = await db.agentToolCalls.where("runId").equals(run.id).first();
if (!originalCall?.preview?.revision || originalCall.status !== "awaiting_approval") throw new Error("real pending fixture missing");
const batchThread = await createChatThread();
const batchRun = await beginAgentRun({threadId: batchThread.id, connector, model: "chat", content: "准备批量视频"});
const video: GenerationSubmitArgs = {...image, model: "veo-3.1-fast-generate-preview", target: {...image.target, slot: "clip"}, parameters: {mode: "text", resolution: "720p", duration: 4, aspectRatio: "16:9"}};
await saveFixtureToolRound(batchRun.id, "", [{id: "batch-fixture", type: "function", function: {name: "prepare_generation_batch", arguments: JSON.stringify({title: "D06 batch", candidates: [video, {...video, prompt: "Second candidate"}]})}}], [{title: "D06 batch", effect: "bookkeeping", highRisk: false, atomic: true}]);
const batchCall = await db.agentToolCalls.where("runId").equals(batchRun.id).first();
if (!batchCall) throw new Error("batch fixture missing");
await transitionToolCall(batchRun.id, batchCall.id, ["pending"], "running");
const batchResult = await prepareGenerationBatch("D06 batch", [video, {...video, prompt: "Second candidate"}], {runId: batchRun.id, threadId: batchThread.id, callId: batchCall.id, signal: new AbortController().signal});
if (!batchResult || typeof batchResult !== "object" || !("batchId" in batchResult) || typeof batchResult.batchId !== "string") throw new Error("batch result missing");
const batchId = batchResult.batchId;
const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
const failures = new Set<string>();
const calls: string[] = [];
const actions: Array<{runId: string; action: string; callId?: string}> = [];
let setCall: (call: AgentToolCall) => void;
let setView: (view: "single" | "batch" | "settings") => void;
let callSequence = 0;
const onOutputState = () => undefined;
function App() {
    const [call, updateCall] = useState(originalCall!);
    const [view, updateView] = useState<"single" | "batch" | "settings">("single");
    setCall = updateCall; setView = updateView;
    const liveProject = useLiveQuery(() => db.projects.get(project.id), []);
    return <><p>D06 fixture</p>
        {view === "single" && <GenerationReview call={call} busy={false} onAction={(runId, action, callId) => {actions.push({runId, action, callId});}}/>}
        {view === "batch" && <AgentGenerationBatches runId={batchRun.id}/>}
        {view === "settings" && liveProject && <ProjectSettingsPanel project={liveProject} onOutputState={onOutputState}/>}
        <Toaster/></>;
}
const root = createRootRoute({component: App});
const route = createRoute({getParentRoute: () => root, path: "/", component: () => null});
window.history.replaceState({}, "", "/");
const router = createRouter({routeTree: root.addChildren([route]), history: createBrowserHistory()});
const fixture = {
    ids: {project: project.id, episode: episode.id, shot: shot.id, originalCall: originalCall.id, run: run.id, batchId},
    original: originalCall.arguments, calls, actions, failures, chatFixtureCalls,
    hold(key: string) {let release!: () => void; gates.set(key, {promise: new Promise<void>(resolve => {release = resolve;}), release});},
    release(key: string) {gates.get(key)?.release(); gates.delete(key);},
    async wait(key: string) {calls.push(key); await gates.get(key)?.promise; if (failures.has(key)) throw new Error(`fixture ${key} storage failure`);},
    view(view: "single" | "batch" | "settings") {setView(view);},
    proposal(args: GenerationSubmitArgs) {setCall({...originalCall, id: `synthetic-${++callSequence}`, arguments: JSON.stringify(args)});},
    image, video,
    realCall() {setCall(originalCall);},
    projectDefaults: {image: defaultImageGeneration(), video: defaultVideoGeneration()},
    records: async () => ({project: await db.projects.get(project.id), shot: await db.shots.get(shot.id), call: await db.agentToolCalls.get(originalCall.id), batch: await readGenerationBatch(batchId, batchThread.id), jobs: await db.agentGenerationJobs.toArray()}),
};
declare global {interface Window {d06: typeof fixture}}
window.d06 = fixture;
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
