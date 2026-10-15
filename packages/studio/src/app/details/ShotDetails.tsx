import {createContext, lazy, Suspense, type ComponentProps, type MouseEvent, type ReactNode, useCallback, useContext, useState} from "react";
import {Link} from "@tanstack/react-router";
import type {ShotDetailTarget} from "../../features/video/models/shotDetailTarget";
import {readShotDetailTarget} from "./shotDetailTarget";

const ShotDetailPanel = lazy(() => import("../../features/video/ui/ShotDetailPanel").then(module => ({default: module.ShotDetailPanel})));
const ShotDetailsAction = createContext<((target: ShotDetailTarget) => void) | null>(null);

/** Named application composition: Agent retains its owner; Video owns loading and editing. */
export function ShotDetailsProvider({children}: {children: ReactNode}) {
    const [target, setTarget] = useState<ShotDetailTarget>();
    const open = useCallback((next: ShotDetailTarget) => setTarget(next), []);
    return <ShotDetailsAction value={open}>{children}{target && <Suspense fallback={null}>
        <ShotDetailPanel target={target} onTargetChange={setTarget} onClose={() => setTarget(undefined)}/>
    </Suspense>}</ShotDetailsAction>;
}

export function useShotDetailActivation() {
    const open = useContext(ShotDetailsAction);
    return useCallback((event: MouseEvent<HTMLElement>, target?: ShotDetailTarget) => {
        if (!open || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.hasAttribute("download")) return;
        const parsed = readShotDetailTarget(event.currentTarget.getAttribute("href") ?? "");
        if (!parsed || (target && (target.projectId !== parsed.projectId || target.episodeId !== parsed.episodeId || target.shotId !== parsed.shotId))) return;
        event.preventDefault();
        open(target ?? parsed);
    }, [open]);
}

/** Keep a real canonical anchor, including copy and modified/middle activation. */
export function ShotDetailLink({href, target, onClick, children, ...props}: Omit<ComponentProps<"a">, "target"> & {href: string; target?: ShotDetailTarget}) {
    const activate = useShotDetailActivation();
    return <Link {...props} to={href} onClick={event => {
        onClick?.(event);
        activate(event, target);
    }}>{children}</Link>;
}
