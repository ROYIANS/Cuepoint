import { db } from "./database";
import { getGeneralAgentConfig } from "./agentSettings";
import { GENERAL_AGENT_ID } from "@/domain/agent";
import type { MediaKind } from "@/domain/types";
import type { GenerationPreference, GenerationPreferences, GenerationPreferenceState } from "@/domain/generationPreferences";
import { inspectGenerationPreferences, validateGenerationPreference } from "@/lib/agent/generationSelection";
import { nowIso } from "@/lib/ids";

/** Read-only, including first use: never initialize settings or overwrite stale defaults. */
export async function getGenerationPreferenceState(): Promise<GenerationPreferenceState> {
  return db.transaction("r", db.agents, db.connectors, async () => {
    const raw = (await db.agents.get(GENERAL_AGENT_ID))?.generationPreferences;
    return inspectGenerationPreferences(raw, await db.connectors.toArray());
  });
}
export async function getGenerationPreferences(): Promise<GenerationPreferences> {
  const state = await getGenerationPreferenceState();
  const issues = Object.values(state.issues).flat();
  if (issues.length) throw new Error(issues.join("；"));
  return state.preferences;
}
/** Explicit user preference action only, never an Agent business-CRUD tool. */
export async function saveGenerationPreference(kind: MediaKind, value: GenerationPreference | null): Promise<GenerationPreferences> {
  if (kind !== "image" && kind !== "video") throw new Error("生成偏好类型无效");
  return db.transaction("rw", db.agents, db.connectors, async () => {
    const connectors = await db.connectors.toArray();
    const validated = value === null ? undefined : validateGenerationPreference(kind, value, connectors);
    const agent = await getGeneralAgentConfig();
    // Preserve the other modality exactly, including a stale choice needing explicit repair.
    const stored = agent.generationPreferences;
    const preferences: GenerationPreferences = {
      ...(stored?.image === undefined ? {} : { image: stored.image }),
      ...(stored?.video === undefined ? {} : { video: stored.video }),
    };
    if (validated === undefined) delete preferences[kind];
    else preferences[kind] = validated;
    await db.agents.update(agent.id, { generationPreferences: preferences, updatedAt: nowIso() });
    return inspectGenerationPreferences(preferences, connectors).preferences;
  });
}
