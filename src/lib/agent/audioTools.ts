import { z } from "zod";
import { db } from "@/db/database";
import { addAudioChapter, addAudioSpeaker, addAudioSegment, addAudioTrack, addAudioClip, getAudioProjectSnapshot, patchAudioChapter, patchAudioSpeaker, patchAudioSegment, patchAudioTrack, patchAudioClip, replaceAudioClips, deleteAudioClip } from "@/db/audio";
import { assertAudioProject, assertAudioRevision, ownedAudioRow } from "@/db/audioShared";
import { splitAudioClip } from "@/lib/audio/commands";
import type { AgentToolContext, AgentToolDefinition } from "./tools";
import type { Spec } from "./businessSchemas";
import { libraryReadTool, libraryWriteTool } from "./libraryToolHelpers";
import { requireBoundProjectScope } from "./projectScope";
import { SPEECH_VOICES } from "@/lib/ai/apimartAudio";
import { MIMO_VOICES } from "@/lib/ai/mimoSpeech";
import { mimoSpeechSpec } from "./mimoSpeechSpec";
import { speakerSpeechProfile } from "@/lib/audioGeneration/defaults";
import * as s from "./businessSchemas";

export async function assertAudioMusicToolScope(projectId: string | undefined, context: AgentToolContext, kind: "audio" | "music") {
  const bound = await requireBoundProjectScope(context, projectId);
  await assertAudioProject(bound, kind);
  return bound;
}
export const audioMusicRevision = s.number(1, 1e12, true);
export const audioMusicTarget = (projectId: string) => ({ label: "打开作品项目", href: `/p/${encodeURIComponent(projectId)}` });
export function audioMusicUnion<T extends [Spec<unknown>, Spec<unknown>, ...Spec<unknown>[]]>(...specs: T): Spec<z.infer<T[number]["schema"]>> {
  return { schema: z.union(specs.map((spec) => spec.schema) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]), json: { type: "object", anyOf: specs.map((spec) => spec.json) } };
}
export function boundedAudioText(value: string, limit = 1600) { return { text: value.slice(0, limit), totalLength: value.length, truncated: value.length > limit }; }
const base = { projectId: s.id };
const identity = { ...base, id: s.id, revision: audioMusicRevision };
const sec = s.number(0, 86400);
const scope = async (args: { projectId: string }, context: AgentToolContext) => { await assertAudioMusicToolScope(args.projectId, context, "audio"); };
const createSpec = audioMusicUnion(
  s.object({ ...base, kind: s.choice(["chapter"]), title: s.text(300, 1), order: s.number(0, 10000, true) }),
  s.object({ ...base, kind: s.choice(["speaker"]), name: s.text(300, 1), voice: s.optional(s.choice([...SPEECH_VOICES, ...MIMO_VOICES])), speed: s.optional(s.number(0.25, 4)), mimo: s.optional(mimoSpeechSpec) }),
  s.object({ ...base, kind: s.choice(["segment"]), chapterId: s.id, text: s.text(12000), notes: s.optional(s.text(4000)), speakerId: s.optional(s.id), order: s.number(0, 100000, true) }),
  s.object({ ...base, kind: s.choice(["track"]), chapterId: s.id, name: s.text(300, 1), role: s.choice(["voice", "music", "effects"]), order: s.number(0, 10000, true) }),
);
const updateSpec = audioMusicUnion(
  s.object({ ...identity, kind: s.choice(["chapter"]), patch: s.nonempty(s.object({ title: s.optional(s.text(300, 1)), order: s.optional(s.number(0, 10000, true)) })) }),
  s.object({ ...identity, kind: s.choice(["speaker"]), patch: s.nonempty(s.object({ name: s.optional(s.text(300, 1)), voice: s.optional(s.choice([...SPEECH_VOICES, ...MIMO_VOICES])), speed: s.optional(s.number(.25, 4)), mimo: s.optional(s.nullable(mimoSpeechSpec)) })) }),
  s.object({ ...identity, kind: s.choice(["segment"]), patch: s.nonempty(s.object({ text: s.optional(s.text(12000)), notes: s.optional(s.text(4000)), order: s.optional(s.number(0, 100000, true)), speakerId: s.optional(s.nullable(s.id)), selectedTakeId: s.optional(s.nullable(s.id)) })) }),
  s.object({ ...identity, kind: s.choice(["track"]), patch: s.nonempty(s.object({ name: s.optional(s.text(300, 1)), role: s.optional(s.choice(["voice", "music", "effects"])), order: s.optional(s.number(0, 10000, true)), gain: s.optional(s.number(0, 4)), muted: s.optional(s.bool), solo: s.optional(s.bool) })) }),
);
async function editable(args: { projectId: string; id: string; revision: number; kind: "chapter" | "speaker" | "segment" | "track" }) {
  const table = { chapter: db.audioChapters, speaker: db.audioSpeakers, segment: db.audioSegments, track: db.audioTracks }[args.kind];
  const row = await table.get(args.id);
  if (!row || row.projectId !== args.projectId) throw new Error("找不到当前项目中的内容");
  assertAudioRevision(row, args.revision);
  return row;
}
async function previewState(args: { projectId: string }, changes: string[]) {
  return { state: await getAudioProjectSnapshot(args.projectId), target: audioMusicTarget(args.projectId), changes };
}
async function clipState(args: { projectId: string; id: string; revision: number }, changes: string[]) {
  const clip = await ownedAudioRow(db.audioClips, args.projectId, args.id);
  assertAudioRevision(clip, args.revision);
  return previewState(args, changes);
}

