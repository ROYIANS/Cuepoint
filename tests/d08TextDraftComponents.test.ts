import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
type Effect = {deps?: unknown[]; setup: () => void | (() => void); cleanup?: () => void};
type Host = {cells: unknown[]; cursor: number; effects: Array<() => void>};
const runtime = vi.hoisted(() => ({active: undefined as Host | undefined}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    return {...react,
        useState: (initial: unknown) => {
            const host = runtime.active!; const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial;
            return [host.cells[index], (next: unknown) => {
                host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;
            }];
        },
        useRef: (initial: unknown) => {
            const host = runtime.active!; const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useEffect: (setup: Effect["setup"], deps?: unknown[]) => {
            const host = runtime.active!; const index = host.cursor++; const previous = host.cells[index] as Effect | undefined;
            if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
                const cell: Effect = {deps, setup}; host.cells[index] = cell;
                host.effects.push(() => {previous?.cleanup?.(); cell.cleanup = setup() || undefined;});
            }
        },
        useMemo: (compute: () => unknown, deps: unknown[]) => {
            const host = runtime.active!; const index = host.cursor++;
            const previous = host.cells[index] as {deps: unknown[]; value: unknown} | undefined;
            if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.cells[index] = {deps, value: compute()};
            return (host.cells[index] as {value: unknown}).value;
        },
        useCallback: (callback: unknown, deps: unknown[]) => {
            const host = runtime.active!; const index = host.cursor++;
            const previous = host.cells[index] as {deps: unknown[]; value: unknown} | undefined;
            if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.cells[index] = {deps, value: callback};
            return (host.cells[index] as {value: unknown}).value;
        },
    };
});
import {TextDraftField} from "@/components/drafts/TextDraftField";
import {ShotTextField} from "@/components/shots/ShotTextField";
import {BeatTextField} from "@/components/story/BeatTextField";
import {useTextDraftRetention} from "@/lib/useTextDraftRetention";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {DraftStatus} from "@/components/ui/draft-status";
import {Input} from "@/components/ui/input";
import {DraftConflictError} from "@/lib/draftConflict";
import {createProject} from "@/db/projects";
import {addStoryBeat, firstEpisode, patchStoryBeat} from "@/db/episodes";
import {addShot, patchShot} from "@/db/shots";
import {db} from "@/db/database";

type Node = ReactElement<Record<string, unknown>>;
const hosts: Host[] = [];
function mount() {const host: Host = {cells: [], cursor: 0, effects: []}; hosts.push(host); return host;}
function nodes(tree: unknown): Node[] {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node; return [node, ...nodes(node.props.children)];
}
function draw<T>(host: Host, run: () => T): T {
    runtime.active = host; host.cursor = 0;
    const result = run(); host.effects.splice(0).forEach(effect => effect()); return result;
}
function unmount(host: Host) {
    host.cells.forEach(cell => {
        if (cell && typeof cell === "object" && "setup" in cell) (cell as Effect).cleanup?.();
    }); host.cells = [];
}
function control(props: Parameters<typeof TextDraftField>[0]) {
    const host = mount(); let current = props;
    const render = () => nodes(draw(host, () => {
        const wrapper = TextDraftField(current);
        return (wrapper.type as (props: unknown) => unknown)(wrapper.props);
    }));
    const change = (value: string) => {
        (render().find(node => node.type === Input)!.props.onChange as (event: unknown) => void)({target: {value}});
    };
    const status = () => render().find(node => node.type === DraftStatus)!.props;
    return {host, render, change, status, external: (value: string) => {current = {...current, value}; render();},
        props: (next: typeof props) => {current = next; render();}, value: () => render().find(node => node.type === Input)!.props.value};
}
async function settle() {for (let i = 0; i < 8; i++) await Promise.resolve();}
function deferred() {let resolve!: () => void; const promise = new Promise<void>(done => {resolve = done;}); return {promise, resolve};}
beforeEach(() => {
    vi.stubGlobal("document", {visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn()});
    vi.stubGlobal("window", {addEventListener: vi.fn(), removeEventListener: vi.fn()});
});
afterEach(async () => {hosts.splice(0).forEach(unmount); await Promise.resolve(); vi.unstubAllGlobals();});

