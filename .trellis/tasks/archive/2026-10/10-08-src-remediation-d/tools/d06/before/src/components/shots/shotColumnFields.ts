import type {Shot, ShotColumnId} from "@/domain/types";

export type TextShotColumnId = Exclude<ShotColumnId, "durationSec" | "characters" | "scene">;
export type TextShotField = "content" | "notes" | "category" | "sound" | "emotion" | "cameraAngle" | "cameraGear" | "focalLength" | "sceneCloseup";
export const TEXT_SHOT_FIELDS = {
    content: "content", notes: "notes", category: "category", sound: "sound", emotion: "emotion",
    cameraAngle: "cameraAngle", cameraGear: "cameraGear", focalLength: "focalLength", sceneCloseup: "sceneCloseup",
} as const satisfies Record<TextShotColumnId, TextShotField>;

export function textShotPatch(column: TextShotColumnId, value: string): Partial<Pick<Shot, TextShotField>> {
    return {[TEXT_SHOT_FIELDS[column]]: value};
}

import type {ColumnDef} from "@/domain/columns";
import type {ShotWorkspaceView} from "@/domain/types";

export function gridColumns(workspaceView: ShotWorkspaceView, visibleDefs: ColumnDef[]) {
    // Media: keep frame/clip tiles at a fixed band; only 内容 grows with the viewport.
    if (workspaceView === "media") {
        return "52px 64px 108px 220px 220px 220px minmax(220px, 1fr)";
    }
    return `52px 64px 108px ${visibleDefs.map((column) => `${column.width}px`).join(" ")}`;
}
