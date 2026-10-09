import {createRoot} from "react-dom/client";
import {createBrowserHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider} from "@tanstack/react-router";
import {Toaster} from "sonner";
import {readProjectCoverIds as readSharedCovers} from "@/lib/studioLibraryQueries";
import {readProjectCoverIds as readIndependentCovers} from "../sourceSnapshots/e04-library/independent-transactions/studioLibraryQueries";
import {db} from "@/db/database";
import {emptyProject, emptyShot, emptyCharacter, emptyScene, emptyProp, emptyStyle} from "@/db/productionRecords";
import {emptySlot} from "@/domain/slot";
import {STUDIO_LIBRARY_ID, CHARACTER_SLOTS, SCENE_SLOTS, PROP_SLOTS, STYLE_SLOTS} from "@/domain/types";
import type {GenerationSlot, MediaRecord, Shot} from "@/domain/types";
import {ProjectGalleryPage} from "@/components/studio/ProjectGalleryPage";
import {CharacterLibraryPage, SceneLibraryPage, PropLibraryPage, StyleLibraryPage} from "@/components/studio/AssetLibraryPages";
import {ProjectGalleryPage as BeforeGallery} from "../sourceSnapshots/e04-library/src/components/studio/ProjectGalleryPage";
import {CharacterLibraryPage as BeforeCharacters, SceneLibraryPage as BeforeScenes, PropLibraryPage as BeforeProps, StyleLibraryPage as BeforeStyles} from "../sourceSnapshots/e04-library/src/components/studio/AssetLibraryPages";
import "@/styles.css";

// Native IndexedDB returned-row counters, separate from output projection and callback work.
type Read = {table: string; method: string; index?: string; transactionId?: number; rows: number; returnedJSONBytes: number};
const reads: Read[] = [];
let tracking = false;
const transactions: Array<{id: number; mode: IDBTransactionMode; stores: string[]}> = [];
const transactionIds = new WeakMap<IDBTransaction, number>();
let transactionSequence = 0;
const originalTransaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (...args: Parameters<typeof originalTransaction>) {
    const transaction = originalTransaction.apply(this, args);
    const id = ++transactionSequence;
    transactionIds.set(transaction, id);
    if (tracking) transactions.push({id, mode: transaction.mode, stores: [...transaction.objectStoreNames]});
    return transaction;
};
const encoder = new TextEncoder();
const bytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;
for (const prototype of [IDBObjectStore.prototype, IDBIndex.prototype]) {
    const originalGetAll = prototype.getAll;
    prototype.getAll = function (...args: Parameters<typeof originalGetAll>) {
        const request = originalGetAll.apply(this, args);
        const entry = {table: this instanceof IDBIndex ? this.objectStore.name : this.name,
            transactionId: transactionIds.get(this instanceof IDBIndex ? this.objectStore.transaction : this.transaction), method: "getAll", index: this instanceof IDBIndex ? this.name : undefined, rows: 0, returnedJSONBytes: 0};
        if (tracking) {
            reads.push(entry);
            request.addEventListener("success", () => {entry.rows = request.result.length; entry.returnedJSONBytes = bytes(request.result);});
        }
        return request;
    };
    const originalCursor = prototype.openCursor;
    prototype.openCursor = function (...args: Parameters<typeof originalCursor>) {
        const request = originalCursor.apply(this, args);
        const entry = {table: this instanceof IDBIndex ? this.objectStore.name : this.name,
            transactionId: transactionIds.get(this instanceof IDBIndex ? this.objectStore.transaction : this.transaction), method: "openCursor", index: this instanceof IDBIndex ? this.name : undefined, rows: 0, returnedJSONBytes: 0};
        if (tracking) {
            reads.push(entry);
            request.addEventListener("success", () => {
                const cursor = request.result;
                if (cursor) {entry.rows++; entry.returnedJSONBytes += bytes(cursor.value);}
            });
        }
        return request;
    };
}

