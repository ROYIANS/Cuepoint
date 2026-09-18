import {
  SHOT_UNASSIGNED_BEAT,
  normalizeShotStatus,
  type Shot,
  type ShotFilters,
} from "@/domain/types";

export function shotBeatFilterId(shot: Pick<Shot, "beatId">): string {
  return shot.beatId ?? SHOT_UNASSIGNED_BEAT;
}

export function shotMatchesFilters(
  shot: Shot,
  filters: ShotFilters,
): boolean {
  const status = normalizeShotStatus(shot.status);
  if (filters.statuses.length > 0 && !filters.statuses.includes(status)) {
    return false;
  }
  if (
    filters.beatIds.length > 0 &&
    !filters.beatIds.includes(shotBeatFilterId(shot))
  ) {
    return false;
  }
  if (filters.gaps.length > 0) {
    const missingFirstFrame = !shot.firstFrame.result?.mediaId;
    const missingClip = !shot.clip.result?.mediaId;
    const matchesGap =
      (filters.gaps.includes("missingFirstFrame") && missingFirstFrame) ||
      (filters.gaps.includes("missingClip") && missingClip);
    if (!matchesGap) return false;
  }
  return true;
}

export function filterShots(shots: Shot[], filters: ShotFilters): Shot[] {
  if (
    filters.statuses.length === 0 &&
    filters.beatIds.length === 0 &&
    filters.gaps.length === 0
  ) {
    return shots;
  }
  return shots.filter((shot) => shotMatchesFilters(shot, filters));
}
