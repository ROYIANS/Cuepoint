import {Ellipsis, Plus} from "lucide-react";
import type {ReactNode} from "react";
import {Still} from "@/components/studio/Still";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "@/components/ui/dropdown-menu";
import {cn} from "@/lib/utils";
import type {Id} from "@/domain/types";

export type CoverFrame = "wide" | "poster";

const COVER_FRAME: Record<CoverFrame, string> = {
    wide: "aspect-[16/10]",
    poster: "aspect-[2/3]",
};

const CAPTION = "mt-2 h-[42px] px-0.5";

function coverShell(frame: CoverFrame) {
    return cn(COVER_FRAME[frame], "w-full overflow-hidden rounded-lg");
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
        <div className="group relative min-w-0">
            <button type="button" onClick={onOpen} aria-label={title} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <div
                    className={cn(
                        coverShell(frame),
                        "bg-card ring-foreground/10 ring-1 transition-colors motion-reduce:transition-none",
                        "group-hover:ring-brand/40",
                    )}
                >
                    <Still mediaId={mediaId} title={title}/>
                </div>
                <div className={CAPTION}>
                    <p className="truncate text-sm font-medium leading-5" title={title}>{title}</p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs leading-[18px]" title={subtitle}>{subtitle}</p>
                </div>
            </button>
            {actions && actions.length > 0 ? (
                <div
                    className="absolute top-2 right-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon-sm"
                                variant="secondary"
                                className="border border-white/10 bg-black/65 text-white hover:bg-black/85"
                                aria-label={`${title} 操作`}
                            >
                                <Ellipsis className="size-3.5"/>
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
        <button type="button" onClick={onClick} className="group block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <div
                className={cn(
                    coverShell(frame),
                    "text-muted-foreground flex flex-col items-center justify-center border border-dashed border-white/12 bg-white/3",
                    "transition-colors group-hover:border-brand/50 group-hover:bg-brand/8 group-hover:text-brand",
                )}
            >
        <span className="flex size-11 items-center justify-center rounded-full bg-white/6 text-xl leading-none">
          <Plus className="size-5"/>
        </span>
            </div>
            <div className={CAPTION}>
                <p className="truncate text-sm font-medium leading-5">{label}</p>
                {hint ? <p className="text-muted-foreground mt-0.5 truncate text-xs leading-[18px]">{hint}</p> : null}
            </div>
        </button>
    );
}

export function LibraryGrid({children}: { children: ReactNode }) {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            {children}
        </div>
    );
}
