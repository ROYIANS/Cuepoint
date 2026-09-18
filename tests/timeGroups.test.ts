import { describe, expect, it } from "vitest";
import { groupThreadsByTime } from "@/components/agent/timeGroups";
import type { ChatThread } from "@/domain/types";

function thread(id: string, updatedAt: Date): ChatThread {
  const iso = updatedAt.toISOString();
  return { id, title: id, createdAt: iso, updatedAt: iso };
}

describe("groupThreadsByTime", () => {
  it("groups today, yesterday, and calendar month for older threads", () => {
    const now = new Date();
    const today = new Date(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const older = new Date(now);
    older.setDate(older.getDate() - 40);
    const olderLabel =
      older.getFullYear() === now.getFullYear()
        ? older.toLocaleDateString("zh-CN", { month: "long" })
        : older.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });

    const groups = groupThreadsByTime([
      thread("t-today", today),
      thread("t-yday", yesterday),
      thread("t-older", older),
    ]);

    expect(groups.map((g) => g.label)).toEqual(["今天", "昨天", olderLabel]);
    expect(groups[0]?.threads.map((t) => t.id)).toEqual(["t-today"]);
    expect(groups[1]?.threads.map((t) => t.id)).toEqual(["t-yday"]);
    expect(groups[2]?.threads.map((t) => t.id)).toEqual(["t-older"]);
  });
});
