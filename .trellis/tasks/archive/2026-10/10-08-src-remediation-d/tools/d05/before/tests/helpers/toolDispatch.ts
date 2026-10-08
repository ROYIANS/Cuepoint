import { db } from "@/db/database";
import { saveToolRound } from "@/db/agentTools";
import type { AgentRun } from "@/domain/agent";

/** Lower-layer ledger fixtures simulate a prior model dispatch, without bypassing production validation. */
export async function saveFixtureToolRound(...args: Parameters<typeof saveToolRound>) {
  const run = await db.agentRuns.get(args[0]);
  if (run?.toolLoading) {
    const step = run.modelStep ?? 1;
    const offeredTools = [...(run.offeredTools ?? []).filter((offer) => offer.step !== step), { step, names: args[2].map((call) => call.function.name) }];
    await db.agentRuns.update(run.id, { offeredTools });
  }
  return saveToolRound(...args);
}
/** Focused tool lifecycle tests start after discovery; full discovery transport is tested separately. */
export async function preloadFixtureGroups(run: AgentRun, groupIds: string[]): Promise<AgentRun> {
  if (!run.toolLoading) return run;
  const state = run.toolLoading;
  const groups = state.groups.filter((group) => groupIds.includes(group.id));
  const toolLoading = { ...state, loadedGroupIds: groups.map((group) => group.id), loadedToolNames: [...new Set(groups.flatMap((group) => group.toolNames))] };
  const next = { ...run, toolLoading };
  await db.agentRuns.put(next);
  return next;
}