const metrics = {projectQueryCallbacks: 0, filterChecks: 0, sortComparisons: 0, fallbackVisits: 0, assetFindChecks: 0, assetCoverCalls: 0};
const outputs: Array<{label: string; entries: number; jsonBytes: number}> = [];
const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
const held: string[] = [];
const published: string[] = [];
function hold(scope: string) {
    let release!: () => void;
    gates.set(scope, {promise: new Promise<void>(resolve => {release = resolve;}), release});
}
function release(scope: string) {gates.get(scope)?.release(); gates.delete(scope);}
async function afterCover(projectIds: readonly string[], result: Map<string, string>) {
    const scope = JSON.stringify(projectIds);
    outputs.push({label: "current-gallery", entries: result.size, jsonBytes: bytes([...result])});
    if (gates.has(scope)) {held.push(scope); await gates.get(scope)!.promise;}
    published.push(scope);
}
async function afterAssets(table: string, rows: unknown[]) {
    const scope = `asset:${table}`;
    output(`current-${table}`, rows);
    if (gates.has(scope)) {held.push(scope); await gates.get(scope)!.promise;}
    published.push(scope);
}
function output(label: string, value: unknown[], entries = value.length) {outputs.push({label, entries, jsonBytes: bytes(value)});}
function reset() {transactions.length = 0; reads.length = 0; outputs.length = 0; held.length = 0; published.length = 0; for (const key of Object.keys(metrics) as Array<keyof typeof metrics>) metrics[key] = 0; tracking = true;}
const report = () => ({transactions: structuredClone(transactions), reads: structuredClone(reads), metrics: {...metrics}, outputs: [...outputs], held: [...held], published: [...published]});
Object.assign(window, {e04Library: {db, metrics, output, afterCover, afterAssets, hold, release, reset, report, readSharedCovers, readIndependentCovers}});

await db.open();
const projects = [
    {...emptyProject("Alpha video"), id: "alpha", kind: "video" as const},
    {...emptyProject("Beta audio"), id: "beta", kind: "audio" as const},
    {...emptyProject("Empty video"), id: "empty", kind: "video" as const},
    {...emptyProject("Explicit video"), id: "explicit", kind: "video" as const, coverMediaId: "explicit-cover"},
    {...emptyProject("Missing video"), id: "missing", kind: "video" as const},
    {...emptyProject("Archived video"), id: "archived", kind: "video" as const, archivedAt: "2026-01-01"},
    ...Array.from({length: 20}, (_, i) => ({...emptyProject(`Hidden music ${i}`), id: `hidden-${i}`, kind: "music" as const})),
];
await db.projects.bulkPut(projects);
await db.ipProfiles.put({id: "ip-alpha", name: "Alpha IP", positioning: "", audience: "", topics: "", expression: "", visual: "", voice: "", revision: 1, archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01"});
await db.projectIpLinks.put({projectId: "alpha", ipId: "ip-alpha", updatedAt: "2026-01-01"});
function shot(id: string, projectId: string, order: number, mediaId?: string, episodeId = "episode-a"): Shot {
    return {...emptyShot(projectId, episodeId, order, String(order), 3), id, content: "large shot text ".repeat(250),
        firstFrame: mediaId ? {...emptySlot(), result: {mediaId, kind: "image"}} : emptySlot()};
}
const shots = [shot("a0", "alpha", 0), shot("a1", "alpha", 2, "alpha-first", "episode-z"),
    shot("a2", "alpha", 2, "alpha-second", "episode-a"), shot("b0", "beta", 1, "beta-first"),
    shot("m0", "missing", 1, "missing-media"), shot("m1", "missing", 2, "available-later"),
    ...Array.from({length: 40}, (_, i) => shot(`alpha-${i}`, "alpha", 10 + i, "alpha-second")),
    ...Array.from({length: 200}, (_, i) => shot(`explicit-${i}`, "explicit", i, "explicit-fallback")),
    ...Array.from({length: 50}, (_, i) => shot(`archived-${i}`, "archived", i, "alpha-second")),
    ...Array.from({length: 1000}, (_, i) => shot(`hidden-${i}`, `hidden-${i % 20}`, i, "alpha-second")),
];
await db.shots.bulkPut(shots);
const result = (mediaId: string): GenerationSlot => ({...emptySlot(), result: {mediaId, kind: "image"}});
for (let i = 0; i < 30; i++) {
    const id = `identitynever-${String(i).padStart(2, "0")}`;
    const owner = STUDIO_LIBRARY_ID;
    const at = `2026-01-${String(1 + i % 28).padStart(2, "0")}`;
    const shared = {id, updatedAt: at, createdAt: at, notes: i === 0 ? "authoredneedle" : "authored notes", extra: {hidden: "provenancenever"}};
    await db.characters.put({...emptyCharacter(owner, `Character ${i}`), ...shared, bio: `biography-${i}`, slots: {[CHARACTER_SLOTS[0].id]: emptySlot(), [CHARACTER_SLOTS[1].id]: result("character-cover")}});
    await db.scenes.put({...emptyScene(owner, `Scene ${i}`), ...shared, location: `location-${i}`, slots: {[SCENE_SLOTS[0].id]: emptySlot(), [SCENE_SLOTS[1].id]: result("scene-cover")}});
    await db.props.put({...emptyProp(owner, `Prop ${i}`), ...shared, usage: `usage-${i}`, slots: {[PROP_SLOTS[0].id]: emptySlot(), [PROP_SLOTS[1].id]: result("prop-cover")}});
    await db.styles.put({...emptyStyle(owner, `Style ${i}`), ...shared, palette: `palette-${i}`, slots: {[STYLE_SLOTS[0].id]: emptySlot(), [STYLE_SLOTS[1].id]: result("style-cover")}});
}
await db.characters.put({...emptyCharacter("foreign-owner", "Foreign character"), id: "foreign-character"});
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), c => c.charCodeAt(0));
await db.media.bulkPut(["alpha-first", "alpha-second", "beta-first", "explicit-cover", "explicit-fallback", "available-later", "character-cover", "scene-cover", "prop-cover", "style-cover", "updated-cover"].map(id => ({id, projectId: "studio", blob: new Blob([png], {type: "image/png"}), mimeType: "image/png", filename: `${id}.png`} satisfies MediaRecord)));

