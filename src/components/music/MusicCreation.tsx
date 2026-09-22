import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { db } from "@/db/database";
import { patchMusicDraft } from "@/db/music";
import type { MusicDraft, MusicSettings } from "@/domain/music";
import { prepareAudioGeneration, submitAudioGeneration } from "@/lib/audioGeneration/runtime";
import { useDebouncedDraft, flushPendingDrafts } from "@/lib/debouncedDraft";
import { DraftConflictError } from "@/lib/draftConflict";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DraftStatus } from "@/components/ui/draft-status";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceSelect, SelectOption, Disclosure, DisclosureTitle } from "@/components/audioMusic/controls";
import { ConnectionSelect, Field, errorText } from "@/components/audioMusic/shared";
import { musicVariant, type MusicVariant } from "./draftVariants";

export function MusicCreation({ record, switching, changeVariant, connectorId, setConnectorId, onSubmitted, onSubmittingChange }: {
  record: MusicDraft; switching: boolean; changeVariant: (target: MusicVariant) => void;
  connectorId: string; setConnectorId: (id: string) => void; onSubmitted: () => void; onSubmittingChange: (value: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const { draft, setDraft, status, error: saveError, retry, useLatest } = useDebouncedDraft<MusicSettings>({
    scope: record.projectId, draftKey: `${record.id}:settings`, initialValue: record.settings,
    persist: async (settings, baseline) => {
      const current = await db.musicDrafts.get(record.id);
      if (!current || JSON.stringify(current.settings) !== JSON.stringify(baseline)) throw new DraftConflictError();
      await patchMusicDraft(record.projectId, current.id, current.revision, { settings });
    },
  });
  const update = (patch: Partial<MusicSettings>) => setDraft((previous) => ({ ...previous, ...patch } as MusicSettings));
  async function generate() {
    if (pending.current) return;
    pending.current = true; setBusy(true); onSubmittingChange(true); setError("");
    try {
      await flushPendingDrafts(record.projectId);
      const current = await db.musicDrafts.get(record.id);
      if (!current) throw new Error("创作草稿不存在");
      const job = await prepareAudioGeneration({ projectId: record.projectId, connectorId, input: { kind: "music", settings: current.settings, draftId: current.id, draftRevision: current.revision } });
      await submitAudioGeneration(record.projectId, job.id);
      onSubmitted();
    } catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); onSubmittingChange(false); }
  }
  return <div className="mw-creation">
    <div className="mw-compose-scroll">
      <div className="mw-mode-bar">
        {draft.engine === "suno" ? <Tabs value={musicVariant(draft)} onValueChange={(value) => changeVariant(value as MusicVariant)}><TabsList aria-label="创作模式"><TabsTrigger disabled={switching || busy} value="suno-simple">简单</TabsTrigger><TabsTrigger disabled={switching || busy} value="suno-custom">自定义</TabsTrigger></TabsList></Tabs> : <span className="text-sm font-medium">Flow Music</span>}
        <WorkspaceSelect aria-label="音乐引擎与模型" disabled={switching || busy} value={draft.engine === "suno" ? draft.version : "flowmusic"} onValueChange={(value) => {
          if (value === "flowmusic") changeVariant("flowmusic");
          else if (draft.engine === "suno") update({ version: value as "v6" | "v6-mini" | "v6-wild" });
          else changeVariant("suno-simple");
        }}>{draft.engine === "suno" ? <><SelectOption value="v6">Suno v6</SelectOption><SelectOption value="v6-wild">Suno v6-wild</SelectOption><SelectOption value="v6-mini">Suno v6-mini</SelectOption></> : <SelectOption value="suno">Suno</SelectOption>}<SelectOption value="flowmusic">Flow Music</SelectOption></WorkspaceSelect>
      </div>
      {draft.engine === "suno" ? <>
        {draft.custom && draft.instrumental ? <p className="mw-instrumental-note">已填写的歌词会保留，切回歌曲后可继续编辑。用下方风格描述这首纯音乐。</p> : <Field label={draft.custom ? "歌词" : "描述你想听到的音乐"}><Textarea disabled={busy || switching} className="mw-main-input" rows={draft.custom ? 9 : 7} aria-label={draft.custom ? "歌词" : "音乐描述"} maxLength={draft.custom ? 5000 : 3000} value={draft.prompt} onChange={(e) => update({ prompt: e.target.value })} placeholder={draft.custom ? "[Verse]\n写下第一句歌词…\n\n[Chorus]\n让旋律记住这一刻" : "午后公路上的独立流行，温暖的吉他，轻快而自在。\n\n写下场景、情绪，或一个灵感。"}/></Field>}
        <label className="mw-check"><Checkbox disabled={busy || switching} checked={draft.instrumental} onCheckedChange={(value) => update({ instrumental: value === true })}/>纯音乐<span>不含人声</span></label>
        {draft.custom && <Field label="风格"><Textarea disabled={busy || switching} aria-label="音乐风格" rows={3} maxLength={1000} value={draft.style} onChange={(e) => update({ style: e.target.value })} placeholder="独立流行、木吉他、温暖的女声…"/></Field>}
        <Disclosure><DisclosureTitle>更多设置</DisclosureTitle><Field label={draft.custom ? "作品名称（可选）" : "草稿名称（可选）"}><Input disabled={busy || switching} aria-label={draft.custom ? "作品名称" : "草稿名称"} value={draft.title} maxLength={80} onChange={(e) => update({ title: e.target.value })}/></Field>{draft.custom && <><Field label="避免的风格"><Input disabled={busy || switching} aria-label="避免的风格" value={draft.negativeTags} onChange={(e) => update({ negativeTags: e.target.value })}/></Field><Field label="期望时长（秒）"><Input disabled={busy || switching} aria-label="期望时长" type="number" min={10} max={360} value={draft.durationSec ?? ""} onChange={(e) => update({ durationSec: e.target.value ? Number(e.target.value) : undefined })}/><small>留空自动决定；可填写 10–360 秒。</small></Field></>}</Disclosure>
      </> : <>
        <Field label="描述你想听到的音乐"><Textarea disabled={busy || switching} className="mw-main-input" aria-label="音乐描述" rows={7} value={draft.soundPrompt} onChange={(e) => update({ soundPrompt: e.target.value })} placeholder="写下风格、情绪、乐器，或让你产生灵感的场景…"/></Field>
        <Disclosure defaultOpen={Boolean(draft.lyrics)}><DisclosureTitle>歌词（可选）</DisclosureTitle><Textarea disabled={busy || switching} aria-label="歌词" rows={7} value={draft.lyrics} onChange={(e) => update({ lyrics: e.target.value })} placeholder="写下你的歌词…"/></Disclosure>
        <Disclosure><DisclosureTitle>更多设置</DisclosureTitle><Field label="作品名称（可选）"><Input disabled={busy || switching} aria-label="作品名称" value={draft.title} onChange={(e) => update({ title: e.target.value })}/></Field><Field label="期望时长（秒）"><Input disabled={busy || switching} aria-label="期望时长" type="number" min={1} max={240} value={draft.lengthSec ?? ""} onChange={(e) => update({ lengthSec: e.target.value ? Number(e.target.value) : undefined })}/></Field><Field label="BPM"><Input disabled={busy || switching} aria-label="BPM" type="number" min={1} value={draft.bpm ?? ""} onChange={(e) => update({ bpm: e.target.value || undefined })}/></Field><Field label="随机种子"><Input disabled={busy || switching} aria-label="随机种子" value={draft.seed ?? ""} onChange={(e) => update({ seed: e.target.value || undefined })}/></Field></Disclosure>
      </>}
      <DraftStatus status={status} error={saveError} onRetry={() => void retry()} onUseLatest={useLatest}/>
    </div>
    <div className="mw-generate"><ConnectionSelect value={connectorId} onChange={setConnectorId}/><Button className="w-full" disabled={!connectorId || busy || switching || status === "error"} onClick={() => void generate()}><Sparkles/>{busy ? "提交生成中…" : "生成音乐"}</Button><p>使用所选 APIMart 账户计费</p>{error && <p role="alert" className="aw-error">{error}</p>}</div>
  </div>;
}
