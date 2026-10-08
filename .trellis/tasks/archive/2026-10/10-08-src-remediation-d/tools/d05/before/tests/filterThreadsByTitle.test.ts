import { describe, expect, it } from "vitest";
import { filterThreadsByTitle } from "@/components/agent/filterThreadsByTitle";
import type { ChatThread } from "@/domain/types";

function thread(id: string, title: string): ChatThread {
  return {
    id,
    title,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("filterThreadsByTitle", () => {
  const threads = [
    thread("a", "角色设定讨论"),
    thread("b", "Scene Lighting"),
    thread("c", "新对话"),
  ];

  it("returns all threads when query is empty or whitespace", () => {
    expect(filterThreadsByTitle(threads, "")).toEqual(threads);
    expect(filterThreadsByTitle(threads, "   ")).toEqual(threads);
  });

  it("filters by case-insensitive English substring", () => {
    expect(filterThreadsByTitle(threads, "scene").map((t) => t.id)).toEqual(["b"]);
    expect(filterThreadsByTitle(threads, "LIGHTING").map((t) => t.id)).toEqual(["b"]);
  });

  it("filters Chinese titles with zh-CN locale folding", () => {
    expect(filterThreadsByTitle(threads, "角色").map((t) => t.id)).toEqual(["a"]);
    expect(filterThreadsByTitle(threads, "对话").map((t) => t.id)).toEqual(["c"]);
  });

  it("does not search message bodies — title only", () => {
    expect(filterThreadsByTitle(threads, "不存在的内容")).toEqual([]);
  });
});
