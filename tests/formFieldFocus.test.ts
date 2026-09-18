import { describe, expect, it } from "vitest";
import { isFormFieldTarget } from "@/lib/formFieldFocus";
import {
  beatGroupIds,
  retainVisibleSelectedIds,
  stepActiveShotId,
} from "@/lib/shotKeyboard";

describe("isFormFieldTarget", () => {
  it("treats input, textarea, select, and contenteditable as form fields", () => {
    expect(isFormFieldTarget({ tagName: "INPUT" } as EventTarget)).toBe(true);
    expect(isFormFieldTarget({ tagName: "TEXTAREA" } as EventTarget)).toBe(true);
    expect(isFormFieldTarget({ tagName: "SELECT" } as EventTarget)).toBe(true);
    expect(isFormFieldTarget({ tagName: "DIV", isContentEditable: true } as EventTarget)).toBe(
      true,
    );
    expect(
      isFormFieldTarget({
        tagName: "SPAN",
        closest: (selector: string) =>
          selector.includes("contenteditable") ? {} : null,
      } as EventTarget),
    ).toBe(true);
  });

  it("yields to overlay / checkbox / listbox controls used by bulk UI", () => {
    expect(
      isFormFieldTarget({
        tagName: "DIV",
        closest: (selector: string) =>
          selector.includes("[role='checkbox']") ||
          selector.includes("[data-slot='select-content']") ||
          selector.includes("[data-slot='popover-content']")
            ? {}
            : null,
      } as EventTarget),
    ).toBe(true);
    expect(
      isFormFieldTarget({
        tagName: "DIV",
        closest: (selector: string) =>
          selector.includes("[role='option']") ? {} : null,
      } as EventTarget),
    ).toBe(true);
  });

  it("allows shortcuts on ordinary non-form targets", () => {
    expect(isFormFieldTarget({ tagName: "BUTTON", closest: () => null } as EventTarget)).toBe(
      false,
    );
    expect(isFormFieldTarget({ tagName: "DIV", closest: () => null } as EventTarget)).toBe(false);
    expect(isFormFieldTarget(null)).toBe(false);
  });
});

describe("stepActiveShotId", () => {
  it("starts at the ends when nothing is active", () => {
    expect(stepActiveShotId(["a", "b", "c"], undefined, 1)).toBe("a");
    expect(stepActiveShotId(["a", "b", "c"], undefined, -1)).toBe("c");
  });

  it("steps within bounds and clamps at the ends", () => {
    expect(stepActiveShotId(["a", "b", "c"], "a", 1)).toBe("b");
    expect(stepActiveShotId(["a", "b", "c"], "c", 1)).toBe("c");
    expect(stepActiveShotId(["a", "b", "c"], "b", -1)).toBe("a");
    expect(stepActiveShotId(["a", "b", "c"], "a", -1)).toBe("a");
  });

  it("recovers when the active id is missing from the visible list", () => {
    expect(stepActiveShotId(["a", "b"], "gone", 1)).toBe("a");
    expect(stepActiveShotId(["a", "b"], "gone", -1)).toBe("b");
  });
});

describe("beatGroupIds", () => {
  it("keeps shot moves inside the current beat group", () => {
    const shots = [
      { id: "s1", beatId: "b1" },
      { id: "s2", beatId: "b1" },
      { id: "s3", beatId: "b2" },
      { id: "s4" },
    ];
    expect(beatGroupIds(shots, "s1", ["b1", "b2"])).toEqual(["s1", "s2"]);
    expect(beatGroupIds(shots, "s4", ["b1", "b2"])).toEqual(["s4"]);
  });
});

describe("retainVisibleSelectedIds", () => {
  it("keeps only ids that remain visible after filtering", () => {
    expect([...retainVisibleSelectedIds(["a", "b", "c"], ["a", "c"])].sort()).toEqual([
      "a",
      "c",
    ]);
    expect(retainVisibleSelectedIds(["hidden"], ["a", "b"]).size).toBe(0);
  });
});
