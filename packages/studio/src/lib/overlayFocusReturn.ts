/**
 * Radix modal Content returns focus through Trigger. Controlled overlays without
 * a Trigger need the opening focus as a fallback, after Radix and consumer work.
 */
export function createOverlayFocusReturn() {
    let opener: HTMLElement | null = null;
    let ownerDocument: Document | undefined;
    let generation = 0;

    return {
        onOpenAutoFocus(event: Event, delegate?: (event: Event) => void) {
            generation += 1;
            ownerDocument = document;
            const active = ownerDocument.activeElement;
            opener = active instanceof HTMLElement && active !== ownerDocument.body ? active : null;
            delegate?.(event);
        },
        onCloseAutoFocus(event: Event, delegate?: (event: Event) => void) {
            delegate?.(event);
            if (event.defaultPrevented) return;
            const openingGeneration = generation;
            const target = opener;
            const documentAtOpen = ownerDocument;
            queueMicrotask(() => {
                if (openingGeneration !== generation || !target?.isConnected || !documentAtOpen) return;
                const active = documentAtOpen.activeElement;
                // Do not steal focus restored by a Radix Trigger, another overlay,
                // a custom handler, or an outside interaction in a nonmodal view.
                if (active && active !== documentAtOpen.body) return;
                target.focus({preventScroll: true});
            });
        },
    };
}
