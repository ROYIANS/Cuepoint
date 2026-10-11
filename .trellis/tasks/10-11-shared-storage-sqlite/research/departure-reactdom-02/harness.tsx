import {createRoot} from "react-dom/client";
import {createRouter, createHashHistory, RouterProvider} from "@tanstack/react-router";
import {StrictMode} from "react";
import {routeTree} from "@/routeTree.gen";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import "@/styles.css";

await db.open();
const project = await createProject("Disposable departure", "film");
const episode = (await db.episodes.where("projectId").equals(project.id).toArray())[0];
window.history.replaceState(null, "", `#/p/${project.id}/e/${episode.id}`);
const router = createRouter({routeTree, history: createHashHistory()});
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
    navigate: () => {void router.navigate({to: "/p/$projectId/world", params: {projectId: project.id}});},
    story: () => {void router.navigate({to: "/p/$projectId/e/$episodeId", params: {projectId: project.id, episodeId: episode.id}});},
    location: () => router.history.location.pathname,
}});
createRoot(document.getElementById("root")!).render(<StrictMode><RouterProvider router={router}/></StrictMode>);
