// @vitest-environment jsdom
import {act, createElement as h, createRef, useEffect, useState} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as Popover from "@radix-ui/react-popover";
import {ContextPanelHostProvider, useContextPanelHost} from "@/app/layout/ContextPanelHost";
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
function Workspace({onOpen}: {onOpen:()=>void}) {
    const hostState = useContextPanelHost();
    return h("main", {inert:hostState?.fullWidth,"data-context-panel-workspace":"", "aria-hidden":hostState?.fullWidth || undefined},
        h("button", {id:"opener",onClick:onOpen}, "Open"), h("button", {id:"main-action"}, "Main action"),
        h("textarea", {"aria-label":"composer",defaultValue:"unsent conversation draft"}));
}
function Fixture({width, preventFocus = false, ownClose = false}: {width:number;preventFocus?:boolean;ownClose?:boolean}) {
    const [open, setOpen] = useState(false);
    return h(ContextPanelHostProvider, {target:host,surfaceWidth:width,navigationWidth:260},
        h("header", null,h("button", {id:"chrome-action"},"Application action")),
        h(Workspace, {onOpen:() => setOpen(true)}),
        h(ContextPanel, {open,onOpenChange:setOpen},
            h(ContextPanelContent, {showCloseButton:!ownClose,returnLabel:"返回对话",onOpenAutoFocus:event => {if (preventFocus) event.preventDefault();}},
                h(ContextPanelTitle,null,"Details"),h(Editor))));
}
async function draw(width:number, preventFocus = false, ownClose = false) {await act(async () => {root.render(h(Fixture,{width,preventFocus,ownClose}));});}
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
        expect(document.activeElement).toBe(input); expect(host.querySelector('[role="complementary"][data-mode="full-width"]')).not.toBeNull();
        expect(host.querySelector('[aria-modal], [role="dialog"], .context-panel-backdrop')).toBeNull();
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
    it("restores the connected opener after returning and delegates caller autofocus prevention", async () => {
        await draw(1000,true);
        const opener = container.querySelector<HTMLButtonElement>("#opener")!; opener.focus(); await click(opener); await settleFocus();
        // A prevented mount event does not focus a child; no independent passive autofocus overrides it.
        expect(document.activeElement).not.toBe(host.querySelector("input"));
        await click(host.querySelector<HTMLButtonElement>('.context-panel-return')!); await settleFocus();
        expect(host.querySelector("input")).toBeNull(); expect(document.activeElement).toBe(opener);
        await draw(1000,false); await click(opener); await settleFocus();
        expect(host.contains(document.activeElement)).toBe(true);
    });
    it("moves hidden workspace focus into full-width details, leaves app chrome reachable and keeps conversation DOM", async () => {
        await draw(1440);
        const opener = container.querySelector<HTMLButtonElement>("#opener")!;
        const workspace = container.querySelector("main")!;
        const composer = container.querySelector<HTMLTextAreaElement>("textarea")!;
        workspace.scrollTop = 246;
        opener.focus(); await click(opener);
        composer.focus(); composer.setSelectionRange(2,8);
        await draw(760);
        expect(host.contains(document.activeElement)).toBe(true);
        expect(container.querySelector("textarea")).toBe(composer);
        expect(composer.value).toBe("unsent conversation draft"); expect(workspace.scrollTop).toBe(246);
        expect(workspace.getAttribute("aria-hidden")).toBe("true");
        const chrome = container.querySelector<HTMLButtonElement>("#chrome-action")!;
        chrome.focus(); await settleFocus();
        expect(document.activeElement).toBe(chrome);
        expect(chrome.closest("[inert]")).toBeNull();
        await draw(1440);
        expect(document.activeElement).toBe(chrome);
        expect(container.querySelector("textarea")).toBe(composer);
        expect(composer.selectionStart).toBe(2); expect(composer.selectionEnd).toBe(8);
        expect(workspace.scrollTop).toBe(246);
    });
    it("keeps a named return control when a consumer supplies its own close button", async () => {
        await draw(760,false,true);
        const opener = container.querySelector<HTMLButtonElement>("#opener")!; opener.focus(); await click(opener);
        const back = host.querySelector<HTMLButtonElement>(".context-panel-return")!;
        expect(back.textContent).toBe("返回对话"); expect(back.closest("[hidden]")).toBeNull();
        await click(back); await settleFocus();
        expect(host.querySelector("input")).toBeNull(); expect(document.activeElement).toBe(opener);
    });
    it("moves focus off the return control when docking hides it", async () => {
        await draw(760,false,true);
        await click(container.querySelector<HTMLButtonElement>("#opener")!);
        const back = host.querySelector<HTMLButtonElement>(".context-panel-return")!;
        back.focus();
        const input = host.querySelector<HTMLInputElement>("input")!;
        await draw(1440,false,true);
        expect(document.activeElement).toBe(input);
        expect(document.activeElement?.closest("[hidden]")).toBeNull();
        expect(host.querySelector("input")).toBe(input);
        expect(mounted).toHaveBeenCalledOnce();
    });
    it("keeps details open while using the application chrome and returns with Escape from the editor", async () => {
        await draw(760);
        const opener = container.querySelector<HTMLButtonElement>("#opener")!;
        opener.focus(); await click(opener);
        const input = host.querySelector<HTMLInputElement>("input")!;
        const chrome = container.querySelector<HTMLButtonElement>("#chrome-action")!;
        await act(async () => {
            chrome.dispatchEvent(new Event("pointerdown", {bubbles:true})); chrome.click(); chrome.focus();
        });
        expect(host.querySelector("input")).toBe(input); expect(document.activeElement).toBe(chrome);
        input.focus();
        await act(async () => {input.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}));});
        await settleFocus();
        expect(host.querySelector("input")).toBeNull(); expect(document.activeElement).toBe(opener);
    });
});
