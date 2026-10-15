// @vitest-environment jsdom
import {act, createElement as h, type ReactNode, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {db} from "@/platform/product/store";
import {TABLE_NAMES} from "@/platform/storage/schema";
import type {StoreObserver, StoreTx} from "@/platform/storage/types";
import {createProject} from "@/features/projects/commands/projects";
import {addShot, patchShot} from "@/features/video/commands/shots";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {ShotDetailPanel} from "@/features/video/ui/ShotDetailPanel";
import type {ShotDetailTarget} from "@/features/video/models/shotDetailTarget";
import {flushPendingDrafts} from "@/platform/product/drafts";

vi.mock("@tanstack/react-router", () => ({
    useBlocker: () => ({status: "idle", proceed: vi.fn(), reset: vi.fn()}),
    Link: ({to, children, ...props}: {to: string; children?: ReactNode}) => h("a", {href: to, ...props}, children),
}));

type Read = {
    query: (tx: StoreTx) => unknown | Promise<unknown>;
    observer: StoreObserver<unknown>;
    stopped: boolean;
};
let root: Root, container: HTMLDivElement, portal: HTMLDivElement;
let first: ShotDetailTarget, second: ShotDetailTarget;
let reads: Read[];
function Fixture() {
    const [target, setTarget] = useState({id: "a", target: first});
    return h(ContextPanelHostProvider, {target: portal, surfaceWidth: 1440, navigationWidth: 260},
        h("button", {onClick: () => setTarget({id: "b", target: second})}, "Inspect B"),
        h(ShotDetailPanel, {request: target, onRequestOutcome: () => undefined, onClosed: () => undefined}));
}
async function click(label: string) {
    const button = [...document.querySelectorAll("button")].find(node => node.textContent === label)!;
    expect(button, label).toBeTruthy();
    await act(async () => button.click());
}
async function publish(read: Read, value?: unknown) {
    const result = value ?? await db.transaction("r", TABLE_NAMES, read.query);
    await act(async () => read.observer.next(result));
    return result;
}
beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {observe() {} unobserve() {} disconnect() {}});
    const project = await createProject("Query lifecycle");
    const episode = await db.episodes.where("projectId").equals(project.id).first();
    if (!episode) throw new Error("Missing fixture episode");
    const a = await addShot(project.id, episode.id), b = await addShot(project.id, episode.id);
    await patchShot(a.id, {content: "A current content"});
    await patchShot(b.id, {content: "B current content"});
    first = {projectId: project.id, episodeId: episode.id, shotId: a.id};
    second = {...first, shotId: b.id};
    reads = [];
    // Hold notification delivery outside the database transaction. Queries below
    // still execute against real StoreTx handles; no timer is awaited inside IDB.
    vi.spyOn(db, "observe").mockImplementation((query, observer) => {
        const read: Read = {query, observer: observer as StoreObserver<unknown>, stopped: false};
        reads.push(read);
        return () => {read.stopped = true;};
    });
    container = document.createElement("div"); portal = document.createElement("div");
    document.body.append(container, portal); root = createRoot(container);
    await act(async () => root.render(h(Fixture)));
    expect(reads).toHaveLength(1);
});
afterEach(async () => {
    await act(async () => root.unmount());
    await flushPendingDrafts(first.projectId);
    container.remove(); portal.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("shot detail read lifetime at the observation boundary", () => {
    it("shows scoped loading and ignores late delivery from the retired target", async () => {
        const aRead = reads[0];
        const aValue = await db.transaction("r", TABLE_NAMES, aRead.query);
        expect(portal.textContent).toContain("正在读取镜头");
        await publish(aRead, aValue);
        expect(portal.querySelector("[data-shot-editor]")?.getAttribute("data-shot-editor")).toBe(first.shotId);
        await click("Inspect B");
        const bRead = reads.at(-1)!;
        expect(aRead.stopped).toBe(true);
        expect(portal.textContent).toContain("正在读取镜头");
        expect(portal.querySelector("[data-shot-editor]")).toBeNull();
        await publish(aRead, aValue);
        expect(portal.querySelector("[data-shot-editor]")).toBeNull();
        await publish(bRead);
        expect(portal.querySelector("[data-shot-editor]")?.getAttribute("data-shot-editor")).toBe(second.shotId);
        expect((portal.querySelector('[aria-label="镜头内容"]') as HTMLTextAreaElement).value).toBe("B current content");
    });

    it("keeps a real query failure local and retries the same owned identity", async () => {
        const read = reads[0];
        let reached = false, failure: unknown;
        try {
            await db.transaction("r", TABLE_NAMES, async tx => {
                const get = vi.spyOn(tx.shots, "get").mockImplementationOnce(async () => {
                    reached = true;
                    throw new Error("Controlled detail read failure");
                });
                try {return await read.query(tx);} finally {get.mockRestore();}
            });
        } catch (cause) {failure = cause;}
        expect(reached).toBe(true);
        expect(failure).toBeInstanceOf(Error);
        await act(async () => read.observer.error(failure));
        expect(portal.textContent).toContain("镜头读取失败");
        expect(portal.querySelector("[data-shot-editor]")).toBeNull();
        expect(container.textContent).toContain("Inspect B");
        await click("重试读取镜头");
        const retry = reads.at(-1)!;
        expect(read.stopped).toBe(true);
        await publish(retry);
        expect(portal.textContent).not.toContain("镜头读取失败");
        expect(portal.querySelector("[data-shot-editor]")?.getAttribute("data-shot-editor")).toBe(first.shotId);
    });

    it("retains the exact dirty editor as read-only after a failed refresh", async () => {
        const read = reads[0];
        await publish(read);
        const content = portal.querySelector<HTMLTextAreaElement>('[aria-label="镜头内容"]')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(content, "Readable local draft");
            content.dispatchEvent(new Event("input", {bubbles: true}));
            read.observer.error(new Error("Controlled refresh failure"));
        });
        expect(portal.textContent).toContain("镜头读取失败");
        expect(portal.querySelector('[aria-label="镜头内容"]')).toBe(content);
        expect(content.value).toBe("Readable local draft");
        expect(content.readOnly).toBe(true);
        await click("重试读取镜头");
        await publish(reads.at(-1)!);
        expect(portal.querySelector('[aria-label="镜头内容"]')).toBe(content);
        expect(content.value).toBe("Readable local draft");
        expect(content.readOnly).toBe(false);
    });
});
