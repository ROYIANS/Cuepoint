// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {UnknownCommitError} from "@/platform/storage/errors";
import type {WorldTab} from "@/features/library/queries/assetLibrary";

const host = vi.hoisted(() => ({
    scope: "project", kind: "character", rows: [] as Array<Record<string, unknown>>,
    navigate: vi.fn(), presence: vi.fn(),
    addCharacter: vi.fn(), addScene: vi.fn(), addProp: vi.fn(), addStyle: vi.fn(),
    deleteCharacter: vi.fn(), deleteScene: vi.fn(), deleteProp: vi.fn(), deleteStyle: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({useNavigate: () => host.navigate,
    Link: ({children}: {children?: ReactNode}) => h("a", {href: "#asset"}, children)}));
vi.mock("@/platform/product/queries", () => ({useProductQuery: () => host.scope === "studio"
    ? {kind: host.kind, rows: host.rows} : host.rows}));
vi.mock("@/features/library/queries/assetLibrary", async original => ({
    ...await original<typeof import("@/features/library/queries/assetLibrary")>(), readAssetPresence: host.presence,
}));
vi.mock("@/features/library/commands/assets", () => ({
    addCharacter: host.addCharacter, addScene: host.addScene, addProp: host.addProp, addStyle: host.addStyle,
    deleteCharacter: host.deleteCharacter, deleteScene: host.deleteScene, deleteProp: host.deleteProp, deleteStyle: host.deleteStyle,
}));
vi.mock("@/features/library/ui/MediaThumb", () => ({MediaPreview: () => null}));
vi.mock("@/features/video/ui/WorldSettingPanel", () => ({WorldSettingPanel: () => null}));
vi.mock("@/features/library/ui/CoverCard", () => ({
    LibraryGrid: ({children}: {children?: ReactNode}) => h("div", null, children),
    CoverCard: ({title, actions}: {title: string; actions: Array<{onSelect: () => void}>}) =>
        h("button", {onClick: actions[0].onSelect, "aria-label": `删除角色 ${title}`}, title),
}));
import {AssetLibraryPage} from "@/features/library/ui/AssetLibraryPage";
import {CharacterLibraryPage, SceneLibraryPage, PropLibraryPage, StyleLibraryPage} from "@/features/library/ui/AssetLibraryPages";
import {STUDIO_LIBRARY_ID} from "@/features/library/models/ownership";

const kinds = [
    {kind: "character", tab: "characters", label: "角色", add: host.addCharacter, remove: host.deleteCharacter, Page: CharacterLibraryPage, param: "characterId"},
    {kind: "scene", tab: "scenes", label: "场景", add: host.addScene, remove: host.deleteScene, Page: SceneLibraryPage, param: "sceneId"},
    {kind: "prop", tab: "props", label: "道具", add: host.addProp, remove: host.deleteProp, Page: PropLibraryPage, param: "propId"},
    {kind: "style", tab: "styles", label: "风格", add: host.addStyle, remove: host.deleteStyle, Page: StyleLibraryPage, param: "styleId"},
] as const;
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
}
let container: HTMLDivElement, root: Root;
async function draw(tab: WorldTab = "characters", projectId = "project") {
    await act(async () => root.render(h(AssetLibraryPage, {projectId, tab, onTabChange: vi.fn()})));
}
function button(text: string) {
    const found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent?.trim() === text);
    expect(found, `button ${text}`).toBeTruthy(); return found!;
}
async function click(text: string, twice = false) {
    const target = button(text);
    await act(async () => {target.click(); if (twice) target.click();});
}
async function openDelete() {
    const target = document.querySelector<HTMLButtonElement>('[aria-label="删除角色 目标"]');
    expect(target).toBeTruthy(); await act(async () => target!.click());
}
function row(ownerId = "project") {
    return {id: "target", projectId: ownerId, name: "目标", createdAt: "2026-10-15", updatedAt: "2026-10-15", slots: {}};
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    host.scope = "project"; host.kind = "character"; host.rows = [];
    for (const operation of kinds) {operation.add.mockReset().mockResolvedValue({id: "created", projectId: "project"}); operation.remove.mockReset().mockResolvedValue(undefined);}
    host.presence.mockReset().mockResolvedValue("present"); host.navigate.mockReset().mockResolvedValue(undefined);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("E05 actual asset collections and destructive Radix dialog", () => {
    for (const scope of ["project", "studio"]) {
        it.each(kinds)(`${scope} $kind acquires one synchronous creation intent and opens its acknowledged ID`, async ({kind, tab, label, add, Page, param}) => {
            host.scope = scope; host.kind = kind;
            const pending = deferred<{id: string}>(); add.mockReturnValueOnce(pending.promise);
            if (scope === "studio") await act(async () => root.render(h(Page)));
            else await draw(tab);
            await click(`${scope === "studio" ? "创建" : "新建"}${label}`, true);
            expect(add).toHaveBeenCalledTimes(1); expect(add).toHaveBeenCalledWith(scope === "studio" ? STUDIO_LIBRARY_ID : "project");
            expect(button("创建中…").disabled).toBe(true); expect(host.navigate).not.toHaveBeenCalled();
            await act(async () => pending.resolve({id: "acknowledged"}));
            expect(host.navigate).toHaveBeenCalledTimes(1);
            expect(host.navigate.mock.calls[0][0].to).toBe(scope === "studio" ? `/${tab}/$${param}` : `/p/$projectId/assets/${tab}/$${param}`);
            expect(host.navigate.mock.calls[0][0].params).toEqual(scope === "studio" ? {[param]: "acknowledged"} : {projectId: "project", [param]: "acknowledged"});
            expect(document.querySelector('[role="alert"]')).toBeNull();
        });
    }
    it("keeps known creation failures actionable and retains the acknowledged ID after opening fails", async () => {
        host.addCharacter.mockRejectedValueOnce(new Error("空间不足"));
        await draw(); await click("新建角色");
        expect(document.querySelector('[role="alert"]')?.textContent).toBe("空间不足");
        expect(button("新建角色").disabled).toBe(false);
        host.navigate.mockRejectedValueOnce(new Error("route unavailable"));
        await click("新建角色"); expect(host.addCharacter).toHaveBeenCalledTimes(2);
        expect(document.querySelector('[role="alert"]')?.textContent).toContain("设定已创建");
        await click("打开已创建的设定", true);
        expect(host.addCharacter).toHaveBeenCalledTimes(2); expect(host.navigate).toHaveBeenCalledTimes(2);
        expect(host.navigate.mock.calls[1][0].params.characterId).toBe("created");
    });
    it("does not navigate a departed project/kind, and the receipt can later open without another add", async () => {
        const pending = deferred<{id: string}>(); host.addCharacter.mockReturnValueOnce(pending.promise);
        await draw(); await click("新建角色"); await draw("scenes", "other");
        await act(async () => pending.resolve({id: "old-owner-created"}));
        expect(host.navigate).not.toHaveBeenCalled(); expect(button("新建场景").disabled).toBe(false);
        await draw(); await click("打开已创建的设定");
        expect(host.addCharacter).toHaveBeenCalledTimes(1);
        expect(host.navigate.mock.calls[0][0].params).toEqual({projectId: "project", characterId: "old-owner-created"});
    });
    it("offers an explicit exit from an unknown creation after the user checked the list", async () => {
        host.addCharacter.mockRejectedValueOnce(new UnknownCommitError("op", "workspace"));
        await draw(); await click("新建角色");
        expect(button("新建角色").disabled).toBe(true);
        await click("已核对列表，允许重新创建");
        expect(document.querySelector('[role="alert"]')).toBeNull(); expect(button("新建角色").disabled).toBe(false);
        expect([...document.querySelectorAll("button")].some(node => node.textContent === "已核对列表，允许重新创建")).toBe(false);
        await click("新建角色"); expect(host.addCharacter).toHaveBeenCalledTimes(2);
        expect(host.navigate).toHaveBeenCalledTimes(1);
    });
    it("quarantines unknown creation per owner/kind through tab changes and suppresses unmounted completion", async () => {
        host.addCharacter.mockRejectedValueOnce(new UnknownCommitError("op", "workspace"));
        await draw(); await click("新建角色"); expect(button("新建角色").disabled).toBe(true);
        expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
        await draw("scenes"); expect(button("新建场景").disabled).toBe(false);
        await draw(); await click("新建角色"); expect(host.addCharacter).toHaveBeenCalledTimes(1);
        await draw("scenes"); const pending = deferred<{id: string}>(); host.addScene.mockReturnValueOnce(pending.promise);
        await click("新建场景"); await act(async () => root.render(null));
        await act(async () => pending.resolve({id: "late"})); expect(host.navigate).not.toHaveBeenCalled();
    });
    it("filters held rows from another project before exposing destructive controls", async () => {
        host.rows = [row("previous-project")]; await draw();
        expect(document.querySelector('[aria-label="删除角色 目标"]')).toBeNull();
    });
    it.each(["project", "studio"])("%s keeps the actual destructive dialog mounted through delay, known failure, retry and acknowledgement", async scope => {
        host.scope = scope; host.rows = [row(scope === "studio" ? STUDIO_LIBRARY_ID : "project")];
        if (scope === "studio") await act(async () => root.render(h(CharacterLibraryPage)));
        else await draw();
        const pending = deferred<void>(); host.deleteCharacter.mockReturnValueOnce(pending.promise);
        await openDelete(); await click("删除", true);
        expect(host.deleteCharacter).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("目标");
        expect(button("删除中…").disabled).toBe(true); expect(button("取消").disabled).toBe(true);
        await act(async () => pending.reject(new Error("目标仍被引用")));
        expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("目标仍被引用");
        expect(button("删除").disabled).toBe(false);
        await click("删除"); expect(host.deleteCharacter).toHaveBeenCalledTimes(2);
        expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    });
    it("retains unknown target quarantine after cancel and exact-target inspection, without destructive replay", async () => {
        host.rows = [row()]; host.deleteCharacter.mockRejectedValueOnce(new UnknownCommitError("delete-op", "workspace"));
        await draw(); await openDelete(); await click("删除");
        expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("无法确认删除结果");
        expect([...document.querySelectorAll("button")].some(element => element.textContent === "删除")).toBe(false);
        await click("取消"); await openDelete(); await click("核对结果", true);
        expect(host.presence).toHaveBeenCalledTimes(1);
        expect(host.presence).toHaveBeenCalledWith({kind: "character", ownerId: "project", id: "target"});
        expect(host.deleteCharacter).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("仍在列表中");
        host.presence.mockResolvedValueOnce("foreign"); await click("核对结果");
        expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("归属");
        host.presence.mockRejectedValueOnce(new Error("read failed")); await click("核对结果");
        expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("暂时无法核对");
        host.presence.mockResolvedValueOnce("missing"); await click("核对结果");
        expect(document.querySelector('[role="alertdialog"]')).toBeNull(); expect(host.deleteCharacter).toHaveBeenCalledTimes(1);
        // Even a retained/stale card does not turn a disappeared row into permission to delete again.
        await openDelete(); expect(button("核对结果")).toBeTruthy(); expect(host.deleteCharacter).toHaveBeenCalledTimes(1);
    });
    it("does not let a late deletion close or label a different project dialog", async () => {
        host.rows = [row()]; const pending = deferred<void>(); host.deleteCharacter.mockReturnValueOnce(pending.promise);
        await draw(); await openDelete(); await click("删除");
        host.rows = [row("other")]; await draw("characters", "other"); await openDelete();
        await act(async () => pending.reject(new Error("old owner failure")));
        expect(document.querySelector('[role="alertdialog"]')).toBeTruthy();
        expect(document.querySelector('[role="alertdialog"]')?.textContent).not.toContain("old owner failure");
        expect(button("删除").disabled).toBe(false);
    });
});
