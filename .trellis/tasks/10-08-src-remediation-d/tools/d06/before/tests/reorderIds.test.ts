import { describe, expect, it } from "vitest";
import {
  moveIdToPosition,
  reorderGroupInFullOrder,
  sameIdOrder,
} from "@/lib/reorderIds";

describe("moveIdToPosition", () => {
  it("moves an id to another position", () => {
    expect(moveIdToPosition(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveIdToPosition(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("returns null when nothing changes or ids are missing", () => {
    expect(moveIdToPosition(["a", "b"], "a", "a")).toBeNull();
    expect(moveIdToPosition(["a", "b"], "x", "b")).toBeNull();
    expect(moveIdToPosition(["a", "b"], "a", "x")).toBeNull();
  });
});

describe("sameIdOrder", () => {
  it("compares length and pairwise order", () => {
    expect(sameIdOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameIdOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameIdOrder(["a"], ["a", "b"])).toBe(false);
  });
});

describe("reorderGroupInFullOrder", () => {
  it("reorders only the group subsequence", () => {
    const full = ["a1", "a2", "b1", "b2", "b3", "c1"];
    const group = ["b1", "b2", "b3"];
    expect(reorderGroupInFullOrder(full, group, "b3", "b1")).toEqual([
      "a1",
      "a2",
      "b3",
      "b1",
      "b2",
      "c1",
    ]);
  });

  it("keeps group membership and foreign slots unchanged", () => {
    const full = ["a1", "b1", "b2", "c1"];
    const group = ["b1", "b2"];
    const next = reorderGroupInFullOrder(full, group, "b1", "b2");
    expect(next).toEqual(["a1", "b2", "b1", "c1"]);
    expect(next!.filter((id) => group.includes(id))).toEqual(["b2", "b1"]);
    expect(next!.filter((id) => !group.includes(id))).toEqual(["a1", "c1"]);
  });

  it("returns null for no-op or foreign ids", () => {
    expect(reorderGroupInFullOrder(["a", "b"], ["a", "b"], "a", "a")).toBeNull();
    expect(reorderGroupInFullOrder(["a", "b", "c"], ["a", "b"], "c", "a")).toBeNull();
  });
});
