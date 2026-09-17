import { MediaPreview } from "@/components/media/MediaThumb";
import { stillTone } from "@/lib/library";
import { cn } from "@/lib/utils";
import type { Id } from "@/domain/types";

export function Still({
  mediaId,
  title,
  className,
}: {
  mediaId?: Id;
  title: string;
  className?: string;
}) {
  if (mediaId) {
    return <MediaPreview mediaId={mediaId} className={cn("size-full", className)} empty="" />;
  }

  const tone = stillTone(title);
  const mark = title.trim().slice(0, 1) || "镜";

  return (
    <div
      className={cn("relative flex size-full items-end overflow-hidden p-4", className)}
      style={{
        background: `linear-gradient(160deg, ${tone.from}, ${tone.to})`,
      }}
    >
      <span className="font-display text-[28px] leading-none text-white/55">{mark}</span>
    </div>
  );
}
