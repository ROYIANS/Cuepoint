import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {AudioProjectSnapshot} from "@/domain/audio";
import type {MusicWork} from "@/domain/music";

type HookHost = {cells: unknown[]; cursor: number};
const host = vi.hoisted(() => ({
    active: undefined as HookHost | undefined,
    invoke: vi.fn(), warning: vi.fn(), error: vi.fn(), mix: vi.fn(), musicData: undefined as unknown,
}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    return {...actual,
        useState(initial: unknown) {
            const hooks = host.active!, index = hooks.cursor++;
            if (!(index in hooks.cells)) hooks.cells[index] = typeof initial === "function" ? initial() : initial;
            return [hooks.cells[index], (next: unknown) => {
                hooks.cells[index] = typeof next === "function" ? next(hooks.cells[index]) : next;
            }];
        },
        useRef(initial: unknown) {
            const hooks = host.active!, index = hooks.cursor++;
            if (!(index in hooks.cells)) hooks.cells[index] = {current: initial};
            return hooks.cells[index];
        },
        useMemo: (compute: () => unknown) => compute(),
        useCallback: (callback: unknown) => callback,
        useEffect: () => undefined,
    };
});
vi.mock("dexie-react-hooks", () => ({useLiveQuery: (query: () => unknown) =>
    query.toString().includes("musicDrafts") ? host.musicData : []}));
vi.mock("@/lib/media", async original => ({...await original<typeof import("@/lib/media")>(), useMedia: () => undefined}));
vi.mock("@/lib/audio/exportMix", () => ({exportAudioMix: host.mix}));
vi.mock("@tauri-apps/api/core", () => ({invoke: host.invoke}));
vi.mock("sonner", () => ({toast: {warning: host.warning, error: host.error}}));

import {AudioTimeline} from "@/components/audio/AudioTimeline";
import {AudioExports} from "@/components/audio/AudioExports";
import {AudioPlayer} from "@/components/audioMusic/shared";
import {MusicWorkspacePage} from "@/components/music/MusicWorkspacePage";
import {Button} from "@/components/ui/button";
import {db} from "@/db/database";
import {addAudioClip, addAudioTake, getAudioProjectSnapshot} from "@/db/audio";
import {createAudioMusicProject} from "@/db/projects";

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join("");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return nodes(value).map(node => typeof node.props.children === "string" ? node.props.children : "").join("");
}
function draw(hooks: HookHost, render: () => unknown) {
    hooks.cursor = 0; host.active = hooks;
    return nodes(render());
}
function click(button: Node) { (button.props.onClick as () => void)(); }
const warningMessage = "文件已保存，但系统未能确认最后的保存步骤。请检查已保存的文件。";
const callerKinds = ["timeline", "exports", "player", "music"] as const;
type CallerKind = typeof callerKinds[number];

async function caller(kind: CallerKind) {
    const project = await createAudioMusicProject("保存反馈", kind === "music" ? "music" : "audio");
    const blob = new Blob([Uint8Array.of(1, 7, 255)], {type: "audio/wav"});
    const filename = "保存反馈.wav", mediaId = "save-feedback-media";
    const hooks: HookHost = {cells: [], cursor: 0};
    let render: () => Node[];
    if (kind === "music") {
        await db.media.add({id: mediaId, projectId: project.id, filename, mimeType: blob.type, blob});
        const work: MusicWork = {id: "save-feedback-work", projectId: project.id, mediaId, revision: 1,
            createdAt: project.createdAt, updatedAt: project.updatedAt, title: "原作品", notes: "保留原始笔记", lyrics: "原始歌词",
            favorite: false, durationSec: 1, sampleRate: 48_000, channels: 1};
        await db.musicWorks.add(work);
        host.musicData = {projectId: project.id, project, drafts: [], works: [work]};
        const page = MusicWorkspacePage({projectId: project.id}) as Node;
        const workspace = () => draw(hooks, () => (page.type as (props: Record<string, unknown>) => unknown)(page.props));
        click(workspace().find(node => node.type === Button && node.props["aria-label"] === "查看 原作品 详情")!);
        const detailHooks: HookHost = {cells: [], cursor: 0};
        render = workspace;
        const details = workspace().find(node => node.props.work === work)!;
        const detailTree = draw(detailHooks, () => (details.type as (props: Record<string, unknown>) => unknown)(details.props));
        const button = detailTree.find(node => node.type === Button && text(node.props.children) === "下载")!;
        return {click: () => click(button), render, blob, filename, mediaId, projectId: project.id};
    }
    const initial = await getAudioProjectSnapshot(project.id);
    const chapter = initial.chapters[0], track = initial.tracks[0];
    const take = await addAudioTake(project.id, {mediaId, name: "原声音", source: "recording", durationSec: 1, sampleRate: 48_000, channels: 1},
        {id: mediaId, projectId: project.id, filename, mimeType: blob.type, blob});
    await addAudioClip(project.id, {chapterId: chapter.id, trackId: track.id, takeId: take.id,
        startSec: 0, trimStartSec: 0, trimEndSec: 1, gain: 1, fadeInSec: 0, fadeOutSec: 0});
    const snapshot: AudioProjectSnapshot = await getAudioProjectSnapshot(project.id);
    if (kind === "timeline") {
        // Encoding/mixing has separate command tests; this test covers the actual
        // export callback and real common/native transfer through its final IPC seam.
        host.mix.mockResolvedValue({blob, filename, attenuation: 1, attenuationDb: 0});
        render = () => draw(hooks, () => AudioTimeline({projectId: project.id, projectName: project.name,
            chapterId: chapter.id, snapshot, selectedId: "", onSelect: () => undefined}));
    } else if (kind === "exports") {
        const item = {id: "saved-export", projectId: project.id, chapterId: chapter.id, revision: 1,
            createdAt: project.createdAt, updatedAt: project.updatedAt, fingerprint: "{}", format: "wav" as const,
            mediaId, durationSec: 1};
        await db.audioExports.add(item); snapshot.exports = [item];
        render = () => draw(hooks, () => AudioExports({snapshot}));
    } else render = () => draw(hooks, () => AudioPlayer({mediaId, title: take.name}));
    const button = render().find(node => node.type === Button && (kind === "player"
        ? node.props["aria-label"] === "下载原始音频"
        : text(node.props.children) === (kind === "timeline" ? "导出 WAV" : "下载")))!;
    expect(button).toBeDefined();
    expect(button.props.disabled).not.toBe(true);
    return {click: () => click(button), render, blob, filename, mediaId, projectId: project.id};
}

