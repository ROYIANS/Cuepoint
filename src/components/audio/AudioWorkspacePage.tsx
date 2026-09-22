import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronDown, Headphones, ListMusic, PanelRightClose, PanelRightOpen, Plus, X } from "lucide-react";
import { db } from "@/db/database";
import { addAudioChapter, addAudioTrack, getAudioProjectSnapshot, patchAudioChapter } from "@/db/audio";
import { AUDIO_TRANSACTION_TABLES } from "@/db/audioShared";
import type { AudioSegment, AudioTake } from "@/domain/audio";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DraftConflictError } from "@/lib/draftConflict";
import { SavedText, errorText, useProjectAudioJobs } from "@/components/audioMusic/shared";
import { AudioSources } from "./AudioSources";
import { AudioInspector } from "./AudioInspector";
import { ScriptDocument } from "./ScriptDocument";
import { AudioTimeline } from "./AudioTimeline";
import "./story-workspace.css";

function useInspectorSheet() {
  const [sheet, setSheet] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1099px)").matches);
  useEffect(() => { const query = window.matchMedia("(max-width: 1099px)"); const update = () => setSheet(query.matches); query.addEventListener("change", update); update(); return () => query.removeEventListener("change", update); }, []);
  return sheet;
}
export function AudioWorkspacePage({ projectId }: { projectId: string }) {
  useProjectAudioJobs(projectId);
  const data = useLiveQuery(async () => { const project = await db.projects.get(projectId) ?? null; return { project, snapshot: project?.kind === "audio" ? await getAudioProjectSnapshot(projectId) : null, projectId }; }, [projectId]);
  const [chapterId, setChapterId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [takeId, setTakeId] = useState("");
  const [clipId, setClipId] = useState("");
  const [mode, setMode] = useState<"script" | "timeline">("script");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"voice" | "sources" | "exports">("voice");
  const [sourceRequest, setSourceRequest] = useState<{ id: string; segmentId?: string }>();
  const [chapterOpen, setChapterOpen] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{ id: string; position: number }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const sheet = useInspectorSheet();
  async function action(fn: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await fn(); } catch (reason) { const message = errorText(reason); setError(message); toast.error(message); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!data || data.projectId !== projectId) return <div className="p-8 text-muted-foreground">加载音频项目…</div>;
  if (!data.project || !data.snapshot) return <div className="p-8">找不到这个音频项目</div>;
  const { snapshot, project } = data;
  const chapter = snapshot.chapters.find((row) => row.id === chapterId) ?? snapshot.chapters[0];
  if (!chapter) return <div className="p-8">项目缺少音频章节，请重新打开项目。</div>;
  const segment = snapshot.segments.find((row) => row.id === segmentId && row.chapterId === chapter.id);
  function selectSegment(row: AudioSegment) {
    setSegmentId(row.id);
    if (segmentId === row.id) return;
    const takes = snapshot!.takes.filter((take) => take.segmentId === row.id);
    const adopted = takes.find((take) => take.id === row.selectedTakeId) ?? takes.at(-1);
    setTakeId(adopted?.id ?? "");
    const clip = snapshot!.clips.find((item) => item.chapterId === row.chapterId && item.takeId === adopted?.id) ?? snapshot!.clips.find((item) => item.chapterId === row.chapterId && takes.some((take) => take.id === item.takeId));
    setClipId(clip?.id ?? "");
    if (clip) setSeekRequest({ id: `${clip.id}:${Date.now()}`, position: clip.startSec });
  }
  function selectClip(id: string) {
    setClipId(id);
    const clip = snapshot!.clips.find((row) => row.id === id);
    const take = snapshot!.takes.find((row) => row.id === clip?.takeId);
    if (take) { setTakeId(take.id); setSegmentId(take.segmentId ?? ""); }
  }
  function selectTake(id: string) {
    setTakeId(id);
    const take = snapshot!.takes.find((row) => row.id === id);
    const owner = snapshot!.segments.find((row) => row.id === take?.segmentId);
    if (owner) { setChapterId(owner.chapterId); setSegmentId(owner.id); }
    else setSegmentId("");
    const clip = snapshot!.clips.find((row) => row.takeId === id && row.chapterId === (owner?.chapterId ?? chapter.id));
    setClipId(clip?.id ?? "");
    if (clip) setSeekRequest({ id: `${clip.id}:${Date.now()}`, position: clip.startSec });
  }
  function inspect(row?: AudioSegment) { if (row) selectSegment(row); setInspectorTab(row ? "voice" : "sources"); setInspectorOpen(true); }
  function saved(take: AudioTake) { setTakeId(take.id); setClipId(""); if (take.segmentId) { setSegmentId(take.segmentId); const owner = snapshot!.segments.find((row) => row.id === take.segmentId); if (owner) setChapterId(owner.chapterId); } else setSegmentId(""); setInspectorTab(take.segmentId ? "voice" : "sources"); setInspectorOpen(true); }
  const inspector = <AudioInspector projectId={projectId} chapterId={chapter.id} snapshot={snapshot} segment={segment} takeId={takeId} tab={inspectorTab} onTabChange={setInspectorTab} onTake={selectTake} onClip={selectClip} onAddSources={(target) => { if (sheet) setInspectorOpen(false); setSourceRequest({ id: String(Date.now()), segmentId: target }); }} action={action} busy={busy} />;
  return <div className="as-workspace" data-mode={mode}>
    <header className="as-toolbar"><div className="as-chapter-selector"><Popover open={chapterOpen} onOpenChange={setChapterOpen}><PopoverTrigger asChild><Button variant="ghost" size="sm"><ListMusic size={15} /><span>{chapter.title}</span><ChevronDown size={13} /></Button></PopoverTrigger><PopoverContent align="start" className="as-chapter-menu"><div className="as-menu-heading">项目章节</div><div className="mb-3"><SavedText key={`${chapter.id}:title`} projectId={projectId} rowId={chapter.id} field="title" value={chapter.title} label="当前章节名称" save={async (title, baseline) => { const current = await db.audioChapters.get(chapter.id); if (!current || current.title !== baseline) throw new DraftConflictError(); await patchAudioChapter(projectId, current.id, current.revision, { title }); }} /></div>{snapshot.chapters.map((row, index) => <Button key={row.id} variant={chapter.id === row.id ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => { setChapterId(row.id); setSegmentId(""); setTakeId(""); setClipId(""); setChapterOpen(false); }}><span className="text-muted-foreground text-xs">{String(index + 1).padStart(2, "0")}</span><span className="truncate">{row.title}</span>{chapter.id === row.id && <Check size={14} className="ml-auto" />}</Button>)}<Button variant="ghost" size="sm" className="mt-2 w-full justify-start" disabled={busy} onClick={() => void action(async () => { const row = await db.transaction("rw", AUDIO_TRANSACTION_TABLES, async () => { const created = await addAudioChapter(projectId, { title: `章节 ${snapshot.chapters.length + 1}`, order: Math.max(0, ...snapshot.chapters.map((item) => item.order)) + 1 }); await addAudioTrack(projectId, { chapterId: created.id, role: "voice", name: "人声", order: 0, gain: 1, muted: false, solo: false }); return created; }); setChapterId(row.id); setSegmentId(""); setTakeId(""); setClipId(""); setChapterOpen(false); })}><Plus size={14} />新增章节</Button></PopoverContent></Popover><span className="as-project-name">{project.name}</span></div>
      <nav className="as-view-modes" aria-label="音频制作模式"><Button size="sm" variant={mode === "script" ? "secondary" : "ghost"} aria-pressed={mode === "script"} onClick={() => setMode("script")}>脚本</Button><Button size="sm" variant={mode === "timeline" ? "secondary" : "ghost"} aria-pressed={mode === "timeline"} onClick={() => setMode("timeline")}>剪辑</Button></nav>
      <div className="as-toolbar-actions"><AudioSources request={sourceRequest} compact projectId={projectId} segmentId={segment?.id} onSaved={saved} /><Button variant="ghost" size="sm" aria-label={inspectorOpen ? "收起声音面板" : "打开声音面板"} onClick={() => { if (!segment) setInspectorTab("sources"); setInspectorOpen(!inspectorOpen); }}>{inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}<span className="as-panel-button-label">声音</span></Button></div>
    </header>
    {error && <div className="as-error" role="alert"><span>{error}</span><Button variant="ghost" size="icon-sm" aria-label="关闭错误提示" onClick={() => setError("")}><X /></Button></div>}
    <div className="as-main"><main className="as-script-scroll"><ScriptDocument key={chapter.id} chapter={chapter} snapshot={snapshot} selectedId={segment?.id ?? ""} busy={busy} action={action} onSelect={selectSegment} onInspect={(row) => inspect(row)} /></main>{!sheet && inspectorOpen && <aside className="as-inspector"><div className="as-inspector-top"><span><Headphones size={14} />声音工作区</span><Button variant="ghost" size="icon-sm" aria-label="收起声音工作区" onClick={() => setInspectorOpen(false)}><X size={14} /></Button></div>{inspector}</aside>}</div>
    <AudioTimeline projectId={projectId} projectName={project.name} chapterId={chapter.id} snapshot={snapshot} selectedId={clipId} onSelect={selectClip} mobileMode={mode} seekRequest={seekRequest} onOpenSources={() => inspect()} />
    {sheet && <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}><SheetContent className="as-inspector-sheet"><SheetHeader><SheetTitle>声音与版本</SheetTitle><SheetDescription>{segment ? "当前段落的声音、生成版本和剪辑来源" : "管理项目声音与导出成品"}</SheetDescription></SheetHeader><div className="as-sheet-scroll">{inspector}</div></SheetContent></Sheet>}
  </div>;
}
