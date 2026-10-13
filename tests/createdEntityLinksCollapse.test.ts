// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {AgentToolCall} from "@/domain/agent";

vi.mock("@tanstack/react-router", () => ({
    Link: ({to, children, className}: {to: string; children?: ReactNode; className?: string}) => h("a", {href: to, className}, children),
    useNavigate: () => vi.fn(),
}));
const {CreatedEntityLinks} = await import("@/components/agent/CreatedEntityLinks");

const now = "2026-10-13T00:00:00.000Z";
function call(items: {href: string; label: string}[]): AgentToolCall {
    return {
        id: "c", runId: "r", threadId: "t", providerCallId: "c", step: 1, order: 0, name: "shot_create", title: "创建镜头",
        arguments: "{}", effect: "write", highRisk: false, status: "completed", createdAt: now, updatedAt: now,
        result: JSON.stringify({items: items.map(target => ({target}))}),
        preview: {summary: "s", changes: [], target: {href: "/p/main", label: "主"}},
    };
}
let root: Root, container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
const render = (el: ReturnType<typeof h>) => act(async () => root.render(el));

describe("CreatedEntityLinks collapseDetails", () => {
    it("folds several entity links into one collapsed detail row listing bare labels once opened", async () => {
        await render(h(CreatedEntityLinks, {call: call([{href: "/p/main", label: "主"}, {href: "/p/1", label: "镜头 1"}, {href: "/p/2", label: "镜头 2"}]), collapseDetails: true}));
        const toggle = container.querySelector<HTMLButtonElement>("button")!;
        expect(toggle.textContent).toBe("2 项明细");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        const list = document.getElementById(toggle.getAttribute("aria-controls")!)!;
        expect(list.hidden).toBe(true);
        await act(async () => toggle.click());
        expect(list.hidden).toBe(false);
        expect([...list.querySelectorAll("a")].map(a => a.textContent)).toEqual(["镜头 1", "镜头 2"]);
    });

    it("shows a single differing link directly", async () => {
        await render(h(CreatedEntityLinks, {call: call([{href: "/p/1", label: "镜头 1"}]), collapseDetails: true}));
        expect(container.querySelector("button")).toBeNull();
        expect(container.querySelector("a")?.textContent).toBe("镜头 1 ↗");
    });

    it("keeps the flat 查看 links by default (task records)", async () => {
        await render(h(CreatedEntityLinks, {call: call([{href: "/p/1", label: "镜头 1"}, {href: "/p/2", label: "镜头 2"}])}));
        expect(container.querySelector("button")).toBeNull();
        expect([...container.querySelectorAll("a")].map(a => a.textContent)).toEqual(["查看镜头 1 ↗", "查看镜头 2 ↗"]);
    });
});
