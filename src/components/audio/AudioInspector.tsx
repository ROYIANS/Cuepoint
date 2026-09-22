import { useRef, useState } from "react";
import { Check, Library, Plus, Trash2, Volume2 } from "lucide-react";
import { db } from "@/db/database";
import { addAudioClip, deleteAudioTake, patchAudioSegment } from "@/db/audio";
import { promoteLegacyMaterial } from "@/db/materials";
import type { AudioProjectSnapshot, AudioSegment, AudioSpeaker, AudioTake } from "@/domain/audio";
import { prepareAudioGeneration, submitAudioGeneration } from "@/lib/audioGeneration/runtime";
import { SPEECH_VOICES } from "@/lib/ai/apimartAudio";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { DraftConflictError } from "@/lib/draftConflict";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { AudioPlayer, ConnectionSelect, Field, GenerationJobs, SavedText, errorText, timeLabel } from "@/components/audioMusic/shared";
import { WorkspaceSelect, SelectOption, Disclosure, DisclosureTitle } from "@/components/audioMusic/controls";
import { AudioExports } from "./AudioExports";

export type AudioAction = (fn: () => Promise<unknown>) => Promise<void>;
export function AudioInspector({ projectId, chapterId, snapshot, segment, takeId, tab, onTabChange, onTake, onClip, onAddSources, action, busy }: {
  projectId: string; chapterId: string; snapshot: AudioProjectSnapshot; segment?: AudioSegment; takeId: string;
  tab: "voice" | "sources" | "exports"; onTabChange: (tab: "voice" | "sources" | "exports") => void;
  onTake: (id: string) => void; onClip: (id: string) => void; onAddSources: (segmentId?: string) => void; action: AudioAction; busy: boolean;
}) {
  const [trackId, setTrackId] = useState("");
  const [pauseSec, setPauseSec] = useState("0");
  const tracks = snapshot.tracks.filter((row) => row.chapterId === chapterId);
  const track = tracks.find((row) => row.id === trackId) ?? tracks[0];
  const take = snapshot.takes.find((row) => row.id === takeId);
  const takes = tab === "voice" && segment ? snapshot.takes.filter((row) => row.segmentId === segment.id) : snapshot.takes;
  const speaker = snapshot.speakers.find((row) => row.id === segment?.speakerId);
  return <div className="as-inspector-content">
    <nav className="as-inspector-tabs" aria-label="声音面板"><Button size="sm" variant={tab === "voice" ? "secondary" : "ghost"} onClick={() => onTabChange("voice")}>段落声音</Button><Button size="sm" variant={tab === "sources" ? "secondary" : "ghost"} onClick={() => onTabChange("sources")}>素材</Button><Button size="sm" variant={tab === "exports" ? "secondary" : "ghost"} onClick={() => onTabChange("exports")}>成品</Button></nav>
    {tab === "exports" ? <><AudioExports snapshot={snapshot} />{!snapshot.exports.length && <div className="as-inspector-empty"><p>还没有导出成品</p><small>将声音放入时间线后，从底部导出 WAV。</small></div>}</> : <>
      <div className="as-inspector-heading"><span className="as-voice-avatar">{speaker?.name.slice(0, 1) ?? <Volume2 size={15} />}</span><div><strong>{tab === "voice" && segment ? speaker?.name ?? "当前段落" : "项目声音"}</strong><small>{tab === "voice" && segment ? `${snapshot.segments.filter((row) => row.chapterId === chapterId).indexOf(segment) + 1} · ${segment.text.slice(0, 48) || "尚未填写脚本"}` : `${snapshot.takes.length} 个声音版本，原始文件均保留`}</small></div></div>
      <Button variant="outline" size="sm" onClick={() => onAddSources(tab === "voice" ? segment?.id : undefined)}><Plus />添加声音</Button>
      {tab === "voice" && segment && <SpeechControls key={`${segment.id}:${speaker?.voice ?? ""}`} segment={segment} speaker={speaker} />}
      <div className="as-subheading"><h3>{tab === "voice" && segment ? "配音版本" : "全部声音"}</h3><span>{takes.length}</span></div>
      {!takes.length && <p className="as-help">录音、上传已有声音，或使用文字生成配音。完成后会保留在这里。</p>}
      <div className="as-version-list">{takes.map((row, index) => <Button variant={takeId === row.id ? "secondary" : "ghost"} className="as-version-row" key={row.id} onClick={() => onTake(row.id)}><Volume2 size={14} /><span><strong>{row.name || `版本 ${index + 1}`}</strong><small>{sourceLabel(row.source)} · {timeLabel(row.durationSec)}{row.source === "tts" && row.textSnapshot !== undefined && snapshot.segments.find((item) => item.id === row.segmentId)?.text !== row.textSnapshot ? " · 脚本已修改" : ""}</small></span>{segment?.selectedTakeId === row.id && <Check size={14} />}</Button>)}</div>
      {take && <div className="as-take-detail"><AudioPlayer mediaId={take.mediaId} title={take.name} compact /><div className="as-detail-actions">{segment && take.segmentId === segment.id && <Button size="sm" variant={segment.selectedTakeId === take.id ? "secondary" : "outline"} disabled={busy || segment.selectedTakeId === take.id} onClick={() => void action(() => patchAudioSegment(projectId, segment.id, segment.revision, { selectedTakeId: take.id }))}><Check />{segment.selectedTakeId === take.id ? "已采用" : "采用此版本"}</Button>}<Button size="icon-sm" variant="ghost" title="保存到素材库" aria-label="保存到素材库" disabled={busy} onClick={() => void action(() => promoteLegacyMaterial("media", take.mediaId, { kind: "global" }))}><Library /></Button><Button size="icon-sm" variant="ghost" title="删除未采用版本" aria-label="删除未采用版本" disabled={busy || snapshot.clips.some((clip) => clip.takeId === take.id) || snapshot.segments.some((row) => row.selectedTakeId === take.id)} onClick={() => void action(async () => { await deleteAudioTake(projectId, take.id, take.revision); onTake(""); })}><Trash2 /></Button></div><Field label="放入音轨"><WorkspaceSelect value={track?.id ?? ""} onValueChange={setTrackId}>{tracks.map((row) => <SelectOption key={row.id} value={row.id}>{row.name}</SelectOption>)}</WorkspaceSelect></Field><Field label="前置停顿（秒）"><Input type="number" min={0} max={300} step={0.1} value={pauseSec} onChange={(event) => setPauseSec(event.target.value)} /></Field><Button className="w-full" disabled={busy || !track} onClick={() => void action(async () => { if (!track) return; const pause = Number(pauseSec); if (!Number.isFinite(pause) || pause < 0 || pause > 300) throw new Error("前置停顿应为 0–300 秒"); const end = Math.max(0, ...snapshot.clips.filter((row) => row.trackId === track.id).map((row) => row.startSec + row.trimEndSec - row.trimStartSec)); const clip = await addAudioClip(projectId, { chapterId, trackId: track.id, takeId: take.id, startSec: end + pause, trimStartSec: 0, trimEndSec: take.durationSec, gain: 1, fadeInSec: 0, fadeOutSec: 0 }); onClip(clip.id); })}><Plus />加入时间线</Button><p className="as-help">追加到音轨末尾，已有剪辑保持原样。</p></div>}
      {segment && tab === "voice" && <Disclosure className="as-note"><DisclosureTitle>配音备注</DisclosureTitle><SavedText key={`${segment.id}:notes`} projectId={projectId} rowId={segment.id} field="notes" value={segment.notes} label="配音备注" multiline save={async (notes, baseline) => { const current = await db.audioSegments.get(segment.id); if (!current || current.notes !== baseline) throw new DraftConflictError(); await patchAudioSegment(projectId, current.id, current.revision, { notes }); }} /></Disclosure>}
    </>}
    <GenerationJobs projectId={projectId} />
  </div>;
}
function sourceLabel(source: AudioTake["source"]) { return { upload: "导入", recording: "录音", library: "素材库", tts: "AI 配音", music: "音乐作品" }[source]; }
function SpeechControls({ segment, speaker }: {
    segment: AudioSegment;
    speaker?: AudioSpeaker;
}) {
    const [connectorId, setConnectorId] = useState("");
    const [voice, setVoice] = useState(speaker?.voice ?? "alloy");
    const [speed, setSpeed] = useState(speaker?.speed ?? 1);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState("");
    async function generate() { if (pending.current)
        return; pending.current = true; setBusy(true); setError(""); try {
        await flushPendingDrafts(segment.projectId);
        const current = await db.audioSegments.get(segment.id);
        if (!current)
            throw new Error("段落已不存在");
        const job = await prepareAudioGeneration({ projectId: segment.projectId, connectorId, input: { kind: "speech", text: current.text, voice, speed, segmentId: current.id, segmentRevision: current.revision } });
        await submitAudioGeneration(segment.projectId, job.id);
    }
    catch (e) {
        setError(errorText(e));
    }
    finally {
        pending.current = false;
        setBusy(false);
    } }
    return <Disclosure className="as-generation"><DisclosureTitle><Sparkles size={13} />生成新配音</DisclosureTitle><ConnectionSelect value={connectorId} onChange={setConnectorId}/><Field label="音色"><WorkspaceSelect value={voice} onValueChange={(value) => setVoice(value)}>{SPEECH_VOICES.map((item) => <SelectOption key={item} value={item}>{item}</SelectOption>)}</WorkspaceSelect></Field><Field label="语速"><Input type="number" min={0.25} max={4} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}/></Field><Button className="w-full" disabled={!connectorId || busy} onClick={() => void generate()}><Sparkles />{busy ? "正在提交…" : "生成配音版本"}</Button><p className="aw-muted mt-3">使用 APIMart 账户计费，每段最多 4096 字符。修改脚本不会改变已有声音。</p>{error && <p className="aw-error" role="alert">{error}</p>}</Disclosure>;
}
