import type {AspectPresetId, Project} from "@/domain/types";
import type {ProjectGenerationDefaults} from "@/domain/output";
import {sameDraftStructure} from "@/lib/draftConflict";

export interface ProjectOutputValue {
    aspectPreset: AspectPresetId;
    generationDefaults: ProjectGenerationDefaults;
}

export interface ProjectOutputDraft {
    value: ProjectOutputValue;
    baseline: ProjectOutputValue;
    observed: ProjectOutputValue;
}

export function projectOutputValue(project: Pick<Project, "aspectPreset" | "generationDefaults">): ProjectOutputValue {
    return {aspectPreset: project.aspectPreset, generationDefaults: structuredClone(project.generationDefaults ?? {})};
}

export function outputDraftPatch({value, baseline}: ProjectOutputDraft): Partial<ProjectOutputValue> {
    return {
        ...(value.aspectPreset !== baseline.aspectPreset ? {aspectPreset: value.aspectPreset} : {}),
        ...(!sameDraftStructure(value.generationDefaults, baseline.generationDefaults) ? {generationDefaults: value.generationDefaults} : {}),
    };
}

/** Only fields still equal to their own baseline follow live updates. */
export function rebaseOutputDraft(state: ProjectOutputDraft, latest: ProjectOutputValue): ProjectOutputDraft {
    const dirty = outputDraftPatch(state);
    const clean = {
        ...(!("aspectPreset" in dirty) && latest.aspectPreset !== state.observed.aspectPreset ? {aspectPreset: latest.aspectPreset} : {}),
        ...(!("generationDefaults" in dirty) && !sameDraftStructure(latest.generationDefaults, state.observed.generationDefaults) ? {generationDefaults: latest.generationDefaults} : {}),
    };
    // Dirty fields keep their last applied live value, so becoming clean can consume a deferred update.
    return {value: {...state.value, ...clean}, baseline: {...state.baseline, ...clean}, observed: {...state.observed, ...clean}};
}

/** Confirm saved fields from storage; props alone cannot distinguish a later revert from stale data. */
export function acknowledgeOutputDraft(
    state: ProjectOutputDraft,
    saved: Partial<ProjectOutputValue>,
    latest: ProjectOutputValue,
    authoritative: ProjectOutputValue,
): ProjectOutputDraft {
    const rebased = rebaseOutputDraft(state, latest);
    const value = {...rebased.value};
    const baseline = {...rebased.baseline};
    if ("aspectPreset" in saved) {
        baseline.aspectPreset = authoritative.aspectPreset;
        if (state.value.aspectPreset === saved.aspectPreset) value.aspectPreset = authoritative.aspectPreset;
    }
    if ("generationDefaults" in saved) {
        baseline.generationDefaults = authoritative.generationDefaults;
        if (sameDraftStructure(state.value.generationDefaults, saved.generationDefaults)) value.generationDefaults = authoritative.generationDefaults;
    }
    // The same already-observed props must not undo this storage confirmation.
    return {value, baseline, observed: latest};
}
