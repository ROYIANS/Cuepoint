import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactElement} from "react";

const host = vi.hoisted(() => ({cells: [] as unknown[], cursor: 0,
    options: undefined as undefined | {shouldBlockFn: (locations: {current: {pathname: string}; next: {pathname: string}}) => boolean; enableBeforeUnload: boolean},
    blocker: {status: "idle", proceed: vi.fn(), reset: vi.fn()},
}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    return {...react,
        useState(initial: unknown) {
            const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = initial;
            return [host.cells[index], (value: unknown) => {host.cells[index] = typeof value === "function" ? value(host.cells[index]) : value;}];
        },
        useRef(initial: unknown) {
            const index = host.cursor++;
            if (!(index in host.cells)) host.cells[index] = {current: initial};
            return host.cells[index];
        },
        useCallback: (callback: unknown) => callback,
    };
});
vi.mock("@tanstack/react-router", () => ({useBlocker: (options: typeof host.options) => {host.options = options; return host.blocker;}}));
import {useManualDraftDeparture} from "@/app/drafts/useManualDraftGuard";
import {Button} from "@/ui/button";

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}
function draw(run: () => ReturnType<typeof useManualDraftDeparture>) {host.cursor = 0; return run();}
function button(value: unknown, label: string) {return nodes(value).find(node => node.type === Button && node.props.children === label)!;}
function click(node: Node) {(node.props.onClick as () => void)();}
const locations = {current: {pathname: "/agent/thread-a"}, next: {pathname: "/agent/thread-b"}};
beforeEach(() => {
    host.cells = []; host.cursor = 0; host.blocker.status = "idle";
    host.blocker.proceed.mockClear(); host.blocker.reset.mockClear();
    vi.stubGlobal("document", {activeElement: null, querySelectorAll: () => []});
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("HTMLInputElement", class {});
    vi.stubGlobal("HTMLTextAreaElement", class {});
});

