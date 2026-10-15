import {createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState} from "react";

type Registration = {
    id: string;
    width: number;
    depart: (proceed: () => void, cancel: () => void) => void;
    close: () => void
};
type Host = {
    target: HTMLElement | null; width: number; docked: boolean; fullWidth: boolean; active: string | null;
    register: (registration: Registration) => () => void; request: (id: string) => void; release: (id: string) => void
};
const ContextPanelHostContext = createContext<Host | null>(null);

export function useContextPanelHost() {
    return useContext(ContextPanelHostContext);
}

export function ContextPanelHostProvider({children, target, surfaceWidth, navigationWidth}: {
    children: ReactNode; target: HTMLElement | null; surfaceWidth: number; navigationWidth: number;
}) {
    const registrations = useRef(new Map<string, Registration>());
    const [active, setActive] = useState<string | null>(null);
    const activeRef = useRef<string | null>(null);
    const generation = useRef(0);
    const pending = useRef<string | null>(null);
    const [width, setWidth] = useState(400);
    const activate = useCallback((id: string) => {
        const entry = registrations.current.get(id);
        if (!entry) return;
        activeRef.current = id;
        setActive(id);
        setWidth(entry.width);
    }, []);
    const release = useCallback((id: string) => {
        if (activeRef.current !== id) return;
        activeRef.current = null;
        setActive(null);
    }, []);
    const register = useCallback((entry: Registration) => {
        registrations.current.set(entry.id, entry);
        return () => {
            registrations.current.delete(entry.id);
            release(entry.id);
            if (pending.current === entry.id) {
                pending.current = null;
                generation.current++;
            }
        };
    }, [release]);
    const request = useCallback((id: string) => {
        if (activeRef.current === id) return;
        if (pending.current) {
            if (pending.current !== id) registrations.current.get(id)?.close();
            return;
        }
        const attempt = ++generation.current;
        const outgoing = activeRef.current && registrations.current.get(activeRef.current);
        if (!outgoing) {
            activate(id);
            return;
        }
        pending.current = id;
        outgoing.depart(() => {
            if (attempt !== generation.current || !registrations.current.has(id)) return;
            pending.current = null;
            generation.current++;
            outgoing.close();
            activate(id);
        }, () => {
            if (attempt !== generation.current) return;
            pending.current = null;
            generation.current++;
            registrations.current.get(id)?.close();
        });
    }, [activate]);
    const docked = surfaceWidth >= navigationWidth + width + 480;
    const fullWidth = !!active && !docked;
    const value = useMemo(() => ({
        target,
        width,
        docked,
        fullWidth,
        active,
        register,
        request,
        release
    }), [target, width, docked, fullWidth, active, register, request, release]);
    return <ContextPanelHostContext value={value}>{children}</ContextPanelHostContext>;
}
