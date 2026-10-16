import {useLayoutEffect, useMemo, type RefObject} from "react";
import {isTauriRuntime} from "../../../platform/runtime/runtimeIdentity";
import {nativeWindowState} from "../../../platform/runtime/desktopLifecycle";
import {acknowledgeAgentReportRead, acknowledgeThreadRead} from "../commands/threadActivity";

/** Geometry is checked on the presented text, within both the reader and its safe viewport. */
export function readablePublicElement(element: HTMLElement, viewport: HTMLElement | null): boolean {
    if (!element.isConnected || document.visibilityState !== "visible" || !document.hasFocus()) return false;
    if (isTauriRuntime()) {
        const native = nativeWindowState.getSnapshot();
        if (!native.visible || !native.focused) return false;
    }
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
        if (parent.hidden || parent.hasAttribute("inert") || parent.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
    }
    if (!element.textContent?.trim() || !element.getClientRects().length) return false;
    const boundary = viewport?.getBoundingClientRect();
    let top = Math.max(0, boundary?.top ?? 0), bottom = Math.min(window.innerHeight, boundary?.bottom ?? window.innerHeight);
    const left = Math.max(0, boundary?.left ?? 0), right = Math.min(window.innerWidth, boundary?.right ?? window.innerWidth);
    // The floating composer can overlap the scroll viewport even while its content is at the tail.
    const column = element.closest(".agent-chat-column");
    const composer = column?.querySelector<HTMLElement>(".agent-composer-dock");
    if (composer && getComputedStyle(composer).visibility !== "hidden") bottom = Math.min(bottom, composer.getBoundingClientRect().top);
    top = Math.max(top, 0);
    if (bottom <= top || right <= left) return false;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim()) textNodes.push(node as Text);
    // The newest meaningful text must be in view; a visible heading cannot certify a clipped body.
    for (const node of textNodes.reverse()) {
        const parent = node.parentElement;
        if (!parent || parent.closest("[hidden], [inert], [aria-hidden='true']")) continue;
        const publicStatus = parent.closest<HTMLElement>("[data-agent-public][role='status']");
        if (parent.closest(".agent-message-footer") && (!publicStatus || !element.contains(publicStatus))) continue;
        if (getComputedStyle(parent).display === "none" || getComputedStyle(parent).visibility === "hidden") continue;
        const range = document.createRange();
        const last = node.textContent?.trimEnd().length ?? 0;
        range.setStart(node, Math.max(0, last - 1)); range.setEnd(node, last);
        const rects = range.getClientRects();
        const rect = rects.item(rects.length - 1);
        if (!rect) continue;
        if (!rect.width || !rect.height) continue;
        const x = Math.max(left, rect.left) + (Math.min(rect.right, right) - Math.max(left, rect.left)) / 2;
        const y = Math.max(top, rect.top) + (Math.min(rect.bottom, bottom) - Math.max(top, rect.top)) / 2;
        if (rect.bottom <= top || rect.top >= bottom || rect.right <= left || rect.left >= right) return false;
        const hit = document.elementFromPoint(x, y);
        return !!hit && element.contains(hit);
    }
    return false;
}

/** Queue only revisions already observed on an eligible surface, never read a newer watermark. */
export function createObservedReadQueue(acknowledge: (revision: number) => Promise<void>) {
    let pending = 0, completed = 0, running = false;
    const flush = async () => {
        if (running || pending <= completed) return;
        running = true;
        const revision = pending;
        try {await acknowledge(revision); completed = Math.max(completed, revision);}
        catch {pending = completed;} // A future eligible observation can retry; no background read claim.
        finally {running = false; if (pending > completed) void flush();}
    };
    return (revision: number) => {if (revision > completed) {pending = Math.max(pending, revision); void flush();}};
}

export function useObservedReadProbe({threadId, jobId, revision, surface, viewport, following}: {
    threadId?: string; jobId?: string; revision: number;
    surface: RefObject<HTMLElement | null>; viewport?: RefObject<HTMLElement | null>; following?: RefObject<boolean>;
}) {
    const observe = useMemo(() => createObservedReadQueue(value => !threadId ? Promise.resolve() : jobId ?
        acknowledgeAgentReportRead({threadId, jobId, observedRevision: value}) :
        acknowledgeThreadRead({threadId, observedRevision: value})), [threadId, jobId]);
    useLayoutEffect(() => {
        const element = surface.current;
        if (!threadId || !revision || !element) return;
        let frame = 0, live = true;
        const check = () => {
            if (frame || !live) return;
            // Two frames ensure the captured commit had a rendering opportunity before eligibility.
            frame = requestAnimationFrame(() => {frame = requestAnimationFrame(() => {
                frame = 0;
                const candidates = jobId ? [element] : [...element.querySelectorAll<HTMLElement>("[data-agent-public]")].reverse();
                const presented = candidates.find(candidate => {
                    for (let parent: HTMLElement | null = candidate; parent && parent !== element; parent = parent.parentElement) {
                        if (parent.hidden || getComputedStyle(parent).display === "none" || getComputedStyle(parent).visibility === "hidden") return false;
                    }
                    return !!candidate.textContent?.trim();
                });
                if (live && presented && (!following || following.current) && readablePublicElement(presented, viewport?.current ?? element.closest(".agent-message-list"))) observe(revision);
            });});
        };
        const mutations = new MutationObserver(check);
        mutations.observe(element, {childList: true, characterData: true, subtree: true});
        for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
            mutations.observe(parent, {attributes: true, attributeFilter: ["hidden", "inert", "aria-hidden", "style", "class", "open"]});
        }
        const resize = new ResizeObserver(check); resize.observe(element);
        if (viewport?.current) resize.observe(viewport.current);
        const stopNative = nativeWindowState.subscribe(check);
        document.addEventListener("visibilitychange", check); window.addEventListener("focus", check);
        window.addEventListener("resize", check); document.addEventListener("scroll", check, true);
        check();
        return () => {live = false; cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect(); stopNative();
            document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check);
            window.removeEventListener("resize", check); document.removeEventListener("scroll", check, true);};
    }, [threadId, jobId, revision, surface, viewport, following, observe]);
}
