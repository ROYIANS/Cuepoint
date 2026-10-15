import type {ProjectMode} from "./../../video/models/format";
import type {AspectPresetId} from "./../../video/models/format";
import type {Project} from "./project";
import {nowIso} from "../../../platform/identity";
import {createId} from "../../../platform/identity";
import {normalizeAspectPreset} from "./../../video/models/format";
import {DEFAULT_VISIBLE_COLUMNS} from "./../../video/models/shots";
import {DEFAULT_SHOT_SETTINGS} from "./../../video/models/shots";
import {emptySeriesStory} from "./../../video/models/story";
import {emptySetting} from "./../../video/models/world";

export function emptyProject(
    name: string,
    mode: ProjectMode = "film",
    aspectPreset: AspectPresetId = "16:9",
): Project {
    const at = nowIso();
    return {
        id: createId("prj"),
        name: name.trim() || "未命名项目",
        mode,
        aspectPreset: normalizeAspectPreset(aspectPreset),
        createdAt: at,
        updatedAt: at,
        columnSettings: {visible: [...DEFAULT_VISIBLE_COLUMNS]},
        shotSettings: {
            ...DEFAULT_SHOT_SETTINGS,
            filters: {statuses: [], beatIds: [], gaps: []},
        },
        story: emptySeriesStory(),
        setting: emptySetting(),
    };
}
