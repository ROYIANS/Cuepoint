import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {BinaryContent} from "@/domain/binary";
import type {MediaRecord} from "@/domain/types";
import {mountedHookHost} from "./helpers/mountedHookHost";

const host = vi.hoisted(() => ({hooks: undefined as ReturnType<typeof mountedHookHost> | undefined, create: vi.fn(), availability: vi.fn(), query: vi.fn()}));
vi.mock("react", async original => ({...await original<typeof import("react")>(), useState: (initial: unknown) => host.hooks!.useState(initial), useRef: (initial: unknown) => host.hooks!.useRef(initial), useEffect: (effect: () => unknown, deps?: readonly unknown[]) => host.hooks!.useEffect(effect, deps)}));
vi.mock("@/lib/storage/hooks", () => ({useProductQuery: host.query}));
vi.mock("@/lib/storage/binary", async original => {
    const actual = await original<typeof import("@/lib/storage/binary")>();
    return {...actual, createBinaryObjectUrl: host.create, binaryAvailability: (binary: BinaryContent, signal?: AbortSignal) => binary instanceof Blob ? actual.binaryAvailability(binary, signal) : host.availability(binary, signal)};
});
import {registerBinaryReference} from "@/lib/storage/codec";
import {useBinaryPreview} from "@/lib/media";
import {MediaPreview} from "@/components/media/MediaThumb";
import {MaterialPreview} from "@/components/studio/materials/MaterialPreview";
import {SourcePlayer} from "@/components/audioMusic/controls";

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;return [node, ...nodes(node.props.children)];
}
function ref(id: number, mimeType = "image/png") {
    return registerBinaryReference({version: 1, workspaceId: "11111111-1111-4111-8111-111111111111", binaryId: `22222222-2222-4222-8222-${String(id).padStart(12, "0")}`, byteLength: 4, contentHash: "a".repeat(64), mimeType});
}
function deferred<T>() {let resolve!: (value: T) => void;const promise = new Promise<T>(yes => {resolve = yes;});return {promise, resolve};}
let releases: ReturnType<typeof vi.fn>[];
beforeEach(() => {
    host.hooks = mountedHookHost();host.create.mockReset();host.availability.mockReset();host.query.mockReset();releases = [];
    host.create.mockImplementation(async () => {const release = vi.fn();releases.push(release);return {url: `blob:verified-${releases.length}`, release};});
    host.availability.mockResolvedValue("ready");
    vi.stubGlobal("window", {addEventListener: vi.fn(), removeEventListener: vi.fn()});
    vi.stubGlobal("document", {addEventListener: vi.fn(), removeEventListener: vi.fn()});
});
afterEach(() => {host.hooks?.unmount();vi.unstubAllGlobals();vi.restoreAllMocks();});

/** Production hook/element callbacks with mounted dependency cleanup. Actual
 * file/symlink/IPC checks are in nativeBinaryProduct, not fabricated here. */
describe("current binary preview failure lifecycle", () => {
    it.each(["image/png", "video/mp4"])("rechecks a mounted %s media element and preserves the missing logical row", async mimeType => {
        const binary = ref(1, mimeType);
        const record: MediaRecord = {id: "owned-media", projectId: "project", mimeType, filename: "owned", blob: binary};
        host.query.mockReturnValue(record);
        const render = () => host.hooks!.render(() => MediaPreview({mediaId: record.id}));
        render();
        await vi.waitFor(() => expect((render() as Node).type).toBe(mimeType.startsWith("image/") ? "img" : "video"));
        const element = render() as Node;
        host.availability.mockResolvedValue("missing");
        (element.props.onError as () => void)();(element.props.onError as () => void)();
        await vi.waitFor(() => expect((render() as Node).props.children).toBe("素材已丢失"));
        expect(host.availability).toHaveBeenCalledExactlyOnceWith(binary, expect.any(AbortSignal));
        expect(releases[0]).toHaveBeenCalledOnce();
        expect(host.query()).toBe(record);
        host.hooks!.unmount();expect(releases[0]).toHaveBeenCalledOnce();
    });
    it("routes a material img error through the same corrupt status callback and releases its URL", async () => {
        const binary = ref(2);
        const payload = {type: "file" as const, filename: "snapshot.png", mimeType: "image/png", blob: binary};
        const render = () => nodes(host.hooks!.render(() => MaterialPreview({payload, inspect: true})));
        render();
        await vi.waitFor(() => expect(render().find(node => node.type === "img")).toBeDefined());
        const img = render().find(node => node.type === "img")!;
        host.availability.mockResolvedValue("corrupt");
        (img.props.onError as () => void)();
        await vi.waitFor(() => expect(render().find(node => node.props.role === "alert")?.props.children).toBe("素材内容已损坏，无法预览"));
        expect(releases[0]).toHaveBeenCalledOnce();expect(payload.blob).toBe(binary);
    });
    it("keeps a present but unsupported/decode-failed Blob as preview error rather than claiming missing", async () => {
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:present-unsupported");
        const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        const blob = new Blob(["not a real video"], {type: "video/mp4"});
        const render = () => host.hooks!.render(() => useBinaryPreview(blob));
        render();const ready = render();expect(ready.status).toBe("ready");
        if (ready.status !== "ready") throw new Error("Expected ready URL");
        ready.onError();
        await vi.waitFor(() => expect(render()).toEqual({status: "error"}));
        expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:present-unsupported");
        expect(host.availability).not.toHaveBeenCalled();
    });
    it("ignores an old URL error and a late availability result after another binary is selected", async () => {
        const a = ref(3), b = ref(4), check = deferred<"missing">();
        let selected = a;
        const render = () => host.hooks!.render(() => useBinaryPreview(selected));
        render();await vi.waitFor(() => expect(render().status).toBe("ready"));
        const old = render();if (old.status !== "ready") throw new Error("Expected initial URL");
        host.availability.mockReturnValue(check.promise);old.onError();
        selected = b;render();await vi.waitFor(() => expect(render()).toMatchObject({status: "ready", url: "blob:verified-2"}));
        old.onError();check.resolve("missing");await Promise.resolve();
        expect(render()).toMatchObject({status: "ready", url: "blob:verified-2"});
        expect(releases[0]).toHaveBeenCalledOnce();expect(releases[1]).not.toHaveBeenCalled();
        expect(host.availability).toHaveBeenCalledOnce();
        const latest = render();if (latest.status !== "ready") throw new Error("Expected replacement URL");
        host.hooks!.unmount();latest.onError();
        expect(host.availability).toHaveBeenCalledOnce();expect(releases[1]).toHaveBeenCalledOnce();
    });
    it("chains the SourcePlayer audio event while a stale source event cannot change the replacement player", () => {
        const first = vi.fn(), second = vi.fn();
        let src = "blob:first", callback = first;
        const render = () => nodes(host.hooks!.render(() => SourcePlayer({src, title: "audition", onError: callback})));
        const old = render().find(node => node.type === "audio")!;
        src = "blob:second";callback = second;render();
        (old.props.onError as () => void)();expect(first).not.toHaveBeenCalled();
        expect(render().find(node => node.props.role === "alert")).toBeUndefined();
        (render().find(node => node.type === "audio")!.props.onError as () => void)();
        expect(second).toHaveBeenCalledOnce();
        expect(render().find(node => node.props.role === "alert")?.props.children).toBe("此音频无法播放，请检查文件格式或重新导入。");
    });
});
