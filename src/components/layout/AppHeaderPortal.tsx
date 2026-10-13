import {createContext, type ReactNode, useContext} from "react";
import {createPortal} from "react-dom";

export const AppHeaderContext = createContext<HTMLElement | null>(null);

/** Move presentation only; the feature's React context and action owners stay intact. */
export function AppHeaderPortal({children}: {children: ReactNode}) {
    const target = useContext(AppHeaderContext);
    return target ? createPortal(children, target) : null;
}
