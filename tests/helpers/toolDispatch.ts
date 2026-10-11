import { db } from "@/db/database";
import { saveToolRound } from "@/db/agentTools";
import type { AgentRun } from "@/domain/agent";

/** Lower-layer ledger fixtures simulate a prior model dispatch, without bypassing production validation. */
export async function saveFixtureToolRound(...args: Parameters<typeof saveToolRound>) {
  const [runId,content,calls,details,output,publicOutput,store]=args;
  const owner=store ?? db;
  return owner.transaction("rw",owner.tables,async tx=> {
    const run = await tx.agentRuns.get(runId);
    if (run?.toolLoading) {
      const step = run.modelStep ?? 1;
      const offeredTools = [...(run.offeredTools ?? []).filter((offer) => offer.step !== step), { step, names: calls.map((call) => call.function.name) }];
      await tx.agentRuns.update(run.id, { offeredTools });
    }
    return saveToolRound(runId,content,calls,details,output,publicOutput,tx);
  });
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
