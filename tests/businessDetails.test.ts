// @vitest-environment jsdom
import {act, createElement as h, type ReactNode, StrictMode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {createProject} from "@/features/projects/commands/projects";
import {addShot} from "@/features/video/commands/shots";
import {addCharacter} from "@/features/library/commands/assets";
import {assetDetailHref} from "@/features/library/models/assetDetailTarget";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {BusinessDetailsProvider, useBusinessDetails, type BusinessDetailTarget, type DetailOpenResult, type DetailReturnOrigin} from "@/app/details/BusinessDetails";
import {ShotDetailLink, ShotDetailsProvider} from "@/app/details/ShotDetails";

vi.mock("@tanstack/react-router", () => ({
    useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()}),
    Link: ({to, children, ...props}: {to: string; children?: ReactNode}) => h("a", {href: to, ...props}, children),
}));
let root: Root, container: HTMLDivElement, portal: HTMLDivElement;
let api: NonNullable<ReturnType<typeof useBusinessDetails>>;
let shot: BusinessDetailTarget, second: BusinessDetailTarget, asset: BusinessDetailTarget;
function Controls() {
    api = useBusinessDetails()!;
    return h("main", null, h("textarea", {"aria-label": "conversation", defaultValue: "retained composition"}),
        h(ShotDetailLink, {href: asset.kind === "asset" ? assetDetailHref(asset.target) : ""}, "Inspect asset"),
        h(ShotDetailLink, {href: asset.kind === "asset" ? assetDetailHref(asset.target) : "", download: "asset"}, "Download asset"),
        h(ShotDetailLink, {href: asset.kind === "asset" ? assetDetailHref(asset.target) : "", target: shot.kind === "shot" ? shot.target : undefined}, "Mismatched asset"),
        h(ShotDetailLink, {href: asset.kind === "asset" ? assetDetailHref(asset.target) : "", onClick: event => event.preventDefault()}, "Cancelled asset"),
        h(ShotDetailLink, {href: "/p/p", onClick: event => event.preventDefault()}, "Continue project"));
}
function Fixture({width = 1440, delegate = false}: {width?: number; delegate?: boolean}) {
    return h(ContextPanelHostProvider, {target: portal, surfaceWidth: width, navigationWidth: 260},
        h(delegate ? ShotDetailsProvider : BusinessDetailsProvider, null, h(Controls)));
}
async function settle(check: () => void) {await vi.waitFor(async () => {await act(async () => {}); check();});}
async function open(target: BusinessDetailTarget, origin?: DetailReturnOrigin) {
    let result!: Promise<DetailOpenResult>;
    await act(async () => {result = api.open(target, {origin});});
    return {result};
}
async function click(label: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === label || node.getAttribute("aria-label") === label);
    expect(button, label).toBeTruthy(); await act(async () => button!.click());
}
async function invalidDuration() {
    const input = portal.querySelector<HTMLInputElement>('[aria-label="时长（秒）"]')!;
    expect(input).toBeTruthy();
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "invalid");
        input.dispatchEvent(new Event("input", {bubbles: true}));
    });
    return input;
}
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    await act(async () => {await Promise.all([import("@/features/video/ui/ShotDetailPanel"), import("@/features/library/ui/AssetDetailPanel")]);});
    const project = await createProject("Composition");
    const episode = await db.episodes.where("projectId").equals(project.id).first();
    if (!episode) throw new Error("missing episode");
    const a = await addShot(project.id, episode.id), b = await addShot(project.id, episode.id);
    const character = await addCharacter(project.id);
    shot = {kind: "shot", target: {projectId: project.id, episodeId: episode.id, shotId: a.id}};
    second = {kind: "shot", target: {projectId: project.id, episodeId: episode.id, shotId: b.id}};
    asset = {kind: "asset", target: {kind: "character", owner: {kind: "project", projectId: project.id}, entityId: character.id}};
    container = document.createElement("div"); portal = document.createElement("div"); document.body.append(container, portal);
    root = createRoot(container); await act(async () => root.render(h(Fixture)));
});
afterEach(async () => {await act(async () => root.unmount()); container.remove(); portal.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe("actual finite detail composition and origin lifecycle", () => {
    it("acknowledges the committed loading frame and returns only after guarded removal", async () => {
        vi.spyOn(db, "observe").mockImplementation(() => () => {});
        const composer = container.querySelector("textarea")!; composer.scrollTop = 31;
        const onEnd = vi.fn(() => expect(portal.querySelector("[data-shot-detail]")).toBeNull());
        const opening = await open(shot, {token: "review-a", label: "返回批量审阅", onEnd});
        await expect(opening.result).resolves.toMatchObject({status: "opened"});
        expect(portal.querySelector("[data-shot-detail]")).not.toBeNull();
        expect(portal.textContent).toContain("正在读取镜头");
        const back = [...portal.querySelectorAll("button")].find(button => button.textContent === "返回批量审阅")!;
        expect(back.closest("[hidden]")).toBeNull(); expect(onEnd).not.toHaveBeenCalled();
        let returning!: Promise<string>; await act(async () => {returning = api.returnToOrigin("review-a");});
        await expect(returning).resolves.toBe("returned");
        expect(onEnd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({token: "review-a", reason: "return"}));
        expect(container.querySelector("textarea")).toBe(composer); expect(composer.scrollTop).toBe(31);
        await expect(api.returnToOrigin("review-a")).resolves.toBe("stale");
        const normalEnd = vi.fn(() => expect(portal.querySelector("[data-shot-detail]")).toBeNull());
        await (await open(shot, {token: "normal-close", label: "返回批量审阅", onEnd: normalEnd})).result;
        await click("关闭");
        expect(normalEnd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({reason: "close"}));
    });
    it("preserves the outgoing dirty owner on same-family and cross-family refusal, then retires it after replacement", async () => {
        const onEnd = vi.fn(() => {
            expect(portal.querySelector("[data-shot-detail]")).toBeNull();
            expect(portal.querySelector("[data-asset-detail]")).not.toBeNull();
        });
        await expect((await open(shot, {token: "old", label: "返回批量审阅", onEnd})).result).resolves.toMatchObject({status: "opened"});
        await settle(() => expect(portal.querySelector('[aria-label="时长（秒）"]')).not.toBeNull());
        const input = await invalidDuration();
        const sameFamily = await open(second);
        await click("继续编辑"); await expect(sameFamily.result).resolves.toMatchObject({status: "refused", reason: "guard"});
        expect(portal.querySelector('[aria-label="时长（秒）"]')).toBe(input);
        const incomingEnd = vi.fn();
        const incoming = await open(asset, {token: "unarmed", label: "返回批量审阅", onEnd: incomingEnd});
        await settle(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
        await expect(api.open(second)).resolves.toMatchObject({status: "refused", reason: "busy"});
        expect(portal.querySelector('[aria-label="时长（秒）"]')).toBe(input);
        await click("继续编辑"); await expect(incoming.result).resolves.toMatchObject({status: "refused", reason: "guard"});
        expect(input.value).toBe("invalid"); expect(onEnd).not.toHaveBeenCalled(); expect(incomingEnd).not.toHaveBeenCalled();
        const accepted = await open(asset); await click("放弃并离开");
        await expect(accepted.result).resolves.toMatchObject({status: "opened"});
        await settle(() => expect(onEnd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({token: "old", reason: "replaced"})));
        await expect(api.returnToOrigin("old")).resolves.toBe("stale");
    });
    it("keeps same-target editor DOM when origin changes and guards explicit return without losing its token", async () => {
        const oldEnd = vi.fn(), newEnd = vi.fn(() => expect(portal.querySelector("[data-shot-detail]")).toBeNull());
        await (await open(shot, {token: "first", label: "返回第一批", onEnd: oldEnd})).result;
        await settle(() => expect(portal.querySelector('[aria-label="时长（秒）"]')).not.toBeNull());
        const input = await invalidDuration();
        await (await open(shot, {token: "second", label: "返回第二批", onEnd: newEnd})).result;
        expect(portal.querySelector('[aria-label="时长（秒）"]')).toBe(input);
        expect(oldEnd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({reason: "replaced"}));
        await expect(api.returnToOrigin("first")).resolves.toBe("stale");
        let returning!: Promise<string>; await act(async () => {returning = api.returnToOrigin("second");});
        await click("继续编辑"); await expect(returning).resolves.toBe("refused");
        expect(newEnd).not.toHaveBeenCalled(); expect(input.value).toBe("invalid");
        await act(async () => root.render(h(Fixture, {width: 760})));
        const back = [...portal.querySelectorAll("button")].find(button => button.textContent === "返回第二批")!;
        expect(back.closest("[hidden]")).toBeNull();
        await act(async () => back.click()); await click("放弃并离开");
        expect(newEnd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({reason: "return"}));
    });
    it("keeps a pending registration across StrictMode setup replay without a false return", async () => {
        await act(async () => root.render(h(StrictMode, null, h(Fixture))));
        const onEnd = vi.fn();
        await (await open(shot, {token: "mounted", label: "返回批量审阅", onEnd})).result;
        await settle(() => expect(portal.querySelector('[aria-label="时长（秒）"]')).not.toBeNull());
        await invalidDuration(); const pending = await open(asset);
        await settle(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
        const settled = vi.fn(); void pending.result.then(settled);
        await act(async () => {await Promise.resolve();});
        expect(settled).not.toHaveBeenCalled();
        await click("继续编辑");
        await expect(pending.result).resolves.toMatchObject({status: "refused", reason: "guard"});
        expect(onEnd).not.toHaveBeenCalled();
        expect(portal.querySelector('[aria-label="时长（秒）"]')).not.toBeNull();
    });
    it("settles a pending open on real provider teardown without returning the origin", async () => {
        const onEnd = vi.fn();
        await (await open(shot, {token: "mounted", label: "返回批量审阅", onEnd})).result;
        await settle(() => expect(portal.querySelector('[aria-label="时长（秒）"]')).not.toBeNull());
        await invalidDuration(); const pending = await open(asset);
        await settle(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
        await act(async () => root.render(null));
        await expect(pending.result).resolves.toMatchObject({status: "refused", reason: "superseded"});
        expect(onEnd).not.toHaveBeenCalled();
        const returnedAfterTeardown = vi.fn();
        await act(async () => {void api.returnToOrigin("mounted").then(returnedAfterTeardown);});
        expect(returnedAfterTeardown).toHaveBeenCalledExactlyOnceWith("stale");
        expect(onEnd).not.toHaveBeenCalled();
    });
    it("widens existing link delegates while preserving caller cancellation, modifiers and real hrefs", async () => {
        await act(async () => root.render(h(Fixture, {delegate: true})));
        const link = [...container.querySelectorAll("a")].find(node => node.textContent === "Inspect asset")!;
        expect(link.getAttribute("href")).toBe(asset.kind === "asset" ? assetDetailHref(asset.target) : "");
        const observed: boolean[] = [];
        const suppressNavigation = (event: Event) => {observed.push(event.defaultPrevented); event.preventDefault();};
        document.addEventListener("click", suppressNavigation);
        try {
            for (const options of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}]) {
                await act(async () => link.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, ...options})));
                expect(portal.querySelector("[data-asset-detail]")).toBeNull();
            }
            expect(observed).toEqual([false, false, false, false, false]);
            for (const label of ["Download asset", "Mismatched asset", "Cancelled asset"]) {
                const fallback = [...container.querySelectorAll("a")].find(node => node.textContent === label)!;
                await act(async () => fallback.click());
                expect(portal.querySelector("[data-asset-detail]")).toBeNull();
            }
            expect(observed.slice(-3)).toEqual([false, false, true]);
            await act(async () => link.click());
            await settle(() => expect(portal.querySelector("[data-asset-detail]")).not.toBeNull());
            expect(observed.at(-1)).toBe(true);
            await click("关闭");
            const workflow = [...container.querySelectorAll("a")].find(node => node.textContent === "Continue project")!;
            await act(async () => workflow.click());
            expect(portal.querySelector("[data-asset-detail]")).toBeNull();
        } finally {document.removeEventListener("click", suppressNavigation);}
    });
});
