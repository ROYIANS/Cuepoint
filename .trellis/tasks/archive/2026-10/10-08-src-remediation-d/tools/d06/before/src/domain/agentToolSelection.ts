import type {AgentRun} from "./agent";

export const DISCOVERY_TOOL_NAME = "load_tool_groups";
export const MAX_LOADED_TOOLS = 36;

export function getOfferedToolNames(run: Pick<AgentRun, "enabledToolNames" | "toolLoading" | "interactionMode">): string[] {
    if (run.interactionMode === "conversation") return [];
    if (!run.toolLoading) return run.enabledToolNames ?? [];
    const allowed = run.enabledToolNames ?? [];
    return [...new Set([...run.toolLoading.foundationToolNames, ...run.toolLoading.loadedToolNames])].filter((name) => allowed.includes(name));
}

/** A call must have been offered in its own request, not merely loaded later. */
export function toolNamesForCall(run: AgentRun, step: number): string[] {
    if (!run.toolLoading) return run.enabledToolNames ?? [];
    return (run.offeredTools?.find((offer) => offer.step === step)?.names ?? []).filter((name) => run.enabledToolNames?.includes(name));
}
