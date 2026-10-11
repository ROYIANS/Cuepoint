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
        useRef: (initial: unknown) => {
            const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useEffect: (effect: () => unknown) => {host.effects.push(effect);},
    };
});
vi.mock("@/lib/storage/hooks", () => ({useProductQuery: host.liveQuery, useProductQueryState: (...args: unknown[]) => ({value: host.liveQuery(...args), error: null})}));

import {isNativeWorkspaceRuntime} from "@/lib/nativeWorkspace";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {addShot} from "@/db/shots";
import {useVideoWorkspaceQuery, useVideoWorkspaceRepository} from "@/lib/videoWorkspaceRepository";
import {useMedia} from "@/lib/media";
import {useShotMedia} from "@/lib/useShotMedia";
import {readBinaryBlob} from "@/lib/storage/binary";

beforeEach(() => {
    host.cells = []; host.cursor = 0; host.effects = []; host.liveQuery.mockReset();
    vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()});
});
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});
function render<T>(run: () => T): T {host.cursor = 0; host.effects = []; return run();}

describe("runtime-independent shared queries and media", () => {
    it("passes the shared bound store to repository queries in genuine Tauri", async () => {
        expect(isNativeWorkspaceRuntime()).toBe(true);
        const project = await createProject("Desktop shared query");
        const query = vi.fn(async (repository: ReturnType<typeof useVideoWorkspaceRepository>) => repository.project(project.id));
        expect(render(() => useVideoWorkspaceQuery(query, [project.id]))).toBeUndefined();
        const sharedRead = host.liveQuery.mock.calls.at(-1)![0] as (store: typeof db) => Promise<typeof project>;
        host.liveQuery.mockReturnValue(await sharedRead(db));
        expect(render(() => useVideoWorkspaceQuery(query, [project.id]))?.name).toBe("Desktop shared query");
        expect(query).toHaveBeenCalledOnce();
        expect(window.__TAURI_INTERNALS__?.invoke).not.toHaveBeenCalled();
    });

    it("delegates loading and retained results to one shared query hook with its dependency key", async () => {
        const query = vi.fn(async () => "shared snapshot");
        expect(render(() => useVideoWorkspaceQuery(query, ["owner"]))).toBeUndefined();
        const [boundRead, dependencies] = host.liveQuery.mock.calls.at(-1)!;
        expect(dependencies).toEqual(["owner", 0]);
        expect(query).not.toHaveBeenCalled();
        host.liveQuery.mockReturnValue(await boundRead(db));
        expect(render(() => useVideoWorkspaceQuery(query, ["owner"]))).toBe("shared snapshot");
        expect(query).toHaveBeenCalledOnce();
        expect(window.__TAURI_INTERNALS__?.invoke).not.toHaveBeenCalled();
    });

    it("resolves existing internal Blob previews in Tauri and revokes the same URL on cleanup", async () => {
        const record: MediaRecord = {id: "native-image", projectId: "studio", mimeType: "image/png", filename: "owned.png", blob: new Blob(["pixels"], {type: "image/png"})};
        await db.media.add(record);
        const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:owned-preview");
        const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        render(() => useMedia(record.id));
        const query = host.liveQuery.mock.calls.at(-1)![0] as (store: typeof db) => Promise<MediaRecord>;
        host.liveQuery.mockReturnValue(await query(db));
        render(() => useMedia(record.id));
        const cleanup = host.effects[0]() as () => void;
        await vi.waitFor(() => {
            expect(render(() => useMedia(record.id))).toEqual({url: "blob:owned-preview", mimeType: "image/png", kind: "image", onError: expect.any(Function)});
        });
        const loadedBlob = createUrl.mock.calls[0][0] as Blob;
        expect(loadedBlob).toMatchObject({size: 6, type: "image/png"});
        expect(await loadedBlob.text()).toBe("pixels");
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
        render(() => useShotMedia([shot]));
        const query = host.liveQuery.mock.calls.at(-1)![0] as (store: typeof db) => Promise<unknown>;
        host.liveQuery.mockReturnValue(await query(db));
        expect(render(() => useShotMedia([shot]))).toBeUndefined();
        const cleanups = host.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
        await vi.waitFor(() => {expect(render(() => useShotMedia([shot]))?.get(used.id)).toBeDefined();});
        const loaded = render(() => useShotMedia([shot]));
        const loadedBlob = await readBinaryBlob(loaded!.get(used.id)!.blob);
        expect(loadedBlob.size).toBe(4);
        expect(await loadedBlob.text()).toBe("used");
        expect(loaded?.has("unused-result")).toBe(false);
        expect(render(() => useShotMedia([]))).toBeUndefined();
        expect(bulkGet).toHaveBeenCalledWith([used.id]);
        cleanups.forEach(cleanup => cleanup());
        expect(window.__TAURI_INTERNALS__?.invoke).not.toHaveBeenCalled();
    });
});
