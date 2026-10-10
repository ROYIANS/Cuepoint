import {Link, useRouterState} from "@tanstack/react-router";
import {ArrowLeft} from "lucide-react";
import type {ReactNode} from "react";
import {AppFrame} from "@/components/layout/AppFrame";

const ASSET_ROUTES = [
    {to: "/characters", label: "角色"},
    {to: "/scenes", label: "场景"},
    {to: "/props", label: "道具"},
    {to: "/styles", label: "风格"},
] as const;

export function StudioShell({onImport, children}: {onImport?: () => void; children: ReactNode}) {
    const pathname = useRouterState({select: state => state.location.pathname});
    const assetSection = ASSET_ROUTES.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`));

    return <AppFrame onImport={onImport}>
        {assetSection ? <nav aria-label="素材库路径" className="flex items-center gap-2 px-4 pt-4 text-xs md:px-6">
            <Link to="/assets" className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                <ArrowLeft className="size-3.5" aria-hidden/>素材库
            </Link>
            <span className="text-muted-foreground/50" aria-hidden>/</span><span className="text-muted-foreground">{assetSection.label}</span>
        </nav> : null}
        {children}
    </AppFrame>;
}
