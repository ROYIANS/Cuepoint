import { Link, useRouterState } from "@tanstack/react-router";
import { Clapperboard, MapPinned, Palette, Upload, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { StudioField } from "@/components/studio/StudioField";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  { to: "/", label: "项目", icon: Clapperboard, exact: true },
  { to: "/characters", label: "角色", icon: UserRound, exact: false },
  { to: "/scenes", label: "场景", icon: MapPinned, exact: false },
  { to: "/styles", label: "风格", icon: Palette, exact: false },
] as const;

export function StudioShell({
  onImport,
  children,
}: {
  onImport?: () => void;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="studio-floor flex min-h-screen">
      <aside className="bg-sidebar sticky top-0 flex h-screen w-[76px] shrink-0 flex-col items-center border-r py-4">
        <div className="mb-6 flex size-10 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-[0_8px_20px_-10px_rgb(0_0_0_/_0.65)]">
          <StudioMark />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === "/" : pathname.startsWith(item.to);
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
          <TooltipContent side="right">导入项目 zip</TooltipContent>
        </Tooltip>
      </aside>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <StudioField />
        <div className="studio-grain pointer-events-none absolute -inset-[18%]" />
        <div className="app-scroll relative h-screen overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function StudioMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
