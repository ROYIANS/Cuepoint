import {
    type ComponentProps,
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState
} from "react";
import {createPortal} from "react-dom";
import {FocusScope} from "@radix-ui/react-focus-scope";
import {DismissableLayer} from "@radix-ui/react-dismissable-layer";
import {useContextPanelHost} from "./ContextPanelHost";
import {XIcon} from "../../ui/icons";
import {createOverlayFocusReturn} from "../../ui/overlayFocusReturn";
import {cn} from "../../ui/cn";

type PanelContext = {
    shown: boolean;
    overlay: boolean;
    width: number;
    titleId: string;
    descriptionId: string;
    close: () => void;
    focusReturn: ReturnType<typeof createOverlayFocusReturn>
};
const PanelContext = createContext<PanelContext | null>(null);

function usePanel() {
    const value = useContext(PanelContext);
    if (!value) throw new Error("ContextPanelContent requires ContextPanel");
    return value;
}

/** Feature-owned open/draft state; the frame arbitrates presentation only. */
export function ContextPanel({open, onOpenChange, width = 400, onRequestDeparture, children}: {
    open: boolean; onOpenChange: (open: boolean) => void; width?: number; children: ReactNode;
    onRequestDeparture?: (proceed: () => void, cancel?: () => void) => void;
}) {
    const id = useId();
    const [focusReturn] = useState(createOverlayFocusReturn);
    useLayoutEffect(() => {
        if (open) focusReturn.onOpenAutoFocus(new Event("context-panel-open"));
    }, [open, focusReturn]);
    const host = useContextPanelHost();
    const current = useRef({onOpenChange, onRequestDeparture});
    current.current = {onOpenChange, onRequestDeparture};
    const register = host?.register, request = host?.request, release = host?.release;
    useEffect(() => register?.({
        id, width, depart: (proceed, cancel) => {
            if (current.current.onRequestDeparture) current.current.onRequestDeparture(proceed, cancel); else proceed();
        }, close: () => current.current.onOpenChange(false)
    }), [register, id, width]);
    useEffect(() => {
        if (open) request?.(id); else release?.(id);
    }, [open, request, release, id]);
    const shown = open && (!host || host.active === id);
    return <PanelContext value={{
        shown, overlay: !host?.docked, width, titleId: `${id}-title`, descriptionId: `${id}-description`, focusReturn,
        close: () => {
            const close = () => current.current.onOpenChange(false);
            if (current.current.onRequestDeparture) current.current.onRequestDeparture(close); else close();
        }
    }}>{children}</PanelContext>;
}

/** This one subtree survives docking; never switch Dialog modal Content branches. */
export function ContextPanelContent({
                                        children,
                                        className,
                                        showCloseButton = true,
                                        onOpenAutoFocus,
                                        onCloseAutoFocus,
                                        side: _side,
                                        ...props
                                    }: ComponentProps<"div"> & {
    side?: "right" | "left"; showCloseButton?: boolean;
    onOpenAutoFocus?: (event: Event) => void; onCloseAutoFocus?: (event: Event) => void;
}) {
    const panel = usePanel();
    const host = useContextPanelHost();
    const focusReturn = panel.focusReturn;
    const ref = useRef<HTMLDivElement>(null);
    const lastOverlay = useRef(panel.overlay);
    useEffect(() => {
        const becameOverlay = panel.overlay && !lastOverlay.current;
        lastOverlay.current = panel.overlay;
        if (becameOverlay && panel.shown && panel.overlay && ref.current && !ref.current.contains(document.activeElement)) {
            const target = ref.current.querySelector<HTMLElement>("[autofocus], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a, [tabindex='0']");
            (target ?? ref.current).focus({preventScroll: true});
        }
    }, [panel.shown, panel.overlay]);
    if (!panel.shown || (host && !host.target)) return null;
    const target = host?.target ?? document.body;
    return createPortal(<>
        {panel.overlay && <div className="context-panel-backdrop" aria-hidden onClick={panel.close}/>}
        <FocusScope key="content" asChild trapped={panel.overlay} loop={panel.overlay}
                    onMountAutoFocus={event => {
                        onOpenAutoFocus?.(event);
                        if (!panel.overlay) event.preventDefault();
                    }} onUnmountAutoFocus={event => {
            focusReturn.onCloseAutoFocus(event, onCloseAutoFocus);
            // Use the shared conditional fallback rather than stealing a valid new focus.
            event.preventDefault();
        }}>
            <DismissableLayer asChild disableOutsidePointerEvents={panel.overlay}
                              onEscapeKeyDown={event => {
                                  if (panel.overlay) {
                                      event.preventDefault();
                                      panel.close();
                                  }
                              }}
                              onPointerDownOutside={event => {
                                  if (panel.overlay) {
                                      event.preventDefault();
                                      panel.close();
                                  }
                              }}
                              onFocusOutside={event => {
                                  if (panel.overlay) event.preventDefault();
                              }}>
                <div {...props} ref={ref} data-slot="context-panel-content"
                     data-mode={panel.overlay ? "overlay" : "docked"}
                     className={cn("context-panel-content", className)}
                     style={{...props.style, "--context-panel-width": `${panel.width}px`} as React.CSSProperties}
                     role={panel.overlay ? "dialog" : "complementary"} aria-modal={panel.overlay || undefined}
                     aria-labelledby={panel.titleId} aria-describedby={panel.descriptionId} tabIndex={-1}>
                    {children}
                    {showCloseButton &&
                        <button type="button" aria-label="关闭" className="context-panel-close" onClick={panel.close}>
                            <XIcon className="size-4" aria-hidden/></button>}
                </div>
            </DismissableLayer>
        </FocusScope>
    </>, target);
}

export function ContextPanelHeader({className, ...props}: ComponentProps<"div">) {
    return <div data-slot="context-panel-header"
                className={cn("shrink-0 flex flex-col gap-1.5 p-4 pr-10", className)} {...props}/>;
}

export function ContextPanelTitle({className, ...props}: ComponentProps<"h2">) {
    const panel = usePanel();
    return <h2 {...props} id={panel.titleId} data-slot="context-panel-title"
               className={cn("text-foreground font-semibold", className)}/>;
}

export function ContextPanelDescription({className, ...props}: ComponentProps<"p">) {
    const panel = usePanel();
    return <p {...props} id={panel.descriptionId} data-slot="context-panel-description"
              className={cn("text-muted-foreground text-sm", className)}/>;
}
