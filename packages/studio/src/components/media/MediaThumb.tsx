import {useMediaState} from "../../lib/media";
import {cn} from "../../lib/utils";
import type {Id} from "../../domain/types";

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
    const state = useMediaState(mediaId);
    if (state.status !== "ready") {
        return (
            <div
                className={cn(
                    "bg-muted text-muted-foreground flex items-center justify-center text-xs",
                    className,
                )}
            >
                {state.status === "empty" ? empty : state.status === "loading" ? "素材加载中…" : state.status === "missing" ? "素材已丢失" : state.status === "corrupt" ? "素材已损坏" : "素材读取失败"}
            </div>
        );
    }
    const view = state.media;
    if (view.kind === "video") {
        return <video src={view.url} onError={view.onError} aria-label={label}
                      className={cn(inspect ? "object-contain" : "object-cover", className)} controls={inspect}
                      muted={!inspect} playsInline preload="metadata"/>;
    }
    return <img src={view.url} onError={view.onError} alt={inspect ? label : ""}
                className={cn(inspect ? "object-contain" : "object-cover", className)}/>;
}
