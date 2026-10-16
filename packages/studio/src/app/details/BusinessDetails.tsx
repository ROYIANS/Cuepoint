import {Component, createContext, lazy, Suspense, type ComponentProps, type MouseEvent, type ReactNode,
    useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from "react";
import {Link} from "@tanstack/react-router";
import type {DetailPanelClose, DetailPanelCloseRequest, DetailPanelOutcome} from "../layout/detailPanelSession";
import {readBusinessDetailTarget, sameBusinessDetailTarget, type BusinessDetailTarget} from "./businessDetailTarget";

export {readBusinessDetailTarget} from "./businessDetailTarget";
export type {BusinessDetailTarget} from "./businessDetailTarget";

const ShotDetailPanel = lazy(() => import("../../features/video/ui/ShotDetailPanel").then(module => ({default: module.ShotDetailPanel})));
const AssetDetailPanel = lazy(() => import("../../features/library/ui/AssetDetailPanel").then(module => ({default: module.AssetDetailPanel})));

export type DetailReturnOrigin = {
    token: string; label: string;
    onEnd: (event: {token: string; requestId: string; reason: "return" | "close" | "replaced"}) => void;
};
export type DetailOpenResult =
    | {status: "opened"; requestId: string}
    | {status: "refused"; requestId: string; reason: "guard" | "busy" | "superseded" | "unavailable"};
type BusinessDetailsApi = {
    open: (target: BusinessDetailTarget, options?: {origin?: DetailReturnOrigin}) => Promise<DetailOpenResult>;
    returnToOrigin: (token: string) => Promise<"returned" | "refused" | "stale">;
};
type Selection = {id: string; target: BusinessDetailTarget; origin?: DetailReturnOrigin};
type Slot = {requested: Selection; accepted?: Selection; closeRequest?: DetailPanelCloseRequest};
type Slots = {shot?: Slot; asset?: Slot};
type OpenAttempt = {id: string; family: BusinessDetailTarget["kind"]; resolve: (result: DetailOpenResult) => void};
type ReturnAttempt = {id: string; requestId: string; resolve: (result: "returned" | "refused" | "stale") => void};
const BusinessDetails = createContext<BusinessDetailsApi | null>(null);

/** A failed incoming lazy family leaves the independent outgoing owner mounted. */
class DetailLoadBoundary extends Component<{requestId: string; onUnavailable: (id: string) => void; children: ReactNode}, {failed: boolean; requestId: string}> {
    state = {failed: false, requestId: this.props.requestId};
    static getDerivedStateFromProps(props: {requestId: string}, state: {requestId: string}) {
        return props.requestId === state.requestId ? null : {failed: false, requestId: props.requestId};
    }
    static getDerivedStateFromError() {return {failed: true};}
    componentDidCatch() {this.props.onUnavailable(this.props.requestId);}
    render() {return this.state.failed ? null : this.props.children;}
}

/** Finite composition; features and the existing host retain draft arbitration. */
export function BusinessDetailsProvider({children, scopeKey}: {children: ReactNode; scopeKey?: string}) {
    const prefix = useId();
    const sequence = useRef(0);
    const [{slots, revision}, setFrame] = useState<{slots: Slots; revision: number}>({slots: {}, revision: 0});
    const current = useRef(slots);
    const currentRevision = useRef(0);
    const openAttempt = useRef<OpenAttempt | undefined>(undefined);
    const returnAttempt = useRef<ReturnAttempt | undefined>(undefined);
    const deferredReplacements = useRef<Selection[]>([]);
    const afterCommit = useRef<Array<{revision: number; run: () => void}>>([]);
    const alive = useRef(true);
    const publish = useCallback((next: Slots) => {
        current.current = next; setFrame({slots: next, revision: ++currentRevision.current});
    }, []);
    const notify = useCallback((selection: Selection, reason: DetailPanelClose["reason"]) => {
        if (selection.origin) afterCommit.current.push({revision: currentRevision.current + 1, run: () => selection.origin!.onEnd({
            token: selection.origin!.token, requestId: selection.id, reason,
        })});
    }, []);
    useLayoutEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            // StrictMode setup replay is not provider teardown or a user return.
            queueMicrotask(() => {
                if (alive.current) return;
                const opening = openAttempt.current;
                openAttempt.current = undefined;
                opening?.resolve({status: "refused", requestId: opening.id, reason: "superseded"});
                returnAttempt.current?.resolve("stale");
                returnAttempt.current = undefined;
                afterCommit.current = [];
                deferredReplacements.current = [];
            });
        };
    }, []);
    // Detail state is scoped to its host (for Agent: the thread), not to the lifetime of the page component.
    // A scope change retires every pane/attempt without remounting the host's children; the departure guard
    // already refused the route change if a pane held unsaved work.
    const scope = useRef(scopeKey);
    useLayoutEffect(() => {
        if (scope.current === scopeKey) return;
        scope.current = scopeKey;
        const opening = openAttempt.current;
        openAttempt.current = undefined;
        opening?.resolve({status: "refused", requestId: opening.id, reason: "superseded"});
        const returning = returnAttempt.current;
        returnAttempt.current = undefined;
        returning?.resolve("stale");
        for (const selection of deferredReplacements.current.splice(0)) notify(selection, "close");
        for (const kind of ["shot", "asset"] as const) {
            const accepted = current.current[kind]?.accepted;
            if (accepted) notify(accepted, "close");
        }
        publish({});
    }, [scopeKey, notify, publish]);
    useEffect(() => {
        // A child may request closure from a passive effect of the previous
        // commit. Only the render containing that removal may return its origin.
        const ready = afterCommit.current.filter(action => action.revision <= revision);
        afterCommit.current = afterCommit.current.filter(action => action.revision > revision);
        for (const action of ready) action.run();
    }, [revision]);
    const open = useCallback<BusinessDetailsApi["open"]>((target, options) => {
        const id = `${prefix}-detail-${++sequence.current}`;
        if (!alive.current) return Promise.resolve({status: "refused", requestId: id, reason: "superseded"});
        if (openAttempt.current || returnAttempt.current) return Promise.resolve({status: "refused", requestId: id, reason: "busy"});
        return new Promise(resolve => {
            openAttempt.current = {id, family: target.kind, resolve};
            const slot = current.current[target.kind];
            publish({...current.current, [target.kind]: {accepted: slot?.accepted, requested: {id, target, origin: options?.origin}}});
        });
    }, [prefix, publish]);
    const returnToOrigin = useCallback<BusinessDetailsApi["returnToOrigin"]>(token => {
        if (!alive.current) return Promise.resolve("stale");
        const family = (["shot", "asset"] as const).find(kind => current.current[kind]?.accepted?.origin?.token === token);
        if (!family) return Promise.resolve("stale");
        if (openAttempt.current || returnAttempt.current) return Promise.resolve("refused");
        const slot = current.current[family]!;
        const id = `${prefix}-return-${++sequence.current}`;
        return new Promise(resolve => {
            returnAttempt.current = {id, requestId: slot.accepted!.id, resolve};
            publish({...current.current, [family]: {...slot, closeRequest: {id, requestId: slot.accepted!.id, reason: "return"}}});
        });
    }, [prefix, publish]);
    const outcome = useCallback((event: DetailPanelOutcome) => {
        const attempt = openAttempt.current;
        if (!alive.current || !attempt || attempt.id !== event.requestId) return;
        const slot = current.current[attempt.family];
        if (!slot || slot.requested.id !== event.requestId) return;
        openAttempt.current = undefined;
        if (event.status === "refused") {
            publish({...current.current, [attempt.family]: slot.accepted ? {requested: slot.accepted, accepted: slot.accepted} : undefined});
            attempt.resolve({status: "refused", requestId: attempt.id, reason: event.reason});
            return;
        }
        if (slot.accepted && slot.accepted.id !== slot.requested.id) notify(slot.accepted, "replaced");
        for (const selection of deferredReplacements.current.splice(0)) notify(selection, "replaced");
        publish({...current.current, [attempt.family]: {...slot, accepted: slot.requested}});
        attempt.resolve({status: "opened", requestId: attempt.id});
    }, [publish, notify]);
    const closed = useCallback((event: DetailPanelClose) => {
        if (!alive.current) return;
        const family = (["shot", "asset"] as const).find(kind => current.current[kind]?.accepted?.id === event.requestId);
        if (!family) return;
        const accepted = current.current[family]!.accepted!;
        if (event.reason === "replaced" && openAttempt.current) deferredReplacements.current.push(accepted);
        else notify(accepted, event.reason);
        const returning = returnAttempt.current;
        if (returning?.requestId === event.requestId) {
            returnAttempt.current = undefined;
            afterCommit.current.push({revision: currentRevision.current + 1, run: () => returning.resolve("returned")});
        }
        publish({...current.current, [family]: undefined});
    }, [publish, notify]);
    const closeRefused = useCallback((id: string) => {
        const attempt = returnAttempt.current;
        if (!alive.current || !attempt || attempt.id !== id) return;
        returnAttempt.current = undefined;
        const family = (["shot", "asset"] as const).find(kind => current.current[kind]?.accepted?.id === attempt.requestId);
        if (family) publish({...current.current, [family]: {...current.current[family]!, closeRequest: undefined}});
        attempt.resolve("refused");
    }, [publish]);
    const unavailable = useCallback((id: string) => {
        const attempt = openAttempt.current;
        if (!alive.current || !attempt || attempt.id !== id) return;
        openAttempt.current = undefined;
        const slot = current.current[attempt.family];
        for (const selection of deferredReplacements.current.splice(0)) notify(selection, "replaced");
        publish({...current.current, [attempt.family]: slot?.accepted ? {requested: slot.accepted, accepted: slot.accepted} : undefined});
        attempt.resolve({status: "refused", requestId: id, reason: "unavailable"});
    }, [publish, notify]);
    const shot = slots.shot, asset = slots.asset;
    const api = useMemo(() => ({open, returnToOrigin}), [open, returnToOrigin]);
    return <BusinessDetails value={api}>{children}
        {shot?.requested.target.kind === "shot" && <DetailLoadBoundary requestId={shot.requested.id} onUnavailable={unavailable}><Suspense fallback={null}>
            <ShotDetailPanel request={{id: shot.requested.id, target: shot.requested.target.target}}
                onRequestOutcome={outcome} onClosed={closed} closeRequest={shot.closeRequest} onCloseRefused={closeRefused}
                returnLabel={(shot.accepted ?? shot.requested).origin?.label}/>
        </Suspense></DetailLoadBoundary>}
        {asset?.requested.target.kind === "asset" && <DetailLoadBoundary requestId={asset.requested.id} onUnavailable={unavailable}><Suspense fallback={null}>
            <AssetDetailPanel request={{id: asset.requested.id, target: asset.requested.target.target}}
                onRequestOutcome={outcome} onClosed={closed} closeRequest={asset.closeRequest} onCloseRefused={closeRefused}
                returnLabel={(asset.accepted ?? asset.requested).origin?.label}/>
        </Suspense></DetailLoadBoundary>}
    </BusinessDetails>;
}

export function useBusinessDetails(): BusinessDetailsApi | null {return useContext(BusinessDetails);}

export function useBusinessDetailActivation() {
    const api = useBusinessDetails();
    return useCallback((event: MouseEvent<HTMLElement>, target?: BusinessDetailTarget) => {
        if (!api || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.hasAttribute("download")) return;
        const parsed = readBusinessDetailTarget(event.currentTarget.getAttribute("href") ?? "");
        if (!parsed || (target && !sameBusinessDetailTarget(target, parsed))) return;
        event.preventDefault();
        void api.open(target ?? parsed);
    }, [api]);
}

export function BusinessDetailLink({href, target, onClick, children, ...props}: Omit<ComponentProps<"a">, "target"> & {href: string; target?: BusinessDetailTarget}) {
    const activate = useBusinessDetailActivation();
    return <Link {...props} to={href} onClick={event => {onClick?.(event); activate(event, target);}}>{children}</Link>;
}
