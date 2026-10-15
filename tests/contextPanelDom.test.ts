// @vitest-environment jsdom
import {act, createElement as h, createRef, useEffect, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as Popover from "@radix-ui/react-popover";
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
import {ContextPanel, ContextPanelContent, ContextPanelTitle} from "@/app/layout/context-panel";
import {Home} from "@/ui/icons";

let root: Root, container: HTMLDivElement, host: HTMLDivElement;
const mounted = vi.fn(), unmounted = vi.fn();
const iconRef = createRef<SVGSVGElement>();
function Editor() {
    const [draft, setDraft] = useState("persistent draft");
    useEffect(() => {mounted(); return () => {unmounted();};}, []);
    return h("div", null,
        h("input", {"aria-label":"draft", value:draft, onChange:event => setDraft(event.currentTarget.value)}),
        h(Home, {ref:iconRef,size:16,weight:"fill","aria-label":"Home"}),
        h(Popover.Root, null,
            h(Popover.Trigger, {"aria-label":"Nested menu"}, "Options"),
            h(Popover.Portal, null,h(Popover.Content, {"aria-label":"Nested content"},
                h("button", {onClick:() => setDraft("updated through nested popup")}, "Use option")))));
}
function Fixture({width, preventFocus = false}: {width:number;preventFocus?:boolean}) {
    const [open, setOpen] = useState(false);
    const [isolated, setIsolated] = useState(false);
    return h(ContextPanelHostProvider, {target:host,surfaceWidth:width,navigationWidth:260,onOverlayChange:setIsolated},
        h("main", {inert:isolated}, h("button", {id:"opener",onClick:() => setOpen(true)}, "Open"), h("button", {id:"main-action"}, "Main action")),
        h(ContextPanel, {open,onOpenChange:setOpen},
            h(ContextPanelContent, {onOpenAutoFocus:event => {if (preventFocus) event.preventDefault();}},
                h(ContextPanelTitle,null,"Details"),h(Editor))));
}
async function draw(width:number, preventFocus = false) {await act(async () => {root.render(h(Fixture,{width,preventFocus}));});}
async function click(node:HTMLElement) {await act(async () => {node.click();});}
async function settleFocus() {await act(async () => {await new Promise(resolve => setTimeout(resolve,10));});}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
    vi.stubGlobal("ResizeObserver",class {observe() {} unobserve() {} disconnect() {}});
    container = document.createElement("div"); host = document.createElement("div");
    document.body.append(container,host); root = createRoot(container); mounted.mockClear(); unmounted.mockClear();
});
afterEach(async () => {await act(async () => {root.unmount();}); await settleFocus(); container.remove(); host.remove(); vi.unstubAllGlobals();});
describe("real React DOM context panel lifecycle", () => {
    it("retains the editor node, draft, caret and SVG ref across docking and nested popup writes", async () => {
        await draw(1440);
        const opener = container.querySelector<HTMLButtonElement>("#opener")!; opener.focus(); await click(opener);
        const input = host.querySelector<HTMLInputElement>("input")!;
        const icon = iconRef.current;
        expect(icon).toBeInstanceOf(SVGSVGElement); expect(icon?.getAttribute("viewBox")).toBe("0 0 256 256");
        input.focus(); input.setSelectionRange(4,9);
        expect(host.querySelector('[role="complementary"]')).not.toBeNull();
        await draw(1139);
        expect(host.querySelector("input")).toBe(input); expect(iconRef.current).toBe(icon);
        expect(input.value).toBe("persistent draft"); expect(input.selectionStart).toBe(4); expect(input.selectionEnd).toBe(9);
        expect(document.activeElement).toBe(input); expect(host.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
        expect(container.querySelector("main")?.hasAttribute("inert")).toBe(true);
        await draw(1440);
        expect(host.querySelector("input")).toBe(input); expect(container.querySelector("main")?.hasAttribute("inert")).toBe(false);
        const mainAction = container.querySelector<HTMLButtonElement>("#main-action")!; mainAction.focus(); expect(document.activeElement).toBe(mainAction);
        await draw(1139);
        await click(host.querySelector<HTMLButtonElement>('[aria-label="Nested menu"]')!);
        const option = [...document.querySelectorAll("button")].find(node => node.textContent === "Use option")!;
        expect(option).toBeTruthy(); await click(option);
        expect(input.value).toBe("updated through nested popup"); expect(host.querySelector("input")).toBe(input);
        expect(mounted).toHaveBeenCalledOnce(); expect(unmounted).not.toHaveBeenCalled();
    });
    it("restores the connected opener after modal close and delegates caller autofocus prevention", async () => {
        await draw(1000,true);
        const opener = container.querySelector<HTMLButtonElement>("#opener")!; opener.focus(); await click(opener); await settleFocus();
        // A prevented mount event does not focus a child; no independent passive autofocus overrides it.
        expect(document.activeElement).not.toBe(host.querySelector("input"));
        await click(host.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!); await settleFocus();
        expect(host.querySelector("input")).toBeNull(); expect(document.activeElement).toBe(opener);
        await draw(1000,false); await click(opener); await settleFocus();
        expect(host.contains(document.activeElement)).toBe(true);
    });
});
