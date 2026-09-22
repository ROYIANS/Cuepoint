import { soundWriteReceipt } from "./soundWriteReceipt";
import { db } from "@/db/database";
import { addMusicDraft, patchMusicDraft, patchMusicWork } from "@/db/music";
import { assertAudioRevision, ownedAudioRow } from "@/db/audioShared";
import { libraryReadTool, libraryWriteTool } from "./libraryToolHelpers";
import { assertAudioMusicToolScope, audioMusicRevision, audioMusicTarget, audioMusicUnion, boundedAudioText } from "./audioTools";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import * as s from "./businessSchemas";

const base = { projectId: s.id };
const identity = { ...base, id: s.id, revision: audioMusicRevision };
const scope = async (args: { projectId: string }, context: AgentToolContext) => { await assertAudioMusicToolScope(args.projectId, context, "music"); };
const settings = audioMusicUnion(
  s.object({ engine: s.choice(["flowmusic"]), soundPrompt: s.text(12000), lyrics: s.text(12000), title: s.text(300), bpm: s.optional(s.text(20)), lengthSec: s.optional(s.number(1, 240)), seed: s.optional(s.text(100)) }),
  s.object({ engine: s.choice(["suno"]), version: s.choice(["v6", "v6-wild", "v6-mini"]), custom: s.bool, instrumental: s.bool, prompt: s.text(10000), title: s.text(160), style: s.text(2000), negativeTags: s.text(2000), durationSec: s.optional(s.number(10, 360)) }),
);
async function state(projectId: string) {
  return { drafts: await db.musicDrafts.where("projectId").equals(projectId).toArray(), works: await db.musicWorks.where("projectId").equals(projectId).toArray() };
}
export const MUSIC_TOOLS: readonly AgentToolDefinition[] = [
  libraryReadTool({ name: "music_read", title: "读取音乐作品", description: "分页读取当前绑定的音乐项目。projectId 可省略，自动使用当前对话项目；显式指定时必须一致。返回 projectId 供后续编辑使用。指定 id 可读取当前生成参数。field 可分页读取作品歌词/备注。未听取声音，不从标题推断声音内容。",
    spec: s.object({ projectId: s.optional(s.id), kind: s.choice(["drafts", "works"]), id: s.optional(s.id), field: s.optional(s.choice(["lyrics", "notes"])), textOffset: s.optional(s.number(0, 1e7, true)), ...s.page }),
    async execute(args, context) {
      const projectId = await assertAudioMusicToolScope(args.projectId, context, "music");
      const data = await state(projectId); const rows = data[args.kind].filter((row) => !args.id || row.id === args.id);
      if (args.id && !rows.length) throw new Error("找不到当前项目中的音乐内容");
      const offset = args.offset ?? 0, limit = args.limit ?? 20;
      if (args.field) {
        if (!args.id || args.kind !== "works") throw new Error("文本分页需要指定作品 ID");
        const work = data.works.find((row) => row.id === args.id)!;
        const value = work[args.field], start = args.textOffset ?? 0;
        return { projectId, id: work.id, revision: work.revision, field: args.field, text: value.slice(start, start + 4000), totalLength: value.length, nextOffset: start + 4000 < value.length ? start + 4000 : null };
      }
      return { projectId, items: rows.slice(offset, offset + limit).map((row) => {
        if ("mediaId" in row) return { id: row.id, revision: row.revision, title: row.title.slice(0, 300), notes: boundedAudioText(row.notes, 300), lyrics: boundedAudioText(row.lyrics, 300), durationSec: row.durationSec, favorite: row.favorite, mediaId: row.mediaId, ...(args.id ? { settings: row.settings } : { engine: row.settings?.engine }), provenance: row.provenance ? { provider: row.provenance.provider, model: row.provenance.model, taskId: row.provenance.taskId, clipId: row.provenance.clipId, audioIndex: row.provenance.audioIndex } : undefined };
        return { id: row.id, revision: row.revision, ...(args.id ? { settings: row.settings } : { engine: row.settings.engine, title: row.settings.title.slice(0, 300) }) };
      }), total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null, note: "仅读取作品资料与参数，未听取音频。" };
    } }),
  libraryWriteTool({ name: "music_save_draft", receipt: (args, result) => soundWriteReceipt("music_draft", args.id ? "updated" : "created", args, result), title: "保存音乐创作草稿", description: "保存完整引擎参数；新建省略 id/revision，更新须同时给当前 id/revision。只保存草稿、不计费；生成需另行确认。切换引擎替换全部参数，不混入另一引擎字段。", scope, owners: (args) => [args.projectId],
    spec: s.object({ ...base, id: s.optional(s.id), revision: s.optional(audioMusicRevision), settings }),
    async prepare(args) {
      if (Boolean(args.id) !== (args.revision !== undefined)) throw new Error("更新草稿必须同时提供 id 和 revision");
      if (args.id) assertAudioRevision(await ownedAudioRow(db.musicDrafts, args.projectId, args.id), args.revision!);
      return { state: await state(args.projectId), target: audioMusicTarget(args.projectId), changes: [`${args.id ? "更新" : "创建"} ${args.settings.engine} 草稿：${JSON.stringify(args.settings).slice(0, 2000)}`, "仅保存创作参数，不提交生成。"] };
    }, execute: (args) => args.id ? patchMusicDraft(args.projectId, args.id, args.revision!, { settings: args.settings }) : addMusicDraft(args.projectId, { settings: args.settings }) }),
  libraryWriteTool({ name: "music_update_work", receipt: (args, result) => soundWriteReceipt("music_work", "updated", args, result), title: "整理音乐作品", description: "按 revision 修改已存在作品的名称、备注或收藏，不改变音乐源文件与原始生成参数。", scope, owners: (args) => [args.projectId],
    spec: s.object({ ...identity, patch: s.nonempty(s.object({ title: s.optional(s.text(300, 1)), notes: s.optional(s.text(8000)), favorite: s.optional(s.bool) })) }),
    async prepare(args) { const row = await ownedAudioRow(db.musicWorks, args.projectId, args.id); assertAudioRevision(row, args.revision); return { state: row, target: audioMusicTarget(args.projectId), changes: [`作品修改：${JSON.stringify(args.patch).slice(0, 1800)}`] }; },
    execute: (args) => patchMusicWork(args.projectId, args.id, args.revision, args.patch) }),
  libraryWriteTool({ name: "music_reuse_work", receipt: (args, result) => soundWriteReceipt("music_draft", "created", args, result), title: "复用音乐参数", description: "将指定作品的实际生成参数另存为新草稿，保留原作品；后续可编辑和经确认生成。没有参数的上传音频不能复用生成设置。", scope, owners: (args) => [args.projectId], spec: s.object(identity),
    async prepare(args) { const work = await ownedAudioRow(db.musicWorks, args.projectId, args.id); assertAudioRevision(work, args.revision); if (!work.settings) throw new Error("此作品没有可复用的生成参数"); return { state: work, target: audioMusicTarget(args.projectId), changes: [`复用「${work.title.slice(0, 300)}」的参数新建音乐草稿，不生成音乐。`] }; },
    async execute(args) { const work = await ownedAudioRow(db.musicWorks, args.projectId, args.id); assertAudioRevision(work, args.revision); if (!work.settings) throw new Error("此作品没有生成参数"); return addMusicDraft(args.projectId, { settings: work.settings }); } }),
];
