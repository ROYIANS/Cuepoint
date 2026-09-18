import { Link, useRouterState } from "@tanstack/react-router";
import {
  Box,
  Cable,
  Clapperboard,
  Info,
  MapPinned,
  Menu,
  MessageSquare,
  Palette,
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

const NAV = [
  { to: "/agent", label: "对话", icon: MessageSquare, exact: false },
  { to: "/projects", label: "项目", icon: Clapperboard, exact: true },
  { to: "/characters", label: "角色", icon: UserRound, exact: false },
  { to: "/scenes", label: "场景", icon: MapPinned, exact: false },
  { to: "/props", label: "道具", icon: Box, exact: false },
  { to: "/styles", label: "风格", icon: Palette, exact: false },
  { to: "/connectors", label: "连接", icon: Cable, exact: false },
  { to: "/about", label: "关于", icon: Info, exact: false },
] as const;

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
      <aside className="studio-navigation hidden h-full w-[76px] shrink-0 flex-col items-center py-4 md:flex">
        <Link
          to="/about"
          className="mb-6 flex size-10 items-center justify-center overflow-visible transition-opacity hover:opacity-90"
          aria-label={PRODUCT_NAME_ZH}
          title={PRODUCT_NAME_ZH}
        >
          <img src={LOGO_SRC} alt="" className="size-10 object-contain drop-shadow-[0_6px_14px_rgb(0_0_0_/_0.55)]" />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex w-[60px] flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] transition-colors",
                  active
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onImport}
              className="text-muted-foreground hover:bg-white/5 hover:text-foreground mt-auto flex size-10 items-center justify-center rounded-full"
              aria-label="导入项目"
            >
              <Upload className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">从备份导入项目</TooltipContent>
        </Tooltip>
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
            className="text-muted-foreground hover:bg-white/5 hover:text-foreground pointer-events-auto flex size-9 items-center justify-center rounded-full"
            aria-label="打开导航"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>
          {onAgent ? null : (
            <Link
              to="/about"
              className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90"
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
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={closeNav}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-brand/15 text-brand"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
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
                  className="text-muted-foreground hover:bg-white/5 hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm"
                >
                  <Upload className="size-4 shrink-0" />
                  从备份导入项目
                </button>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        <div className="app-scroll relative min-h-0 min-w-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </ClickSpark>
  );
}
