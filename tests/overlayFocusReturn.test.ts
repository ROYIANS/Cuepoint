import {afterEach, describe, expect, it, vi} from "vitest";
import {createOverlayFocusReturn} from "@/lib/overlayFocusReturn";

// Minimal focus environment: the initializer and both production handlers run;
// browser acceptance separately verifies actual Radix/Portal event ordering.
function focusEnvironment() {
    const documentState: {activeElement: FocusElement | null; body: FocusElement | null} = {activeElement: null, body: null};
    class FocusElement {
        isConnected = true;
        focus = vi.fn((_options?: FocusOptions) => {documentState.activeElement = this;});
    }
    const body = new FocusElement();
    documentState.body = body;
    documentState.activeElement = body;
    vi.stubGlobal("HTMLElement", FocusElement);
    vi.stubGlobal("document", documentState);
    return {documentState, body, element: () => new FocusElement()};
}

const autoFocusEvent = () => new Event("autofocus", {cancelable: true});
const flushFocus = () => new Promise<void>(resolve => queueMicrotask(resolve));

afterEach(() => vi.unstubAllGlobals());

describe("controlled overlay focus return", () => {
    it("captures before open autofocus and restores the opener when Radix has no trigger", async () => {
        const {documentState, body, element} = focusEnvironment();
        const opener = element();
        const input = element();
        documentState.activeElement = opener;
        const handlers = createOverlayFocusReturn();
        const open = autoFocusEvent();
        const onOpen = vi.fn(() => input.focus());
        handlers.onOpenAutoFocus(open, onOpen);
        expect(onOpen).toHaveBeenCalledWith(open);
        documentState.activeElement = body;
        const close = autoFocusEvent();
        handlers.onCloseAutoFocus(close);
        // Radix's own composed modal handler prevents default but has no Trigger.
        close.preventDefault();
        await flushFocus();
        expect(documentState.activeElement).toBe(opener);
        expect(opener.focus).toHaveBeenCalledWith({preventScroll: true});
    });

    it("keeps Radix trigger focus and nonpreventing custom focus", async () => {
        const {documentState, body, element} = focusEnvironment();
        const opener = element();
        const destination = element();
        const handlers = createOverlayFocusReturn();
        documentState.activeElement = opener;
        handlers.onOpenAutoFocus(autoFocusEvent());
        documentState.activeElement = body;
        handlers.onCloseAutoFocus(autoFocusEvent());
        destination.focus();
        await flushFocus();
        expect(documentState.activeElement).toBe(destination);
        expect(opener.focus).not.toHaveBeenCalled();
        documentState.activeElement = body;
        handlers.onCloseAutoFocus(autoFocusEvent(), () => destination.focus());
        await flushFocus();
        expect(documentState.activeElement).toBe(destination);
        expect(opener.focus).not.toHaveBeenCalled();
    });

    it("preserves AlertDialog cancel autofocus and remembers the original opener", async () => {
        const {documentState, body, element} = focusEnvironment();
        const opener = element();
        const cancel = element();
        documentState.activeElement = opener;
        const handlers = createOverlayFocusReturn();
        const open = autoFocusEvent();
        handlers.onOpenAutoFocus(open);
        // The shared callback must leave Radix's composed Cancel handler enabled.
        expect(open.defaultPrevented).toBe(false);
        open.preventDefault();
        cancel.focus({preventScroll: true});
        expect(documentState.activeElement).toBe(cancel);
        documentState.activeElement = body;
        handlers.onCloseAutoFocus(autoFocusEvent());
        await flushFocus();
        expect(documentState.activeElement).toBe(opener);
        expect(opener.focus).toHaveBeenCalledWith({preventScroll: true});
    });

    it("respects consumer preventDefault even when it deliberately leaves body focused", async () => {
        const {documentState, body, element} = focusEnvironment();
        const opener = element();
        documentState.activeElement = opener;
        const handlers = createOverlayFocusReturn();
        handlers.onOpenAutoFocus(autoFocusEvent());
        documentState.activeElement = body;
        const close = autoFocusEvent();
        const onClose = vi.fn((event: Event) => event.preventDefault());
        handlers.onCloseAutoFocus(close, onClose);
        await flushFocus();
        expect(onClose).toHaveBeenCalledWith(close);
        expect(documentState.activeElement).toBe(body);
        expect(opener.focus).not.toHaveBeenCalled();
    });

    it("does not focus an opener removed by navigation or a nested overlay closing", async () => {
        const {documentState, body, element} = focusEnvironment();
        const opener = element();
        documentState.activeElement = opener;
        const handlers = createOverlayFocusReturn();
        handlers.onOpenAutoFocus(autoFocusEvent());
        documentState.activeElement = body;
        handlers.onCloseAutoFocus(autoFocusEvent());
        opener.isConnected = false;
        await flushFocus();
        expect(documentState.activeElement).toBe(body);
        expect(opener.focus).not.toHaveBeenCalled();
    });

    it("cancels a stale close fallback when the same content opens again", async () => {
        const {documentState, body, element} = focusEnvironment();
        const first = element();
        const second = element();
        const handlers = createOverlayFocusReturn();
        documentState.activeElement = first;
        handlers.onOpenAutoFocus(autoFocusEvent());
        documentState.activeElement = body;
        handlers.onCloseAutoFocus(autoFocusEvent());
        documentState.activeElement = second;
        handlers.onOpenAutoFocus(autoFocusEvent());
        documentState.activeElement = body;
        await flushFocus();
        expect(first.focus).not.toHaveBeenCalled();
        expect(second.focus).not.toHaveBeenCalled();
        handlers.onCloseAutoFocus(autoFocusEvent());
        await flushFocus();
        expect(documentState.activeElement).toBe(second);
    });

    it("has no fallback when opened without a focused control", async () => {
        const {documentState, body} = focusEnvironment();
        const handlers = createOverlayFocusReturn();
        handlers.onOpenAutoFocus(autoFocusEvent());
        handlers.onCloseAutoFocus(autoFocusEvent());
        await flushFocus();
        expect(documentState.activeElement).toBe(body);
        expect(body.focus).not.toHaveBeenCalled();
    });
});
