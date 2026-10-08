import { describe, expect, it } from "vitest";
import { parseDurationInput } from "@/lib/durationInput";

describe("duration input", () => {
  it("accepts the numeric value while preserving fractional editing at the UI boundary", () => {
    expect(["1", "1.", "1.5"].map(parseDurationInput)).toEqual([1, 1, 1.5]);
    expect(["0", "", "0.", "0.5", ".5", " 12.25 "].map(parseDurationInput)).toEqual([0, 0, 0, 0.5, 0.5, 12.25]);
  });
  it("does not replace incomplete or invalid inputs with zero", () => {
    for (const raw of [".", "-", "-1", "1.2.3", "NaN", "Infinity", "1e999", "abc", "9".repeat(400)]) {
      expect(parseDurationInput(raw)).toBeUndefined();
    }
  });
});
