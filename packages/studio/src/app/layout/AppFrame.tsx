import {Link, useRouter, useRouterState} from "@tanstack/react-router";
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    FolderOpen,
    Home,
    ListTodo,
    Menu,
    PanelLeft,
    Settings,
    Upload,
    Users
} from "../../ui/icons";
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {useAutoUpdateCheck} from "../../features/settings/ui/useAutoUpdateCheck";
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle} from "../../ui/sheet";
import {Tooltip, TooltipContent, TooltipTrigger} from "../../ui/tooltip";
import {AppHeaderContext} from "./AppHeaderPortal";
import {ModuleNavigationContext} from "./ModuleLayout";
import {ContextPanelHostProvider, useContextPanelHost} from "./ContextPanelHost";
import {getHistoryNavigation} from "../navigation/historyNavigation";
import {LOGO_SRC, PRODUCT_NAME_ZH} from "@cuepoint/distribution/brand";
import {cn} from "../../ui/cn";
import {getWindowChromeKind} from "../../platform/runtime/windowChrome";

function matchesPath(pathname: string, target: string) {
    return pathname === target || pathname.startsWith(`${target}/`);
}

const NAV = [
    {
        to: "/agent",
        label: "创作助手",
        icon: Home,
        active: (path: string) => matchesPath(path, "/agent") && !matchesPath(path, "/agent/tasks")
    },
    {to: "/ips", label: "IP", icon: Users, active: (path: string) => matchesPath(path, "/ips")},
    {
        to: "/projects",
        label: "项目",
        icon: FolderOpen,
        active: (path: string) => matchesPath(path, "/projects") || matchesPath(path, "/p")
    },
    {
        to: "/assets",
        label: "素材库",
        icon: BookOpen,
        active: (path: string) => ["/assets", "/characters", "/scenes", "/props", "/styles"].some(target => matchesPath(path, target))
    },
    {to: "/agent/tasks", label: "任务", icon: ListTodo, active: (path: string) => matchesPath(path, "/agent/tasks")},
    {
        to: "/settings",
        label: "设置",
        icon: Settings,
        active: (path: string) => matchesPath(path, "/settings") || matchesPath(path, "/about") || matchesPath(path, "/connectors")
    },
] as const;
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-chrome)]";

