import { describe, expect, it } from "vitest";
import type { AgentToolCall } from "@/domain/agent";
import { describeRunWrites } from "@/lib/agent/runWriteOutcomes";
import { createWriteReceipt, readWriteReceipt, type WriteReceiptEntry } from "@/lib/agent/writeReceipt";
import { soundWriteReceipt } from "@/lib/agent/soundWriteReceipt";

const run = { id: "run", threadId: "thread", projectId: "project" };
const entry = (patch: Partial<WriteReceiptEntry> = {}): WriteReceiptEntry => ({ kind: "shot", operation: "created", id: "shot", ownerId: "project", revision: "v1", label: "镜头", ...patch });
const call = (patch: Partial<AgentToolCall> = {}): AgentToolCall => ({
  id: "call", runId: "run", threadId: "thread", providerCallId: "provider", step: 1, order: 0,
  name: "shot_create", title: "private-title", arguments: "private-arguments", effect: "write", atomic: true,
  highRisk: false, status: "completed", result: JSON.stringify({ writeReceipt: createWriteReceipt([entry()]), extra: "private-extra" }),
  createdAt: "2026-09-22", updatedAt: "2026-09-22", ...patch,
});
const result = (entries: WriteReceiptEntry[]) => JSON.stringify({ writeReceipt: createWriteReceipt(entries) });

describe("direct-write receipt evidence", () => {
  it("shows only owned committed writes, not read/network/plan data or assistant claims", () => {
    const summary = describeRunWrites(run, [call(), ...(["read", "network", "bookkeeping"] as const).map(effect => call({ id: effect, effect })), call({ id: "foreign", threadId: "elsewhere" })]);
    expect(summary).toMatchObject({ total: 1, uncoveredCalls: 0, groups: [{ label: "新增镜头", count: 1 }] });
    expect(JSON.stringify(summary)).not.toContain("private-");
    expect(describeRunWrites(run, []).total).toBe(0);
  });
  it.each(["failed", "rejected", "unknown", "running", "awaiting_approval", "approved", "pending"] as const)("never uses %s writes as proof", status => {
    expect(describeRunWrites(run, [call({ status })]).total).toBe(0);
  });
  it.each([
    { atomic: false }, { name: "unsupported" }, { result: "invalid JSON" },
    { result: JSON.stringify({ status: "completed", id: "shot" }) },
    { result: result([entry({ ownerId: "foreign" })]) },
    { result: result([entry({ kind: "music_work" })]) },
    { result: result([entry({ operation: "updated" })]) },
    { result: result([entry({ revision: undefined })]) },
    { result: result([entry(), entry()]) },
    { result: " ".repeat(65537) },
  ])("leaves unsupported, foreign, malformed or incomplete evidence uncovered: %j", patch => {
    expect(describeRunWrites(run, [call(patch)])).toMatchObject({ total: 0, uncoveredCalls: 1 });
  });
  it("records operations rather than falsely counting unique surviving entities", () => {
    const edits = [call(), call({ id: "edit", step: 2, name: "shot_update", result: result([entry({ operation: "updated", revision: "v2" })]) }), call({ id: "delete", step: 3, name: "shot_delete", result: result([entry({ operation: "deleted", revision: undefined })]) })];
    const summary = describeRunWrites(run, [...edits].reverse());
    expect(summary.total).toBe(3);
    expect(summary.entries.map(row => row.operation)).toEqual(["created", "updated", "deleted"]);
    expect(describeRunWrites(run, [...edits, edits[0]]).total).toBe(3);
  });
  it("accepts a new project and its seeded episode only under that created owner", () => {
    const creation = call({ name: "project_create", result: JSON.stringify({ id: "new-project", writeReceipt: createWriteReceipt([entry({ kind: "project", id: "new-project", ownerId: "new-project" }), entry({ kind: "episode", id: "episode", ownerId: "new-project" })]) }) });
    expect(describeRunWrites({ ...run, projectId: undefined }, [creation]).total).toBe(2);
    expect(describeRunWrites(run, [creation]).total).toBe(0);
  });
  it("bounds displayed entries but discloses exact remaining operation coverage", () => {
    const rows = Array.from({ length: 80 }, (_, i) => call({ id: `call-${i}`, step: i, result: result([entry({ id: `shot-${i}` })]) }));
    const summary = describeRunWrites(run, rows);
    expect(summary).toMatchObject({ total: 80, omitted: 20, groups: [{ label: "新增镜头", count: 80 }] });
    expect(summary.entries).toHaveLength(60);
  });
  it("validates receipt version, bounds, finite revision and excludes arbitrary fields", () => {
    const valid = createWriteReceipt([entry()]);
    expect(readWriteReceipt({ ...valid, version: 2 })).toBeUndefined();
    expect(readWriteReceipt({ ...valid, secret: "hidden" })).toBeUndefined();
    expect(() => createWriteReceipt([entry({ label: "a".repeat(161) })])).toThrow();
    expect(() => createWriteReceipt([entry({ revision: NaN })])).toThrow();
    expect(() => createWriteReceipt(Array(41).fill(entry()))).toThrow();
  });
  it("separates sound metadata, draft, placement and deletion from generation", () => {
    const sound = soundWriteReceipt("audio_segment", "updated", { projectId: "project" }, { id: "segment", projectId: "project", revision: 2, text: "声".repeat(200), selectedTakeId: "take" });
    expect(sound.entries[0]).toMatchObject({ kind: "audio_segment", operation: "updated", label: "声".repeat(160) });
    expect(describeRunWrites(run, [call({ name: "audio_update", result: JSON.stringify({ writeReceipt: sound }) })]).groups).toEqual([{ label: "更新脚本段落", count: 1 }]);
    expect(soundWriteReceipt("audio_clip", "deleted", { projectId: "project", id: "clip" }, { removedClipId: "clip" }).entries[0]).not.toHaveProperty("revision");
    expect(() => soundWriteReceipt("audio_clip", "deleted", { projectId: "project", id: "other" }, { removedClipId: "clip" })).toThrow();
    expect(() => soundWriteReceipt("music_draft", "created", { projectId: "project" }, { id: "draft", projectId: "foreign", revision: 1 })).toThrow();
  });
});
