import { describe, expect, it } from "vitest";
import { resolveTimelineShortcut, type TimelineKeyEvent, type TimelineShortcutState } from "@/lib/audio/shortcuts";
const ready: TimelineShortcutState = { focused: true, blocked: false, hasSelection: true, canSplit: true, canUndo: true, canRedo: true };
describe("focused audio timeline shortcuts", () => {
  it.each([
    [{ key: " " }, "play"], [{ key: "Delete" }, "remove"], [{ key: "Backspace" }, "remove"], [{ key: "s" }, "split"],
    [{ key: "d", metaKey: true }, "duplicate"], [{ key: "d", ctrlKey: true }, "duplicate"],
    [{ key: "z", metaKey: true }, "undo"], [{ key: "z", ctrlKey: true }, "undo"],
    [{ key: "Z", metaKey: true, shiftKey: true }, "redo"], [{ key: "z", ctrlKey: true, shiftKey: true }, "redo"],
    [{ key: "y", ctrlKey: true }, "redo"], [{ key: "y", metaKey: true }, "redo"],
  ] as const)("resolves %j to %s", (event, command) => expect(resolveTimelineShortcut(event, ready)).toBe(command));
  it.each([
    { repeat: true }, { isComposing: true }, { defaultPrevented: true }, { altKey: true },
    { ctrlKey: true, metaKey: true },
  ])("ignores guarded event %j", guard => {
    for (const key of [" ", "Delete", "Backspace", "s", "d", "z", "y"]) expect(resolveTimelineShortcut({ key, ...guard }, ready)).toBeUndefined();
  });
  it.each([{ focused: false }, { blocked: true }])("requires focus and permits caller input/overlay/busy/drag guard %j", guard => {
    const events: TimelineKeyEvent[] = [{ key: " " }, { key: "Delete" }, { key: "s" }, { key: "d", ctrlKey: true }, { key: "z", metaKey: true }];
    for (const event of events) expect(resolveTimelineShortcut(event, { ...ready, ...guard })).toBeUndefined();
  });
  it.each([
    { key: "Delete", ctrlKey: true }, { key: "Backspace", metaKey: true }, { key: "s", ctrlKey: true },
    { key: " ", metaKey: true }, { key: "S", shiftKey: true }, { key: "Delete", shiftKey: true },
    { key: "d", ctrlKey: true, shiftKey: true }, { key: "y", ctrlKey: true, shiftKey: true }, { key: "d" }, { key: "z" }, { key: "y" },
  ])("does not reinterpret modified or unassigned key %j", event => expect(resolveTimelineShortcut(event, ready)).toBeUndefined());
  it("requires selection, legal split position, and available history independently", () => {
    for (const key of ["Delete", "Backspace", "s"]) expect(resolveTimelineShortcut({ key }, { ...ready, hasSelection: false })).toBeUndefined();
    expect(resolveTimelineShortcut({ key: "d", ctrlKey: true }, { ...ready, hasSelection: false })).toBeUndefined();
    expect(resolveTimelineShortcut({ key: "s" }, { ...ready, canSplit: false })).toBeUndefined();
    expect(resolveTimelineShortcut({ key: "z", metaKey: true }, { ...ready, canUndo: false })).toBeUndefined();
    expect(resolveTimelineShortcut({ key: "y", ctrlKey: true }, { ...ready, canRedo: false })).toBeUndefined();
    expect(resolveTimelineShortcut({ key: "Z", metaKey: true, shiftKey: true }, { ...ready, canRedo: false })).toBeUndefined();
    expect(resolveTimelineShortcut({ key: " " }, { ...ready, hasSelection: false })).toBe("play");
  });
});
