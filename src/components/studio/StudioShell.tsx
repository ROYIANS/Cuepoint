import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Cable,
  FolderOpen,
  ListChecks,
  Library,
  Menu,
  MessageSquare,
  Settings2,
  Upload,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ClickSpark } from "@/components/ui/click-spark";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LOGO_SRC, PRODUCT_NAME_ZH } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ASSET_ROUTES = [
  { to: "/characters", label: "角色" },
  { to: "/scenes", label: "场景" },
  { to: "/props", label: "道具" },
  { to: "/styles", label: "风格" },
] as const;

function matchesPath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

const NAV = [
  {
    to: "/agent", label: "创作助手", icon: MessageSquare,
    isActive: (path: string) => matchesPath(path, "/agent") && !matchesPath(path, "/agent/tasks"),
  },
  { to: "/ips", label: "我的 IP", icon: UserRound, isActive: (path: string) => matchesPath(path, "/ips") },
  { to: "/projects", label: "项目", icon: FolderOpen, isActive: (path: string) => matchesPath(path, "/projects") },
  {
    to: "/assets", label: "素材库", icon: Library,
    isActive: (path: string) => matchesPath(path, "/assets") || ASSET_ROUTES.some((item) => matchesPath(path, item.to)),
  },
  { to: "/agent/tasks", label: "任务", icon: ListChecks, isActive: (path: string) => matchesPath(path, "/agent/tasks") },
] as const;

const UTILITIES = [
  { to: "/connectors", label: "连接与模型", icon: Cable, isActive: (path: string) => matchesPath(path, "/connectors") },
  { to: "/settings", label: "设置与帮助", icon: Settings2, isActive: (path: string) => matchesPath(path, "/settings") || matchesPath(path, "/about") },
] as const;

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function StudioShell({
  onImport,
  children,
}: {
  onImport?: () => void;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const onAgent = pathname === "/agent" || pathname.startsWith("/agent/");

  const assetSection = ASSET_ROUTES.find((item) => matchesPath(pathname, item.to));

  const closeNav = () => setNavOpen(false);

  return (
    <ClickSpark
      className="studio-floor flex h-dvh overflow-hidden"
      sparkColor="#fff"
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
    >
      <aside className="studio-navigation hidden h-full w-[76px] shrink-0 flex-col items-center overflow-y-auto py-4 md:flex">
        <Link
          to="/about"
          className={cn("mb-6 flex size-10 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-90", FOCUS)}
          aria-label={PRODUCT_NAME_ZH}
          title={PRODUCT_NAME_ZH}
        >
          <img src={LOGO_SRC} alt="" className="size-10 object-contain drop-shadow-[0_6px_14px_rgb(0_0_0_/_0.55)]" />
        </Link>
        <nav aria-label="工作室导航" className="flex w-full flex-1 flex-col items-center gap-1">
          {[...NAV, ...UTILITIES].map((item, index) => {
            const active = item.isActive(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: true }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] whitespace-nowrap transition-colors",
                  FOCUS,
                  index === NAV.length && "mt-auto",
                  active
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {onImport ? <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onImport}
              className={cn("text-muted-foreground hover:bg-white/5 hover:text-foreground mt-2 flex size-10 shrink-0 items-center justify-center rounded-full", FOCUS)}
              aria-label="导入项目"
            >
              <Upload className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">从备份导入项目</TooltipContent>
        </Tooltip> : null}
      </aside>

      <div className="studio-content-surface relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "studio-mobile-header bg-sidebar/80 sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b px-3 backdrop-blur-md md:hidden",
            // On /agent the bar overlays ChatHeader. Keep it full-width for layout
            // but pass clicks through except the menu button — otherwise the topic
            // control on the chat header right side never receives input.
            onAgent &&
              "pointer-events-none absolute inset-x-0 top-0 border-b-0 bg-transparent backdrop-blur-none",
          )}
        >
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className={cn("text-muted-foreground hover:bg-white/5 hover:text-foreground pointer-events-auto flex size-9 items-center justify-center rounded-full", FOCUS)}
            aria-label="打开导航"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>
          {onAgent ? null : (
            <Link
              to="/about"
              className={cn("flex min-w-0 items-center gap-2 rounded-md transition-opacity hover:opacity-90", FOCUS)}
              aria-label={PRODUCT_NAME_ZH}
            >
              <img src={LOGO_SRC} alt="" className="size-7 object-contain" />
              <span className="truncate text-sm font-semibold">{PRODUCT_NAME_ZH}</span>
            </Link>
          )}
        </header>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent
            side="left"
            className="bg-sidebar w-[min(280px,85vw)] gap-0 p-0 sm:max-w-[280px]"
          >
            <SheetHeader className="border-b px-4 py-4">
              <SheetTitle className="flex items-center gap-2 text-base">
                <img src={LOGO_SRC} alt="" className="size-7 object-contain" />
                {PRODUCT_NAME_ZH}
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="工作室导航" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
              {[...NAV, ...UTILITIES].map((item, index) => {
                const active = item.isActive(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: true }}
                    aria-current={active ? "page" : undefined}
                    onClick={closeNav}
                    className={cn(
                      "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      FOCUS,
                      index === NAV.length && "mt-auto",
                      active
                        ? "bg-brand/15 text-brand"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {onImport ? (
              <div className="border-t p-3">
                <button
                  type="button"
                  onClick={() => {
                    closeNav();
                    onImport();
                  }}
                  className={cn("text-muted-foreground hover:bg-white/5 hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm", FOCUS)}
                >
                  <Upload className="size-4 shrink-0" />
                  从备份导入项目
                </button>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        <div className="app-scroll relative min-h-0 min-w-0 flex-1 overflow-auto">
          {assetSection ? (
            <nav aria-label="素材库路径" className="flex items-center gap-2 px-4 pt-5 text-sm sm:px-10">
              <Link to="/assets" className={cn("text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm", FOCUS)}>
                <ArrowLeft className="size-3.5" aria-hidden />
                素材库
              </Link>
              <span className="text-muted-foreground/50" aria-hidden>/</span>
              <span className="text-muted-foreground">{assetSection.label}</span>
            </nav>
          ) : null}
          {children}
        </div>
      </div>
    </ClickSpark>
  );
}
