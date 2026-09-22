import { WorkspaceSelect, SelectOption, Disclosure, DisclosureTitle } from "@/components/audioMusic/controls";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Play, Pause, Plus, Library, Copy, Search, X, Download } from "lucide-react";
import { db } from "@/db/database";
import { addMusicDraft, patchMusicWork } from "@/db/music";
import { adoptMusicWorkAsAudioTake } from "@/db/audio";
import { promoteLegacyMaterial } from "@/db/materials";
import { defaultMusicSettings, type MusicSettings, type MusicWork } from "@/domain/music";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { DraftConflictError } from "@/lib/draftConflict";
import { downloadBlob } from "@/lib/projectPackage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AudioPlayer, Empty, Field, GenerationJobs, SavedText, errorText, timeLabel, useProjectAudioJobs } from "@/components/audioMusic/shared";
import { MusicCreation } from "./MusicCreation";
import { linkMusicVariants, musicVariant, newVariantSettings, parseVariantLinks, type MusicVariant, type VariantLinks } from "./draftVariants";
import "./music-workspace.css";

export function MusicWorkspacePage({ projectId }: { projectId: string }) {
  return <MusicWorkspace key={projectId} projectId={projectId}/>;
}
function MusicWorkspace({ projectId }: { projectId: string }) {
  useProjectAudioJobs(projectId);
  const data = useLiveQuery(async () => ({ project: await db.projects.get(projectId) ?? null, drafts: await db.musicDrafts.where("projectId").equals(projectId).sortBy("createdAt"), works: await db.musicWorks.where("projectId").equals(projectId).reverse().sortBy("createdAt"), projectId }), [projectId]);
  const [draftId, setDraftId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [toggleRequest, setToggleRequest] = useState(0);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [sort, setSort] = useState("newest");
  const [mobileMode, setMobileMode] = useState("create");
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [connectorId, setConnectorId] = useState("");
  const [error, setError] = useState("");
  const [actionBusy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const busy = actionBusy || submitting;
  const actionPending = useRef(false);
  const storageKey = `cuepoint.music.variants.${projectId}`;
  const variantLinks = useRef<VariantLinks>((() => { try { return parseVariantLinks(localStorage.getItem(storageKey)); } catch { return {}; } })());
  useEffect(() => { const media = window.matchMedia("(min-width: 1280px)"); const update = () => setWide(media.matches); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  async function action(fn: () => Promise<unknown>) {
    if (actionPending.current || submissionPending.current) return;
    actionPending.current = true; setError(""); setBusy(true);
    try { await fn(); } catch (e) { setError(errorText(e)); }
    finally { actionPending.current = false; setBusy(false); }
  }
  if (!data || data.projectId !== projectId) return <div className="p-8 text-muted-foreground">加载音乐项目…</div>;
  if (!data.project || data.project.kind !== "music") return <div className="p-8">找不到这个音乐项目</div>;
  const draft = data.drafts.find((row) => row.id === draftId) ?? data.drafts.at(-1);
  const selected = data.works.find((row) => row.id === selectedId);
  const playing = data.works.find((row) => row.id === playingId);
  const works = data.works.filter((row) => (!favorites || row.favorite) && `${row.title} ${row.lyrics}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  const queueIndex = works.findIndex((row) => row.id === playingId);
  const previous = queueIndex > 0 ? works[queueIndex - 1] : undefined;
  const next = queueIndex >= 0 ? works[queueIndex + 1] : undefined;
  function play(work: MusicWork) { if (playingId === work.id) setToggleRequest((value) => value + 1); else { setPlayingId(work.id); setIsPlaying(false); } }
  async function switchVariant(target: MusicVariant) {
    if (!draft || target === musicVariant(draft.settings)) return;
    await flushPendingDrafts(projectId);
    const current = await db.musicDrafts.get(draft.id);
    if (!current || current.projectId !== projectId) throw new Error("创作草稿不存在");
    const targetId = variantLinks.current[current.id]?.[target];
    const retained = targetId ? await db.musicDrafts.get(targetId) : undefined;
    const row = retained?.projectId === projectId && musicVariant(retained.settings) === target ? retained : await addMusicDraft(projectId, { settings: newVariantSettings(current.settings, target) });
    variantLinks.current = linkMusicVariants(variantLinks.current, current, row);
    try { localStorage.setItem(storageKey, JSON.stringify(variantLinks.current)); } catch { /* Draft contents are still durable in Dexie. */ }
    setDraftId(row.id);
  }
  const details = selected && <MusicDetails key={selected.id} work={selected} busy={busy} action={action} reuse={() => void action(async () => {
    if (!selected.settings) return;
    await flushPendingDrafts(projectId);
    const row = await addMusicDraft(projectId, { settings: structuredClone(selected.settings) }); setDraftId(row.id); setMobileMode("create"); setSelectedId("");
  })}/>;
  return <div className="aw-root mw-root">
    <div className="mw-mobile-nav"><Tabs value={mobileMode} onValueChange={setMobileMode}><TabsList aria-label="音乐工作台"><TabsTrigger value="create">创作</TabsTrigger><TabsTrigger value="works">作品 {data.works.length || ""}</TabsTrigger></TabsList></Tabs></div>
    {error && <div role="alert" className="aw-banner aw-error">{error}</div>}
    <div className="mw-body" data-mode={mobileMode} data-details={Boolean(selected && wide)}>
      <aside className="mw-composer" aria-label="音乐创作">
        <div className="mw-draft-bar"><WorkspaceSelect aria-label="创作草稿" disabled={busy} value={draft?.id ?? ""} onValueChange={(value) => void action(async () => { await flushPendingDrafts(projectId); setDraftId(value); })}>{data.drafts.map((row, index) => <SelectOption key={row.id} value={row.id}>{row.settings.title || `创作 ${index + 1}`} · {row.settings.engine === "flowmusic" ? "Flow" : row.settings.custom ? "自定义" : "简单"}</SelectOption>)}</WorkspaceSelect><Button size="icon-sm" variant="ghost" aria-label="新建创作" disabled={busy} onClick={() => void action(async () => { await flushPendingDrafts(projectId); const row = await addMusicDraft(projectId, { settings: defaultMusicSettings() }); setDraftId(row.id); })}><Plus/></Button></div>
        {draft ? <MusicCreation key={draft.id} record={draft} switching={busy} changeVariant={(target) => void action(() => switchVariant(target))} connectorId={connectorId} setConnectorId={setConnectorId} onSubmitted={() => setMobileMode("works")} onSubmittingChange={(value) => { submissionPending.current = value; setSubmitting(value); }}/> : <Button onClick={() => void action(async () => { const row = await addMusicDraft(projectId, { settings: defaultMusicSettings() }); setDraftId(row.id); })}>开始创作</Button>}
      </aside>
      <main className="mw-library" aria-label="音乐作品库">
        <div className="mw-library-heading"><h1>作品</h1><span>{data.works.length} 首</span></div>
        <div className="mw-library-tools"><div className="mw-search"><Search size={16}/><Input aria-label="搜索作品" placeholder="搜索作品或歌词" value={query} onChange={(e) => setQuery(e.target.value)}/></div><Button size="sm" variant={favorites ? "secondary" : "outline"} aria-pressed={favorites} onClick={() => setFavorites(!favorites)}><Heart size={14} fill={favorites ? "currentColor" : "none"}/>收藏</Button><WorkspaceSelect aria-label="作品排序" value={sort} onValueChange={setSort}><SelectOption value="newest">最新</SelectOption><SelectOption value="oldest">最早</SelectOption></WorkspaceSelect></div>
        <GenerationJobs projectId={projectId} mode="activity"/>
        {!works.length ? <Empty title={query || favorites ? "没有匹配的作品" : "你的下一首，从一个灵感开始"}>{query || favorites ? "试试其他关键词，或取消收藏筛选。" : "描述想听到的音乐，生成的每个版本都会留在这里。"}</Empty> : works.map((work, index) => <div key={work.id}>
          {(index === 0 || new Date(work.createdAt).toDateString() !== new Date(works[index - 1].createdAt).toDateString()) && <h2 className="mw-date">{new Date(work.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</h2>}
          <div className="mw-work-row" data-selected={selectedId === work.id} data-playing={playingId === work.id}>
            <Button size="icon" variant="secondary" aria-label={`${playingId === work.id && isPlaying ? "暂停" : "播放"} ${work.title}`} onClick={() => play(work)}>{playingId === work.id && isPlaying ? <Pause/> : <Play/>}</Button>
            <Button variant="ghost" className="mw-work-title" aria-label={`查看 ${work.title || "未命名作品"} 详情`} onClick={() => setSelectedId(work.id)}><strong>{work.title || "未命名作品"}</strong><small>{work.settings?.engine === "suno" ? `Suno ${work.settings.version}` : work.settings?.engine === "flowmusic" ? "Flow Music" : work.provenance?.model || "音乐"}{work.settings && ` · ${work.settings.engine === "flowmusic" ? work.settings.soundPrompt : work.settings.custom ? work.settings.style : work.settings.prompt}`}</small></Button>
            <span className="aw-time aw-muted">{timeLabel(work.durationSec)}</span><Button size="icon-sm" variant="ghost" aria-label={work.favorite ? "取消收藏" : "收藏作品"} disabled={busy} onClick={() => void action(() => patchMusicWork(projectId, work.id, work.revision, { favorite: !work.favorite }))}><Heart size={15} fill={work.favorite ? "currentColor" : "none"}/></Button>
          </div>
        </div>)}
      </main>
      {wide && selected && <aside className="mw-details"><div className="mw-details-heading"><span>作品详情</span><Button size="icon-sm" variant="ghost" aria-label="关闭作品详情" onClick={() => setSelectedId("")}><X/></Button></div>{details}</aside>}
    </div>
    {!wide && <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(""); }}><SheetContent className="mw-detail-sheet w-full sm:max-w-md overflow-y-auto"><SheetHeader><SheetTitle>作品详情</SheetTitle><SheetDescription>歌词、创作笔记与作品操作</SheetDescription></SheetHeader><div className="px-5 pb-6">{details}</div></SheetContent></Sheet>}
    <AudioPlayer key={playing?.id ?? "empty"} mediaId={playing?.mediaId} title={playing?.title ?? ""} autoplay={Boolean(playing)} toggleRequest={toggleRequest} onPlayingChange={setIsPlaying} onPrevious={previous ? () => play(previous) : undefined} onNext={next ? () => play(next) : undefined} onEnded={next ? () => play(next) : undefined}/>
  </div>;
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
    return <div className="mw-detail-content"><SavedText projectId={work.projectId} rowId={work.id} field="title" value={work.title} label="作品标题" save={save("title")}/>
      <p className="aw-muted">{timeLabel(work.durationSec)} · {work.settings?.engine === "flowmusic" ? "Flow Music" : work.settings?.engine === "suno" ? `Suno ${work.settings.version}` : "音乐作品"}</p>
      <div className="mw-detail-actions">{work.settings && <Button variant="outline" disabled={busy} onClick={reuse}><Copy/>复用创作</Button>}<Button variant="outline" disabled={busy} onClick={() => void action(async () => { const media = await db.media.get(work.mediaId); if (!media) throw new Error("原始音频不可用"); downloadBlob(media.blob, media.filename); })}><Download/>下载</Button></div>
      <section><h3>歌词</h3><p className="aw-lyrics">{work.lyrics || "这首作品没有返回歌词。"}</p></section>
      <Disclosure><DisclosureTitle>创作笔记</DisclosureTitle><SavedText projectId={work.projectId} rowId={work.id} field="notes" value={work.notes} label="创作笔记" multiline save={save("notes")} placeholder="记录喜欢的段落和下次想调整的方向…"/></Disclosure>
      <Disclosure><DisclosureTitle>使用这首音乐</DisclosureTitle><div className="mw-reuse-actions"><Button size="sm" variant="outline" disabled={busy} onClick={() => void action(() => promoteLegacyMaterial("media", work.mediaId, { kind: "global" }))}><Library/>存入素材库</Button><Field label="添加到音频项目"><WorkspaceSelect aria-label="目标音频项目" value={targetProjectId} onValueChange={(value) => { setTargetProjectId(value); setAdopted(false); }}><SelectOption value="">选择音频项目</SelectOption>{audioProjects?.map((project) => <SelectOption key={project.id} value={project.id}>{project.name}</SelectOption>)}</WorkspaceSelect><Button variant="outline" size="sm" disabled={busy || !targetProjectId || adopted} onClick={() => void action(async () => { await adoptMusicWorkAsAudioTake(targetProjectId, work.id); setAdopted(true); })}>{adopted ? "已添加独立声音副本" : "添加音乐声音"}</Button></Field></div></Disclosure>
      {work.settings && <Disclosure><DisclosureTitle>创作参数</DisclosureTitle><MusicParameterSummary settings={work.settings}/></Disclosure>}
    </div>;
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
