import {createRoot} from "react-dom/client";
import {createBrowserHistory, createRootRoute, createRoute, createRouter, RouterProvider, useRouterState} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {AgentChatPage} from "@/components/agent/AgentChatPage";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {createChatThread} from "@/db/chat";
import {importReferenceFile} from "@/lib/references/import";

const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
const failures = new Set<string>();
const calls: Array<{kind: string; payload?: unknown; aborted?: boolean}> = [];
function hold(key: string) {
    let release!: () => void;
    gates.set(key, {promise: new Promise<void>(resolve => {release = resolve;}), release});
}
function release(key: string) {gates.get(key)?.release(); gates.delete(key);}
async function wait(key: string) {await gates.get(key)?.promise; if (failures.has(key)) throw new Error(`fixture ${key} failure`);}

// This random-port origin has its own IndexedDB, independent of the application.
await db.delete(); await db.open();
const project = await createProject("B07 isolated");
await db.connectors.put({id: "b07-connector", definitionId: "openai-compatible", protocol: "openai-compatible",
    baseUrl: "https://no-provider.invalid/v1", apiKey: "fixture-only", updatedAt: new Date().toISOString()});
const options = {connectorId: "b07-connector", model: "model", projectId: project.id};
const a = await createChatThread({...options, title: "Thread A"});
const b = await createChatThread({...options, title: "Thread B"});
const reference = await importReferenceFile(project.id, new File(["Fixture reference text"], "source.txt", {type: "text/plain"}));

function App() {
    const path = useRouterState({select: state => state.location.pathname});
    return <><AgentChatPage threadId={path.startsWith("/agent/") ? path.slice("/agent/".length) : undefined}/><Toaster/></>;
}
const root = createRootRoute({component: App});
const home = createRoute({getParentRoute: () => root, path: "/agent", component: () => null});
const detail = createRoute({getParentRoute: () => root, path: "/agent/$threadId", component: () => null});
window.history.replaceState({}, "", "/agent");
const router = createRouter({routeTree: root.addChildren([home, detail]), history: createBrowserHistory(), defaultPendingMinMs: 0});
const fixture = {
    a: a.id, b: b.id, projectId: project.id, referenceId: reference.id, calls, failures, hold, release, wait,
    navigate: (id?: string) => id ? router.navigate({to: "/agent/$threadId", params: {threadId: id}}) : router.navigate({to: "/agent"}),
    records: async () => ({threads: await db.chatThreads.toArray(), messages: await db.chatMessages.toArray(), runs: await db.agentRuns.toArray()}),
};
declare global {interface Window {b07: typeof fixture}}
window.b07 = fixture;
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
