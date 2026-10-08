import {
  groupModelsByVendor,
  inferModelHints,
  modelDisplayName,
} from "@/lib/ai/modelVendors";
import { describe, expect, it } from "vitest";

describe("groupModelsByVendor", () => {
  it("groups known families and slash-prefixed ids", () => {
    const groups = groupModelsByVendor([
      "gpt-5.6-luna",
      "claude-sonnet-4",
      "deepseek-chat",
      "cc-deepseek-v3.1",
      "baidu/ERNIE-4.5",
      "mystery-model",
    ]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.models]));
    expect(byKey.openai).toContain("gpt-5.6-luna");
    expect(byKey.anthropic).toContain("claude-sonnet-4");
    expect(byKey.deepseek).toEqual(expect.arrayContaining(["deepseek-chat", "cc-deepseek-v3.1"]));
    expect(byKey.baidu).toContain("baidu/ERNIE-4.5");
    expect(byKey.other).toContain("mystery-model");
  });

  it("groups OpenAI-compatible catalog ids by vendor, not the cc- prefix", () => {
    const groups = groupModelsByVendor([
      "bai-qwen3-vl-235b-a22b-instruct",
      "baidu/ERNIE-4.5-300B-A47B",
      "ByteDance-Seed/Seed-OSS-36B-Instruct",
      "cc-deepseek-v3.1",
      "cc-ernie-4.5-300b-a47b",
      "cc-glm-5",
      "cc-glm-5-turbo",
    ]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.models]));
    expect(byKey.qwen).toEqual(["bai-qwen3-vl-235b-a22b-instruct"]);
    expect(byKey.baidu).toEqual(expect.arrayContaining(["baidu/ERNIE-4.5-300B-A47B", "cc-ernie-4.5-300b-a47b"]));
    expect(byKey.bytedance).toEqual(["ByteDance-Seed/Seed-OSS-36B-Instruct"]);
    expect(byKey.deepseek).toEqual(["cc-deepseek-v3.1"]);
    expect(byKey.zhipu).toEqual(["cc-glm-5", "cc-glm-5-turbo"]);
  });

  it("groups cc- prefixed OpenAI and Gemini ids, and does not treat photo1 as o-series", () => {
    const groups = groupModelsByVendor(["cc-gpt-4o", "cc-gemini-2.5-flash", "photo1", "o1-preview"]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.models]));
    expect(byKey.openai).toEqual(["cc-gpt-4o", "o1-preview"]);
    expect(byKey.google).toEqual(["cc-gemini-2.5-flash"]);
    expect(byKey.other).toContain("photo1");
  });
});

describe("modelDisplayName / inferModelHints", () => {
  it("strips a provider prefix for the chip label", () => {
    expect(modelDisplayName("baidu/ERNIE-4.5-300B-A47B")).toBe("ERNIE-4.5-300B-A47B");
    expect(modelDisplayName("cc-glm-5")).toBe("cc-glm-5");
  });

  it("infers vision / tools / reasoning from the id", () => {
    expect(inferModelHints("bai-qwen3-vl-235b-a22b-instruct").vision).toBe(true);
    expect(inferModelHints("cc-glm-5").reasoning).toBe(true);
    expect(inferModelHints("text-embedding-3-small").tools).toBe(false);
  });
});
