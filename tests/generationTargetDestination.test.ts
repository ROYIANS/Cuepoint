import { describe, expect, it } from "vitest";
import { generationTargetDestination } from "@/lib/generationTargetDestination";

describe("generation target destination", () => {
  it("locates the exact shot in its owning episode", () => {
    expect(generationTargetDestination({ kind: "shot", projectId: "project", episodeId: "episode", entityId: "shot", slot: "clip" })).toEqual({
      to: "/p/$projectId/e/$episodeId/shots", params: { projectId: "project", episodeId: "episode" }, search: { shot: "shot" },
    });
  });
  it("preserves studio versus project asset ownership and encodes path segments", () => {
    expect(generationTargetDestination({ kind: "character", projectId: "studio", entityId: "a/b", slot: "front" }).to).toBe("/characters/a%2Fb");
    expect(generationTargetDestination({ kind: "scene", projectId: "p/q", entityId: "s/t", slot: "wide" }).to).toBe("/p/p%2Fq/assets/scenes/s%2Ft");
  });
});
