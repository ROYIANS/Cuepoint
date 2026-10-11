import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";
import {printStoryboard} from "@/lib/runtimePrint";
import {StoryboardPrintPage} from "@/components/produce/StoryboardPrintPage";
import {Button} from "@/components/ui/button";
import {emptyEpisode, emptyProject} from "@/db/productionRecords";

const native = vi.hoisted(() => ({invoke: vi.fn(), error: vi.fn(), success: vi.fn(), queryIndex: 0, rows: [] as unknown[]}));
vi.mock("@tauri-apps/api/core", () => ({invoke: native.invoke}));
vi.mock("dexie-react-hooks", () => ({useLiveQuery: () => native.rows[native.queryIndex++]}));
vi.mock("@/lib/useShotMedia", () => ({useShotMedia: () => new Map()}));
vi.mock("sonner", () => ({toast: {error: native.error, success: native.success}}));

beforeEach(() => { native.invoke.mockReset(); native.error.mockReset(); native.success.mockReset(); native.queryIndex = 0; native.rows = []; });
afterEach(() => vi.unstubAllGlobals());

describe("storyboard host print boundary", () => {
    it("keeps the browser's user-initiated print behavior without native dispatch", async () => {
        const print = vi.fn();
        vi.stubGlobal("window", {print});
        await expect(printStoryboard()).resolves.toBeUndefined();
        expect(print).toHaveBeenCalledOnce();
        expect(native.invoke).not.toHaveBeenCalled();
    });

    it("propagates a browser print failure", async () => {
        const error = new Error("browser print unavailable");
        vi.stubGlobal("window", {print: () => { throw error; }});
        await expect(printStoryboard()).rejects.toBe(error);
        expect(native.invoke).not.toHaveBeenCalled();
    });

    it("waits for the fixed native command instead of declaring a queued operation printed", async () => {
        const print = vi.fn();
        vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}, print});
        let open: (() => void) | undefined;
        native.invoke.mockImplementation(() => new Promise<void>(resolve => { open = resolve; }));
        let settled = false;
        const pending = printStoryboard().then(() => { settled = true; });
        await vi.waitFor(() => expect(native.invoke).toHaveBeenCalledExactlyOnceWith("product_print_storyboard"));
        expect(settled).toBe(false);
        open!();
        await pending;
        expect(settled).toBe(true);
        expect(print).not.toHaveBeenCalled();
    });

    it.each([new Error("native dialog unavailable"), {code: "caller", message: "Only the bundled main window is trusted"}])(
        "propagates native errors without falling back to default portrait print", async error => {
            const print = vi.fn();
            vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}, print});
            native.invoke.mockRejectedValue(error);
            await expect(printStoryboard()).rejects.toBe(error);
            expect(native.invoke).toHaveBeenCalledExactlyOnceWith("product_print_storyboard");
            expect(print).not.toHaveBeenCalled();
        },
    );
});

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function clickActualPrint() {
    const project = emptyProject("原生打印"), episode = emptyEpisode(project.id, 1);
    native.rows = [
        {projectId: project.id, project}, {projectId: project.id, episodeId: episode.id, episode},
        {projectId: project.id, episodeId: episode.id, shots: []},
        {projectId: project.id, characters: [], scenes: []}, {projectId: project.id, props: [], styles: []},
    ];
    const wrapper = StoryboardPrintPage({projectId: project.id, episodeId: episode.id}) as Node;
    const content = (wrapper.type as (props: Record<string, unknown>) => unknown)(wrapper.props);
    const button = nodes(content).find(node => node.type === Button && typeof node.props.onClick === "function");
    if (!button) throw new Error("Loaded storyboard print button is missing");
    (button.props.onClick as () => void)();
}

describe("actual shared storyboard print control", () => {
    it("routes a loaded browser storyboard through the original print dialog", async () => {
        const print = vi.fn(); vi.stubGlobal("window", {print});
        clickActualPrint();
        await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
        expect(native.invoke).not.toHaveBeenCalled();
        expect(native.error).not.toHaveBeenCalled(); expect(native.success).not.toHaveBeenCalled();
    });

    it("opens native print without treating dialog initiation as printed success", async () => {
        const print = vi.fn(); vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}, print});
        native.invoke.mockResolvedValue(undefined);
        clickActualPrint();
        await vi.waitFor(() => expect(native.invoke).toHaveBeenCalledExactlyOnceWith("product_print_storyboard"));
        expect(print).not.toHaveBeenCalled();
        expect(native.error).not.toHaveBeenCalled(); expect(native.success).not.toHaveBeenCalled();
    });

    it("shows a safe dispatch error without default-print fallback or success feedback", async () => {
        const print = vi.fn(); vi.stubGlobal("window", {__TAURI_INTERNALS__: {invoke: vi.fn()}, print});
        native.invoke.mockRejectedValue({code: "print", message: "native system failure"});
        clickActualPrint();
        await vi.waitFor(() => expect(native.error).toHaveBeenCalledExactlyOnceWith("无法打开打印窗口，请重试。"));
        expect(native.invoke).toHaveBeenCalledExactlyOnceWith("product_print_storyboard");
        expect(print).not.toHaveBeenCalled(); expect(native.success).not.toHaveBeenCalled();
    });
});
