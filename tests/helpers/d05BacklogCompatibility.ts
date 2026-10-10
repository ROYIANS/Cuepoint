import {readFileSync} from "node:fs";
import {expect} from "vitest";

export const CONTEXTUAL_PROJECT_TOOLS = new Set([
    "audio_create", "audio_update", "audio_place_take", "audio_edit_clip", "audio_split_clip", "audio_remove_clip",
    "music_save_draft", "music_update_work", "music_reuse_work", "audio_generate_speech", "music_generate", "audio_generation_check"
]);
export const CONTEXTUAL_OWNER_TOOLS = new Set([
    "episode_create", "episode_update", "episode_delete", "beat_create", "beat_update", "beat_delete",
    "shot_create", "shot_update", "shot_delete", "character_create", "character_update", "character_delete",
    "scene_create", "scene_update", "scene_delete", "prop_create", "prop_update", "prop_delete",
    "style_create", "style_update", "style_delete", "creative_duplicate", "creative_reorder", "slot_update", "media_delete_orphan"
]);
type Advertisement = {name: string; description: string; parameters: Record<string, unknown>};
const descriptions = JSON.parse(readFileSync("tests/fixtures/d05/backlog-description-deltas.json", "utf8")) as Record<string, {old: string; next: string}>;
export const BACKLOG_TOOL_ADDITIONS = JSON.parse(readFileSync("tests/fixtures/d05/backlog-additions.json", "utf8")) as Advertisement[];

/** Only argument-root required flags (including root union variants) may relax.
 * Nested records, types, limits, order and every effect/approval flag stay exact.
 */
function relaxRequired(schema: Record<string, unknown>, field: string) {
    if (Array.isArray(schema.required)) schema.required = schema.required.filter(value => value !== field);
    for (const key of ["anyOf", "oneOf"]) if (Array.isArray(schema[key])) {
        for (const branch of schema[key]) relaxRequired(branch as Record<string, unknown>, field);
    }
}

export function expectedBacklogAdvertisement(original: Advertisement): Advertisement {
    const expected = structuredClone(original);
    if (CONTEXTUAL_PROJECT_TOOLS.has(expected.name)) relaxRequired(expected.parameters, "projectId");
    if (CONTEXTUAL_OWNER_TOOLS.has(expected.name)) relaxRequired(expected.parameters, "ownerId");
    const delta = descriptions[expected.name];
    if (delta) {
        expect(expected.description, `${expected.name}: immutable original description`).toBe(delta.old);
        expected.description = delta.next;
    }
    const properties = expected.parameters.properties as Record<string, Record<string, unknown>> | undefined;
    const source = expected.name === "task_read" ? properties?.source
        : ["task_create", "task_update", "task_record_write"].includes(expected.name) ? properties?.sources.items as Record<string, unknown> | undefined : undefined;
    if (source) (source.properties as Record<string, unknown>).resultKey = {type: "string", minLength: 1, maxLength: 512};
    return expected;
}

export function contextualField(name: string): "ownerId" | "projectId" | undefined {
    return CONTEXTUAL_OWNER_TOOLS.has(name) ? "ownerId" : CONTEXTUAL_PROJECT_TOOLS.has(name) ? "projectId" : undefined;
}
