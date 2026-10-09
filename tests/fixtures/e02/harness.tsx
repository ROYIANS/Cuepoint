import {createRoot} from "react-dom/client";
import {createRootRoute, createRoute, createRouter, createBrowserHistory, Outlet, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import {AgentChatPage} from "@/components/agent/AgentChatPage";
import {LobeChatTheme} from "@/components/agent/LobeChatTheme";
import type {ChatMessage, ChatThread} from "@/domain/types";
import "@/styles.css";

const at = "2026-10-09T00:00:00.000Z";
const threads: ChatThread[] = [
    {id: "e02-a", title: "Selected topic A", createdAt: at, updatedAt: "2026-10-09T03:00:00.000Z"},
    {id: "e02-b", title: "Inactive topic B", createdAt: at, updatedAt: "2026-10-09T02:00:00.000Z"},
    {id: "e02-c", title: "Inactive topic C", createdAt: at, updatedAt: "2026-10-09T01:00:00.000Z"},
];
function messages(turns: number): ChatMessage[] {
    return Array.from({length: turns * 2}, (_, index) => ({
        id: `e02-message-${index}`, threadId: "e02-a", role: index % 2 ? "assistant" : "user",
        content: `${index === turns * 2 - 1 ? "FINAL MESSAGE" : `Message ${index + 1}`}\n\n${"Visible transcript content with ordinary words. ".repeat(30)}${index === turns * 2 - 1 ? "\n\nFINAL MESSAGE END" : ""}`,
        createdAt: `2026-10-09T00:${String(index).padStart(2, "0")}:00.000Z`, status: "complete",
    }));
}
await db.open();
await db.chatThreads.bulkPut(threads);
await db.chatMessages.bulkPut(messages(3));
const root = createRootRoute({component: () => <>
    <button id="keyboard-start" style={{position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0}} aria-label="Keyboard start"/>
    <LobeChatTheme><Outlet/></LobeChatTheme><Toaster/>
</>});
const initial = createRoute({getParentRoute: () => root, path: "/tests/fixtures/e02/", component: () => <AgentChatPage threadId="e02-a"/>});
const agent = createRoute({getParentRoute: () => root, path: "/agent/$threadId", component: () => <AgentChatPage threadId={agent.useParams().threadId}/>});
const router = createRouter({routeTree: root.addChildren([initial, agent]), history: createBrowserHistory()});
const control = {
    db, navigate: (to: string) => router.navigate({to}), location: () => router.history.location.pathname,
    reset: async () => {await db.chatThreads.bulkPut(threads); await router.navigate({to: "/agent/$threadId", params: {threadId: "e02-a"}});},
    turns: async (count: number) => {
        await db.transaction("rw", db.chatMessages, async () => {
            await db.chatMessages.where("threadId").equals("e02-a").delete();
            await db.chatMessages.bulkPut(messages(count));
        });
    },
};
Object.assign(window, {e02: control});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
