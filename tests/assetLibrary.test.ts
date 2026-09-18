import { describe, expect, it } from "vitest";
import { matchesAssetSearch, parseWorldTab } from "@/lib/assetLibrary";

describe("asset discovery", () => {
  it("finds authored descriptions while excluding ownership, IDs and provenance", () => {
    const asset = { id: "secret-id", name: "信使", personality: "Cold outside, 温柔内心", projectId: "other-project", extra: { sourceAssetId: "source-id" } };
    expect(matchesAssetSearch(asset, " 温柔 ")).toBe(true);
    expect(matchesAssetSearch(asset, "COLD")).toBe(true);
    expect(matchesAssetSearch(asset, "secret-id")).toBe(false);
    expect(matchesAssetSearch(asset, "other-project")).toBe(false);
    expect(matchesAssetSearch(asset, "source-id")).toBe(false);
    expect(matchesAssetSearch(asset, " ")).toBe(true);
  });
  it("only restores known world tabs from route search", () => {
    expect(parseWorldTab("props")).toBe("props");
    expect(parseWorldTab("styles")).toBe("styles");
    expect(parseWorldTab("unknown")).toBeUndefined();
    expect(parseWorldTab(["characters"])).toBeUndefined();
  });
});
