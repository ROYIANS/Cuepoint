import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {AudioProjectSnapshot} from "@/domain/audio";
import type {ChatThread, ConnectorConfig} from "@/domain/types";

// Deterministic effect host for actual hook owners. Native scheduling is covered
// separately; this host keeps stable setters/memos and executes dependency cleanup.
type Effect = {kind: "effect"; deps?: readonly unknown[]; setup: () => void | (() => void); cleanup?: () => void};
type Host = {cells: unknown[]; cursor: number; effects: Array<() => void>; mounted: boolean; lateWrites: number};
const runtime = vi.hoisted(() => ({host: undefined as Host | undefined}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    const same = (a?: readonly unknown[], b?: readonly unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const memo = (fn: () => unknown, deps?: readonly unknown[]) => {
        const host = runtime.host!, i = host.cursor++;
        const previous = host.cells[i] as {deps?: readonly unknown[]; value: unknown} | undefined;
        if (!previous || !same(deps, previous.deps)) host.cells[i] = {deps, value: fn()};
        return (host.cells[i] as {value: unknown}).value;
    };
    return {...react,
        useMemo: memo,
        useCallback: (fn: unknown, deps?: readonly unknown[]) => memo(() => fn, deps),
        useState: (initial: unknown) => {
            const host = runtime.host!, i = host.cursor++;
            if (!(i in host.cells)) {
                const cell = {value: typeof initial === "function" ? initial() : initial, set: (next: unknown) => {
                    if (!host.mounted) host.lateWrites++;
                    cell.value = typeof next === "function" ? next(cell.value) : next;
                }};
                host.cells[i] = cell;
            }
            const cell = host.cells[i] as {value: unknown; set: (next: unknown) => void};
            return [cell.value, cell.set];
        },
        useRef: (initial: unknown) => {
            const host = runtime.host!, i = host.cursor++;
            if (!(i in host.cells)) host.cells[i] = {current: initial};
            return host.cells[i];
        },
        useEffect: (setup: Effect["setup"], deps?: readonly unknown[]) => {
            const host = runtime.host!, i = host.cursor++;
            const previous = host.cells[i] as Effect | undefined;
            if (!previous || !same(deps, previous.deps)) {
                const cell: Effect = {kind: "effect", deps, setup}; host.cells[i] = cell;
                host.effects.push(() => {previous?.cleanup?.(); cell.cleanup = setup() || undefined;});
            }
        },
    };
});
const audio = vi.hoisted(() => ({players: [] as Array<{
    playing: boolean; currentTime: number; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>;
}>, load: vi.fn()}));
vi.mock("@/lib/audio/engine", async original => {
    const actual = await original<typeof import("@/lib/audio/engine")>();
    return {...actual, AudioPreviewPlayer: class {
        playing = false; currentTime = 0;
        play = vi.fn(async (_schedule, _buffers, at: number) => {this.currentTime = at; this.playing = true;});
        pause = vi.fn(() => {this.playing = false; return this.currentTime;});
        dispose = vi.fn(async () => {this.playing = false;});
        constructor() {audio.players.push(this);}
    }};
});
vi.mock("@/lib/audio/buffers", () => ({loadBuffers: audio.load, loadAudioBuffer: vi.fn()}));
const chat = vi.hoisted(() => ({update: vi.fn()}));
vi.mock("@/db/chat", () => ({updateChatThread: chat.update, bindChatThreadProject: vi.fn()}));
const imports = vi.hoisted(() => ({importFile: vi.fn()}));
vi.mock("@/lib/references/import", () => ({importReferenceFile: imports.importFile, retryReferenceImport: vi.fn()}));
vi.mock("sonner", () => ({toast: {error: vi.fn(), success: vi.fn()}}));

import {AudioTimeline, type AudioTimelineProps} from "@/components/audio/AudioTimeline";
import {useReferenceDraft} from "@/components/agent/useReferenceDraft";
import {useChatSelection} from "@/components/agent/useChatSelection";

type Node = ReactElement<Record<string, unknown>>;
const hosts: Host[] = [];
function mount(): Host {const host: Host = {cells: [], cursor: 0, effects: [], mounted: true, lateWrites: 0}; hosts.push(host); return host;}
function draw<T>(host: Host, run: () => T): T {
    runtime.host = host; host.cursor = 0;
    const result = run(); host.effects.splice(0).forEach(effect => effect()); return result;
}
function unmount(host: Host) {
    host.mounted = false;
    for (const cell of host.cells) if (cell && typeof cell === "object" && "kind" in cell && cell.kind === "effect") (cell as Effect).cleanup?.();
}
function nodes(tree: unknown): Node[] {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const node = tree as Node; return [node, ...nodes(node.props.children)];
}
function button(tree: unknown, label: string) {return nodes(tree).find(node => node.props["aria-label"] === label)!;}
function click(tree: unknown, label: string) {(button(tree, label).props.onClick as () => void)();}
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(r => {resolve = r;}); return {promise, resolve};}
async function settle() {for (let i = 0; i < 8; i++) await Promise.resolve();}
function snapshot(): AudioProjectSnapshot {
    const row = {projectId: "project", revision: 1, createdAt: "2026-10-09", updatedAt: "2026-10-09"};
    return {speakers: [], segments: [], exports: [],
        chapters: [{...row, id: "chapter", title: "Chapter", order: 0}],
        tracks: [{...row, id: "track", chapterId: "chapter", role: "voice", name: "Track", order: 0, gain: 1, muted: false, solo: false}],
        takes: [{...row, id: "take", name: "Take", source: "upload", mediaId: "media", durationSec: 30, sampleRate: 48000, channels: 1}],
        clips: [{...row, id: "clip", chapterId: "chapter", trackId: "track", takeId: "take", startSec: 0, trimStartSec: 0, trimEndSec: 30, gain: 1, fadeInSec: 0, fadeOutSec: 0}],
    };
}
function timelineProps(): AudioTimelineProps {return {projectId: "project", projectName: "Project", chapterId: "chapter", snapshot: snapshot(), selectedId: "", onSelect: vi.fn()};}

