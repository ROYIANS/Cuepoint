import { validShotMediaId, type ShotMediaIndex } from "@/lib/shotMedia";
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
  media: ShotMediaIndex = new Map(),
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
    const missingFirstFrame = !validShotMediaId(shot.firstFrame.result, "image", shot.projectId, media);
    const missingClip = !validShotMediaId(shot.clip.result, "video", shot.projectId, media);
    const matchesGap =
      (filters.gaps.includes("missingFirstFrame") && missingFirstFrame) ||
      (filters.gaps.includes("missingClip") && missingClip);
    if (!matchesGap) return false;
  }
  return true;
}

export function filterShots(shots: Shot[], filters: ShotFilters, media: ShotMediaIndex = new Map()): Shot[] {
  if (
    filters.statuses.length === 0 &&
    filters.beatIds.length === 0 &&
    filters.gaps.length === 0
  ) {
    return shots;
  }
  return shots.filter((shot) => shotMatchesFilters(shot, filters, media));
}
