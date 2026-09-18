import { describe, expect, it } from "vitest";
import { formatThinkingTitle } from "@/lib/thinkingTitle";

describe("formatThinkingTitle", () => {
  it("shows 思考中 while active", () => {
    expect(formatThinkingTitle(true, 1700)).toBe("思考中");
  });

  it("shows duration when complete", () => {
    expect(formatThinkingTitle(false, 1700)).toBe("已深度思考 1.7 秒");
  });

  it("falls back without duration", () => {
    expect(formatThinkingTitle(false)).toBe("已深度思考");
  });
});
