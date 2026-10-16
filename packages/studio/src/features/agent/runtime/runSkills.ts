import type {AgentInteractionMode, AgentToolLoading} from "../models/agent";
import type {ProjectKind} from "../../projects/models/project";
import type {InstalledSkillsSnapshot} from "../skills/models/installedSkill";
import {filterProjectMemoryTools} from "../../memory/agent/memoryToolNames";
import {INSTALLED_SKILL_TOOL_NAMES, installedSkillInstructions} from "../skills/runtime/disclosure";
import {assembleSkills} from "./skills";
import {createToolLoading, DISCOVERY_TOOL_NAME, toolLoadingInstructions} from "./toolLoading";

export interface RunSkillSurface {
    readonly enabledToolNames: string[];
    readonly toolLoading: AgentToolLoading | undefined;
    readonly skillInstructions: string;
}

/** New-run admission and next-send preview share the exact definitions/guidance layer. */
export function composeRunSkills(input: {
    readonly enabledSkillIds: readonly string[];
    readonly taskToolNames: readonly string[];
    readonly projectId?: string;
    readonly projectKind?: ProjectKind;
    readonly interactionMode: AgentInteractionMode;
    readonly installedSkills?: InstalledSkillsSnapshot;
}): RunSkillSurface {
    if (input.interactionMode === "conversation") return {enabledToolNames: [], toolLoading: undefined, skillInstructions: ""};
    const builtin = assembleSkills(input.enabledSkillIds);
    const fixed = input.installedSkills?.entries.length ? INSTALLED_SKILL_TOOL_NAMES : [];
    // Fixed read helpers participate before capability loading calculates its cap.
    const allowed = filterProjectMemoryTools([...new Set([...builtin.enabledToolNames, ...input.taskToolNames, ...fixed])], input.projectId, input.interactionMode);
    const toolLoading = createToolLoading(input.enabledSkillIds, allowed, input.projectKind);
    return {
        enabledToolNames: toolLoading ? [...new Set([...allowed, DISCOVERY_TOOL_NAME])] : allowed,
        toolLoading,
        skillInstructions: [toolLoading ? toolLoadingInstructions(toolLoading) : builtin.skillInstructions,
            installedSkillInstructions(input.installedSkills)].filter(Boolean).join("\n"),
    };
}
