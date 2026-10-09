import {createRoot} from "react-dom/client";
import {createBrowserHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import * as projects from "@/db/projects";
import * as episodes from "@/db/episodes";
import * as assets from "@/db/assets";
import {addShot} from "@/db/shots";
import {createIpProfile} from "@/db/ipProfiles";
import {ProjectGalleryPage} from "@/components/studio/ProjectGalleryPage";
import {CharacterLibraryPage, SceneLibraryPage, PropLibraryPage, StyleLibraryPage} from "@/components/studio/AssetLibraryPages";
import {EpisodeListPage} from "@/components/workspace/EpisodeListPage";
import {STUDIO_LIBRARY_ID} from "@/domain/types";
import {UndoProvider} from "@/lib/undo";
import "@/styles.css";

const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
const failures = new Set<string>();
const calls: Array<{name: string; args: unknown[]}> = [];
function hold(name: string) {
    let release!: () => void;
    const promise = new Promise<void>(resolve => {release = resolve;});
    gates.set(name, {promise, release});
}
function release(name: string) {gates.get(name)?.release(); gates.delete(name);}
async function before(name: string, args: unknown[]) {
    calls.push({name, args: structuredClone(args)});
    await gates.get(name)?.promise;
    if (failures.has(name)) throw new Error(`写入失败：${name}，请重试`);
}
const root = createRootRoute({component: () => <UndoProvider><Outlet/><Toaster/></UndoProvider>});
const gallery = createRoute({getParentRoute: () => root, path: "gallery", component: ProjectGalleryPage});
const libraryRoutes = [
    ["characters", CharacterLibraryPage], ["scenes", SceneLibraryPage],
    ["props", PropLibraryPage], ["styles", StyleLibraryPage],
].map(([path, component]) => createRoute({getParentRoute: () => root, path: path as string, component: component as typeof CharacterLibraryPage}));
// Destination stubs observe the production page's actual navigation contract.
// The write-owning pages above are imported unchanged, never reproduced here.
const destinations = ["characters/$characterId", "scenes/$sceneId", "props/$propId", "styles/$styleId", "p/$projectId"].map(path =>
    createRoute({getParentRoute: () => root, path, component: () => <p>创建成功</p>}),
);
const episodeList = createRoute({getParentRoute: () => root, path: "episodes/$projectId", component: () => {
    const {projectId} = episodeList.useParams();
    return <EpisodeListPage projectId={projectId}/>;
}});
const episodeDetail = createRoute({getParentRoute: () => root, path: "p/$projectId/e/$episodeId", component: () => <p>打开分集</p>});
const away = createRoute({getParentRoute: () => root, path: "away", component: () => <p>已离开</p>});
window.history.replaceState(null, "", "/gallery");
const router = createRouter({routeTree: root.addChildren([gallery, ...libraryRoutes, ...destinations, episodeList, episodeDetail, away]), history: createBrowserHistory()});
await db.open();
const rename = await projects.createProject("Rename owner");
const deletion = await projects.createProject("Delete owner");
const archive = await projects.createProject("Archive owner");
const binding = await projects.createProject("Binding owner");
const seriesA = await projects.createProject("Series A", "series");
const seriesB = await projects.createProject("Series B", "series");
const secondA = await episodes.addEpisode(seriesA.id);
await addShot(seriesA.id, secondA.id);
await episodes.addEpisode(seriesA.id);
await episodes.addEpisode(seriesB.id);
const ip = await createIpProfile({name: "Fixture IP"});
const rows: Record<string, {id: string; name: string}> = {};
for (const [kind, add] of [["character", assets.addCharacter], ["scene", assets.addScene], ["prop", assets.addProp], ["style", assets.addStyle]] as const) {
    rows[kind] = await add(STUDIO_LIBRARY_ID);
}
const ids = {rename: rename.id, deletion: deletion.id, archive: archive.id, binding: binding.id, seriesA: seriesA.id, seriesB: seriesB.id, ip: ip.id, rows};
Object.assign(window, {e01Writes: {
    db, ids, hold, release, before, failures, calls, projects, assets,
    navigate: (path: string) => {void router.navigate({to: path});},
    location: () => router.history.location.pathname,
}});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
