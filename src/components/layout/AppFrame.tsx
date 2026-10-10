import {Link, useRouterState} from "@tanstack/react-router";
import {Cable, FolderOpen, Info, Library, ListChecks, Menu, MessageSquare, Upload, UserRound} from "lucide-react";
import {type ReactNode, useState} from "react";
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle} from "@/components/ui/sheet";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {LOGO_SRC, PRODUCT_NAME_ZH} from "@/lib/brand";
import {cn} from "@/lib/utils";

function matchesPath(pathname: string, target: string) {
    return pathname === target || pathname.startsWith(`${target}/`);
}

const NAV = [
    {to: "/agent", label: "创作助手", icon: MessageSquare, active: (path: string) => matchesPath(path, "/agent") && !matchesPath(path, "/agent/tasks")},
    {to: "/ips", label: "IP", icon: UserRound, active: (path: string) => matchesPath(path, "/ips")},
    {to: "/projects", label: "项目", icon: FolderOpen, active: (path: string) => matchesPath(path, "/projects") || matchesPath(path, "/p")},
    {to: "/assets", label: "素材库", icon: Library, active: (path: string) => ["/assets", "/characters", "/scenes", "/props", "/styles"].some(target => matchesPath(path, target))},
    {to: "/agent/tasks", label: "任务", icon: ListChecks, active: (path: string) => matchesPath(path, "/agent/tasks")},
    {to: "/connectors", label: "连接与模型", icon: Cable, active: (path: string) => matchesPath(path, "/connectors")},
    {to: "/about", label: "关于", icon: Info, active: (path: string) => matchesPath(path, "/about")},
] as const;

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

/** Window and navigation presentation. Studio and workspace retain their own owners. */
export function AppFrame({children, onImport, contentScroll = "auto"}: {
    children: ReactNode;
    onImport?: () => void;
    contentScroll?: "auto" | "hidden";
}) {
    const pathname = useRouterState({select: state => state.location.pathname});
    const [navOpen, setNavOpen] = useState(false);
    const onAgent = matchesPath(pathname, "/agent");

    function renderNavigation(mobile: boolean) {
        return <nav aria-label="应用导航" className={cn("app-navigation-list", mobile && "app-mobile-nav p-3")}>
            {NAV.map((item, index) => {
                const Icon = item.icon;
                const link = <Link to={item.to} activeOptions={{exact: true}} aria-label={item.label}
                    aria-current={item.active(pathname) ? "page" : undefined}
                    onClick={mobile ? () => setNavOpen(false) : undefined}
                    className={cn("app-nav-item", FOCUS, index === 5 && "app-nav-utility-first")}>
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden/>
                    <span className="app-nav-label">{item.label}</span>
                </Link>;
                return mobile ? <div className={index === 5 ? "mt-auto" : undefined} key={item.to}>{link}</div>
                    : <Tooltip key={item.to}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip>;
            })}
        </nav>;
    }

    const importButton = (mobile: boolean) => onImport ? <button type="button" aria-label="导入项目"
        className={cn("app-nav-item app-navigation-import", FOCUS, mobile && "w-full justify-start")}
        onClick={() => {setNavOpen(false); onImport();}}>
        <Upload className="size-4 shrink-0" aria-hidden/><span className={mobile ? undefined : "app-nav-label"}>导入项目</span>
    </button> : null;

    return <div className="app-frame studio-floor">
        <aside className="app-navigation">
            <Link to="/about" aria-label={PRODUCT_NAME_ZH} className={cn("app-navigation-brand rounded-md", FOCUS)}>
                <img src={LOGO_SRC} alt=""/><span className="text-sm font-semibold">{PRODUCT_NAME_ZH}</span>
            </Link>
            {renderNavigation(false)}
            {onImport ? <Tooltip><TooltipTrigger asChild>{importButton(false)}</TooltipTrigger><TooltipContent side="right">从备份导入项目</TooltipContent></Tooltip> : null}
        </aside>
        <div className="studio-content-surface relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className={cn("studio-mobile-header z-20 flex h-12 shrink-0 items-center gap-3 border-b bg-sidebar px-3 md:hidden", onAgent && "pointer-events-none absolute inset-x-0 top-0 border-b-0 bg-transparent")}>
                <button type="button" onClick={() => setNavOpen(true)} aria-label="打开导航"
                    className={cn("pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", FOCUS)}>
                    <Menu className="size-5" strokeWidth={1.75} aria-hidden/>
                </button>
                {onAgent ? null : <Link to="/about" className={cn("flex min-w-0 items-center gap-2 rounded-md", FOCUS)} aria-label={PRODUCT_NAME_ZH}>
                    <img src={LOGO_SRC} alt="" className="size-6 object-contain"/><span className="truncate text-sm font-semibold">{PRODUCT_NAME_ZH}</span>
                </Link>}
            </header>
            <div className={cn("app-frame-content app-scroll relative", contentScroll === "auto" ? "overflow-auto" : "flex flex-col overflow-hidden")}>
                {children}
            </div>
        </div>
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetContent side="left" className="w-[min(280px,85vw)] gap-0 bg-sidebar p-0 sm:max-w-[280px]">
                <SheetHeader className="shrink-0 border-b px-4 py-4">
                    <SheetTitle className="flex items-center gap-2 text-base"><img src={LOGO_SRC} alt="" className="size-7 object-contain"/>{PRODUCT_NAME_ZH}</SheetTitle>
                    <SheetDescription className="sr-only">工作室与项目导航</SheetDescription>
                </SheetHeader>
                {renderNavigation(true)}
                {onImport ? <div className="shrink-0 border-t p-3">{importButton(true)}</div> : null}
            </SheetContent>
        </Sheet>
    </div>;
}