/** Window and navigation presentation. Studio and workspace retain their owners. */
export function AppFrame({children, onImport, contentScroll = "auto"}: {
    children: ReactNode;
    onImport?: () => void;
    contentScroll?: "auto" | "hidden"
}) {
    useAutoUpdateCheck();
    const pathname = useRouterState({select: state => state.location.pathname});
    const router = useRouter();
    const history = getHistoryNavigation(router.history);
    const capabilities = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
    const [navOpen, setNavOpen] = useState(false);
    const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null);
    const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
    const [surface, setSurface] = useState<HTMLDivElement | null>(null);
    const [surfaceWidth, setSurfaceWidth] = useState(0);
    const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
    const [collapsed, setCollapsed] = useState(false);
    const navigationOpener = useRef<HTMLElement | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [registrations, setRegistrations] = useState<Map<symbol, number>>(() => new Map());
    useEffect(() => {
        const query = window.matchMedia("(max-width: 767px)");
        const update = () => {
            setNarrow(query.matches);
            setMobileOpen(false);
        };
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    useEffect(() => {
        if (!surface) return;
        const observer = new ResizeObserver(entries => setSurfaceWidth(entries[0].contentRect.width));
        observer.observe(surface);
        setSurfaceWidth(surface.clientWidth);
        return () => observer.disconnect();
    }, [surface]);
    const register = useCallback((width: number) => {
        const key = Symbol();
        setRegistrations(previous => new Map(previous).set(key, width));
        return () => setRegistrations(previous => {
            const next = new Map(previous);
            next.delete(key);
            return next;
        });
    }, []);
    const open = narrow ? mobileOpen : !collapsed;
    const setOpen = useCallback((value: boolean) => {
        if (narrow) {
            if (value && document.activeElement instanceof HTMLElement) navigationOpener.current = document.activeElement;
            setMobileOpen(value);
        } else setCollapsed(!value);
    }, [narrow]);
    const navigation = useMemo(() => ({
        open,
        setOpen,
        toggle: () => setOpen(!open),
        registered: registrations.size > 0,
        narrow,
        register,
        opener: navigationOpener
    }), [open, setOpen, registrations.size, narrow, register]);
    const navigationWidth = !narrow && open ? Math.max(0, ...registrations.values()) : 0;
    const isolated = narrow && mobileOpen;
    const chromeKind = getWindowChromeKind();
    const section = NAV.find(item => item.active(pathname));

    function renderNavigation(mobile: boolean) {
        return <nav aria-label="应用导航" className={cn("app-navigation-list", mobile && "app-mobile-nav p-3")}>
            {NAV.map((item, index) => {
                const selected = item.active(pathname), Icon = item.icon;
                const link = <Link to={item.to} activeOptions={{exact: true}} aria-label={item.label}
                                   aria-current={selected ? "page" : undefined}
                                   onClick={mobile ? () => setNavOpen(false) : undefined}
                                   className={cn("app-nav-item", FOCUS, index === 6 && "app-nav-utility-first")}>
                    <Icon weight={selected ? "fill" : "regular"} className="size-4 shrink-0" aria-hidden/><span
                    className="app-nav-label">{item.label}</span>
                </Link>;
                return mobile ? <div className={index === 6 ? "mt-auto" : undefined}
                                     key={item.to}>{index === 6 && importButton(true)}{link}</div>
                    : <div key={item.to} className={index === 6 ? "mt-auto" : undefined}>{index === 6 && onImport &&
                        <Tooltip><TooltipTrigger asChild>{importButton(false)}</TooltipTrigger><TooltipContent
                            side="right">从备份导入项目</TooltipContent></Tooltip>}<Tooltip><TooltipTrigger
                        asChild>{link}</TooltipTrigger><TooltipContent
                        side="right">{item.label}</TooltipContent></Tooltip></div>;
            })}
        </nav>;
    }

    const importButton = (mobile: boolean) => onImport ? <button type="button" aria-label="导入项目"
                                                                 className={cn("app-nav-item app-navigation-import", FOCUS, mobile && "w-full justify-start")}
                                                                 onClick={() => {
                                                                     setNavOpen(false);
                                                                     onImport();
                                                                 }}><Upload className="size-4 shrink-0"
                                                                            aria-hidden/><span
        className={mobile ? undefined : "app-nav-label"}>导入项目</span></button> : null;
    return <div className="app-frame studio-floor" data-window-chrome={chromeKind}>
        <ModuleNavigationContext value={navigation}>
            <ContextPanelHostProvider target={panelHost} surfaceWidth={surfaceWidth} navigationWidth={navigationWidth}>
                <AppHeaderContext value={headerHost}>
                    <header className="app-topbar" inert={isolated} aria-hidden={isolated || undefined}
                            data-tauri-drag-region={chromeKind === "macos-overlay" ? "deep" : undefined}>
                        <div className="app-topbar-leading">
                            <Link to="/about" aria-label={PRODUCT_NAME_ZH} data-tauri-drag-region="false"
                                  className={cn("app-topbar-brand rounded-md", FOCUS)}><img src={LOGO_SRC}
                                                                                            alt=""/></Link>
                            <button type="button" onClick={() => setNavOpen(true)} aria-label="打开应用导航"
                                    data-tauri-drag-region="false"
                                    className={cn("app-mobile-nav-trigger app-header-shortcut", FOCUS)}><Menu
                                className="size-4" aria-hidden/></button>
                        </div>
                        <div className="app-history-controls" data-tauri-drag-region="false">
                            <button type="button" aria-label="后退" disabled={!capabilities.canBack}
                                    onClick={history.back} className={cn("app-header-shortcut", FOCUS)}><ArrowLeft
                                className="size-4" aria-hidden/></button>
                            <button type="button" aria-label="前进" disabled={!capabilities.canForward}
                                    onClick={history.forward} className={cn("app-header-shortcut", FOCUS)}><ArrowRight
                                className="size-4" aria-hidden/></button>
                            {navigation.registered &&
                                <button type="button" aria-label={open ? "收起模块导航" : "展开模块导航"}
                                        aria-expanded={open} onClick={navigation.toggle}
                                        className={cn("app-header-shortcut", FOCUS)}><PanelLeft className="size-4"
                                                                                                aria-hidden/></button>}
                        </div>
                        <div ref={setHeaderHost} className="app-header-slot"/>
                        <div className="app-header-fallback"><span>{section?.label ?? PRODUCT_NAME_ZH}</span></div>
                    </header>
                    <div className="app-frame-body">
                        <aside className="app-navigation" inert={isolated} aria-hidden={isolated || undefined}>
                            {renderNavigation(false)}
                        </aside>
                        <WorkingSurface setSurface={setSurface} setPanelHost={setPanelHost}
                                        contentScroll={contentScroll}>{children}</WorkingSurface>
                    </div>
                    <Sheet open={navOpen} onOpenChange={setNavOpen}>
                        <SheetContent side="left" className="w-[min(280px,85vw)] gap-0 bg-sidebar p-0 sm:max-w-[280px]">
                            <SheetHeader className="shrink-0 border-b px-4 py-4"><SheetTitle
                                className="flex items-center gap-2 text-base"><img src={LOGO_SRC} alt=""
                                                                                   className="size-7 object-contain"/>{PRODUCT_NAME_ZH}
                            </SheetTitle><SheetDescription
                                className="sr-only">工作室与项目导航</SheetDescription></SheetHeader>
                            {renderNavigation(true)}
                        </SheetContent>
                    </Sheet>
                </AppHeaderContext>
            </ContextPanelHostProvider>
        </ModuleNavigationContext>
    </div>;
}

function WorkingSurface({setSurface, setPanelHost, contentScroll, children}: {
    setSurface: (node: HTMLDivElement | null) => void; setPanelHost: (node: HTMLDivElement | null) => void;
    contentScroll: "auto" | "hidden"; children: ReactNode;
}) {
    const host = useContextPanelHost();
    const fullWidth = !!host?.fullWidth;
    let detailMode: "docked" | "full-width" | undefined;
    let detailWidth: number | string = 0;
    if (host?.active) {
        detailMode = fullWidth ? "full-width" : "docked";
        detailWidth = fullWidth ? "100%" : host.width;
    }
    return <div ref={setSurface} className="studio-content-surface app-working-surface"
                data-detail-mode={detailMode}>
        <div inert={fullWidth} aria-hidden={fullWidth || undefined} data-context-panel-workspace
             data-context-panel-inactive={fullWidth || undefined}
             className={cn("app-frame-content app-scroll", contentScroll === "auto" ? "overflow-auto" : "flex flex-col overflow-hidden")}>{children}</div>
        <div ref={setPanelHost} className="app-context-panel-host"
             data-mode={detailMode} style={{width: detailWidth}}/>
    </div>;
}
