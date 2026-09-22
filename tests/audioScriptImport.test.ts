import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createAudioMusicProject } from "@/db/repo";
import { addAudioSegment } from "@/db/audio";
import { appendAudioScript, splitAudioScript } from "@/lib/audio/scriptImport";

describe("audio script paragraphs", () => {
  it("treats each nonempty pasted line as a script unit", () => {
    expect(splitAudioScript("  第一行\r\n第二行\r\n \r\n\r\n下一段\n尾行  ")).toEqual(["第一行", "第二行", "下一段", "尾行"]);
  });
  it("never silently truncates long text or over-limit paragraph lists", () => {
    const long = "正文".repeat(5000);
    expect(splitAudioScript(long)).toEqual([long]);
    expect(() => splitAudioScript(Array.from({ length: 201 }, () => "正文").join("\n\n"))).toThrow("200");
    expect(() => splitAudioScript("\n \n")).toThrow("粘贴");
  });
  it("appends sequentially without touching existing script or audio", async () => {
    const project = await createAudioMusicProject("测试配音", "audio");
    const chapter = (await db.audioChapters.where("projectId").equals(project.id).toArray())[0];
    const existing = await addAudioSegment(project.id, { chapterId: chapter.id, order: 4, text: "已有台词", notes: "备注" });
    const added = await appendAudioScript(project.id, chapter.id, "第一段\n第二行\n\n第二段");
    expect(added.map((row) => [row.order, row.text])).toEqual([[5, "第一段"], [6, "第二行"], [7, "第二段"]]);
    expect(await db.audioSegments.get(existing.id)).toEqual(existing);
    expect(await db.audioTakes.count()).toBe(0);
    expect(await db.audioClips.count()).toBe(0);
  });
  it("rolls the whole import back if a later insert fails", async () => {
    const project = await createAudioMusicProject("回滚测试", "audio");
    const chapter = (await db.audioChapters.where("projectId").equals(project.id).toArray())[0];
    const rejectSecond = (_key: unknown, row: { text: string }) => { if (row.text === "拒绝此段") throw new Error("模拟写入失败"); };
    db.audioSegments.hook("creating", rejectSecond);
    try { await expect(appendAudioScript(project.id, chapter.id, "首段\n\n拒绝此段")).rejects.toThrow("模拟写入失败"); }
    finally { db.audioSegments.hook("creating").unsubscribe(rejectSecond); }
    expect(await db.audioSegments.where("chapterId").equals(chapter.id).count()).toBe(0);
  });
});

import { editAudioScriptLines } from "@/lib/audio/scriptImport";
import { addAudioSpeaker } from "@/db/audio";

describe("inline audio script editing", () => {
  async function fixture() {
    const project = await createAudioMusicProject("行编辑", "audio");
    const chapter = (await db.audioChapters.where("projectId").equals(project.id).toArray())[0];
    const speaker = await addAudioSpeaker(project.id, { name: "旁白", voice: "alloy" });
    const line = await addAudioSegment(project.id, { chapterId: chapter.id, speakerId: speaker.id, text: "甲乙丙丁", notes: "保留备注", order: 1 });
    await addAudioSegment(project.id, { chapterId: chapter.id, text: "后文", notes: "", order: 2 });
    return { project, chapter, speaker, line };
  }
  it("Enter replaces the selected range and preserves role, order, and notes on original", async () => {
    const { project, line, speaker } = await fixture();
    const rows = await editAudioScriptLines({ projectId: project.id, segmentId: line.id, baseline: line.text, start: 1, end: 3 });
    expect(rows.map((row) => row.text)).toEqual(["甲", "丁"]);
    expect(rows.map((row) => row.order)).toEqual([1, 1.5]);
    expect(rows[1].speakerId).toBe(speaker.id);
    expect(rows[0].notes).toBe("保留备注");
    expect(rows[1].notes).toBe("");
  });
  it("Enter at the end makes an empty next line for typing", async () => {
    const { project, line } = await fixture();
    const rows = await editAudioScriptLines({ projectId: project.id, segmentId: line.id, baseline: line.text, start: 4, end: 4 });
    expect(rows.map((row) => row.text)).toEqual(["甲乙丙丁", ""]);
  });
  it("multiline paste replaces selection, keeps surrounding text, skips blank lines", async () => {
    const { project, line } = await fixture();
    const rows = await editAudioScriptLines({ projectId: project.id, segmentId: line.id, baseline: line.text, start: 1, end: 3, pasted: "第一\r\n\r\n第二\n第三" });
    expect(rows.map((row) => row.text)).toEqual(["甲第一", "第二", "第三丁"]);
    expect(rows[2].order).toBeLessThan(2);
  });
  it("stale content and cross-project edits reject without mutations", async () => {
    const { project, line, chapter } = await fixture();
    await expect(editAudioScriptLines({ projectId: project.id, segmentId: line.id, baseline: "过期", start: 0, end: 0 })).rejects.toThrow("其他页面");
    await expect(editAudioScriptLines({ projectId: "another", segmentId: line.id, baseline: line.text, start: 0, end: 0 })).rejects.toThrow();
    expect(await db.audioSegments.get(line.id)).toEqual(line);
    expect(await db.audioSegments.where("chapterId").equals(chapter.id).count()).toBe(2);
  });
  it("rolls original text back if adding a split line fails", async () => {
    const { project, line } = await fixture();
    const rejectNew = () => { throw new Error("模拟行创建失败"); };
    db.audioSegments.hook("creating", rejectNew);
    try { await expect(editAudioScriptLines({ projectId: project.id, segmentId: line.id, baseline: line.text, start: 1, end: 1 })).rejects.toThrow("模拟行创建失败"); }
    finally { db.audioSegments.hook("creating").unsubscribe(rejectNew); }
    expect(await db.audioSegments.get(line.id)).toEqual(line);
  });
});
