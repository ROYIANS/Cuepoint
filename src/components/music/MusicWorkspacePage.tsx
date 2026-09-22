import { WorkspaceSelect, SelectOption, Disclosure, DisclosureTitle } from "@/components/audioMusic/controls";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Disc3, Heart, Play, Plus, Sparkles, Library, Copy, Search } from "lucide-react";
import { db } from "@/db/database";
import { addMusicDraft, patchMusicDraft, patchMusicWork } from "@/db/music";
import { adoptMusicWorkAsAudioTake } from "@/db/audio";
import { promoteLegacyMaterial } from "@/db/materials";
import { defaultMusicSettings, type MusicDraft, type MusicSettings, type MusicWork } from "@/domain/music";
import { prepareAudioGeneration, submitAudioGeneration } from "@/lib/audioGeneration/runtime";
import { useDebouncedDraft, flushPendingDrafts } from "@/lib/debouncedDraft";
import { DraftConflictError } from "@/lib/draftConflict";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DraftStatus } from "@/components/ui/draft-status";
import { AudioPlayer, ConnectionSelect, Empty, Field, GenerationJobs, SavedText, errorText, timeLabel, useProjectAudioJobs } from "@/components/audioMusic/shared";
export function MusicWorkspacePage({ projectId }: {
    projectId: string;
}) {
    useProjectAudioJobs(projectId);
    const data = useLiveQuery(async () => ({ project: await db.projects.get(projectId) ?? null, drafts: await db.musicDrafts.where("projectId").equals(projectId).sortBy("createdAt"), works: await db.musicWorks.where("projectId").equals(projectId).reverse().sortBy("createdAt"), projectId }), [projectId]);
    const [draftId, setDraftId] = useState("");
    const [selectedId, setSelectedId] = useState("");
    const [playingId, setPlayingId] = useState("");
    const [query, setQuery] = useState("");
    const [favorites, setFavorites] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function action(fn: () => Promise<unknown>) { setError(""); setBusy(true); try {
        await fn();
    }
    catch (e) {
        setError(errorText(e));
    }
    finally {
        setBusy(false);
    } }
    if (!data || data.projectId !== projectId)
        return <div className="p-8 text-muted-foreground">加载音乐项目…</div>;
    if (!data.project || data.project.kind !== "music")
        return <div className="p-8">找不到这个音乐项目</div>;
    const draft = data.drafts.find((row) => row.id === draftId) ?? data.drafts.at(-1);
    const selected = data.works.find((row) => row.id === selectedId);
    const playing = data.works.find((row) => row.id === playingId);
    const works = data.works.filter((row) => (!favorites || row.favorite) && `${row.title} ${row.lyrics}`.toLowerCase().includes(query.toLowerCase()));
    return <div className="aw-root">
    <header className="aw-header"><div><div className="aw-eyebrow">MUSIC / CREATIVE WORKSPACE</div><h1>{data.project.name}</h1></div><div className="aw-actions"><small>{data.works.length} 首作品 · 本地保存</small><Button size="sm" variant="outline" disabled={busy} onClick={() => void action(async () => { const row = await addMusicDraft(projectId, { settings: defaultMusicSettings() }); setDraftId(row.id); })}><Plus />新建创作</Button></div></header>
    {error && <div role="alert" className="aw-banner aw-error">{error}</div>}
    <div className="aw-body aw-music-body">
      <aside className="aw-rail"><div className="aw-section-heading"><span>创作台</span><Disc3 size={15}/></div>{data.drafts.length > 0 && <Field label="创作草稿"><WorkspaceSelect value={draft?.id ?? ""} onValueChange={(value) => setDraftId(value)}>{data.drafts.map((row, index) => <SelectOption key={row.id} value={row.id}>{row.settings.title || `创作 ${index + 1}`} · {row.settings.engine === "suno" ? "Suno" : "Flow"}</SelectOption>)}</WorkspaceSelect></Field>}{draft ? <MusicCreation key={draft.id} record={draft}/> : <><p className="aw-muted">从一句灵感，开始你的第一首作品。</p><Button className="mt-4" disabled={busy} onClick={() => void action(async () => { const row = await addMusicDraft(projectId, { settings: defaultMusicSettings() }); setDraftId(row.id); })}><Plus />开始创作</Button></>}<GenerationJobs projectId={projectId}/></aside>
      <main className="aw-content"><div className="aw-section-heading"><span>作品库 <span className="aw-muted"> / {works.length}</span></span><Button size="sm" variant={favorites ? "secondary" : "ghost"} onClick={() => setFavorites(!favorites)}><Heart size={14} fill={favorites ? "currentColor" : "none"}/>收藏</Button></div><div className="aw-inline mb-5"><Search size={16} className="text-muted-foreground"/><Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索作品" placeholder="搜索标题或歌词…"/></div>{!works.length ? <Empty title={query || favorites ? "没有匹配的作品" : "让灵感开始发声"}>在创作台描述你想听到的音乐，或者切换到自定义歌词。每次生成都会保留完整作品，供你反复试听与挑选。</Empty> : works.map((work, index) => <div className="aw-music-row" data-selected={selectedId === work.id} key={work.id}><Button size="icon-sm" variant="ghost" aria-label={`播放 ${work.title}`} onClick={() => { setPlayingId(work.id); setSelectedId(work.id); }}><Play size={14}/></Button><Button variant="ghost" className="aw-music-row-title" onClick={() => setSelectedId(work.id)}><strong>{work.title || "未命名作品"}</strong><small>{String(index + 1).padStart(2, "0")} · {work.provenance?.model ?? work.settings?.engine ?? "音乐"} · {new Date(work.createdAt).toLocaleDateString("zh-CN")}</small></Button><span className="aw-time aw-muted">{timeLabel(work.durationSec)}</span><Button size="icon-sm" variant="ghost" aria-label={work.favorite ? "取消收藏" : "收藏作品"} disabled={busy} onClick={() => void action(() => patchMusicWork(projectId, work.id, work.revision, { favorite: !work.favorite }))}><Heart size={15} fill={work.favorite ? "currentColor" : "none"}/></Button></div>)}</main>
      <aside className="aw-inspector">{selected ? <MusicDetails key={selected.id} work={selected} busy={busy} action={action} reuse={() => void action(async () => { if (!selected.settings)
        return; const row = await addMusicDraft(projectId, { settings: structuredClone(selected.settings) }); setDraftId(row.id); })}/> : <Empty title="作品详情">选择作品，查看歌词、创作参数和笔记。</Empty>}</aside>
    </div><AudioPlayer key={playing?.id ?? "empty"} mediaId={playing?.mediaId} title={playing?.title ?? ""} autoplay={Boolean(playing)}/>
  </div>;
}
function MusicCreation({ record }: {
    record: MusicDraft;
}) {
    const [connectorId, setConnectorId] = useState("");
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState("");
    const { draft, setDraft, status, error: saveError, retry, useLatest } = useDebouncedDraft<MusicSettings>({ scope: record.projectId, draftKey: `${record.id}:settings`, initialValue: record.settings, persist: async (settings, baseline) => {
            const current = await db.musicDrafts.get(record.id);
            if (!current || JSON.stringify(current.settings) !== JSON.stringify(baseline))
                throw new DraftConflictError();
            await patchMusicDraft(record.projectId, current.id, current.revision, { settings });
        } });
    const engineDrafts = useRef<Partial<Record<MusicSettings["engine"], MusicSettings>>>({});
    function changeEngine(engine: MusicSettings["engine"]) {
      if (engine === draft.engine) return;
      engineDrafts.current[draft.engine] = structuredClone(draft);
      const retained = engineDrafts.current[engine];
      if (retained) { setDraft(retained); return; }
      if (engine === "flowmusic" && draft.engine === "suno") setDraft({ engine, title: draft.title, soundPrompt: draft.custom ? draft.style : draft.prompt, lyrics: draft.custom ? draft.prompt : "" });
      else if (engine === "suno" && draft.engine === "flowmusic") setDraft({ engine, version: "v6", title: draft.title, custom: Boolean(draft.lyrics), prompt: draft.lyrics || draft.soundPrompt, style: draft.lyrics ? draft.soundPrompt : "", negativeTags: "", instrumental: false });
    }
    const update = (patch: Partial<MusicSettings>) => setDraft((previous) => ({ ...previous, ...patch } as MusicSettings));
    async function generate() {
        if (pending.current)
            return;
        pending.current = true;
        setBusy(true);
        setError("");
        try {
            await flushPendingDrafts(record.projectId);
            const current = await db.musicDrafts.get(record.id);
            if (!current)
                throw new Error("创作草稿不存在");
            const job = await prepareAudioGeneration({ projectId: record.projectId, connectorId, input: { kind: "music", settings: current.settings, draftId: current.id, draftRevision: current.revision } });
            await submitAudioGeneration(record.projectId, job.id);
        }
        catch (e) {
            setError(errorText(e));
        }
        finally {
            pending.current = false;
            setBusy(false);
        }
    }
    return <><Field label="音乐引擎"><WorkspaceSelect value={draft.engine} onValueChange={(value) => changeEngine(value as MusicSettings["engine"])}><SelectOption value="suno">Suno</SelectOption><SelectOption value="flowmusic">Flow Music</SelectOption></WorkspaceSelect></Field>
    {draft.engine === "suno" ? <><Field label="创作模式"><WorkspaceSelect value={draft.custom ? "custom" : "simple"} onValueChange={(value) => update({ custom: value === "custom" })}><SelectOption value="simple">灵感描述</SelectOption><SelectOption value="custom">自定义歌词</SelectOption></WorkspaceSelect></Field><Field label={draft.custom ? "歌词" : "描述你想要的音乐"}><Textarea rows={7} maxLength={draft.custom ? 5000 : 3000} value={draft.prompt} onChange={(e) => update({ prompt: e.target.value })} placeholder={draft.custom ? "[Verse]\n写下你的歌词…" : "例如：午后公路上的独立流行，温暖的吉他，轻快而自在…"}/></Field><label className="aw-check"><Checkbox checked={draft.instrumental} onCheckedChange={(checked) => update({ instrumental: checked === true })} />纯音乐</label>{draft.custom && <><Field label="作品标题"><Input value={draft.title} maxLength={80} onChange={(e) => update({ title: e.target.value })}/></Field><Field label="风格"><Textarea value={draft.style} maxLength={1000} onChange={(e) => update({ style: e.target.value })} placeholder="曲风、乐器、情绪与人声特点"/></Field></>}<Disclosure><DisclosureTitle>更多设置</DisclosureTitle><Field label="Suno 版本"><WorkspaceSelect value={draft.version} onValueChange={(value) => update({ version: value as "v6" | "v6-wild" | "v6-mini" })}><SelectOption value="v6">v6</SelectOption><SelectOption value="v6-wild">v6-wild</SelectOption><SelectOption value="v6-mini">v6-mini</SelectOption></WorkspaceSelect></Field>{draft.custom && <><Field label="避免的风格"><Input value={draft.negativeTags} onChange={(e) => update({ negativeTags: e.target.value })}/></Field><Field label="期望时长（秒，可选）"><Input type="number" min={10} max={360} value={draft.durationSec ?? ""} onChange={(e) => update({ durationSec: e.target.value ? Number(e.target.value) : undefined })}/><small>10–360 秒，实际时长由模型决定。</small></Field></>}</Disclosure></> : <><Field label="音乐描述"><Textarea rows={5} value={draft.soundPrompt} onChange={(e) => update({ soundPrompt: e.target.value })} placeholder="音乐的风格、情绪和乐器…"/></Field><Field label="歌词（可选）"><Textarea rows={5} value={draft.lyrics} onChange={(e) => update({ lyrics: e.target.value })}/></Field><Field label="作品标题"><Input value={draft.title} onChange={(e) => update({ title: e.target.value })}/></Field><Disclosure><DisclosureTitle>更多设置</DisclosureTitle><Field label="时长（秒，可选）"><Input type="number" min={1} max={240} value={draft.lengthSec ?? ""} onChange={(e) => update({ lengthSec: e.target.value ? Number(e.target.value) : undefined })}/></Field><Field label="BPM（可选）"><Input type="number" min={1} value={draft.bpm ?? ""} onChange={(e) => update({ bpm: e.target.value || undefined })}/></Field><Field label="随机种子（可选）"><Input value={draft.seed ?? ""} onChange={(e) => update({ seed: e.target.value || undefined })}/></Field></Disclosure></>}
    <DraftStatus status={status} error={saveError} onRetry={() => void retry()} onUseLatest={useLatest}/><div className="mt-5"><ConnectionSelect value={connectorId} onChange={setConnectorId}/></div><Button className="w-full" disabled={!connectorId || busy || status === "error"} onClick={() => void generate()}><Sparkles size={15}/>{busy ? "提交生成中…" : "生成音乐"}</Button><p className="aw-muted mt-3">生成将使用所选 APIMart 账户计费。结果自动保留到当前项目。</p>{error && <p role="alert" className="aw-error">{error}</p>}</>;
}
function MusicDetails({ work, busy, action, reuse }: {
    work: MusicWork;
    busy: boolean;
    action: (fn: () => Promise<unknown>) => Promise<void>;
    reuse: () => void;
}) {
    const audioProjects = useLiveQuery(() => db.projects.filter((row) => row.kind === "audio" && !row.archivedAt).toArray());
    const [targetProjectId, setTargetProjectId] = useState("");
    const [adopted, setAdopted] = useState(false);
    const save = (field: "title" | "notes") => async (text: string, baseline: string) => { const current = await db.musicWorks.get(work.id); if (!current || current[field] !== baseline)
        throw new DraftConflictError(); await patchMusicWork(work.projectId, work.id, current.revision, { [field]: text }); };
    return <><div className="aw-eyebrow">SELECTED WORK</div><div className="aw-detail-title"><SavedText projectId={work.projectId} rowId={work.id} field="title" value={work.title} label="作品标题" save={save("title")}/></div><div className="aw-actions mb-6">{work.settings && <Button size="sm" variant="outline" disabled={busy} onClick={reuse}><Copy />复用参数</Button>}<Button size="sm" variant="outline" disabled={busy} onClick={() => void action(() => promoteLegacyMaterial("media", work.mediaId, { kind: "global" }))}><Library />存入素材库</Button></div><Field label="添加到音频项目"><WorkspaceSelect value={targetProjectId} onValueChange={(value) => { setTargetProjectId(value); setAdopted(false); }}><SelectOption value="">选择音频项目</SelectOption>{audioProjects?.map((project) => <SelectOption key={project.id} value={project.id}>{project.name}</SelectOption>)}</WorkspaceSelect><Button variant="outline" size="sm" disabled={busy || !targetProjectId || adopted} onClick={() => void action(async () => { await adoptMusicWorkAsAudioTake(targetProjectId, work.id); setAdopted(true); })}>{adopted ? "已添加独立声音副本" : "添加音乐声音"}</Button></Field><Field label="创作笔记"><SavedText projectId={work.projectId} rowId={work.id} field="notes" value={work.notes} label="创作笔记" multiline save={save("notes")} placeholder="记录喜欢的段落和下次想调整的方向…"/></Field><div className="aw-section-heading">歌词</div><p className="aw-lyrics">{work.lyrics || "这首作品没有返回歌词。"}</p>{work.settings && <Disclosure className="mt-6"><DisclosureTitle>原始创作参数</DisclosureTitle><MusicParameterSummary settings={work.settings}/></Disclosure>}</>;
}
function MusicParameterSummary({ settings }: {
    settings: MusicSettings;
}) {
    const items: Array<[
        string,
        string | number | undefined
    ]> = settings.engine === "suno"
        ? [["引擎", `Suno ${settings.version}`], ["模式", settings.custom ? "自定义歌词" : "灵感描述"], ["声音", settings.instrumental ? "纯音乐" : "歌曲"], ["描述 / 歌词", settings.prompt], ["风格", settings.custom ? settings.style : undefined], ["避免风格", settings.custom ? settings.negativeTags : undefined], ["期望时长", settings.custom ? settings.durationSec : undefined]]
        : [["引擎", "Flow Music"], ["描述", settings.soundPrompt], ["歌词", settings.lyrics], ["BPM", settings.bpm], ["时长", settings.lengthSec], ["随机种子", settings.seed]];
    return <dl className="aw-lyrics">{items.filter(([, value]) => value !== undefined && value !== "").map(([label, value]) => <div key={label} className="mb-3"><dt className="text-foreground">{label}</dt><dd>{value}</dd></div>)}</dl>;
}
