import { describe, expect, it } from "vitest";
import { emptySlot } from "@/domain/slot";
import {
  DEFAULT_SHOT_FILTERS,
  SHOT_UNASSIGNED_BEAT,
  normalizeShotFilters,
  normalizeShotStatus,
  type Shot,
  type ShotFilters,
} from "@/domain/types";
import { filterShots, shotMatchesFilters } from "@/lib/shotFilters";

function shot(partial: Partial<Shot> & Pick<Shot, "id">): Shot {
  return {
    projectId: "project",
    episodeId: "episode",
    order: 1,
    shotNumber: partial.id,
    status: "draft",
    firstFrame: emptySlot(),
    lastFrame: emptySlot(),
    clip: emptySlot(),
    category: "",
    durationSec: 0,
    content: "",
    notes: "",
    sceneCloseup: "",
    sound: "",
    emotion: "",
    cameraAngle: "",
    cameraGear: "",
    focalLength: "",
    characterIds: [],
    ...partial,
  };
}

describe("normalizeShotStatus", () => {
  it("defaults unknown and missing values to draft", () => {
    expect(normalizeShotStatus(undefined)).toBe("draft");
    expect(normalizeShotStatus("unknown")).toBe("draft");
    expect(normalizeShotStatus("approved")).toBe("approved");
  });
});

describe("normalizeShotFilters", () => {
  it("returns empty filters for missing input and dedupes known values", () => {
    expect(normalizeShotFilters(undefined)).toEqual(DEFAULT_SHOT_FILTERS);
    expect(
      normalizeShotFilters({
        statuses: ["ready", "ready", "nope"],
        beatIds: ["beat", "beat", SHOT_UNASSIGNED_BEAT],
        gaps: ["missingClip", "missingFirstFrame", "other"],
      }),
    ).toEqual({
      statuses: ["ready"],
      beatIds: ["beat", SHOT_UNASSIGNED_BEAT],
      gaps: ["missingClip", "missingFirstFrame"],
    });
  });
});

describe("shot filter predicates", () => {
  const base: ShotFilters = { statuses: [], beatIds: [], gaps: [] };

  it("matches combined status, beat, and gap filters", () => {
    const draftLoose = shot({ id: "a", status: "draft" });
    const readyBeat = shot({ id: "b", status: "ready", beatId: "beat" });
    const framedMissing = shot({
      id: "c",
      status: "framed",
      beatId: "beat",
      firstFrame: {
        ...emptySlot(),
        result: { mediaId: "frame", kind: "image" },
      },
    });
    const clipped = shot({
      id: "d",
      status: "clipped",
      clip: { ...emptySlot(), result: { mediaId: "clip", kind: "video" } },
    });

    expect(
      shotMatchesFilters(draftLoose, {
        ...base,
        statuses: ["draft"],
        beatIds: [SHOT_UNASSIGNED_BEAT],
        gaps: ["missingFirstFrame"],
      }),
    ).toBe(true);
    expect(
      shotMatchesFilters(readyBeat, {
        ...base,
        statuses: ["ready"],
        beatIds: ["beat"],
      }),
    ).toBe(true);
    expect(
      shotMatchesFilters(framedMissing, {
        ...base,
        gaps: ["missingFirstFrame"],
      }),
    ).toBe(false);
    expect(
      filterShots([draftLoose, readyBeat, framedMissing, clipped], {
        statuses: ["draft", "ready"],
        beatIds: [],
        gaps: ["missingClip"],
      }).map((item) => item.id),
    ).toEqual(["a", "b"]);
    // Within a dimension, multi-select is OR (same as status/beat).
    const complete = shot({
      id: "e",
      firstFrame: {
        ...emptySlot(),
        result: { mediaId: "frame", kind: "image" },
      },
      clip: { ...emptySlot(), result: { mediaId: "clip", kind: "video" } },
    });
    expect(
      filterShots([draftLoose, framedMissing, clipped, complete], {
        ...base,
        gaps: ["missingFirstFrame", "missingClip"],
      }).map((item) => item.id),
    ).toEqual(["a", "c", "d"]);
  });

  it("treats missing status as draft when filtering", () => {
    const legacy = shot({ id: "legacy" });
    delete (legacy as { status?: string }).status;
    expect(
      shotMatchesFilters(legacy, { ...base, statuses: ["draft"] }),
    ).toBe(true);
  });
});
