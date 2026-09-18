import { useMedia } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Id } from "@/domain/types";

export function MediaPreview({
  mediaId,
  className = "",
  empty = "素材",
  inspect = false,
  label = "素材预览",
}: {
  mediaId?: Id;
  className?: string;
  empty?: string;
  /** Only enable outside buttons/links; video controls are interactive. */
  inspect?: boolean;
  label?: string;
}) {
  const view = useMedia(mediaId);
  if (!view) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center text-xs",
          className,
        )}
      >
        {mediaId ? "素材加载中或已不可用" : empty}
      </div>
    );
  }
  if (view.kind === "video") {
    return <video src={view.url} aria-label={label} className={cn(inspect ? "object-contain" : "object-cover", className)} controls={inspect} muted={!inspect} playsInline preload="metadata" />;
  }
  return <img src={view.url} alt={inspect ? label : ""} className={cn(inspect ? "object-contain" : "object-cover", className)} />;
}
