import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Upload } from "lucide-react";
import { db } from "@/db/database";
import type { AudioTake } from "@/domain/audio";
import { validateMimoReferenceBlob } from "@/lib/audioGeneration/reference";
import { decodeAudioBlob } from "@/lib/audio/engine";
import { detectAudioMime } from "@/lib/audio/mime";
import { encodePcm16Wav } from "@/lib/audio/wav";
import { Button } from "@/components/ui/button";
import { AudioPlayer, errorText } from "@/components/audioMusic/shared";
import { WorkspaceSelect, SelectOption } from "@/components/audioMusic/controls";
import { keepAudioSource } from "./AudioSources";

export function VoiceReferencePicker({ projectId, takes, value, onChange, disabled, onBusyChange }: {
  projectId: string; takes: AudioTake[]; value: string; onChange: (id: string) => void; disabled?: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const upload = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refs = [...new Map(takes.map(row => [row.mediaId, row])).values()];
  const selected = useLiveQuery(async () => value ? (await db.media.get(value)) ?? null : null, [value]);
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); onBusyChange(true); setError("");
    try { await action(); } catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }
  return <div className="space-y-3"><WorkspaceSelect aria-label="选择参考声音" disabled={disabled || busy} value={value} onValueChange={(id) => void perform(async () => {
    const media = await db.media.get(id); if (!media || media.projectId !== projectId) throw new Error("参考声音不属于当前项目");
    const mime = await detectAudioMime(media.blob);
    if (["audio/wav", "audio/mpeg", "audio/mp3", "audio/x-wav", "audio/wave"].includes(mime)) { await validateMimoReferenceBlob(media.blob); onChange(id); }
    else { const { blob } = encodePcm16Wav(await decodeAudioBlob(media.blob)); await validateMimoReferenceBlob(blob); const take = await keepAudioSource(projectId, blob, `${media.filename} · 参考.wav`, "upload"); onChange(take.mediaId); }
  })}><SelectOption value="">选择项目录音或配音版本</SelectOption>{refs.map(row => <SelectOption key={row.mediaId} value={row.mediaId}>{row.name}</SelectOption>)}{value && !refs.some(row => row.mediaId === value) && <SelectOption value={value}>{selected?.projectId === projectId ? selected.filename : "参考声音不可用"}</SelectOption>}</WorkspaceSelect>
    <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => upload.current?.click()}><Upload/>{busy ? "正在保存参考…" : "上传参考声音"}</Button>
    <input ref={upload} hidden type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; void perform(async () => { await validateMimoReferenceBlob(file); const take = await keepAudioSource(projectId, file, file.name, "upload"); onChange(take.mediaId); }); }}/>
    {value && <AudioPlayer mediaId={value} title="参考声音" compact/>}
    <p className="text-xs text-muted-foreground">支持 WAV / MP3；项目中的其他录音会保存为 WAV 参考副本。</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
