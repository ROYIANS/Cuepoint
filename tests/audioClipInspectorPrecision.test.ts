import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {AudioClip, AudioProjectSnapshot} from "@/features/audio/models/audio";

type Host = {cells: unknown[]; cursor: number};
const runtime = vi.hoisted(() => ({active: undefined as Host | undefined}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    return {...actual,
        useState(initial: unknown) {
            const host = runtime.active!, index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = typeof initial === "function" ? initial() : initial;
            return [host.cells[index], (next: unknown) => {
                host.cells[index] = typeof next === "function" ? next(host.cells[index]) : next;
            }];
        },
        useRef(initial: unknown) {
            const host = runtime.active!, index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useMemo: (compute: () => unknown) => compute(),
        useCallback: (callback: unknown) => callback,
        useEffect: () => undefined,
    };
});

import {AudioTimeline} from "@/features/audio/ui/AudioTimeline";
import {Button} from "@/ui/button";
import {Input} from "@/ui/input";
import {db} from "@/platform/product/store";
import {addAudioClip, addAudioTake} from "@/features/audio/commands/audio";
import {getAudioProjectSnapshot} from "@/features/audio/queries/snapshot";
import {createAudioMusicProject} from "@/features/projects/commands/projects";
import {AudioClipHistory} from "@/features/audio/engine/commands";

type Node = ReactElement<Record<string, unknown>>;
const labels = ["时间线位置（秒）", "源裁剪起点（秒）", "源裁剪终点（秒）", "音量倍数", "淡入时长（秒）", "淡出时长（秒）"];
const editKeys = ["startSec", "trimStartSec", "trimEndSec", "gain", "fadeInSec", "fadeOutSec"] as const;
type EditKey = typeof editKeys[number];
function edits(clip: AudioClip) { return Object.fromEntries(editKeys.map(key => [key, clip[key]])); }
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function draw(host: Host, render: () => unknown) {
    host.cursor = 0;
    runtime.active = host;
    return nodes(render());
}

async function fixture() {
    const project = await createAudioMusicProject("毫秒录音", "audio");
    const initial = await getAudioProjectSnapshot(project.id);
    const chapter = initial.chapters[0], track = initial.tracks[0];
    const take = await addAudioTake(project.id, {mediaId: "precision-source", name: "真实录音时长", source: "recording", durationSec: 8.945, sampleRate: 48_000, channels: 1},
        {id: "precision-source", projectId: project.id, filename: "recording.wav", mimeType: "audio/wav", blob: new Blob([Uint8Array.of(1, 2, 3)], {type: "audio/wav"})});
    const clip = await addAudioClip(project.id, {chapterId: chapter.id, trackId: track.id, takeId: take.id, startSec: 0, trimStartSec: 0, trimEndSec: 8.945, gain: 1, fadeInSec: 0, fadeOutSec: 0});
    const history = new AudioClipHistory(project.id, chapter.id);
    const timelineHost: Host = {cells: [], cursor: 0}, inspectorHost: Host = {cells: [], cursor: 0};
    let snapshot: AudioProjectSnapshot = await getAudioProjectSnapshot(project.id);
    const timeline = () => draw(timelineHost, () => AudioTimeline({projectId: project.id, projectName: project.name, chapterId: chapter.id,
        snapshot, selectedId: clip.id, onSelect: () => undefined, clipHistory: history}));
    const inspector = () => {
        const target = timeline().find(node => node.props.clip && typeof node.props.save === "function" && typeof node.type === "function");
        if (!target) throw new Error("Selected clip inspector is missing");
        return draw(inspectorHost, () => (target.type as (props: Record<string, unknown>) => unknown)(target.props));
    };
    const input = (key: EditKey) => {
        const field = inspector().find(node => node.props.label === labels[editKeys.indexOf(key)]);
        const control = nodes(field?.props.children).find(node => node.type === Input);
        if (!control) throw new Error(`Missing clip field: ${key}`);
        return control;
    };
    const change = (key: EditKey, value: string) => (input(key).props.onChange as (event: unknown) => void)({target: {value}});
    const submit = () => {
        const event = {preventDefault: vi.fn()};
        (inspector().find(node => node.type === "form")!.props.onSubmit as (event: unknown) => void)(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
    };
    const clickHistory = (label: string) => {
        const control = timeline().find(node => node.type === Button && node.props["aria-label"] === label)!;
        expect(control.props.disabled).toBe(false);
        (control.props.onClick as () => void)();
    };
    const refresh = async () => {snapshot = await getAudioProjectSnapshot(project.id);};
    return {project, clip, take, history, timeline, inspector, input, change, submit, clickHistory, refresh};
}

beforeEach(() => { runtime.active = undefined; });

describe("actual clip inspector precision and command wiring", () => {
    // This lightweight hook host executes actual component callbacks and repositories.
    // It does not substitute for the final Tauri/WebKit HTML-validation check.
    it("allows an unchanged 8.945-second recording in every numeric field while retaining HTML bounds", async () => {
        const host = await fixture();
        for (const key of editKeys) expect(host.input(key).props).toMatchObject({type: "number", min: 0, step: "any", required: true});
        expect(host.input("gain").props.max).toBe(4);
        expect(host.input("trimEndSec").props.value).toBe("8.945");
        host.change("gain", "0.753");
        host.change("fadeInSec", "0.111");
        host.change("fadeOutSec", "0.222");
        host.submit();
        await vi.waitFor(async () => expect(await db.audioClips.get(host.clip.id)).toMatchObject({revision: 2, trimEndSec: 8.945, gain: .753, fadeInSec: .111, fadeOutSec: .222}));
        expect((await db.audioTakes.get(host.take.id))?.durationSec).toBe(8.945);
    });

    it("submits all exact fields through clip history and restores them through the real undo/redo controls", async () => {
        const host = await fixture();
        const next = {startSec: .125, trimStartSec: .007, trimEndSec: 8.934567, gain: .753, fadeInSec: .111123, fadeOutSec: .222345};
        for (const key of editKeys) host.change(key, String(next[key]));
        host.submit();
        await vi.waitFor(async () => expect(edits((await db.audioClips.get(host.clip.id))!)).toEqual(next));
        await host.refresh();
        host.clickHistory("撤销时间线编辑");
        await vi.waitFor(async () => expect(edits((await db.audioClips.get(host.clip.id))!)).toEqual(edits(host.clip)));
        await host.refresh();
        host.clickHistory("重做时间线编辑");
        await vi.waitFor(async () => expect(edits((await db.audioClips.get(host.clip.id))!)).toEqual(next));
        expect(await db.audioTakes.count()).toBe(1);
        expect(await db.media.count()).toBe(1);
        expect(new Uint8Array(await (await db.media.get(host.take.mediaId))!.blob.arrayBuffer())).toEqual(Uint8Array.of(1, 2, 3));
    });

    it.each([
        {startSec: "NaN"}, {startSec: "Infinity"}, {startSec: "-0.001"},
        {trimEndSec: "8.945001"}, {trimStartSec: "8.945"},
        {gain: "-0.001"}, {gain: "4.000001"},
        {fadeInSec: "8.945001"}, {fadeOutSec: "8.945001"},
        {fadeInSec: "4.473", fadeOutSec: "4.473"},
    ])("retains business validation and leaves no partial edit/history for %j", async invalid => {
        const host = await fixture();
        for (const [key, value] of Object.entries(invalid)) host.change(key as EditKey, value);
        // Direct invocation also tests owner validation behind browser constraints.
        host.submit();
        await vi.waitFor(() => expect(host.timeline().find(node => node.props.role === "alert")).toBeDefined());
        expect(await db.audioClips.get(host.clip.id)).toEqual(host.clip);
        expect(host.history.canUndo).toBe(false);
        expect(host.history.canRedo).toBe(false);
    });
});
