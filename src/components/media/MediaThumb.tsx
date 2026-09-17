import { useMedia } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Id } from "@/domain/types";

export function MediaPreview({
  mediaId,
  className = "",
  empty = "素材",
}: {
  mediaId?: Id;
  className?: string;
  empty?: string;
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
        {empty}
      </div>
    );
  }
  if (view.kind === "video") {
    return <video src={view.url} className={cn("object-cover", className)} muted playsInline />;
  }
  return <img src={view.url} alt="" className={cn("object-cover", className)} />;
}
