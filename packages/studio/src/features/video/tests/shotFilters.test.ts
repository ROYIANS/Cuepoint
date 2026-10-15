import {registerBinaryReference} from "@/platform/storage/codec";
import {verifiedShotMediaIndex, shotBinaryState} from "@/features/video/queries/shotMedia";
import { describe, expect, it } from "vitest";
import { emptySlot } from "@/features/library/models/slot";
import {DEFAULT_SHOT_FILTERS, SHOT_UNASSIGNED_BEAT, normalizeShotFilters, normalizeShotStatus, type Shot, type ShotFilters} from "@/features/video/models/shots";
import {type MediaRecord} from "@/features/library/models/media";
import { filterShots, shotMatchesFilters } from "@/features/video/services/shotFilters";

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
  const media = new Map(["frame", "clip"].map((id) => [id, { id, projectId: "project", mimeType: id === "frame" ? "image/png" : "video/mp4", filename: id, blob: new Blob([id]) } satisfies MediaRecord]));
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
      }, media),
    ).toBe(true);
    expect(
      shotMatchesFilters(readyBeat, {
        ...base,
        statuses: ["ready"],
        beatIds: ["beat"],
      }, media),
    ).toBe(true);
    expect(
      shotMatchesFilters(framedMissing, {
        ...base,
        gaps: ["missingFirstFrame"],
      }, media),
    ).toBe(false);
    expect(
      filterShots([draftLoose, readyBeat, framedMissing, clipped], {
        statuses: ["draft", "ready"],
        beatIds: [],
        gaps: ["missingClip"],
      }, media).map((item) => item.id),
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
      }, media).map((item) => item.id),
    ).toEqual(["a", "c", "d"]);
  });

  it("counts missing, wrong-kind and image placeholder results as media gaps", () => {
    const candidate = shot({ id: "placeholder", clip: { ...emptySlot(), result: { mediaId: "frame", kind: "image" } } });
    expect(shotMatchesFilters(candidate, { ...base, gaps: ["missingClip"] }, media)).toBe(true);
    candidate.clip.result = { mediaId: "absent", kind: "video" };
    expect(shotMatchesFilters(candidate, { ...base, gaps: ["missingClip"] }, media)).toBe(true);
    candidate.clip.result = { mediaId: "frame", kind: "video" };
    expect(shotMatchesFilters(candidate, { ...base, gaps: ["missingClip"] }, media)).toBe(true);
  });

  it("treats missing status as draft when filtering", () => {
    const legacy = shot({ id: "legacy" });
    delete (legacy as { status?: string }).status;
    expect(
      shotMatchesFilters(legacy, { ...base, statuses: ["draft"] }),
    ).toBe(true);
  });
});


it("keeps native logical result rows while gap filters require a verified availability snapshot", () => {
  const binary = registerBinaryReference({version: 1, workspaceId: "11111111-1111-4111-8111-111111111111", binaryId: "22222222-2222-4222-8222-222222222222", byteLength: 10, mimeType: "image/png", contentHash: "a".repeat(64)});
  const row: MediaRecord = {id: "native", projectId: "project", filename: "frame.png", mimeType: "image/png", blob: binary};
  const current = shot({id: "with-native-result", firstFrame: {...emptySlot(), result: {mediaId: row.id, kind: "image"}}});
  const filters: ShotFilters = {statuses: [], beatIds: [], gaps: ["missingFirstFrame"]};
  const pending = new Map([[row.id, row]]);
  expect(shotBinaryState(pending, row.id)).toBe("pending");
  expect(shotMatchesFilters(current, filters, pending)).toBe(true);
  for (const state of ["missing", "corrupt", "error"] as const) {
    const index = verifiedShotMediaIndex(pending, new Map([[row.id, state]]));
    expect(index.get(row.id)).toBe(row);
    expect(shotMatchesFilters(current, filters, index)).toBe(true);
  }
  const ready = verifiedShotMediaIndex(pending, new Map([[row.id, "ready"]]));
  expect(shotMatchesFilters(current, filters, ready)).toBe(false);
});