describe("D08 actual shared text control and retention", () => {
    it("shows edits immediately, marks retention before persistence, serializes newer text and freezes the callback owner", async () => {
        const gate = deferred(); const writes: Array<[string, string]> = [];
        const persist = vi.fn(async (value: string, baseline: string) => {writes.push([value, baseline]); if (writes.length === 1) await gate.promise;});
        const pending = vi.fn(); const foreign = vi.fn(async () => {});
        const field = control({projectId: "d08-delayed", draftKey: "shot:A:content", value: "original", persist, onStatusChange: pending});
        field.render(); field.change("first");
        expect(pending).toHaveBeenLastCalledWith("saving"); expect(writes).toEqual([]); expect(field.value()).toBe("first");
        const flush = flushPendingDrafts("d08-delayed");
        expect(writes).toEqual([["first", "original"]]);
        field.change("newest"); field.props({projectId: "d08-delayed", draftKey: "shot:A:content", value: "original", persist: foreign, onStatusChange: pending});
        gate.resolve(); await flush;
        expect(writes).toEqual([["first", "original"], ["newest", "first"]]);
        expect(foreign).not.toHaveBeenCalled(); expect(field.value()).toBe("newest"); expect(field.status().status).toBe("saved");
    });
    it("keeps the initial scalar baseline through remote notifications, failure, retry and explicit latest adoption", async () => {
        const writes: Array<[string, string]> = []; let reject = true;
        const field = control({projectId: "d08-conflict", draftKey: "beat:A:title", value: "base", persist: async (value, baseline) => {
            writes.push([value, baseline]); if (reject) throw new DraftConflictError();
        }});
        field.render(); field.change("mine"); field.external("remote");
        await expect(flushPendingDrafts("d08-conflict")).rejects.toBeInstanceOf(DraftConflictError);
        expect(field.value()).toBe("mine"); expect(field.status().status).toBe("error");
        (field.status().onRetry as () => void)(); await settle();
        expect(writes).toEqual([["mine", "base"], ["mine", "base"]]);
        (field.status().onUseLatest as () => void)(); expect(field.value()).toBe("remote");
        reject = false; field.change("merged"); await flushPendingDrafts("d08-conflict");
        expect(writes.at(-1)).toEqual(["merged", "remote"]);
    });
    it("retains an unmounted failure for project flush and restores it on reopen", async () => {
        let fail = true; const writes: Array<[string, string]> = [];
        const props = {projectId: "d08-reopen", draftKey: "shot:A:notes", value: "base", persist: async (value: string, baseline: string) => {
            writes.push([value, baseline]); if (fail) throw new Error("storage unavailable");
        }};
        const first = control(props); first.render(); first.change("retained");
        await expect(flushPendingDrafts(props.projectId)).rejects.toThrow("storage unavailable");
        unmount(first.host); await expect(flushPendingDrafts(props.projectId)).rejects.toThrow("storage unavailable");
        const reopened = control(props); reopened.render(); await settle(); expect(reopened.value()).toBe("retained"); expect(reopened.status().status).toBe("error");
        fail = false; await flushPendingDrafts(props.projectId);
        expect(writes.at(-1)).toEqual(["retained", "base"]); expect(reopened.status().status).toBe("saved");
    });
    it("pins only unresolved matched rows, including a same-turn empty/missing query", () => {
        const host = mount(); let rows = [{id: "A", title: "A"}, {id: "B", title: "B"}];
        const render = () => draw(host, () => useTextDraftRetention(rows));
        const initial = render(); initial.onStatusChange("A", "title", "saving");
        expect(initial.isPending("A")).toBe(true); rows = []; expect(render().rows).toEqual([{id: "A", title: "A"}]);
        render().onStatusChange("A", "title", "error"); expect(render().retainedCount).toBe(1);
        render().onStatusChange("A", "title", "saved"); expect(render().rows).toEqual([]);
    });
    it("real shot and beat adapters save through their respective repository baselines", async () => {
        const project = await createProject("adapter", "series"); const episode = (await firstEpisode(project.id))!;
        const beat = await addStoryBeat(episode.id); const shot = await addShot(project.id, episode.id);
        const shotElement = ShotTextField({shot, field: "notes"});
        const shotField = control(shotElement.props); shotField.render(); shotField.change("note draft");
        await patchShot(shot.id, {durationSec: 3}); await flushPendingDrafts(project.id);
        expect(await db.shots.get(shot.id)).toMatchObject({notes: "note draft", durationSec: 3});
        const beatElement = BeatTextField({projectId: project.id, episodeId: episode.id, beat, field: "title"});
        const beatField = control(beatElement.props); beatField.render(); beatField.change("local title");
        await patchStoryBeat(episode.id, beat.id, {title: "remote title"}); beatField.external("remote title");
        await expect(flushPendingDrafts(project.id)).rejects.toBeInstanceOf(DraftConflictError);
        expect(beatField.value()).toBe("local title"); (beatField.status().onUseLatest as () => void)();
        await flushPendingDrafts(project.id); expect(beatField.value()).toBe("remote title");
    });
});
