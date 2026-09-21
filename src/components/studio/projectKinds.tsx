import { Clapperboard, Image, Mic2, Music2, PenLine } from "lucide-react";

/** Presentation catalog only. Unavailable kinds must never create video records. */
export const PROJECT_KINDS = [
  { id: "video", label: "视频", icon: Clapperboard, description: "从故事、分镜到画面制作，让想法成为影像。", examples: "短片 · 剧集 · 广告 · MV", available: true },
  { id: "image", label: "图片", icon: Image, description: "围绕一个主题，创作有一致风格的图片与视觉内容。", examples: "摄影 · 插画 · 海报 · 图集", available: false },
  { id: "copy", label: "文案", icon: PenLine, description: "整理思路、打磨表达，写下属于你的内容。", examples: "文章 · 社交文案 · 剧本 · 故事", available: false },
  { id: "podcast", label: "播客", icon: Mic2, description: "从一个话题出发，用声音分享观点与故事。", examples: "单口 · 对谈 · 访谈 · 系列节目", available: false },
  { id: "music", label: "音乐", icon: Music2, description: "记录旋律与情绪，逐步完成歌曲和配乐。", examples: "歌曲 · 配乐 · 器乐 · 编曲", available: false },
] as const;

export type ProjectKindOption = (typeof PROJECT_KINDS)[number];
export type ProjectKindId = ProjectKindOption["id"];

export function ProjectKindPlaceholder({ kind }: { kind: ProjectKindOption }) {
  const Icon = kind.icon;
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center">
      <Icon className="text-muted-foreground mb-5 size-8" strokeWidth={1.25} aria-hidden />
      <span className="text-muted-foreground mb-3 rounded-full border px-2.5 py-1 text-xs">即将推出</span>
      <h2 className="text-lg font-medium">{kind.label}创作</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">{kind.description}</p>
      <p className="text-muted-foreground mt-4 text-xs">{kind.examples}</p>
      <p className="text-muted-foreground mt-6 text-xs">暂未开放项目创建，现有项目不受影响。</p>
    </div>
  );
}
