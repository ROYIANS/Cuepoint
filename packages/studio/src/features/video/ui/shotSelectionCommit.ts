import {normalizeShotStatus, type Shot} from "../models/shots";

/**
 * Detail-pane selection controls use the same field/baseline contract as text fields: the baseline is the value
 * the control displayed, so a concurrent Agent/grid change to that field surfaces as a conflict instead of being
 * overwritten. Character membership is an intent delta applied to the latest row by `setShotCharacterSelected`.
 */
export type ShotSelectionCommit = {patch: Partial<Pick<Shot, "status" | "sceneId">>; baseline: Partial<Pick<Shot, "status" | "sceneId">>};

export function shotStatusCommit(shot: Pick<Shot, "status">, value: string): ShotSelectionCommit {
    return {patch: {status: normalizeShotStatus(value)}, baseline: {status: shot.status}};
}

export function shotSceneCommit(shot: Pick<Shot, "sceneId">, value: string): ShotSelectionCommit {
    return {patch: {sceneId: value === "none" ? undefined : value}, baseline: {sceneId: shot.sceneId}};
}
