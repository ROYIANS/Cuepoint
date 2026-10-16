import {type ComponentProps, type MouseEvent, type ReactNode, useCallback} from "react";
import type {ShotDetailTarget} from "../../features/video/models/shotDetailTarget";
import {BusinessDetailLink, BusinessDetailsProvider, useBusinessDetailActivation} from "./BusinessDetails";

/** Existing consumers share the single finite business-detail composition. */
export function ShotDetailsProvider({children, scopeKey}: {children: ReactNode; scopeKey?: string}) {
    return <BusinessDetailsProvider scopeKey={scopeKey}>{children}</BusinessDetailsProvider>;
}

export function useShotDetailActivation() {
    const activate = useBusinessDetailActivation();
    return useCallback((event: MouseEvent<HTMLElement>, target?: ShotDetailTarget) => {
        activate(event, target ? {kind: "shot", target} : undefined);
    }, [activate]);
}

/** Preserve canonical anchors and current caller handlers, including asset links. */
export function ShotDetailLink({target, ...props}: Omit<ComponentProps<"a">, "target"> & {href: string; target?: ShotDetailTarget}) {
    return <BusinessDetailLink {...props} target={target ? {kind: "shot", target} : undefined}/>;
}
