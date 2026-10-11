import {useCallback, useEffect, useState} from "react";
import {Link, useRouterState} from "@tanstack/react-router";
import {Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";
import {nativeWorkspace, useNativeWorkspaceState} from "@/lib/nativeWorkspace";
import type {NativeBeat, NativeEpisode, NativeShot, NativeVideoWorkspaceState} from "@/lib/nativeWorkspace";
import {toast} from "sonner";

function episodePath(pathname: string, projectId: string): string | undefined {
    const prefix = `/p/${projectId}/e/`;
    return pathname.startsWith(prefix) ? pathname.slice(prefix.length).split("/")[0] || undefined : undefined;
}
function newEpisode(projectId: string, order: number): NativeEpisode {
    const now = String(Date.now());
    return {id: crypto.randomUUID(), projectId, order, title: `第${order + 1}集`, logline: "", script: "", createdAt: now, updatedAt: now};
}
function newBeat(episodeId: string, order: number): NativeBeat {
    return {id: crypto.randomUUID(), episodeId, order, title: `节拍 ${order + 1}`, content: "", timeOfDay: ""};
}
function newShot(projectId: string, episodeId: string, order: number): NativeShot {
    return {id: crypto.randomUUID(), projectId, episodeId, order, shotNumber: order + 1, status: "draft", durationSec: 0, content: "", notes: "", sceneCloseup: "", sound: "", emotion: "", cameraAngle: "", cameraGear: "", focalLength: ""};
}

export function NativeProjectWorkspacePage({projectId}: {projectId: string}) {
    const pathname = useRouterState({select: state => state.location.pathname});
    const {state, availability, error, refresh} = useNativeWorkspaceState();
    const episodeId = episodePath(pathname, projectId);
    const [video, setVideo] = useState<NativeVideoWorkspaceState>();
    const [busy, setBusy] = useState(false);
    const [title, setTitle] = useState("");
    const [logline, setLogline] = useState("");
    const loadVideo = useCallback(async () => {
        if (!state || !state.projects.some(p => p.id === projectId)) return;
        try { setVideo(await nativeWorkspace.videoState(projectId)); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "读取视频项目失败"); }
    }, [projectId, state]);
    useEffect(() => { void loadVideo(); }, [loadVideo, pathname]);
    useEffect(() => { if (video && episodeId) { const item = video.episodes.find(e => e.id === episodeId); setTitle(item?.title ?? ""); setLogline(item?.logline ?? ""); } }, [video, episodeId]);
    if (error) return <PageContent><PageState kind="error" title="原生工作区不可用" description={error} action={<Button variant="outline" onClick={() => void refresh()}>重试</Button>}/></PageContent>;
    if (!state || !video) return <PageContent><PageState kind="loading" title="正在打开视频项目…"/></PageContent>;
    const project = state.projects.find(item => item.id === projectId);
    if (!project) return <PageContent><PageState kind="missing" title="找不到这个项目" action={<Button asChild><Link to="/projects">返回项目</Link></Button>}/></PageContent>;
    const episode = episodeId ? video.episodes.find(item => item.id === episodeId) : undefined;
    const episodeBeats = episode ? video.beats.filter(item => item.episodeId === episode.id) : [];
    const episodeShots = episode ? video.shots.filter(item => item.episodeId === episode.id) : [];
    const isShots = Boolean(episodeId && pathname.includes("/shots"));
    async function saveEpisode(next: NativeEpisode) { setBusy(true); try { await nativeWorkspace.saveEpisode(next); await loadVideo(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "保存集失败"); } finally { setBusy(false); } }
    async function saveBeat(next: NativeBeat) { setBusy(true); try { await nativeWorkspace.saveBeat(next); await loadVideo(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "保存节拍失败"); } finally { setBusy(false); } }
    async function saveShot(next: NativeShot) { setBusy(true); try { await nativeWorkspace.saveShot(next); await loadVideo(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "保存镜头失败"); } finally { setBusy(false); } }
    if (!episode) return <ProjectHome project={project} video={video} availability={availability} busy={busy} onAdd={() => void saveEpisode(newEpisode(projectId, video.episodes.length))}/>;
    if (isShots) return <ShotsEditor episode={episode} shots={episodeShots} busy={busy} onSave={saveShot} onAdd={() => void saveShot(newShot(projectId, episode.id, episodeShots.length))}/>;
    return <StoryEditor episode={episode} beats={episodeBeats} title={title} logline={logline} busy={busy} setTitle={setTitle} setLogline={setLogline} onSaveEpisode={saveEpisode} onSaveBeat={saveBeat} onAddBeat={() => void saveBeat(newBeat(episode.id, episodeBeats.length))}/>;
}
function ProjectHome({project, video, availability, busy, onAdd}: {project: {id: string; title: string}; video: NativeVideoWorkspaceState; availability: Array<{assetId: string; status: string}>; busy: boolean; onAdd: () => void}) {
    const [logline, setLogline] = useState(video.video.logline);
    async function saveLogline() { try { await nativeWorkspace.saveVideoProject({...video.video, logline, updatedAt: String(Date.now())}); toast.success("项目简介已保存"); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "保存项目简介失败"); } }
    return <PageContent role="main"><PageHeader title={project.title} description={`原生 SQLite 视频项目 · 素材检查 ${availability.length}`} actions={<Button disabled={busy} onClick={onAdd}><Plus aria-hidden/>新增集</Button>}/><section className="mb-5 rounded-xl border bg-card p-5"><label className="text-sm font-medium" htmlFor="native-logline">项目简介</label><Textarea id="native-logline" className="mt-2" value={logline} onChange={e => setLogline(e.target.value)} onBlur={() => void saveLogline()}/><p className="mt-2 text-xs text-muted-foreground">媒体引用 {video.referencedAssetIds.length} 个；素材缺失仍保留逻辑引用。</p></section><div className="grid gap-3">{video.episodes.map(item => <article key={item.id} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-medium">{item.title}</h2><p className="text-sm text-muted-foreground">{item.logline || "暂无集简介"}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link to="/p/$projectId/e/$episodeId" params={{projectId: project.id, episodeId: item.id}}>故事与节拍</Link></Button><Button size="sm" asChild><Link to="/p/$projectId/e/$episodeId/shots" params={{projectId: project.id, episodeId: item.id}} search={{shot: undefined}}>分镜</Link></Button></div></div></article>)}</div></PageContent>;
}
function StoryEditor({episode, beats, title, logline, busy, setTitle, setLogline, onSaveEpisode, onSaveBeat, onAddBeat}: {episode: NativeEpisode; beats: NativeBeat[]; title: string; logline: string; busy: boolean; setTitle: (value: string) => void; setLogline: (value: string) => void; onSaveEpisode: (episode: NativeEpisode) => Promise<void>; onSaveBeat: (beat: NativeBeat) => Promise<void>; onAddBeat: () => void}) {
    return <PageContent><PageHeader title={episode.title} description="故事与有序节拍" actions={<Button disabled={busy} onClick={onAddBeat}><Plus aria-hidden/>新增节拍</Button>}/><section className="space-y-3 rounded-xl border bg-card p-5"><Input aria-label="集标题" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => void onSaveEpisode({...episode, title, updatedAt: String(Date.now())})}/><Textarea aria-label="集简介" value={logline} onChange={e => setLogline(e.target.value)} onBlur={() => void onSaveEpisode({...episode, logline, updatedAt: String(Date.now())})}/><Textarea aria-label="集脚本" defaultValue={episode.script} onBlur={e => void onSaveEpisode({...episode, script: e.currentTarget.value, updatedAt: String(Date.now())})}/></section><div className="mt-5 space-y-3">{beats.map(beat => <BeatRow key={beat.id} beat={beat} busy={busy} onSave={onSaveBeat}/>)}</div></PageContent>;
}
function BeatRow({beat, busy, onSave}: {beat: NativeBeat; busy: boolean; onSave: (beat: NativeBeat) => Promise<void>}) {
    const [title, setTitle] = useState(beat.title); const [content, setContent] = useState(beat.content);
    return <article className="rounded-xl border bg-card p-4"><div className="flex gap-2"><Input aria-label="节拍标题" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => void onSave({...beat, title})}/><Textarea aria-label="节拍内容" value={content} onChange={e => setContent(e.target.value)} onBlur={() => void onSave({...beat, content})} disabled={busy}/></div></article>;
}
function ShotsEditor({episode, shots, busy, onSave, onAdd}: {episode: NativeEpisode; shots: NativeShot[]; busy: boolean; onSave: (shot: NativeShot) => Promise<void>; onAdd: () => void}) {
    return <PageContent><PageHeader title={`${episode.title} · 分镜`} description="有序镜头列表" actions={<Button disabled={busy} onClick={onAdd}><Plus aria-hidden/>新增镜头</Button>}/><div className="space-y-3">{shots.map(shot => <ShotRow key={shot.id} shot={shot} busy={busy} onSave={onSave}/>)}</div></PageContent>;
}
function ShotRow({shot, busy, onSave}: {shot: NativeShot; busy: boolean; onSave: (shot: NativeShot) => Promise<void>}) {
    const [content, setContent] = useState(shot.content); const [notes, setNotes] = useState(shot.notes); const [duration, setDuration] = useState(String(shot.durationSec));
    return <article className="rounded-xl border bg-card p-4"><div className="mb-2 flex items-center justify-between"><strong>镜头 {shot.shotNumber}</strong><select aria-label="镜头状态" value={shot.status} disabled={busy} onChange={e => void onSave({...shot, status: e.target.value as NativeShot["status"]})}><option value="draft">草稿</option><option value="ready">可生成</option><option value="framed">已出图</option><option value="clipped">已成片</option><option value="approved">通过</option></select></div><Textarea aria-label="镜头内容" value={content} onChange={e => setContent(e.target.value)} onBlur={() => void onSave({...shot, content})}/><div className="mt-2 flex gap-2"><Input aria-label="时长" type="number" min="0" step="0.1" value={duration} onChange={e => setDuration(e.target.value)} onBlur={() => void onSave({...shot, durationSec: Number(duration)})}/><Input aria-label="备注" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => void onSave({...shot, notes})}/></div></article>;
}
