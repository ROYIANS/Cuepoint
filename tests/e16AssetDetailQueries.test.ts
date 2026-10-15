// @vitest-environment jsdom
import {act, createElement as h, type ReactNode} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {TABLE_NAMES} from "@/platform/storage/schema";
import type {StoreObserver, StoreTx} from "@/platform/storage/types";
import {createProject} from "@/features/projects/commands/projects";
import {addCharacter, addScene, addProp, addStyle} from "@/features/library/commands/assets";
import {STUDIO_LIBRARY_ID} from "@/features/library/models/ownership";
import type {AssetDetailTarget} from "@/features/library/models/assetDetailTarget";
import {AssetDetailPanel} from "@/features/library/ui/AssetDetailPanel";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {flushPendingDrafts} from "@/platform/product/drafts";

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
    useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()}),
    Link: ({to, children, ...props}: {to: string; children?: ReactNode}) => h("a", {href: to, ...props}, children),
}));

type Read = {query: (tx: StoreTx) => unknown | Promise<unknown>; observer: StoreObserver<unknown>; stopped: boolean};
let root: Root, container: HTMLDivElement, portal: HTMLDivElement;
let reads: Read[], projectId: string, requestNumber: number;
const add = {character: addCharacter, scene: addScene, prop: addProp, style: addStyle};
const label = {character: "角色", scene: "场景", prop: "道具", style: "风格"};
const closed = vi.fn(), outcomes = vi.fn();
function render(target: AssetDetailTarget) {
    const id = `request-${++requestNumber}`;
    return act(async () => root.render(h(ContextPanelHostProvider, {target: portal, surfaceWidth: 1440, navigationWidth: 260},
        h(AssetDetailPanel, {request: {id, target}, onRequestOutcome: outcomes, onClosed: closed}))));
}
async function createTarget(kind: AssetDetailTarget["kind"] = "character", owner: AssetDetailTarget["owner"] = {kind: "project", projectId}) {
    const asset = await add[kind](owner.kind === "project" ? owner.projectId : STUDIO_LIBRARY_ID);
    return {asset, target: {kind, owner, entityId: asset.id} satisfies AssetDetailTarget};
}
async function publish(read: Read, value?: unknown) {
    const result = value ?? await db.transaction("r", TABLE_NAMES, read.query);
    await act(async () => read.observer.next(result));
    return result;
}
async function click(text: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === text)!;
    expect(button, text).toBeTruthy(); await act(async () => button.click());
}
function nameInput() {return portal.querySelector<HTMLInputElement>('[data-asset-text$=":name"] input')!;}
function type(input: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", {bubbles: true}));
}
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    projectId = (await createProject("Asset reads")).id;
    reads = []; requestNumber = 0; outcomes.mockClear(); closed.mockClear();
    vi.spyOn(db, "observe").mockImplementation((query, observer) => {
        const read = {query, observer: observer as StoreObserver<unknown>, stopped: false}; reads.push(read);
        return () => {read.stopped = true;};
    });
    container = document.createElement("div"); portal = document.createElement("div");
    document.body.append(container, portal); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    await flushPendingDrafts(projectId); await flushPendingDrafts(STUDIO_LIBRARY_ID);
    container.remove(); portal.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe.each((["character", "scene", "prop", "style"] as const).flatMap(kind =>
    (["project", "studio"] as const).map(ownerKind => ({kind, ownerKind}))))("owned $ownerKind $kind detail query", ({kind, ownerKind}) => {
    it("reads the exact owned table row and rejects the same ID under the other owner", async () => {
        const owner: AssetDetailTarget["owner"] = ownerKind === "project" ? {kind: "project", projectId} : {kind: "studio"};
        const {target, asset} = await createTarget(kind, owner);
        await render(target);
        expect(portal.textContent).toContain(`正在读取${label[kind]}`);
        // Presentation acknowledges connected owned loading DOM, before the held read.
        expect(outcomes).toHaveBeenCalledWith({requestId: "request-1", status: "presented"});
        const first = reads[0];
        const result = await publish(first);
        expect(result).toMatchObject({value: {kind, asset: {id: asset.id, projectId: asset.projectId}}});
        expect(portal.querySelector("[data-asset-editor]")?.getAttribute("data-asset-editor")).toBe(asset.id);
        expect(nameInput().value).toBe(asset.name);
        const otherOwner: AssetDetailTarget["owner"] = ownerKind === "project" ? {kind: "studio"} : {kind: "project", projectId};
        await render({...target, owner: otherOwner});
        expect(first.stopped).toBe(true);
        expect(portal.querySelector("[data-asset-editor]")).toBeNull();
        await publish(reads.at(-1)!);
        expect(portal.textContent).toContain(`找不到这个${label[kind]}`);
        expect(portal.querySelector("[data-asset-editor]")).toBeNull();
    });
});

