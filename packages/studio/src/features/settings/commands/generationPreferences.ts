import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import {getGeneralAgentConfig} from "../../agent/commands/agentSettings";
import {GENERAL_AGENT_ID} from "../../agent/models/agent";
import type {MediaKind} from "../../library/models/slots";
import type {
    GenerationPreference,
    GenerationPreferences,
    GenerationPreferenceState
} from "../models/generationPreferences";
import {inspectGenerationPreferences, validateGenerationPreference} from "../../video/agent/generationSelection";
import {nowIso} from "../../../platform/identity";

/** Read-only, including first use: never initialize settings or overwrite stale defaults. */
export async function getGenerationPreferenceState(store?: ProductStore): Promise<GenerationPreferenceState> {
    const db = store ?? productDb;
    return db.transaction("r", [db.agents, db.connectors].flat(), async (db) => {
        const raw = (await db.agents.get(GENERAL_AGENT_ID))?.generationPreferences;
        return inspectGenerationPreferences(raw, await db.connectors.toArray());
    });
}

export async function getGenerationPreferences(store?: ProductStore): Promise<GenerationPreferences> {
    const db = store ?? productDb;
    const state = await getGenerationPreferenceState(db);
    const issues = Object.values(state.issues).flat();
    if (issues.length) throw new Error(issues.join("；"));
    return state.preferences;
}

/** Explicit user preference action only, never an Agent business-CRUD tool. */
export async function saveGenerationPreference(kind: MediaKind, value: GenerationPreference | null, store?: ProductStore): Promise<GenerationPreferences> {
    const db = store ?? productDb;
    if (kind !== "image" && kind !== "video") throw new Error("生成偏好类型无效");
    return db.transaction("rw", [db.agents, db.connectors].flat(), async (db) => {
        const connectors = await db.connectors.toArray();
        const validated = value === null ? undefined : validateGenerationPreference(kind, value, connectors);
        const agent = await getGeneralAgentConfig(db);
        // Preserve the other modality exactly, including a stale choice needing explicit repair.
        const stored = agent.generationPreferences;
        const preferences: GenerationPreferences = {
            ...(stored?.image === undefined ? {} : {image: stored.image}),
            ...(stored?.video === undefined ? {} : {video: stored.video}),
        };
        if (validated === undefined) delete preferences[kind];
        else preferences[kind] = validated;
        await db.agents.update(agent.id, {generationPreferences: preferences, updatedAt: nowIso()});
        return inspectGenerationPreferences(preferences, connectors).preferences;
    });
}
