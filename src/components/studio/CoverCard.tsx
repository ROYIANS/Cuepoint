import { Ellipsis, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Still } from "@/components/studio/Still";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Id } from "@/domain/types";

export type CoverFrame = "wide" | "poster";

const COVER_FRAME: Record<CoverFrame, string> = {
  wide: "aspect-[16/10]",
  poster: "aspect-[2/3]",
};

const CAPTION = "mt-2.5 h-[42px] px-0.5";

function coverShell(frame: CoverFrame) {
  return cn(COVER_FRAME[frame], "w-full overflow-hidden rounded-2xl");
}

export function CoverCard({
  title,
  subtitle,
  mediaId,
  onOpen,
  actions,
  frame = "wide",
}: {
  title: string;
  subtitle: string;
  mediaId?: Id;
  onOpen: () => void;
  actions?: Array<{ label: string; tone?: "danger"; onSelect: () => void }>;
  frame?: CoverFrame;
}) {
  return (
    <div className="group relative">
      <button type="button" onClick={onOpen} aria-label={title} className="block w-full text-left">
        <div
          className={cn(
            coverShell(frame),
            "bg-card ring-foreground/8 ring-1 transition-[transform,box-shadow,ring-color] duration-200",
            "group-hover:-translate-y-0.5 group-hover:ring-brand/40 group-hover:shadow-[0_16px_36px_-22px_rgb(0_0_0_/_0.7)]",
          )}
        >
          <Still mediaId={mediaId} title={title} />
        </div>
        <div className={CAPTION}>
          <p className="truncate text-[13.5px] font-medium tracking-tight">{title}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{subtitle}</p>
        </div>
      </button>
      {actions && actions.length > 0 ? (
        <div className="absolute top-2.5 right-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="secondary"
                className="size-7 rounded-full border-0 bg-black/55 text-white shadow-none hover:bg-black/75"
                aria-label={`${title} 操作`}
              >
                <Ellipsis className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  variant={action.tone === "danger" ? "destructive" : "default"}
                  onSelect={action.onSelect}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

export function CreateTile({
  label,
  hint,
  onClick,
  frame = "wide",
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  frame?: CoverFrame;
}) {
  return (
    <button type="button" onClick={onClick} className="group block w-full text-left">
      <div
        className={cn(
          coverShell(frame),
          "text-muted-foreground flex flex-col items-center justify-center border border-dashed border-white/12 bg-white/3",
          "transition-colors group-hover:border-brand/50 group-hover:bg-brand/8 group-hover:text-brand",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-white/6 text-xl leading-none">
          <Plus className="size-5" />
        </span>
      </div>
      <div className={CAPTION}>
        <p className="truncate text-[13.5px] font-medium tracking-tight">{label}</p>
        {hint ? <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{hint}</p> : null}
      </div>
    </button>
  );
}

export function LibraryGrid({ children }: { children: ReactNode }) {
  return (
    <div className="studio-enter grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-5 gap-y-7">
      {children}
    </div>
  );
}