describe("asset read delivery and unavailable drafts", () => {
    it("requires an actual project even when a project target spells the Studio sentinel", async () => {
        const {target} = await createTarget("character", {kind: "studio"});
        await render({...target, owner: {kind: "project", projectId: STUDIO_LIBRARY_ID}});
        expect(await publish(reads[0])).toMatchObject({value: null});
        expect(portal.textContent).toContain("找不到这个角色");
        expect(portal.querySelector("[data-asset-editor]")).toBeNull();
    });
    it("retires the old observation and independently rejects an injected foreign row envelope", async () => {
        const a = await createTarget(), b = await createTarget("scene");
        await render(a.target);
        const aRead = reads[0], aValue = await publish(aRead);
        await render(b.target);
        const bRead = reads.at(-1)!;
        expect(aRead.stopped).toBe(true);
        expect(portal.textContent).toContain("正在读取场景");
        await publish(aRead, aValue);
        expect(portal.querySelector("[data-asset-editor]")).toBeNull();
        const bValue = await db.transaction("r", TABLE_NAMES, bRead.query) as {key: string; value: unknown};
        await publish(bRead, {key: bValue.key, value: {kind: "scene", asset: a.asset}});
        expect(portal.textContent).toContain("找不到这个场景");
        expect(portal.querySelector("[data-asset-editor]")).toBeNull();
        await publish(bRead, bValue);
        expect(portal.querySelector("[data-asset-editor]")?.getAttribute("data-asset-editor")).toBe(b.asset.id);
    });
    it("keeps a genuine StoreTx read failure local and retries only the same target", async () => {
        const {target} = await createTarget("prop"); await render(target);
        const read = reads[0]; let failure: unknown, reached = false;
        try {
            await db.transaction("r", TABLE_NAMES, async tx => {
                const get = vi.spyOn(tx.props, "get").mockImplementationOnce(async () => {reached = true; throw new Error("Controlled read failure");});
                try {return await read.query(tx);} finally {get.mockRestore();}
            });
        } catch (cause) {failure = cause;}
        expect(reached).toBe(true); expect(failure).toBeInstanceOf(Error);
        await act(async () => read.observer.error(failure));
        expect(portal.textContent).toContain("道具读取失败");
        expect(portal.querySelector("[data-asset-editor]")).toBeNull();
        await click("重试读取道具");
        expect(read.stopped).toBe(true); await publish(reads.at(-1)!);
        expect(portal.querySelector("[data-asset-editor]")?.getAttribute("data-asset-editor")).toBe(target.entityId);
    });
    it("retains the same dirty input through read failure and retry with writes disabled until ownership returns", async () => {
        const {target} = await createTarget(); await render(target);
        const read = reads[0]; await publish(read); const input = nameInput();
        await act(async () => {type(input, "Readable local draft"); read.observer.error(new Error("Controlled refresh failure"));});
        expect(nameInput()).toBe(input); expect(input.value).toBe("Readable local draft"); expect(input.readOnly).toBe(true);
        await act(async () => {await expect(flushPendingDrafts(projectId)).rejects.toThrow("暂时不可用");});
        expect((await db.characters.get(target.entityId))?.name).not.toBe("Readable local draft");
        await click("重试读取角色");
        expect(input.readOnly).toBe(true); await publish(reads.at(-1)!);
        expect(nameInput()).toBe(input); expect(input.value).toBe("Readable local draft"); expect(input.readOnly).toBe(false);
        await click("重试");
        await act(async () => flushPendingDrafts(projectId));
        expect((await db.characters.get(target.entityId))?.name).toBe("Readable local draft");
    });
    it("retains only a matching missing draft as read-only and permits explicit discard", async () => {
        const {target} = await createTarget(); await render(target);
        const read = reads[0]; await publish(read); const input = nameInput();
        await act(async () => type(input, "Deleted target draft"));
        await db.characters.delete(target.entityId); await publish(read);
        expect(portal.textContent).toContain("找不到这个角色");
        expect(nameInput()).toBe(input); expect(input.readOnly).toBe(true);
        await act(async () => {await expect(flushPendingDrafts(projectId)).rejects.toThrow("暂时不可用");});
        await click("重试"); expect(await db.characters.get(target.entityId)).toBeUndefined();
        const closeButton = portal.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!;
        await act(async () => closeButton.click()); await click("放弃并离开");
        expect(closed).toHaveBeenCalledWith({requestId: "request-1", reason: "close"});
    });
});
