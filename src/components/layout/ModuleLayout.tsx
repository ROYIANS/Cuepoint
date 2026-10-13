import {createContext, type ReactNode, useContext, useEffect, useRef, useState} from "react";
import {FocusScope} from "@radix-ui/react-focus-scope";
import {DismissableLayer} from "@radix-ui/react-dismissable-layer";
import {cn} from "@/lib/utils";

export type ModuleNavigationState = {
    open: boolean; setOpen: (open: boolean) => void; toggle: () => void; registered: boolean;
    narrow: boolean; opener?: React.RefObject<HTMLElement | null>; register: (width: number) => () => void;
};
export const ModuleNavigationContext = createContext<ModuleNavigationState | null>(null);
export function useModuleNavigation() {
    const context = useContext(ModuleNavigationContext);
    const [open, setOpen] = useState(true);
    return context ?? {open, setOpen, toggle: () => setOpen(value => !value), registered: true, narrow: false, register: () => () => {}};
}

/** Presentation only: a collapsed navigation and its feature children stay mounted. */
export function ModuleLayout({navigation, navigationLabel = "模块导航", navigationWidth = 260, children, className, mainClassName}: {
    navigation?: ReactNode; navigationLabel?: string; navigationWidth?: number; children: ReactNode;
    className?: string; mainClassName?: string;
}) {
    const state = useModuleNavigation();
    const register = state.register;
    const hasNavigation = navigation != null;
    useEffect(() => hasNavigation ? register(navigationWidth) : undefined, [register, hasNavigation, navigationWidth]);
    const navigationRef = useRef<HTMLElement>(null);
    const localOpener = useRef<HTMLElement | null>(null);
    const opener = state.opener ?? localOpener;
    const wasOverlay = useRef(false);
    const overlay = hasNavigation && state.open && state.narrow;
    useEffect(() => {
        const navigation = navigationRef.current;
        if (overlay && !wasOverlay.current) {
            const focused = document.activeElement;
            if (!state.opener && focused instanceof HTMLElement && !navigation?.contains(focused)) opener.current = focused;
            if (navigation && !navigation.contains(focused)) navigation.querySelector<HTMLElement>("button, a, input, [tabindex='0']")?.focus({preventScroll: true});
        } else if (!overlay && wasOverlay.current && (!document.activeElement || document.activeElement === document.body || navigation?.contains(document.activeElement))) {
            if (opener.current?.isConnected) opener.current.focus({preventScroll: true});
        }
        wasOverlay.current = overlay;
    }, [overlay,opener,state.opener]);
    return <div className={cn("module-layout", !hasNavigation && "module-layout-passthrough", className)}
                data-navigation-open={state.open} style={{"--module-navigation-width": `${navigationWidth}px`} as React.CSSProperties}>
        {hasNavigation && <>
            {overlay && <div className="module-navigation-backdrop" onClick={() => state.setOpen(false)} aria-hidden/>}
            <FocusScope key="navigation" asChild trapped={overlay} loop={overlay} onMountAutoFocus={event => event.preventDefault()}>
                <DismissableLayer asChild disableOutsidePointerEvents={overlay}
                    onEscapeKeyDown={event => {if (overlay) {event.preventDefault(); state.setOpen(false);}}}
                    onPointerDownOutside={event => {if (overlay) {event.preventDefault(); state.setOpen(false);}}}>
                    <aside ref={navigationRef} className="module-navigation app-scroll" aria-label={navigationLabel}
                           role={overlay ? "dialog" : undefined} aria-modal={overlay || undefined}
                           inert={!state.open} aria-hidden={!state.open || undefined}>{state.narrow && <button type="button" className="module-navigation-row" onClick={() => state.setOpen(false)}>关闭模块导航</button>}{navigation}</aside>
                </DismissableLayer>
            </FocusScope>
        </>}
        <div className={cn("module-main", mainClassName)} inert={overlay} aria-hidden={overlay || undefined}>{children}</div>
    </div>;
}
