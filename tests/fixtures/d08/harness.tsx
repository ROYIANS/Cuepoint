import {createRoot} from "react-dom/client";
import {createRootRoute, createRoute, createRouter, createBrowserHistory, Outlet, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import * as projects from "@/db/projects";
import * as episodes from "@/db/episodes";
import * as shots from "@/db/shots";
import {StoryPage} from "@/components/story/StoryPage";
import {ShotEditorPage} from "@/components/shots/ShotEditorPage";
import {Route as ProjectRoute} from "@/routes/p.$projectId";
import {UndoProvider} from "@/lib/undo";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {SHOT_COLUMNS} from "@/domain/columns";
import {normalizeEpisodeStory} from "@/domain/types";
import "@/styles.css";

const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
function hold(key: string) {
    let release!: () => void;
    const promise = new Promise<void>(resolve => {release = resolve;});
    gates.set(key, {promise, release});
}
function release(key: string) {gates.get(key)?.release(); gates.delete(key);}
const root = createRootRoute({component: () => <UndoProvider><Outlet/><Toaster/></UndoProvider>});
const project = createRoute({getParentRoute: () => root, path: "p/$projectId", component: ProjectRoute.options.component});
const episode = createRoute({getParentRoute: () => project, path: "e/$episodeId", component: Outlet});
const story = createRoute({getParentRoute: () => episode, path: "/", component: () => <StoryPage {...story.useParams()}/>});
const storyboard = createRoute({getParentRoute: () => episode, path: "shots", component: () => <ShotEditorPage {...storyboard.useParams()}/>});
const away = createRoute({getParentRoute: () => root, path: "away", component: () => <p>left D08 fixture</p>});
const routeTree = root.addChildren([project.addChildren([episode.addChildren([story, storyboard])]), away]);
window.history.replaceState(null, "", "/away");
const router = createRouter({routeTree, history: createBrowserHistory()});
await db.open();
async function seed(name: string) {
    const project = await projects.createProject(name, "series");
    await db.projects.update(project.id, {columnSettings: {visible: SHOT_COLUMNS.map(column => column.id)}});
    const episode = (await episodes.firstEpisode(project.id))!;
    const beat = await episodes.addStoryBeat(episode.id);
    await episodes.patchStoryBeat(episode.id, beat.id, {title: `${name}场次`, content: `${name}内容`, timeOfDay: "日"});
    const shot = await shots.addShot(project.id, episode.id, {beatId: beat.id});
    await shots.patchShot(shot.id, {content: `${name}镜头`, notes: `${name}备注`});
    // A long actual shot list exercises the existing IntersectionObserver viewport.
    for (let i = 0; i < 32; i++) await shots.addShot(project.id, episode.id, {beatId: beat.id});
    return {project, episode: (await db.episodes.get(episode.id))!, beat: normalizeEpisodeStory((await db.episodes.get(episode.id))?.story).beats[0], shot: (await db.shots.get(shot.id))!};
}
const a = await seed("A"); const b = await seed("B");
const control = {db, projects, episodes, shots, a, b, router, hold, release,
    calls: [] as Array<{command: string; args: unknown[]}>, failures: new Set<string>(),
    wait: (key: string) => gates.get(key)?.promise,
    navigate: (url: string) => {void router.navigate({to: url});},
    location: () => router.history.location.pathname,
    flush: flushPendingDrafts,
    detached: false,
};
Object.assign(window, {d08: control});
const view = createRoot(document.getElementById("root")!);
Object.assign(control, {
    // Force-remount seam tests retained controller recovery beyond normal guarded navigation.
    detach: () => {view.render(<p>detached D08 fixture</p>); control.detached = true;},
    reopen: () => {view.render(<RouterProvider router={router}/>); control.detached = false;},
});
view.render(<RouterProvider router={router}/>);
