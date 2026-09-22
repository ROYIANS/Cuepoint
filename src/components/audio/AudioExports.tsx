import { useState } from "react";
import { Download, Play } from "lucide-react";
import { db } from "@/db/database";
import type { AudioProjectSnapshot } from "@/domain/audio";
import { buildAudioSchedule } from "@/lib/audio/schedule";
import { downloadBlob } from "@/lib/projectPackage";
import { Button } from "@/components/ui/button";
import { Disclosure, DisclosureTitle, SourcePlayer } from "@/components/audioMusic/controls";
import { errorText, timeLabel } from "@/components/audioMusic/shared";
import { useMedia } from "@/lib/media";

export function AudioExports({ snapshot }: { snapshot: AudioProjectSnapshot }) {
  const [playingId, setPlayingId] = useState<string>();
  const [error, setError] = useState("");
  const media = useMedia(playingId);
  if (!snapshot.exports.length) return null;
  return <Disclosure className="aw-export-history mt-6" defaultOpen><DisclosureTitle>导出成品 · {snapshot.exports.length}</DisclosureTitle>
    <div className="aw-source-list">{[...snapshot.exports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => {
      const chapterExport = item.scope === "chapter" || Boolean(item.chapterId);
      let current = false;
      try { current = !(chapterExport && !item.chapterId) && item.fingerprint === JSON.stringify(buildAudioSchedule(snapshot, item.chapterId)); } catch { /* Missing sources make this an older snapshot. */ }
      const title = chapterExport ? snapshot.chapters.find((chapter) => chapter.id === item.chapterId)?.title ?? item.chapterTitle ?? "原章节成品" : "完整项目";
      return <div key={item.id} className="aw-source"><strong>{title} · WAV</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {timeLabel(item.durationSec)}</small><p className="aw-muted mt-2">{current ? "与当前编辑一致" : "此成品未包含后续编辑，可重新导出最新版本。"}</p><div className="aw-actions mt-2"><Button size="sm" variant="ghost" onClick={() => setPlayingId(item.mediaId)}><Play />试听成品</Button><Button size="sm" variant="ghost" onClick={() => { setError(""); void db.media.get(item.mediaId).then((record) => { if (!record) throw new Error("成品音频文件已不存在"); downloadBlob(record.blob, record.filename); }).catch((reason: unknown) => setError(errorText(reason))); }}><Download />下载</Button></div></div>;
    })}</div>{media && <SourcePlayer src={media.url} title="导出成品" autoplay />}{error && <p className="aw-error" role="alert">{error}</p>}
  </Disclosure>;
}
