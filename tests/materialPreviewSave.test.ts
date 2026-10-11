import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import type {MaterialPayload} from "@/domain/materials";

const host = vi.hoisted(() => ({
    cells: [] as unknown[], cursor: 0,
    save: vi.fn(), success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(),
}));
vi.mock("react", async original => {
    const actual = await original<typeof import("react")>();
    return {...actual,
        useState(initial: unknown) {
            const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = initial;
            return [host.cells[index], (next: unknown) => { host.cells[index] = next; }];
        },
        useRef(initial: unknown) {
            const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useEffect: () => undefined,
    };
});
vi.mock("@/lib/runtimeSave", async original => ({...await original<typeof import("@/lib/runtimeSave")>(), downloadBlob: host.save}));
vi.mock("@/lib/media", async original => ({...await original<typeof import("@/lib/media")>(), useBinaryPreview: (_binary: unknown, enabled: boolean) => enabled ? {status: "ready", url: "blob:original-preview", onError: vi.fn()} : {status: "empty"}}));
vi.mock("sonner", () => ({toast: {success: host.success, info: host.info, error: host.error, warning: host.warning}}));

import {MaterialPreview} from "@/components/studio/materials/MaterialPreview";
import {Button} from "@/components/ui/button";

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function render(payload: MaterialPayload, inspect = true) {
    host.cursor = 0;
    return nodes(MaterialPreview({payload, inspect}));
}
function action(tree: Node[]) { return tree.find(node => node.type === Button)!; }
function click(node: Node) { (node.props.onClick as () => void)(); }
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
}
const payload = (): MaterialPayload => ({type: "file", filename: "原始素材.png", mimeType: "image/png", blob: new Blob([Uint8Array.of(0, 255, 3)], {type: "image/png"})});

beforeEach(() => {
    host.cells = []; host.cursor = 0;
    host.save.mockReset();
    for (const feedback of [host.success, host.info, host.error, host.warning]) feedback.mockReset();
    vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
});
afterEach(() => vi.unstubAllGlobals());

describe("material original-file save caller", () => {
    it("awaits the common native Save boundary with original bytes/name, blocks same-tick duplicates and reports only confirmed publication", async () => {
        const file = payload(), pending = deferred<"saved">();
        host.save.mockReturnValue(pending.promise);
        const firstAction = action(render(file));
        click(firstAction);
        click(firstAction);
        await vi.waitFor(() => expect(host.save).toHaveBeenCalledExactlyOnceWith(file.blob, file.filename));
        expect(action(render(file)).props).toMatchObject({disabled: true, children: "正在保存原文件…"});
        expect(host.success).not.toHaveBeenCalled();
        pending.resolve("saved");
        await vi.waitFor(() => expect(host.success).toHaveBeenCalledExactlyOnceWith("原文件已保存"));
        expect(action(render(file)).props.disabled).toBe(false);
        expect(host.info).not.toHaveBeenCalled();
        expect(host.error).not.toHaveBeenCalled();
    });

    it("reports cancellation without success and permits an explicit later retry", async () => {
        const file = payload();
        host.save.mockResolvedValueOnce("canceled").mockResolvedValueOnce("saved");
        click(action(render(file)));
        await vi.waitFor(() => expect(host.info).toHaveBeenCalledExactlyOnceWith("已取消保存原文件"));
        expect(host.success).not.toHaveBeenCalled();
        expect(action(render(file)).props.disabled).toBe(false);
        click(action(render(file)));
        await vi.waitFor(() => expect(host.success).toHaveBeenCalledExactlyOnceWith("原文件已保存"));
        expect(host.save).toHaveBeenCalledTimes(2);
    });

    it.each([false, true])("distinguishes unpublished failure from published finalization warning (%s) and clears pending", async published => {
        const file = payload();
        const error = Object.assign(new Error(published ? "文件已保存，但目录同步未确认" : "目标文件已存在"), {published});
        host.save.mockRejectedValue(error);
        click(action(render(file)));
        await vi.waitFor(() => {
            if (published) expect(host.warning).toHaveBeenCalledExactlyOnceWith(error.message);
            else expect(host.error).toHaveBeenCalledExactlyOnceWith(`保存原文件失败：${error.message}`);
        });
        expect(host.success).not.toHaveBeenCalled();
        expect(host.info).not.toHaveBeenCalled();
        expect(action(render(file)).props.disabled).toBe(false);
        expect(published ? host.error : host.warning).not.toHaveBeenCalled();
    });

    it("preserves browser anchor download and does not add a download action to a collection preview", () => {
        vi.stubGlobal("window", {});
        const file = payload();
        const tree = render(file);
        expect(tree.find(node => node.type === "a")?.props).toMatchObject({href: "blob:original-preview", download: file.filename, children: "下载原文件"});
        expect(action(tree)).toBeUndefined();
        expect(render(file, false).some(node => node.type === "a")).toBe(false);
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}});
        expect(action(render(file, false))).toBeUndefined();
        expect(host.save).not.toHaveBeenCalled();
    });
});
