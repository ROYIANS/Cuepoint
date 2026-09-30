import {createRoot} from "react-dom/client";
import {useState} from "react";
import {createRootRoute, createRoute, createRouter, createBrowserHistory, Outlet, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import * as repo from "@/db/repo";
import {createFileMaterial} from "@/db/materials";
import {Route as ProjectRoute} from "@/routes/p.$projectId";
import {Route as HomeRoute} from "@/routes/p.$projectId.index";
import {ShotEditorPage} from "@/components/shots/ShotEditorPage";
import {StoryboardPrintPage} from "@/components/produce/StoryboardPrintPage";
import {CharacterDetailPage} from "@/components/assets/CharacterDetailPage";
import {SceneDetailPage} from "@/components/assets/SceneDetailPage";
import {PropDetailPage} from "@/components/assets/PropDetailPage";
import {StyleDetailPage} from "@/components/assets/StyleDetailPage";
import {MaterialDetailPanel} from "@/components/studio/materials/MaterialDetailPanel";
import {UndoProvider} from "@/lib/undo";
import "@/styles.css";

const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
function hold(key: string) {
    let release!: () => void;
    const promise = new Promise<void>(resolve => {release = resolve;});
    gates.set(key, {promise, release});
}
function release(key: string) {gates.get(key)?.release(); gates.delete(key);}
for (const table of [db.projects, db.episodes, db.characters, db.scenes, db.props, db.styles, db.libraryMaterials]) {
    const original = table.get.bind(table);
    table.get = async (id: string) => {
        const value = await original(id);
        await gates.get(`${table.name}:${id}`)?.promise;
        return value;
    };
}

for (const [table, field] of [[db.episodes, "projectId"], [db.shots, "episodeId"]] as const) {
    const originalWhere = table.where.bind(table);
    table.where = (key: string) => {
        const clause = originalWhere(key);
        if (key === field) {
            const originalEquals = clause.equals.bind(clause);
            clause.equals = (value: string) => {
                const collection = originalEquals(value);
                const originalSort = collection.sortBy.bind(collection);
                collection.sortBy = async (sort: string) => {
                    const rows = await originalSort(sort);
                    await gates.get(`${table.name}:list:${value}`)?.promise;
                    return rows;
                };
                return collection;
            };
        }
        return clause;
    };
}
let selectMaterial: (id: string) => void;
let materialInitial = "";
const root = createRootRoute({component: () => <UndoProvider><Outlet/><Toaster/></UndoProvider>});
const project = createRoute({getParentRoute: () => root, path: "p/$projectId", component: ProjectRoute.options.component});
const home = createRoute({getParentRoute: () => project, path: "/", component: HomeRoute.options.component});
const world = createRoute({getParentRoute: () => project, path: "world", component: () => <p>world fixture</p>});
const episode = createRoute({getParentRoute: () => project, path: "e/$episodeId", component: Outlet});
const story = createRoute({getParentRoute: () => episode, path: "/", component: () => <p>story fixture</p>});
const shots = createRoute({getParentRoute: () => episode, path: "shots", component: () => {
    const params = shots.useParams();
    return <ShotEditorPage {...params} focusShotId={shots.useSearch().shot}/>;
}, validateSearch: (search: Record<string, unknown>) => ({shot: typeof search.shot === "string" ? search.shot : undefined})});
const print = createRoute({getParentRoute: () => episode, path: "produce/storyboard", component: () => <StoryboardPrintPage {...print.useParams()}/>});
const asset = createRoute({getParentRoute: () => root, path: "asset/$ownerId/$kind/$assetId", component: () => {
    const {ownerId, kind, assetId} = asset.useParams();
    const back = {kind: "project" as const, projectId: ownerId};
    if (kind === "character") return <CharacterDetailPage characterId={assetId} back={back}/>;
    if (kind === "scene") return <SceneDetailPage sceneId={assetId} back={back}/>;
    if (kind === "prop") return <PropDetailPage propId={assetId} back={back}/>;
    return <StyleDetailPage styleId={assetId} back={back}/>;
}});
const materials = createRoute({getParentRoute: () => root, path: "materials", component: () => {
    const [id, setId] = useState(materialInitial);
    selectMaterial = setId;
    return <MaterialDetailPanel id={id} onClose={() => setId("")} onSelect={setId}/>;
}});
const away = createRoute({getParentRoute: () => root, path: "away", component: () => <p>left fixture</p>});
const routeTree = root.addChildren([project.addChildren([home, world, episode.addChildren([story, shots, print])]), asset, materials, away]);
// Use the installed browser history implementation: memory history does not
// exercise POP blockers or the native beforeunload listener.
window.history.replaceState(null, "", "/away");
const router = createRouter({routeTree, history: createBrowserHistory()});
await db.open();
const a = await repo.createProject("Project A", "series");
const b = await repo.createProject("Project B", "series");
const film = await repo.createProject("Film", "film");
const ea = (await repo.firstEpisode(a.id))!;
const eb = await repo.addEpisode(a.id);
await repo.updateEpisode(ea.id, {title: "Episode A"});
await repo.updateEpisode(eb.id, {title: "Episode B"});
const sa = await repo.addShot(a.id, ea.id);
const sb = await repo.addShot(a.id, eb.id);
const rows: Record<string, Array<{id: string}>> = {};
for (const [kind, add] of [["character", repo.addCharacter], ["scene", repo.addScene], ["prop", repo.addProp], ["style", repo.addStyle]] as const) {
    rows[kind] = [await add(a.id), await add(a.id)];
}
const mc = await createFileMaterial(new File(["c"], "C.txt", {type: "text/plain"}), {kind: "global"}, "Material C");
const ma = await createFileMaterial(new File(["a"], "A.txt", {type: "text/plain"}), {kind: "project", id: a.id}, "Material A");
const mb = await createFileMaterial(new File(["b"], "B.txt", {type: "text/plain"}), {kind: "global"}, "Material B");
materialInitial = ma.id;

// Only the OS file picker/upload transport are controlled. Session ownership,
// saves, media cleanup, live queries, UI, ReactDOM and router remain real.
const media = {file: new File(["owned upload"], "upload.png", {type: "image/png"}), fail: false, picked: 0, uploads: [] as File[]};
const control = {
    router, db, repo, ids: {a: a.id, b: b.id, film: film.id, ea: ea.id, eb: eb.id, sa: sa.id, sb: sb.id, rows, ma: ma.id, mb: mb.id, mc: mc.id},
    hold, release, media,
    wait: (key: string) => gates.get(key)?.promise,
    failures: new Set<string>(),
    selectMaterial: (id: string) => selectMaterial(id),
    navigate: (url: string) => {void router.navigate({to: url});},
    location: () => router.history.location.pathname,
};
Object.assign(window, {b01: control});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
