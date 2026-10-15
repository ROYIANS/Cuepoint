// @vitest-environment jsdom
import {act, createElement as h} from "react";
import {createRoot} from "react-dom/client";
import {expect, it, vi} from "vitest";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {BusinessDetailsProvider, useBusinessDetails, type DetailOpenResult} from "@/app/details/BusinessDetails";

vi.mock("@tanstack/react-router", () => ({useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()})}));
vi.mock("@/features/library/ui/AssetDetailPanel", () => {throw new Error("controlled incoming chunk failure");});

it("settles failed incoming loading without retiring or removing the accepted outgoing origin", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const container = document.createElement("div"), portal = document.createElement("div");
    document.body.append(container, portal); const root = createRoot(container);
    let api!: NonNullable<ReturnType<typeof useBusinessDetails>>;
    function Controls() {api = useBusinessDetails()!; return h("textarea", {defaultValue: "retained conversation"});}
    try {
        await act(async () => {await import("@/features/video/ui/ShotDetailPanel");
            root.render(h(ContextPanelHostProvider, {target: portal, surfaceWidth: 1440, navigationWidth: 260}, h(BusinessDetailsProvider, null, h(Controls))));});
        const onEnd = vi.fn(); let first!: Promise<DetailOpenResult>;
        await act(async () => {first = api.open({kind: "shot", target: {projectId: "p", episodeId: "e", shotId: "s"}}, {origin: {token: "old", label: "返回批量审阅", onEnd}});});
        await vi.waitFor(async () => {await act(async () => {}); expect(portal.querySelector('[data-shot-detail="s"]')).not.toBeNull();});
        await expect(first).resolves.toMatchObject({status: "opened"});
        const frame = portal.querySelector("[data-shot-detail]");
        const unarmed = vi.fn(); let next!: Promise<DetailOpenResult>;
        await act(async () => {next = api.open({kind: "asset", target: {kind: "prop", owner: {kind: "studio"}, entityId: "a"}}, {origin: {token: "unarmed", label: "返回批量审阅", onEnd: unarmed}});});
        await vi.waitFor(async () => {await act(async () => {}); await expect(next).resolves.toMatchObject({status: "refused", reason: "unavailable"});});
        expect(portal.querySelector("[data-shot-detail]")).toBe(frame);
        expect(onEnd).not.toHaveBeenCalled(); expect(unarmed).not.toHaveBeenCalled();
        let result!: Promise<string>; await act(async () => {result = api.returnToOrigin("old");});
        await expect(result).resolves.toBe("returned");
        expect(onEnd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({reason: "return"}));
        expect(consoleError).toHaveBeenCalled();
    } finally {
        await act(async () => root.unmount()); container.remove(); portal.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    }
});
