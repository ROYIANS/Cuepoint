import {describe, expect, it} from "vitest";
import {memoryInputSchema} from "@/features/memory/services/schema";
const input = {
  category: "convention" as const,
  title: "角色命名",
  topicKey: "角色命名",
  body: "使用角色表中的名称",
  applicability: "整个项目",
  tags: [],
};
describe("explicit memory inclusion", () => {
  it("rejects invented inclusion policy", () => {
    expect(
      memoryInputSchema.safeParse({ ...input, inclusion: "force" }).success,
    ).toBe(false);
  });
});
