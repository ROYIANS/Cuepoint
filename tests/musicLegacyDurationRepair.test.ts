import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

// Execute the actual MusicCreation and useDebouncedDraft callbacks/effects. This
// small hook/JSX host does not simulate ReactDOM, Radix or browser scheduling.
type Effect = {deps?: unknown[]; cleanup?: () => void};
const host = vi.hoisted(() => ({cells: [] as unknown[], cursor: 0, effects: [] as Array<() => void>}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    return {...react,
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
        useEffect: (setup: () => void | (() => void), deps?: unknown[]) => {
            const index = host.cursor++, previous = host.cells[index] as Effect | undefined;
            if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
                const cell: Effect = {deps}; host.cells[index] = cell;
                host.effects.push(() => {previous?.cleanup?.(); cell.cleanup = setup() || undefined;});
            }
        },
        useMemo: (compute: () => unknown, deps: unknown[]) => {
            const index = host.cursor++, previous = host.cells[index] as {deps: unknown[]; value: unknown} | undefined;
            if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.cells[index] = {deps, value: compute()};
            return (host.cells[index] as {value: unknown}).value;
        },
        useCallback: (callback: unknown, deps: unknown[]) => {
            const index = host.cursor++, previous = host.cells[index] as {deps: unknown[]; value: unknown} | undefined;
            if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.cells[index] = {deps, value: callback};
            return (host.cells[index] as {value: unknown}).value;
        },
    };
});

import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/repo";
import * as musicRepo from "@/db/music";
import {defaultMusicSettings, type MusicDraft, type MusicSettings} from "@/domain/music";
import {MusicCreation} from "@/components/music/MusicCreation";
import {DraftStatus} from "@/components/ui/draft-status";
import {flushPendingDrafts} from "@/lib/debouncedDraft";
import {DraftConflictError} from "@/lib/draftConflict";
import {musicWireInput} from "@/lib/audioGeneration/input";

