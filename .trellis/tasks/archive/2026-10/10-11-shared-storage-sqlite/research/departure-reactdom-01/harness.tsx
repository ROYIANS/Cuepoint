import {createRoot} from "react-dom/client";
import {createRootRoute, createRoute, createRouter, createHashHistory, Link, Outlet, RouterProvider} from "@tanstack/react-router";
import {StoryPage} from "@/components/story/StoryPage";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {UndoProvider} from "@/lib/undo";
import "@/styles.css";

await db.open();
const project = await createProject("Disposable departure", "film");
const episode = (await db.episodes.where("projectId").equals(project.id).toArray())[0];
const root = createRootRoute({component: () => <UndoProvider><nav><Link to="/world">World</Link><Link to="/story">Story</Link></nav><Outlet/></UndoProvider>});
const story = createRoute({getParentRoute: () => root, path: "story", component: () => <StoryPage projectId={project.id} episodeId={episode.id}/>});
const world = createRoute({getParentRoute: () => root, path: "world", component: () => <p>World page</p>});
window.history.replaceState(null, "", "#/story");
const router = createRouter({routeTree: root.addChildren([story, world]), history: createHashHistory()});
let release: (() => void) | undefined;
let pending: Promise<void> | undefined;
const events: Array<{type: string; target: string; trusted: boolean}> = [];
for (const type of ["click", "keydown"]) document.addEventListener(type, event => {
    const element = event.target instanceof HTMLElement ? event.target : null;
    events.push({type, target: element?.textContent?.slice(0, 80) ?? "", trusted: event.isTrusted});
}, true);
Object.assign(window, {departure: {
    db, project, episode, events,
    hold: () => {pending = new Promise<void>(resolve => {release = resolve;});},
    release: () => {release?.(); pending = undefined; release = undefined;},
    wait: () => pending,
    navigate: () => {void router.navigate({to: "/world"});},
    location: () => router.history.location.pathname,
}});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
