import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {MediaRecord} from "@/domain/types";

const host = vi.hoisted(() => ({
    cells: [] as unknown[], cursor: 0,
    effects: [] as Array<() => unknown>, liveQuery: vi.fn(),
}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    return {...actual,
        useState: (initial: unknown) => {
            const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial;
            return [host.cells[index], (next: unknown) => {host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;}];
        },
        useRef: (initial: unknown) => ({current: initial}),
        useEffect: (effect: () => unknown) => {host.effects.push(effect);},
    };
});
vi.mock("dexie-react-hooks", () => ({useLiveQuery: host.liveQuery}));

import * as productStorage from "@/lib/productStorage";
import {isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {addShot} from "@/db/shots";
import {useVideoWorkspaceQuery} from "@/lib/videoWorkspaceRepository";
import {useMedia} from "@/lib/media";
import {useShotMedia} from "@/lib/useShotMedia";

beforeEach(() => {
    host.cells = []; host.cursor = 0; host.effects = []; host.liveQuery.mockReset();
    vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()});
});
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});
function render<T>(run: () => T): T {host.cursor = 0; host.effects = []; return run();}

describe("runtime-independent IndexedDB live queries and media", () => {
    it("runs the existing live query in genuine Tauri when IndexedDB owns the product", async () => {
        expect(isNativeWorkspaceRuntime()).toBe(true);
        const project = await createProject("Desktop live query");
        const query = vi.fn(async () => db.projects.get(project.id));
        expect(render(() => useVideoWorkspaceQuery(query, [project.id]))).toBeUndefined();
        const liveRead = host.liveQuery.mock.calls.at(-1)![0] as typeof query;
        expect(liveRead).toBe(query);
        host.liveQuery.mockReturnValue(await liveRead());
        expect(render(() => useVideoWorkspaceQuery(query, [project.id]))?.name).toBe("Desktop live query");
        for (const effect of host.effects) effect();
        expect(window.__TAURI_INTERNALS__?.invoke).not.toHaveBeenCalled();
    });

    it("keeps explicit SQLite queries outside Dexie and releases their native subscription", async () => {
        vi.spyOn(productStorage, "usesSqliteProductStorage").mockReturnValue(true);
        const query = vi.fn(async () => "native snapshot");
        const nativeAdd = vi.spyOn(window, "addEventListener");
        const nativeRemove = vi.spyOn(window, "removeEventListener");
        expect(render(() => useVideoWorkspaceQuery(query, ["owner"]))).toBeUndefined();
        const disabledLiveRead = host.liveQuery.mock.calls.at(-1)![0] as () => unknown;
        expect(disabledLiveRead()).toBeUndefined();
        expect(query).not.toHaveBeenCalled();
        const cleanups = host.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
        await vi.waitFor(() => expect(host.cells[0]).toEqual({key: '["owner"]', value: "native snapshot"}));
        expect(query).toHaveBeenCalledOnce();
        expect(nativeAdd).toHaveBeenCalledWith("cuepoint:video-workspace-changed", expect.any(Function));
        cleanups.forEach(cleanup => cleanup());
        expect(nativeRemove).toHaveBeenCalledWith("cuepoint:video-workspace-changed", expect.any(Function));
    });

    it("resolves existing internal Blob previews in Tauri and revokes the same URL on cleanup", async () => {
        const record: MediaRecord = {id: "native-image", projectId: "studio", mimeType: "image/png", filename: "owned.png", blob: new Blob(["pixels"], {type: "image/png"})};
        await db.media.add(record);
        const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:owned-preview");
        const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        render(() => useMedia(record.id));
        const query = host.liveQuery.mock.calls.at(-1)![0] as () => Promise<MediaRecord>;
        host.liveQuery.mockReturnValue(await query());
        render(() => useMedia(record.id));
        const cleanup = host.effects[0]() as () => void;
        expect(render(() => useMedia(record.id))).toEqual({url: "blob:owned-preview", mimeType: "image/png", kind: "image"});
        expect(createUrl.mock.calls[0][0]).toMatchObject({size: 6, type: "image/png"});
        cleanup();
        expect(revokeUrl).toHaveBeenCalledWith("blob:owned-preview");
        host.liveQuery.mockReturnValue(null);
        expect(render(() => useMedia("missing"))).toBeUndefined();
        expect(window.__TAURI_INTERNALS__?.invoke).not.toHaveBeenCalled();
    });

    it("loads the same referenced shot media projection in Tauri instead of returning an empty native index", async () => {
        const project = await createProject("Desktop shot results");
        const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
        const shot = await addShot(project.id, episode.id);
        const used = {id: "used-result", projectId: project.id, mimeType: "image/png", filename: "used.png", blob: new Blob(["used"])};
        await db.media.bulkAdd([used, {...used, id: "unused-result"}]);
        shot.firstFrame.result = {mediaId: used.id, kind: "image"};
        const bulkGet = vi.spyOn(db.media, "bulkGet");
        useShotMedia([shot]);
        const query = host.liveQuery.mock.calls.at(-1)![0] as () => Promise<unknown>;
        host.liveQuery.mockReturnValue(await query());
        expect(useShotMedia([shot])?.get(used.id)?.blob.size).toBe(4);
        expect(useShotMedia([shot])?.has("unused-result")).toBe(false);
        expect(useShotMedia([])).toBeUndefined();
        expect(bulkGet).toHaveBeenCalledWith([used.id]);
        expect(window.__TAURI_INTERNALS__?.invoke).not.toHaveBeenCalled();
    });
});