describe("E01 production departure callbacks", () => {
    it("delegates nested media pending locally while allowing an inline route draft to resolve", async () => {
        const state = {dirty: true, pending: true, routeDirty: true, routePending: false};
        const discard = vi.fn(async () => {});
        const render = () => useManualDraftDeparture(true, true, discard, {readState: () => state});
        expect(draw(render)).toBeDefined();
        expect(host.options!.shouldBlockFn(locations)).toBe(true);
        host.blocker.status = "blocked";
        expect(button(draw(render).confirmation, "放弃并离开")).toBeDefined();
        click(button(draw(render).confirmation, "放弃并离开"));
        await vi.waitFor(() => expect(host.blocker.proceed).toHaveBeenCalledOnce());
        expect(discard).toHaveBeenCalledOnce();
        host.blocker.status = "idle";
        const local = vi.fn();
        draw(render).requestDeparture(local);
        expect(button(draw(render).confirmation, "放弃并离开")).toBeUndefined();
        expect(local).not.toHaveBeenCalled();
    });
    it("delegates route state to a nested editor while retaining local owner dirty/pending protection", () => {
        const state = {dirty: true, pending: false, routeDirty: false, routePending: false};
        const leave = vi.fn();
        const render = () => useManualDraftDeparture(true, false, vi.fn(), {readState: () => state});
        const guard = draw(render);
        expect(host.options!.shouldBlockFn(locations)).toBe(false);
        expect(host.options!.enableBeforeUnload).toBe(false);
        guard.requestDeparture(leave);
        expect(leave).not.toHaveBeenCalled();
        expect(button(draw(render).confirmation, "放弃并离开")).toBeDefined();
        state.pending = true;
        expect(host.options!.shouldBlockFn(locations)).toBe(false);
        guard.requestDeparture(leave);
        expect(button(draw(render).confirmation, "放弃并离开")).toBeUndefined();
        expect(host.options!.enableBeforeUnload).toBe(false);
        state.routePending = true;
        draw(render);
        expect(host.options!.shouldBlockFn(locations)).toBe(true);
        expect(host.options!.enableBeforeUnload).toBe(true);
    });

    it("reads synchronous dirty/pending owner changes before any rerender and keeps search changes", () => {
        const state = {dirty: false, pending: false};
        const leave = vi.fn();
        const render = () => useManualDraftDeparture(false, false, vi.fn(), {readState: () => state});
        const guard = draw(render);
        expect(host.options!.shouldBlockFn(locations)).toBe(false);
        state.dirty = true;
        expect(host.options!.shouldBlockFn(locations)).toBe(true);
        expect(host.options!.shouldBlockFn({current: {pathname: "/agent/a"}, next: {pathname: "/agent/a"}})).toBe(false);
        guard.requestDeparture(leave);
        expect(leave).not.toHaveBeenCalled();
        let tree = draw(render).confirmation;
        const oldDiscard = button(tree, "放弃并离开");
        click(button(tree, "继续编辑"));
        expect(leave).not.toHaveBeenCalled();
        state.dirty = false; state.pending = true;
        guard.requestDeparture(leave);
        tree = draw(render).confirmation;
        // Even a discard callback captured when the rendered props are stale cannot leave pending work.
        expect(button(tree, "放弃并离开")).toBeUndefined();
        click(oldDiscard);
        expect(leave).not.toHaveBeenCalled();
        state.pending = false;
        draw(render).requestDeparture(leave);
        expect(leave).toHaveBeenCalledOnce();
    });

    it("freezes the initiating local request and resets a later blocked route after local discard", async () => {
        const first = vi.fn(), replacement = vi.fn(), localDiscard = vi.fn(async () => {}), ownerDiscard = vi.fn();
        const render = () => useManualDraftDeparture(true, false, ownerDiscard);
        const guard = draw(render);
        guard.requestDeparture(first, localDiscard);
        guard.requestDeparture(replacement);
        host.blocker.status = "blocked";
        click(button(draw(render).confirmation, "放弃并离开"));
        await vi.waitFor(() => expect(first).toHaveBeenCalledOnce());
        expect(localDiscard).toHaveBeenCalledOnce();
        expect(ownerDiscard).not.toHaveBeenCalled();
        expect(replacement).not.toHaveBeenCalled();
        expect(host.blocker.reset).toHaveBeenCalledOnce();
    });

    it("continues the exact local departure only after successful explicit discard; failures stay retryable", async () => {
        const discard = vi.fn().mockRejectedValueOnce(new Error("discard failed")).mockResolvedValue(undefined);
        const leave = vi.fn();
        const render = () => useManualDraftDeparture(true, false, discard);
        draw(render).requestDeparture(leave);
        click(button(draw(render).confirmation, "放弃并离开"));
        await vi.waitFor(() => expect(nodes(draw(render).confirmation).some(node => node.props.role === "alert" && node.props.children === "discard failed")).toBe(true));
        expect(leave).not.toHaveBeenCalled();
        click(button(draw(render).confirmation, "放弃并离开"));
        await vi.waitFor(() => expect(leave).toHaveBeenCalledOnce());
        expect(discard).toHaveBeenCalledTimes(2);
    });
    it("reports canceled panel replacement once and permits a later retry", () => {
        const leave = vi.fn(), cancel = vi.fn();
        const render = () => useManualDraftDeparture(true,false,vi.fn());
        draw(render).requestDeparture(leave,undefined,cancel);
        click(button(draw(render).confirmation,"继续编辑"));
        expect(cancel).toHaveBeenCalledOnce(); expect(leave).not.toHaveBeenCalled();
        draw(render).requestDeparture(leave,undefined,cancel);
        expect((draw(render).confirmation as Node).props.open).toBe(true);
        const modal = draw(render).confirmation as Node;
        (modal.props.onOpenChange as (open: boolean) => void)(false);
        expect(cancel).toHaveBeenCalledTimes(2); expect(leave).not.toHaveBeenCalled();
    });
    it("rejects a competing panel request without replacing the initiating departure", async () => {
        const first = vi.fn(), second = vi.fn(), canceled = vi.fn();
        const render = () => useManualDraftDeparture(true,false,vi.fn(async () => {}));
        draw(render).requestDeparture(first);
        draw(render).requestDeparture(second,undefined,canceled);
        expect(canceled).toHaveBeenCalledOnce();
        click(button(draw(render).confirmation,"放弃并离开"));
        await vi.waitFor(() => expect(first).toHaveBeenCalledOnce());
        expect(second).not.toHaveBeenCalled();
    });

});
