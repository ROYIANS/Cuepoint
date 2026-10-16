import {expect, it} from "vitest";
import {sameThreadControl, type ThreadControlSnapshot} from "@/features/agent/queries/threadReading";

const run = (id: string, status = "running") => ({id, threadId: "t", taskId: undefined, createdAt: "2026-10-16", status, hasToolCalls: false, pauseReason: undefined}) as ThreadControlSnapshot["runs"][number];
const base = (runs: ThreadControlSnapshot["runs"] = []): ThreadControlSnapshot => ({threadId: "t", ready: true, hasMessages: true, hasRuns: runs.length > 0, runs, compacting: false});

it("compares control projections structurally without retaining an encoded key", () => {
    const many = Array.from({length: 500}, (_, index) => run(`r${index}`, "completed"));
    expect(sameThreadControl(base(many), base(many.map(item => ({...item}))))).toBe(true);
    expect(sameThreadControl(base(many), base([...many.slice(0, 499), run("r499", "running")]))).toBe(false);
    expect(sameThreadControl(base(many), base(many.slice(1)))).toBe(false);
    expect(sameThreadControl(base(), {...base(), compacting: true})).toBe(false);
    expect(sameThreadControl(base(), {...base(), error: "x"})).toBe(false);
    expect(sameThreadControl(base(), {...base(), threadId: "other"})).toBe(false);
});
