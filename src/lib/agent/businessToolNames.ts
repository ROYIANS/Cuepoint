/** Lightweight skill allowlists: must not import repository code (settings read skills). */
export const BUSINESS_TOOL_GROUPS = {
  read: ["business_search", "business_detail", "business_read_relations", "business_read_text"],
  story: [
    "project_create", "project_update", "project_delete",
    "episode_create", "episode_update", "episode_delete",
    "beat_create", "beat_update", "beat_delete",
    "shot_create", "shot_update", "shot_delete",
    "creative_duplicate", "creative_reorder",
  ],
  assets: [
    "character_create", "character_update", "character_delete",
    "scene_create", "scene_update", "scene_delete",
    "prop_create", "prop_update", "prop_delete",
    "style_create", "style_update", "style_delete",
    "asset_copy_from_studio", "slot_update", "media_delete_orphan",
  ],
} as const;