type Node = ReactElement<Record<string, unknown>>;
function nodes(tree: unknown): Node[] {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node;
    // Expand the production repair leaf; other UI primitives remain JSX nodes.
    if (typeof node.type === "function" && node.type.name === "SimpleMusicDurationRepair") {
        return [node, ...nodes((node.type as (props: Record<string, unknown>) => unknown)(node.props))];
    }
    return [node, ...nodes(node.props.children)];
}
function draw(record: MusicDraft, options: {switching?: boolean} = {}) {
    host.cursor = 0;
    const tree = nodes(MusicCreation({record, switching: options.switching ?? false, changeVariant: vi.fn(), connectorId: "api", setConnectorId: vi.fn(), onSubmitted: vi.fn(), onSubmittingChange: vi.fn()}));
    host.effects.splice(0).forEach(effect => effect());
    return tree;
}
const repair = (tree: Node[]) => tree.find(node => node.props.children === "清除历史时长");
function click(node: Node | undefined) {
    expect(node).toBeDefined();
    (node!.props.onClick as () => void)();
}
function changeText(tree: Node[], text: string) {
    const input = tree.find(node => node.props["aria-label"] === "音乐描述")!;
    (input.props.onChange as (event: {target: {value: string}}) => void)({target: {value: text}});
}
let scope: string | undefined;
async function fixture(duration: number | undefined = 30.5, custom = false) {
    const project = await createAudioMusicProject("历史 Simple", "music"); scope = project.id;
    const settings: MusicSettings = {engine: "suno", version: "v6", custom, instrumental: false, prompt: "原文", title: "原题", style: "", negativeTags: ""};
    const row = await musicRepo.addMusicDraft(project.id, {settings});
    await db.musicDrafts.update(row.id, {settings: {...settings, durationSec: duration}});
    return (await db.musicDrafts.get(row.id))!;
}
beforeEach(() => {
    host.cells = []; host.cursor = 0; host.effects = []; scope = undefined;
    vi.stubGlobal("window", {addEventListener: vi.fn(), removeEventListener: vi.fn()});
    vi.stubGlobal("document", {visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn()});
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout"]});
});
afterEach(async () => {
    for (const cell of host.cells) {
        if (cell && typeof cell === "object" && "cleanup" in cell) (cell as Effect).cleanup?.();
    }
    if (scope) await flushPendingDrafts(scope).catch(() => undefined);
    vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("C02 actual Simple legacy repair callbacks", () => {
    it.each([30.5, 120, 9, 361])("shows historical duration %s unchanged until explicit action", async duration => {
        const row = await fixture(duration), save = vi.spyOn(musicRepo, "patchMusicDraft");
        const tree = draw(row);
        expect(repair(tree)?.props.disabled).toBe(false);
        expect(tree.flatMap(node => nodes(node)).some(node => String(node.props.children).includes(String(duration)))).toBe(true);
        await vi.advanceTimersByTimeAsync(400);
        expect(save).not.toHaveBeenCalled();
        expect((await db.musicDrafts.get(row.id))?.settings).toEqual(row.settings);
    });

    it("keeps ordinary Simple and Custom layouts unchanged and disables repair while switching or busy", async () => {
        const row = await fixture();
        expect(repair(draw(row, {switching: true}))?.props.disabled).toBe(true);
        // The first production useState cell is the component's busy state.
        host.cells[0] = true;
        expect(repair(draw(row))?.props.disabled).toBe(true);
        host.cells[0] = false;
        const plain = {...row, settings: defaultMusicSettings("suno")};
        draw(plain);
        expect(repair(draw(plain))).toBeUndefined();
        const custom = {...row, settings: {...row.settings, custom: true} as MusicSettings};
        draw(custom);
        expect(repair(draw(custom))).toBeUndefined();
    });

    it("clears only the historical duration, preserves dirty text and saves through the actual debounce/CAS", async () => {
        const row = await fixture(), save = vi.spyOn(musicRepo, "patchMusicDraft");
        let tree = draw(row);
        changeText(tree, "用户尚未保存的新描述");
        tree = draw(row);
        expect((await db.musicDrafts.get(row.id))?.settings).toEqual(row.settings);
        click(repair(tree));
        expect(save).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(400);
        expect(save).toHaveBeenCalledOnce();
        await flushPendingDrafts(row.projectId);
        const repaired = (await db.musicDrafts.get(row.id))!;
        expect(repaired.settings).toEqual({...row.settings, prompt: "用户尚未保存的新描述", durationSec: undefined});
        expect(repaired.revision).toBe(row.revision + 1);
        expect(save).toHaveBeenCalledWith(row.projectId, row.id, row.revision, {settings: repaired.settings});
        expect(musicWireInput(repaired.settings)).toEqual({model: "suno", version: "v6", custom: false, instrumental: false, prompt: "用户尚未保存的新描述"});
        expect(repair(draw(repaired))).toBeUndefined();
        expect(draw(repaired).find(node => node.type === DraftStatus)?.props.status).toBe("saved");
    });

    it("retains the cleared local draft and text on write failure, then retries the same draft", async () => {
        const row = await fixture(), actual = musicRepo.patchMusicDraft;
        const save = vi.spyOn(musicRepo, "patchMusicDraft").mockRejectedValue(new Error("quota"));
        changeText(draw(row), "保留的本地描述");
        click(repair(draw(row)));
        await vi.advanceTimersByTimeAsync(400);
        await expect(flushPendingDrafts(row.projectId)).rejects.toThrow("quota");
        const tree = draw(row), status = tree.find(node => node.type === DraftStatus)!;
        expect(status.props.status).toBe("error");
        expect(status.props.error).toMatchObject({message: "quota"});
        expect(repair(tree)).toBeUndefined();
        expect(tree.find(node => node.props["aria-label"] === "音乐描述")?.props.value).toBe("保留的本地描述");
        expect((await db.musicDrafts.get(row.id))?.settings).toEqual(row.settings);
        save.mockImplementation(actual);
        (status.props.onRetry as () => void)();
        await flushPendingDrafts(row.projectId);
        expect((await db.musicDrafts.get(row.id))?.settings).toEqual({...row.settings, prompt: "保留的本地描述", durationSec: undefined});
    });

    it("keeps local repair/text and reports CAS conflict instead of overwriting a newer draft", async () => {
        const row = await fixture();
        changeText(draw(row), "本地修复描述");
        click(repair(draw(row)));
        const latest = await musicRepo.patchMusicDraft(row.projectId, row.id, row.revision, {settings: {...row.settings, prompt: "另一编辑器已保存", durationSec: undefined}});
        const save = vi.spyOn(musicRepo, "patchMusicDraft");
        await vi.advanceTimersByTimeAsync(400);
        await expect(flushPendingDrafts(row.projectId)).rejects.toBeInstanceOf(DraftConflictError);
        const tree = draw(latest), status = tree.find(node => node.type === DraftStatus)!;
        expect(status.props.error).toBeInstanceOf(DraftConflictError);
        expect(status.props.status).toBe("error");
        expect(tree.find(node => node.props["aria-label"] === "音乐描述")?.props.value).toBe("本地修复描述");
        expect(repair(tree)).toBeUndefined();
        expect(save).not.toHaveBeenCalled();
        expect((await db.musicDrafts.get(row.id))?.settings).toEqual(latest.settings);
    });
});