function transport(outcome: "publishedWithError" | "canceled" | "failure", code = "directorySync") {
    const session = "9e6fc544-f958-4c4c-a013-06fbed060bc3";
    host.invoke.mockImplementation(async (command: string, args: {request: Record<string, unknown>}) => {
        if (command === "product_save_cancel") return true;
        if (command === "product_save_begin") {
            if (outcome === "failure") throw new Error("目标文件已存在");
            return outcome === "canceled" ? {type: "canceled"} : {type: "ready", session, chunkBytes: 262_144};
        }
        if (command === "product_save_chunk") return Number(args.request.offset) + (args.request.bytes as number[]).length;
        if (command === "product_save_finish") return {type: "publishedWithError", byteLength: 3, contentHash: args.request.contentHash, code};
        throw new Error(`Unexpected test command ${command}`);
    });
}

beforeEach(() => {
    host.active = undefined; host.musicData = undefined;
    for (const mock of [host.invoke, host.warning, host.error, host.mix]) mock.mockReset();
    vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: host.invoke}, matchMedia: () => ({matches: true})});
    vi.stubGlobal("localStorage", {getItem: () => null});
});
afterEach(() => vi.unstubAllGlobals());

describe.each(callerKinds)("%s saves distinguish publication from failure", kind => {
    it.each(["directorySync", "stageCleanup"])("shows a saved-file warning for %s without retrying or changing owned media", async code => {
        transport("publishedWithError", code);
        const view = await caller(kind);
        const mediaBefore = await db.media.get(view.mediaId);
        const clipsBefore = await db.audioClips.toArray(), worksBefore = await db.musicWorks.toArray();
        view.click();
        await vi.waitFor(() => {
            if (kind === "timeline") expect(view.render().find(node => node.props.role === "status" && text(node.props.children).includes(warningMessage))).toBeDefined();
            else expect(host.warning).toHaveBeenCalledExactlyOnceWith(warningMessage);
        });
        expect(view.render().some(node => node.props.role === "alert")).toBe(false);
        expect(host.error).not.toHaveBeenCalled();
        expect(host.invoke.mock.calls.filter(([command]) => command === "product_save_begin")).toHaveLength(1);
        expect(host.invoke.mock.calls.filter(([command]) => command === "product_save_finish")).toHaveLength(1);
        expect(host.invoke.mock.calls.some(([command]) => command === "product_save_cancel")).toBe(false);
        expect(await db.media.get(view.mediaId)).toEqual(mediaBefore);
        expect(new Uint8Array(await (await db.media.get(view.mediaId))!.blob.arrayBuffer())).toEqual(Uint8Array.of(1, 7, 255));
        expect(await db.audioClips.toArray()).toEqual(clipsBefore);
        expect(await db.musicWorks.toArray()).toEqual(worksBefore);
        if (kind === "timeline") expect(host.mix).toHaveBeenCalledOnce();
    });

    it("retains an unpublished failure as an error without treating it as saved", async () => {
        transport("failure");
        const view = await caller(kind); view.click();
        await vi.waitFor(() => {
            if (kind === "player") expect(host.error).toHaveBeenCalledExactlyOnceWith("目标文件已存在");
            else expect(view.render().find(node => node.props.role === "alert" && text(node.props.children).includes("目标文件已存在"))).toBeDefined();
        });
        expect(host.warning).not.toHaveBeenCalled();
        expect(host.invoke.mock.calls.filter(([command]) => command === "product_save_begin")).toHaveLength(1);
        expect(host.invoke.mock.calls.some(([command]) => command === "product_save_finish")).toBe(false);
    });

    it("keeps cancellation separate from published warning and performs no transfer", async () => {
        transport("canceled");
        const view = await caller(kind); view.click();
        await vi.waitFor(() => expect(host.invoke.mock.calls.some(([command]) => command === "product_save_cancel")).toBe(true));
        expect(host.warning).not.toHaveBeenCalled(); expect(host.error).not.toHaveBeenCalled();
        expect(view.render().some(node => node.props.role === "alert")).toBe(false);
        expect(host.invoke.mock.calls.filter(([command]) => command === "product_save_begin")).toHaveLength(1);
        expect(host.invoke.mock.calls.some(([command]) => command === "product_save_chunk" || command === "product_save_finish")).toBe(false);
        expect(await db.media.get(view.mediaId)).toBeDefined();
        if (kind === "timeline") expect(view.render().find(node => node.props.role === "status" && text(node.props.children).includes("已取消另存文件"))).toBeDefined();
    });
});