export const AUDIO_TOOLS: readonly AgentToolDefinition[] = [
  libraryReadTool({ name: "audio_read", title: "读取音频项目", description: "分页读取当前绑定的音频项目。projectId 可省略，自动使用当前对话项目；显式指定时必须一致。返回 projectId 供后续编辑使用。id 可读指定项，field+textOffset 可分段读脚本/备注；speakers 使用 field=instruction 读取完整演绎指导。不听取声音，不返回音频字节。",
    spec: s.object({ projectId: s.optional(s.id), kind: s.choice(["chapters", "speakers", "segments", "takes", "tracks", "clips"]), id: s.optional(s.id), chapterId: s.optional(s.id), field: s.optional(s.choice(["text", "notes", "instruction"])), textOffset: s.optional(s.number(0, 1e7, true)), ...s.page }),
    async execute(args, context) {
      const projectId = await assertAudioMusicToolScope(args.projectId, context, "audio");
      const snapshot = await getAudioProjectSnapshot(projectId);
      const all = snapshot[args.kind].filter((row) => (!args.id || row.id === args.id) && (!args.chapterId || ("chapterId" in row && row.chapterId === args.chapterId)));
      if (args.id && !all.length) throw new Error("找不到当前项目中的内容");
      const offset = args.offset ?? 0, limit = args.limit ?? 20;
      if (args.field === "instruction") {
        if (!args.id || args.kind !== "speakers") throw new Error("演绎指导分页需要指定说话人 ID");
        const row = snapshot.speakers.find(item => item.id === args.id)!;
        const value = row.mimo?.instruction ?? "", start = args.textOffset ?? 0;
        return { projectId, id: row.id, revision: row.revision, field: args.field, text: value.slice(start, start + 4000), totalLength: value.length, nextOffset: start + 4000 < value.length ? start + 4000 : null };
      }
      if (args.field) {
        if (!args.id || args.kind !== "segments") throw new Error("文本分页需要指定脚本段落 ID");
        const row = snapshot.segments.find((segment) => segment.id === args.id)!;
        const value = row[args.field], start = args.textOffset ?? 0;
        return { projectId, id: row.id, revision: row.revision, field: args.field, text: value.slice(start, start + 4000), totalLength: value.length, nextOffset: start + 4000 < value.length ? start + 4000 : null };
      }
      const items = all.slice(offset, offset + limit).map((row) => {
        if ("text" in row) return { ...row, text: boundedAudioText(row.text, 300), notes: boundedAudioText(row.notes, 100) };
        if ("mediaId" in row) return { id: row.id, projectId: row.projectId, revision: row.revision, name: row.name.slice(0, 300), segmentId: row.segmentId, mediaId: row.mediaId, source: row.source, durationSec: row.durationSec, sampleRate: row.sampleRate, channels: row.channels };
        if ("title" in row) return { ...row, title: row.title.slice(0, 300) };
        if ("name" in row) return { ...row, name: row.name.slice(0, 300), ...("mimo" in row && row.mimo ? { mimo: { ...row.mimo, instruction: boundedAudioText(row.mimo.instruction, 300) } } : {}) };
        return row;
      });
      return { projectId, items, total: all.length, nextOffset: offset + limit < all.length ? offset + limit : null, note: "音频仅提供元信息，未听取声音。" };
    } }),
  libraryWriteTool({ name: "audio_create", title: "组织配音项目", description: "创建章节、角色音色、脚本段落或轨道。kind=speaker 可命名并保存 MiMo 预置/设计/克隆音色，省略音色配置时默认 MiMo；显式 APIMart voice 保留兼容。此工具只保存音色配置，试音使用 audio_generate_speech 经确认生成。", spec: createSpec, scope, owners: (args) => [args.projectId],
    prepare: (args) => previewState(args, [`创建${args.kind}：${JSON.stringify(args).slice(0, 1800)}`]),
    async execute(args) {
      const { projectId, kind, ...input } = args;
      switch (kind) {
        case "chapter": return addAudioChapter(projectId, input as Extract<typeof args, { kind: "chapter" }>);
        case "speaker": { const row = input as Extract<typeof args, { kind: "speaker" }>; const profile = row.voice || row.mimo ? { voice: row.voice ?? "mimo_default", speed: row.speed ?? 1, ...(row.mimo ? { mimo: row.mimo } : row.voice && (MIMO_VOICES as readonly string[]).includes(row.voice) ? { mimo: { mode: "preset" as const, instruction: "" } } : {}) } : { ...speakerSpeechProfile(), ...(row.speed !== undefined ? { speed: row.speed } : {}) }; return addAudioSpeaker(projectId, { ...row, ...profile }); }
        case "segment": { const row = args as Extract<typeof args, { kind: "segment" }>; return addAudioSegment(projectId, { chapterId: row.chapterId, text: row.text, notes: row.notes ?? "", order: row.order, speakerId: row.speakerId }); }
        case "track": { const row = args as Extract<typeof args, { kind: "track" }>; return addAudioTrack(projectId, { chapterId: row.chapterId, name: row.name, role: row.role, order: row.order, gain: 1, muted: false, solo: false }); }
      }
    } }),
  libraryWriteTool({ name: "audio_update", title: "修改配音内容", description: "按读取到的 revision 修改章节、说话人、脚本或轨道。段落 selectedTakeId 只选择版本，不替换时间线声音；null 清除选用/说话人。修改脚本不会自动重新生成。", spec: updateSpec, scope, owners: (args) => [args.projectId],
    async prepare(args) { await editable(args); return previewState(args, [`修改${args.kind}：${JSON.stringify(args.patch).slice(0, 1800)}`]); },
    async execute(args) {
      switch (args.kind) {
        case "chapter": return patchAudioChapter(args.projectId, args.id, args.revision, args.patch);
        case "speaker": { const { mimo, ...patch } = args.patch; return patchAudioSpeaker(args.projectId, args.id, args.revision, { ...patch, ...(Object.hasOwn(args.patch, "mimo") ? { mimo: mimo ?? undefined } : {}) }); }
        case "track": return patchAudioTrack(args.projectId, args.id, args.revision, args.patch);
        case "segment": {
          const { speakerId, selectedTakeId, ...patch } = args.patch;
          return patchAudioSegment(args.projectId, args.id, args.revision, { ...patch, ...(Object.hasOwn(args.patch, "speakerId") ? { speakerId: speakerId ?? undefined } : {}), ...(Object.hasOwn(args.patch, "selectedTakeId") ? { selectedTakeId: selectedTakeId ?? undefined } : {}) });
        }
      }
    } }),
  libraryWriteTool({ name: "audio_place_take", title: "将配音放入时间线", description: "把已存在的真实 takeId 明确放入当前章节轨道；不会改变已放置片段。startSec 是时间线位置，trim 为原始声音秒数。", scope, owners: (args) => [args.projectId],
    spec: s.object({ ...base, chapterId: s.id, trackId: s.id, takeId: s.id, startSec: sec, trimStartSec: sec, trimEndSec: sec }),
    prepare: (args) => previewState(args, [`将版本 ${args.takeId} 放入轨道 ${args.trackId}，位置 ${args.startSec} 秒，来源 ${args.trimStartSec}–${args.trimEndSec} 秒。`]),
    execute: (args) => addAudioClip(args.projectId, { chapterId: args.chapterId, trackId: args.trackId, takeId: args.takeId, startSec: args.startSec, trimStartSec: args.trimStartSec, trimEndSec: args.trimEndSec, gain: 1, fadeInSec: 0, fadeOutSec: 0 }) }),
  libraryWriteTool({ name: "audio_edit_clip", title: "编辑声音片段", description: "按 revision 调整位置、原始裁剪边界、音量或淡入淡出；不修改原始媒体，不替换 take。", scope, owners: (args) => [args.projectId],
    spec: s.object({ ...identity, patch: s.nonempty(s.object({ startSec: s.optional(sec), trimStartSec: s.optional(sec), trimEndSec: s.optional(sec), gain: s.optional(s.number(0, 4)), fadeInSec: s.optional(sec), fadeOutSec: s.optional(sec) })) }),
    prepare: (args) => clipState(args, [`片段修改：${JSON.stringify(args.patch)}`]), execute: (args) => patchAudioClip(args.projectId, args.id, args.revision, args.patch) }),
  libraryWriteTool({ name: "audio_split_clip", title: "分割声音片段", description: "按时间线绝对秒数分割片段，保留来源且不移动后续声音；分割点必须在片段内部及淡入淡出区外。", scope, owners: (args) => [args.projectId],
    spec: s.object({ ...identity, timeSec: sec }), prepare: (args) => clipState(args, [`在 ${args.timeSec} 秒分割片段，原始音频完整保留。`]),
    async execute(args) {
      const clip = await ownedAudioRow(db.audioClips, args.projectId, args.id); assertAudioRevision(clip, args.revision);
      const snapshot = await getAudioProjectSnapshot(args.projectId); const current = snapshot.clips.filter((row) => row.chapterId === clip.chapterId);
      const parts = splitAudioClip(clip, args.timeSec);
      const result = await replaceAudioClips(args.projectId, clip.chapterId, current, current.flatMap((row) => row.id === clip.id ? parts : [row]));
      return result.filter((row) => parts.some((part) => part.id === row.id));
    } }),
  libraryWriteTool({ name: "audio_remove_clip", title: "移除时间线片段", description: "明确移除一个时间线片段，保留原始配音版本和媒体；不会删除脚本。", highRisk: true, scope, owners: (args) => [args.projectId], spec: s.object(identity),
    prepare: (args) => clipState(args, [`移除片段 ${args.id}，保留声音来源。`]), async execute(args) { await deleteAudioClip(args.projectId, args.id, args.revision); return { removedClipId: args.id }; } }),
];
