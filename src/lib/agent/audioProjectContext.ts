import { db } from "@/db/database";
import type { Project } from "@/domain/types";
import { getProjectKind } from "@/domain/types";
import { targetRevision } from "@/lib/productionRevision";
import type { ProjectContextSnapshot } from "@/domain/projectContext";

/** Bounded current facts; audio bytes, arbitrary provider payloads and secrets never enter context. */
export async function getAudioMusicProjectContext(project: Project): Promise<ProjectContextSnapshot> {
  const projectId = project.id, kind = getProjectKind(project);
  const [chapters, speakers, segments, tracks, takes, clips, drafts, works, jobs, ipLink] = await Promise.all([
    db.audioChapters.where("projectId").equals(projectId).sortBy("order"), db.audioSpeakers.where("projectId").equals(projectId).toArray(),
    db.audioSegments.where("projectId").equals(projectId).sortBy("order"), db.audioTracks.where("projectId").equals(projectId).sortBy("order"),
    db.audioTakes.where("projectId").equals(projectId).toArray(), db.audioClips.where("projectId").equals(projectId).toArray(),
    db.musicDrafts.where("projectId").equals(projectId).toArray(), db.musicWorks.where("projectId").equals(projectId).toArray(),
    db.audioGenerationJobs.where("projectId").equals(projectId).toArray(), db.projectIpLinks.get(projectId),
  ]);
  const ip = ipLink ? await db.ipProfiles.get(ipLink.ipId) : undefined;
  let truncated = false;
  const text = (s: string | undefined, max: number) => { if ((s?.length ?? 0) > max) truncated = true; return (s ?? "").slice(0, max); };
  const limited = <T>(rows: T[], max: number) => { if (rows.length > max) truncated = true; return rows.slice(0, max); };
  const facts = {
    id: projectId, kind, name: text(project.name, 200), brief: text(project.brief, 600),
    ip: ip && !ip.archived ? { id: ip.id, revision: ip.revision, name: text(ip.name, 160), positioning: text(ip.positioning, 240), expression: text(ip.expression, 240), voice: text(ip.voice, 240) } : null,
    ...(kind === "audio" ? {
      speechDefaults: { provider: "mimo", voice: "mimo_default", speed: 1, note: "可继承段落角色音色；audio_create(kind=speaker) 创建音色，audio_generate_speech 经确认试音。连接配置通过 audio_generation_capabilities 读取。" },
      chapters: limited(chapters, 20).map(r => ({ id: r.id, revision: r.revision, title: text(r.title, 100), order: r.order })),
      speakers: limited(speakers, 20).map(r => ({ id: r.id, revision: r.revision, name: text(r.name, 100), voice: text(r.voice, 80), speed: r.speed, mimo: r.mimo ? { ...r.mimo, instruction: text(r.mimo.instruction, 160) } : undefined })),
      segments: limited(segments, 30).map(r => ({ id: r.id, revision: r.revision, chapterId: r.chapterId, speakerId: r.speakerId, text: text(r.text, 160), selectedTakeId: r.selectedTakeId })),
      tracks: limited(tracks, 20).map(r => ({ id: r.id, chapterId: r.chapterId, revision: r.revision, name: text(r.name, 100), role: r.role, muted: r.muted, solo: r.solo })),
      takeCount: takes.length, clipCount: clips.length,
    } : {
      drafts: limited(drafts, 10).map(r => ({ id: r.id, revision: r.revision, engine: r.settings.engine, title: text(r.settings.title, 100) })),
      works: limited(works, 30).map(r => ({ id: r.id, revision: r.revision, title: text(r.title, 120), favorite: r.favorite, durationSec: r.durationSec })),
    }),
    generationJobs: limited(jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), 10).map(r => ({ id: r.id, kind: r.input.kind, status: r.status, dormant: r.dormant, error: text(r.error, 200) })),
    note: "音频只能读取文字、结构和元信息，不能据此声称已听取内容；原始段落/片段/作品请加载音频或音乐工具按需读取。",
  };
  return { projectId, name: project.name, fingerprint: targetRevision({ project, chapters, speakers, segments, tracks, takes, clips, drafts, works, jobs, ipLink, ip }),
    content: JSON.stringify(facts), coverage: { episodes: { total: 0, included: 0 }, assets: { total: takes.length + works.length, included: Math.min(30, works.length) }, truncated,
      audio: { chapters: { total: chapters.length, included: Math.min(20, chapters.length) }, segments: { total: segments.length, included: Math.min(30, segments.length) }, tracks: { total: tracks.length, included: Math.min(20, tracks.length) }, works: { total: works.length, included: Math.min(30, works.length) } } } };
}
