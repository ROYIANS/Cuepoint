import {createRoot} from "react-dom/client";
import {useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import {createRootRoute, createRoute, createRouter, createBrowserHistory, Outlet, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {createAgentTask} from "@/db/agentTasks";
import {saveTaskRecord} from "@/db/agentTaskRecords";
import {createManualWrapup, saveWrapup} from "@/db/agentTaskWrapups";
import {encodePcm16Wav} from "@/lib/audio/wav";
import {addAudioSpeaker} from "@/db/audio";
import {TaskInspector} from "@/components/agent/TaskInspector";
import {AgentChatPage} from "@/components/agent/AgentChatPage";
import {VoiceLibrary} from "@/components/audio/VoiceLibrary";
import {useManualDraftGuard} from "@/lib/useManualDraftGuard";
import "@/styles.css";

const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
const failures = new Set<string>();
const calls: Array<{key: string; args: unknown[]}> = [];
function hold(key: string) {
    let release!: () => void;
    const promise = new Promise<void>(resolve => {release = resolve;});
    gates.set(key, {promise, release});
}
function release(key: string) {gates.get(key)?.release(); gates.delete(key);}
await db.open();
const project = await createAudioMusicProject("Draft A", "audio");
const other = await createAudioMusicProject("Draft B", "audio");
const task = await createAgentTask({projectId: project.id, title: "Task A", goal: "Goal A", plan: [], acceptanceCriteria: ["Checked"]});
const taskB = await createAgentTask({projectId: project.id, title: "Task B", goal: "Goal B", plan: []});
await db.chatMessages.add({id: "e01-source", threadId: task.threadId, role: "user", content: "Reference source", createdAt: "2026-10-09T00:00:00.000Z", status: "complete"});
await saveTaskRecord(task.id, {kind: "research", claim: "proposal", title: "Saved record", body: "Saved body", sources: []});
await addAudioSpeaker(project.id, {name: "Saved voice", voice: "mimo_default", speed: 1, mimo: {mode: "preset", instruction: ""}});
const wrapup = await createManualWrapup(task.id);
await saveWrapup(task.id, wrapup.id, {...wrapup.content, overview: "Saved overview"}, wrapup.revision);
const referenceBlob = encodePcm16Wav({length: 4800, sampleRate: 48000, numberOfChannels: 1,
    getChannelData: () => new Float32Array(4800)}).blob;
const referenceBytes = Array.from(new Uint8Array(await referenceBlob.arrayBuffer()));
let selectTask: (id: string) => void;
let selectProject: (id: string) => void;
let toggleVoice: (open: boolean) => void;
let retire: () => void;
let observedTaskId: string | undefined;
function Inspector() {
    const [id, setId] = useState(task.id);
    const [open, setOpen] = useState(true);
    const [mounted, setMounted] = useState(true);
    selectTask = setId;
    retire = () => setMounted(false);
    const current = useLiveQuery(() => db.agentTasks.get(id), [id]);
    const messages = useLiveQuery(() => db.chatMessages.where("threadId").equals(current?.threadId ?? "").toArray(), [current?.threadId]) ?? [];
    observedTaskId = current?.id;
    return <><button onClick={() => setOpen(true)}>Open inspector</button>{mounted && current && <TaskInspector task={current} runs={[]} messages={messages}
        open={open} onOpenChange={setOpen} onOpenBoard={() => void router.navigate({to: "/away"})}/>}</>;
}
function Voices() {
    const [id, setId] = useState(project.id);
    const [open, setOpen] = useState(true);
    const [mounted, setMounted] = useState(true);
    selectProject = setId;
    toggleVoice = setOpen;
    retire = () => setMounted(false);
    const speakers = useLiveQuery(() => db.audioSpeakers.where("projectId").equals(id).toArray(), [id]) ?? [];
    const takes = useLiveQuery(() => db.audioTakes.where("projectId").equals(id).toArray(), [id]) ?? [];
    return <><button onClick={() => setOpen(true)}>Open voices</button>{mounted && <VoiceLibrary projectId={id} open={open} onOpenChange={setOpen} speakers={speakers} takes={takes}/>}</>;
}
function SharedGuardInputs() {
    const [value, setValue] = useState("1");
    const guard = useManualDraftGuard(value !== "1", false, () => {});
    return <>{guard}<input type="number" aria-label="guard number" value={value} onChange={event => setValue(event.target.value)}/>
        <input type="range" aria-label="guard range" defaultValue="3"/><input type="date" aria-label="guard date" defaultValue="2026-10-09"/>
        <input type="color" aria-label="guard color" defaultValue="#ffffff"/></>;
}
const root = createRootRoute({component: () => <><Outlet/><Toaster/></>});
const inspector = createRoute({getParentRoute: () => root, path: "inspector", component: Inspector});
const sharedGuard = createRoute({getParentRoute: () => root, path: "shared-guard", component: SharedGuardInputs});
const voice = createRoute({getParentRoute: () => root, path: "voice", component: Voices});
const away = createRoute({getParentRoute: () => root, path: "away", component: () => <p>Left editor</p>});
const agent = createRoute({getParentRoute: () => root, path: "agent/$threadId", component: () => <AgentChatPage threadId={agent.useParams().threadId}/>});
const agentHome = createRoute({getParentRoute: () => root, path: "agent", component: () => <AgentChatPage/>});
const board = createRoute({getParentRoute: () => root, path: "agent/tasks", component: () => <AgentChatPage view="tasks"/>});
window.history.replaceState(null, "", "/away");
const router = createRouter({routeTree: root.addChildren([inspector, voice, agent, agentHome, board, away, sharedGuard]), history: createBrowserHistory()});
const control = {
    db, task, taskB, project, other, failures, calls, hold, release, referenceBytes,
    wait: (key: string) => gates.get(key)?.promise,
    selectTask: (id: string) => selectTask(id), selectProject: (id: string) => selectProject(id),
    observedTask: () => observedTaskId,
    toggleVoice: (open: boolean) => toggleVoice(open), retire: () => retire(),
    navigate: (to: string) => {void router.navigate({to});},
    location: () => router.history.location.pathname,
};
Object.assign(window, {e01: control});
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://mimo.fixture.test/")) return realFetch(input, init);
    calls.push({key: "audition", args: [url, init?.body]});
    await gates.get("audition")?.promise;
    if (failures.has("audition")) throw new Error("fixture audition failure");
    if (url.includes("/models")) return Response.json({data: []});
    return Response.json({choices: [{finish_reason: "stop", message: {audio: {data: btoa(String.fromCharCode(...referenceBytes))}}}]});
};
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
