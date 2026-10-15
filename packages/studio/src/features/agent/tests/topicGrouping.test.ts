import {describe, expect, it} from "vitest";
import {
    formatRelativeShort,
    groupThreadsByProject,
    readTopicGrouping,
    TOPIC_GROUPING_KEY,
    writeTopicGrouping,
} from "@/features/agent/ui/topicGrouping";
import type {ChatThread} from "@/features/agent/models/chat";
import type {Project} from "@/features/projects/models/project";

const thread = (id: string, updatedAt: string, projectId?: string): ChatThread =>
    ({id, title: id, createdAt: updatedAt, updatedAt, projectId});
const project = (id: string, name: string) => ({id, name}) as Project;

describe("groupThreadsByProject", () => {
    const projects = [project("p1", "甲"), project("p2", "乙"), project("p3", "空")];
    it("orders sections by newest topic, topics newest first, unlinked last, empty projects hidden", () => {
        const groups = groupThreadsByProject([
            thread("a-old", "2026-01-01T00:00:00Z", "p1"),
            thread("none", "2026-09-01T00:00:00Z"),
            thread("b-new", "2026-05-01T00:00:00Z", "p2"),
            thread("a-new", "2026-03-01T00:00:00Z", "p1"),
            thread("gone", "2026-02-01T00:00:00Z", "deleted"),
        ], projects);
        expect(groups.map(g => g.label)).toEqual(["乙", "甲", "未关联项目"]);
        expect(groups[1].threads.map(t => t.id)).toEqual(["a-new", "a-old"]);
        expect(groups[2].threads.map(t => t.id)).toEqual(["none", "gone"]);
    });
});

describe("topic grouping preference", () => {
    const store = (value: string | null) => ({getItem: () => value, setItem: () => undefined});
    it("defaults, accepts valid values and falls back on invalid or throwing storage", () => {
        expect(readTopicGrouping(store(null))).toBe("project");
        expect(readTopicGrouping(store("time"))).toBe("time");
        expect(readTopicGrouping(store("project"))).toBe("project");
        expect(readTopicGrouping(store("weird"))).toBe("project");
        expect(readTopicGrouping({getItem: () => { throw new Error("denied"); }})).toBe("project");
    });
    it("writes under the key and ignores failures", () => {
        const seen: string[][] = [];
        writeTopicGrouping("time", {setItem: (k, v) => { seen.push([k, v]); }});
        expect(seen).toEqual([[TOPIC_GROUPING_KEY, "time"]]);
        expect(() => writeTopicGrouping("time", {setItem: () => { throw new Error("full"); }})).not.toThrow();
    });
});

describe("formatRelativeShort", () => {
    const now = Date.parse("2026-10-13T00:00:00Z");
    const ago = (ms: number) => new Date(now - ms).toISOString();
    it("formats each range", () => {
        expect(formatRelativeShort(ago(30_000), now)).toBe("刚刚");
        expect(formatRelativeShort(ago(5 * 60_000), now)).toBe("5 分钟");
        expect(formatRelativeShort(ago(3 * 3_600_000), now)).toBe("3 小时");
        expect(formatRelativeShort(ago(28 * 86_400_000), now)).toBe("28 天");
        expect(formatRelativeShort(ago(95 * 86_400_000), now)).toBe("3 个月");
        expect(formatRelativeShort(ago(800 * 86_400_000), now)).toBe("2 年");
    });
});