const root = createRootRoute({component: () => <><Outlet/><Toaster/></>});
const gallery = createRoute({getParentRoute: () => root, path: "gallery", component: ProjectGalleryPage});
const beforeGallery = createRoute({getParentRoute: () => root, path: "before/gallery", component: BeforeGallery});
const characters = createRoute({getParentRoute: () => root, path: "characters", component: CharacterLibraryPage});
const scenes = createRoute({getParentRoute: () => root, path: "scenes", component: SceneLibraryPage});
const props = createRoute({getParentRoute: () => root, path: "props", component: PropLibraryPage});
const styles = createRoute({getParentRoute: () => root, path: "styles", component: StyleLibraryPage});
const beforeCharacters = createRoute({getParentRoute: () => root, path: "before/characters", component: BeforeCharacters});
const beforeScenes = createRoute({getParentRoute: () => root, path: "before/scenes", component: BeforeScenes});
const beforeProps = createRoute({getParentRoute: () => root, path: "before/props", component: BeforeProps});
const beforeStyles = createRoute({getParentRoute: () => root, path: "before/styles", component: BeforeStyles});
const characterDetail = createRoute({getParentRoute: () => root, path: "characters/$characterId", component: () => <p>Character detail destination</p>});
const sceneDetail = createRoute({getParentRoute: () => root, path: "scenes/$sceneId", component: () => <p>Scene detail destination</p>});
const propDetail = createRoute({getParentRoute: () => root, path: "props/$propId", component: () => <p>Prop detail destination</p>});
const styleDetail = createRoute({getParentRoute: () => root, path: "styles/$styleId", component: () => <p>Style detail destination</p>});
const away = createRoute({getParentRoute: () => root, path: "away", component: () => <p>Fixture ready</p>});
window.history.replaceState(null, "", "/away");
const router = createRouter({routeTree: root.addChildren([gallery, beforeGallery, characters, scenes, props, styles, beforeCharacters, beforeScenes, beforeProps, beforeStyles, characterDetail, sceneDetail, propDetail, styleDetail, away]), history: createBrowserHistory()});
Object.assign(window.e04Library, {navigate: (to: string) => router.navigate({to}), location: () => router.history.location.pathname, ids: {shots: shots.length, projects: projects.length}});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);

declare global {
    interface Window {
        e04Library: {
            db: typeof db; readSharedCovers: typeof readSharedCovers; readIndependentCovers: typeof readIndependentCovers; metrics: typeof metrics; output: typeof output; afterCover: typeof afterCover;
            afterAssets: typeof afterAssets; hold: typeof hold; release: typeof release; reset: typeof reset; report: typeof report;
            navigate: (to: string) => Promise<void>; location: () => string;
            ids: {shots: number; projects: number};
        };
    }
}
