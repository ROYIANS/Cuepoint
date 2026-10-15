import {ModuleLayout} from "./ModuleLayout";
import {Link, useRouterState} from "@tanstack/react-router";
import type {ReactNode} from "react";
import {AppFrame} from "./AppFrame";

const ASSET_ROUTES = [
    {to: "/characters", label: "角色"},
    {to: "/scenes", label: "场景"},
    {to: "/props", label: "道具"},
    {to: "/styles", label: "风格"},
] as const;

export function StudioShell({onImport, children}: { onImport?: () => void; children: ReactNode }) {
    const pathname = useRouterState({select: state => state.location.pathname});
    const assetSection = ASSET_ROUTES.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`));

    return <AppFrame onImport={onImport}>
        {assetSection ? <ModuleLayout navigationLabel="素材导航" navigation={<>
            <h2 className="module-nav-heading">素材库</h2>
            <div className="module-nav-group"><Link to="/assets" search={{view: "media"}}
                                                    className="module-nav-item">媒体与资料</Link><Link to="/assets"
                                                                                                       search={{view: "settings"}}
                                                                                                       className="module-nav-item">创作设定</Link>
            </div>
            <div className="module-nav-group"><h3
                className="module-nav-heading text-xs">编辑库</h3>{ASSET_ROUTES.map(item => <Link key={item.to}
                                                                                                  to={item.to}
                                                                                                  className="module-nav-item"
                                                                                                  aria-current={item === assetSection ? "page" : undefined}>{item.label}</Link>)}
            </div>
        </>}>{children}</ModuleLayout> : children}
    </AppFrame>;
}
