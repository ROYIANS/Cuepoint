import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Sparkles } from "lucide-react";
import { db } from "@/db/database";
import { patchAudioSegment } from "@/db/audio";
import type { AudioSegment, AudioSpeaker } from "@/domain/audio";
import { prepareAudioGeneration, submitAudioGeneration } from "@/lib/audioGeneration/runtime";
import { defaultMimoConnector, speakerSpeechProfile } from "@/lib/audioGeneration/defaults";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { errorText } from "@/components/audioMusic/shared";
import { WorkspaceSelect, SelectOption, Disclosure, DisclosureTitle } from "@/components/audioMusic/controls";
import { MimoConnection } from "./MimoConnection";
import { voiceLabel } from "./VoiceLibrary";

export function SpeechControls({ segment, speaker, speakers, onVoices }: {
  segment: AudioSegment; speaker?: AudioSpeaker; speakers: AudioSpeaker[]; onVoices: () => void;
}) {
  const connections = useLiveQuery(() => db.connectors.toArray());
  const profile = speakerSpeechProfile(speaker);
  const connector = profile.mimo ? defaultMimoConnector(connections ?? []) : connections?.find(row => row.definitionId === "apimart" && row.apiKey.trim());
  const [direction, setDirection] = useState("");
  const [optimize, setOptimize] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function perform(fn: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function generate() {
    if (!connector) return;
    await flushPendingDrafts(segment.projectId);
    const current = await db.audioSegments.get(segment.id);
    if (!current || current.projectId !== segment.projectId) throw new Error("段落已不存在");
    if (current.speakerId !== segment.speakerId) throw new Error("段落音色已改变，请重新确认后生成");
    if (speaker && (await db.audioSpeakers.get(speaker.id))?.revision !== speaker.revision) throw new Error("音色已改变，请重新确认后生成");
    const mimo = profile.mimo ? { ...profile.mimo, instruction: [profile.mimo.instruction, direction.trim()].filter(Boolean).join("\n"), ...(profile.mimo.mode === "design" ? { optimizeTextPreview: optimize } : {}) } : undefined;
    const job = await prepareAudioGeneration({ projectId: segment.projectId, connectorId: connector.id,
      input: { kind: "speech", text: current.text, ...profile, ...(mimo ? { mimo } : {}), segmentId: current.id, segmentRevision: current.revision } });
    const result = await submitAudioGeneration(segment.projectId, job.id);
    if (result.error) setError(result.error);
    else setNotice(result.status === "saved" ? "配音已保存到下方版本，试听后即可采用。" : "请在生成任务中查看进度。");
  }
  return <section className="as-generation space-y-3" aria-label="段落配音">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">配音</h3><Button size="sm" variant="ghost" disabled={busy} onClick={onVoices}><Plus/>创作音色</Button></div>
    <WorkspaceSelect aria-label="这段使用的音色" disabled={busy} value={speaker?.id ?? ""} onValueChange={(id) => void perform(async () => {
      await flushPendingDrafts(segment.projectId);
      const row = await db.audioSegments.get(segment.id);
      if (!row || row.speakerId !== segment.speakerId) throw new Error("段落已更新，请重新选择音色");
      await patchAudioSegment(segment.projectId, row.id, row.revision, { speakerId: id || undefined });
    })}><SelectOption value="">MiMo 默认音色</SelectOption>{speakers.map(row => <SelectOption key={row.id} value={row.id}>{row.name} · {voiceLabel(row)}</SelectOption>)}</WorkspaceSelect>
    <Button className="w-full" disabled={!connector || busy} onClick={() => void perform(generate)}><Sparkles/>{busy ? "处理中…" : "生成这段配音"}</Button>
    {profile.mimo && <Disclosure><DisclosureTitle>演绎与文本（可选）</DisclosureTitle><Textarea aria-label="这段演绎指导" value={direction} maxLength={4000} rows={2} disabled={busy} onChange={(e) => setDirection(e.target.value)} placeholder="这一段轻声讲述，结尾放慢…"/>{profile.mimo.mode === "design" && <><label className="flex items-start gap-2 py-2 text-sm"><Checkbox disabled={busy} checked={optimize} onCheckedChange={(value) => setOptimize(value === true)}/>允许润色播报文本</label><p className="text-xs text-muted-foreground">默认保持稿件原文。开启后，实际播报文本会另存到配音版本。</p></>}</Disclosure>}
    {connections === undefined ? <p className="as-help">加载配音连接…</p> : !connector ? profile.mimo ? <MimoConnection existing={connections.find(row => row.definitionId === "mimo")}/> : <p className="as-help">这个旧音色需要 APIMart 连接。可从上方选择 MiMo 默认音色，或前往“连接与模型”恢复原连接。</p> : <p className="text-xs text-muted-foreground">{profile.mimo ? "MiMo" : "APIMart · 原有音色"} · 生成一个新版本，保留当前声音</p>}
    {notice && <p className="as-help" role="status">{notice}</p>}{error && <p className="aw-error" role="alert">{error}</p>}
  </section>;
}