beforeEach(() => {
    vi.useFakeTimers(); audio.players.length = 0; audio.load.mockReset(); imports.importFile.mockReset(); chat.update.mockReset();
    const windowTarget = new EventTarget();
    vi.stubGlobal("window", Object.assign(windowTarget, {setInterval, clearInterval}));
    vi.stubGlobal("document", Object.assign(new EventTarget(), {querySelectorAll: () => [], activeElement: null}));
});
afterEach(() => {for (const host of hosts.splice(0)) if (host.mounted) unmount(host); vi.useRealTimers(); vi.unstubAllGlobals();});

describe("E07 actual UI hook lifecycle contracts", () => {
    it("consumes one seek ID without pausing playback on resize or equivalent request objects", async () => {
        const host = mount(), props = timelineProps(), onPosition = vi.fn(); props.onPositionChange = onPosition;
        props.seekRequest = {id: "seek-1", position: 8};
        audio.load.mockResolvedValue(new Map());
        let tree = draw(host, () => AudioTimeline(props));
        const player = audio.players[0]; expect(onPosition).toHaveBeenLastCalledWith(8);
        click(tree, "播放章节"); await settle(); expect(player.play).toHaveBeenCalledTimes(1);
        tree = draw(host, () => AudioTimeline(props));
        const pauses = player.pause.mock.calls.length;
        click(tree, "放大时间线");
        draw(host, () => AudioTimeline({...props, seekRequest: {id: "seek-1", position: 19}}));
        expect(player.pause).toHaveBeenCalledTimes(pauses); expect(player.playing).toBe(true);
        expect(player.play.mock.calls[0][2]).toBe(8);
        draw(host, () => AudioTimeline({...props, seekRequest: {id: "seek-2", position: 12}}));
        expect(player.pause).toHaveBeenCalledTimes(pauses + 1); expect(onPosition).toHaveBeenLastCalledWith(12);
    });

    it.each(["audition", "composition", "project", "unmount"] as const)("invalidates delayed buffer playback on %s", async transition => {
        const host = mount(), props = timelineProps(), pending = deferred<Map<string, AudioBuffer>>();
        audio.load.mockReturnValue(pending.promise);
        const tree = draw(host, () => AudioTimeline(props));
        click(tree, "播放章节"); expect(audio.load).toHaveBeenCalledTimes(1);
        const previous = audio.players[0];
        if (transition === "audition") document.dispatchEvent(new Event("audio-workspace-audition"));
        if (transition === "composition") draw(host, () => AudioTimeline({...props, snapshot: {...props.snapshot, tracks: props.snapshot.tracks.map(track => ({...track, gain: .5}))}}));
        if (transition === "project") draw(host, () => AudioTimeline({...props, projectId: "other-project"}));
        if (transition === "unmount") unmount(host);
        pending.resolve(new Map()); await settle();
        expect(audio.players.every(player => player.play.mock.calls.length === 0)).toBe(true);
        if (transition === "project" || transition === "unmount") expect(previous.dispose).toHaveBeenCalledTimes(1);
        expect(host.lateWrites).toBe(0);
    });

    it("polls one player through callback changes and records the final stopped position", () => {
        const host = mount(), props = timelineProps(), first = vi.fn(), latest = vi.fn();
        draw(host, () => AudioTimeline({...props, onPositionChange: first}));
        const player = audio.players[0]; player.playing = true; player.currentTime = 4;
        vi.advanceTimersByTime(60); expect(first).toHaveBeenLastCalledWith(4);
        draw(host, () => AudioTimeline({...props, onPositionChange: latest}));
        player.playing = false; player.currentTime = 6;
        vi.advanceTimersByTime(60); expect(latest).toHaveBeenLastCalledWith(6);
        expect(audio.players).toHaveLength(1); expect(player.dispose).not.toHaveBeenCalled();
        const count = latest.mock.calls.length; vi.advanceTimersByTime(120); expect(latest).toHaveBeenCalledTimes(count);
        unmount(host); expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts imports added after mount without publishing late completions", async () => {
        const host = mount(), pending = deferred<never>();
        imports.importFile.mockReturnValue(pending.promise);
        const draft = draw(host, () => useReferenceDraft("thread", "project"));
        const importing = draft.importFiles([new File(["reference"], "reference.txt", {type: "text/plain"})]);
        const options = imports.importFile.mock.calls[0][2] as {signal: AbortSignal};
        expect(options.signal.aborted).toBe(false);
        draw(host, () => useReferenceDraft("other-thread", "project"));
        expect(options.signal.aborted).toBe(false);
        unmount(host); expect(options.signal.aborted).toBe(true);
        pending.resolve(undefined as never); await importing;
        expect(host.lateWrites).toBe(0);
    });

    it("retains an in-flight model choice across unrelated thread metadata refresh", async () => {
        const host = mount(), durable = deferred<void>();
        chat.update.mockReturnValue(durable.promise);
        const connector: ConnectorConfig = {id: "connector", definitionId: "openai-compatible", protocol: "openai-compatible", baseUrl: "https://example.test", apiKey: "fixture", updatedAt: "2026-10-09"};
        const connectors = [connector];
        const thread: ChatThread = {id: "thread", title: "Original", connectorId: connector.id, model: "saved", createdAt: "2026-10-09", updatedAt: "2026-10-09"};
        const selectionProps = {loaded: true, activeThread: thread, activeThreadId: thread.id, connectorList: connectors};
        draw(host, () => useChatSelection(selectionProps));
        let selection = draw(host, () => useChatSelection(selectionProps));
        // The local model update is synchronous even while its durable write awaits.
        const updating = selection.handleModelChange("new-model");
        selection = draw(host, () => useChatSelection({...selectionProps, activeThread: {...thread, title: "Renamed"}}));
        selection = draw(host, () => useChatSelection({...selectionProps, activeThread: {...thread, title: "Renamed"}}));
        expect(selection.snapshot.model).toBe("new-model");
        durable.resolve(); await updating;
        draw(host, () => useChatSelection({...selectionProps, activeThread: {...thread, id: "another-thread"}}));
        selection = draw(host, () => useChatSelection({...selectionProps, activeThread: {...thread, id: "another-thread"}}));
        expect(selection.snapshot.model).toBe("saved");
    });
});
