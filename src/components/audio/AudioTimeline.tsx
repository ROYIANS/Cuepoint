import { WorkspaceSelect, SelectOption, WorkspaceSlider } from "@/components/audioMusic/controls";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronDown, ChevronUp, Download, Expand, Magnet, Music2, Pause, Play, Plus, RotateCcw, RotateCw, Scissors, SkipBack, SlidersHorizontal, Trash2, Volume2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { AudioClip, AudioProjectSnapshot, AudioTake, AudioTrack } from "@/domain/audio";
import { db } from "@/db/database";
import { addAudioExport, addAudioTrack, getAudioProjectSnapshot, patchAudioTrack } from "@/db/audio";
import { AudioBufferCache, AudioPreviewPlayer, decodeAudioBlob, renderAudioMix } from "@/lib/audio/engine";
import { buildAudioSchedule, type AudioSchedule } from "@/lib/audio/schedule";
import { preflightAudioRender } from "@/lib/audio/wav";
import { createWaveformPeaks } from "@/lib/audio/waveform";
import { formatTimelineTick, snapTimelinePosition, timelineClipLabel, timelineGeometry } from "@/lib/audio/timeline";
import { createId } from "@/lib/ids";
import { downloadBlob } from "@/lib/projectPackage";
import { flushPendingDrafts } from "@/lib/debouncedDraft";
import { isFormFieldTarget } from "@/lib/formFieldFocus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field, errorText, timeLabel } from "@/components/audioMusic/shared";
import { AudioClipHistory } from "@/lib/audio/commands";
import "./timeline.css";

const cache = new AudioBufferCache();
async function loadBuffers(schedule: AudioSchedule) {
  preflightAudioRender(schedule.durationSec, schedule.sources);
  const buffers = new Map<string, AudioBuffer>();
  for (const source of schedule.sources) {
    let buffer = cache.get(source.mediaId);
    if (!buffer) {
      const record = await db.media.get(source.mediaId);
      if (!record) throw new Error("音频原文件已不存在，无法完整播放或导出");
      buffer = await decodeAudioBlob(record.blob);
      cache.set(source.mediaId, buffer);
    }
    buffers.set(source.mediaId, buffer);
  }
  return buffers;
}

type DragState = { clip: AudioClip; kind: "move" | "start" | "end"; initialX: number; startSec: number; trimStartSec: number; trimEndSec: number };
export interface AudioTimelineProps {
  projectId: string; projectName: string; chapterId: string; snapshot: AudioProjectSnapshot;
  selectedId: string; onSelect: (id: string) => void;
  mobileMode?: "script" | "timeline";
  seekRequest?: { id: string; position: number };
  onPositionChange?: (seconds: number) => void;
  onOpenSources?: () => void;
}

export function AudioTimeline({ projectId, projectName, chapterId, snapshot, selectedId, onSelect, mobileMode = "script", seekRequest, onPositionChange, onOpenSources }: AudioTimelineProps) {
  const player = useRef<AudioPreviewPlayer | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const onPosition = useRef(onPositionChange); onPosition.current = onPositionChange;
  const history = useMemo(() => new AudioClipHistory(projectId, chapterId), [projectId, chapterId]);
  const [, redraw] = useState(0);
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(900);
  const [expanded, setExpanded] = useState(true);
  const [snapping, setSnapping] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [exportScope, setExportScope] = useState("chapter");
  const [inspector, setInspector] = useState(false);
  const [drag, setDrag] = useState<DragState>();
  const dragRef = useRef<DragState | undefined>(undefined);
  const scrubRef = useRef<{ resume: boolean } | undefined>(undefined);
  const playEpoch = useRef(0);
  const tracks = snapshot.tracks.filter((row) => row.chapterId === chapterId).sort((a, b) => a.order - b.order);
  const clips = snapshot.clips.filter((row) => row.chapterId === chapterId);
  const selected = clips.find((row) => row.id === selectedId);
  const contentDuration = Math.max(0, ...clips.map((clip) => clip.startSec + clip.trimEndSec - clip.trimStartSec));
  const geometry = timelineGeometry(contentDuration, viewportWidth, zoom);
  const compositionKey = JSON.stringify([clips, tracks]);
  const splitAvailable = Boolean(selected && position > selected.startSec && position < selected.startSec + selected.trimEndSec - selected.trimStartSec);

  function updatePosition(seconds: number) {
    positionRef.current = seconds; setPosition(seconds); onPosition.current?.(seconds);
  }
  useEffect(() => {
    mounted.current = true;
    const instance = new AudioPreviewPlayer(); player.current = instance;
    const timer = window.setInterval(() => {
      if (instance.playing) updatePosition(instance.currentTime);
      else if (playingRef.current) updatePosition(instance.currentTime);
      playingRef.current = instance.playing; setPlaying(instance.playing);
    }, 60);
    const pause = () => { playEpoch.current++; updatePosition(instance.pause()); setPlaying(false); };
    document.addEventListener("audio-workspace-audition", pause);
    return () => { mounted.current = false; playEpoch.current++; clearInterval(timer); document.removeEventListener("audio-workspace-audition", pause); void instance.dispose(); player.current = null; };
  }, [projectId]);
  const playingRef = useRef(false);
  useEffect(() => { playEpoch.current++; player.current?.pause(); updatePosition(0); setPlaying(false); setInspector(false); setZoom(1); }, [chapterId]);
  useEffect(() => { playEpoch.current++; player.current?.pause(); setPlaying(false); }, [compositionKey]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(root.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!seekRequest) return;
    playEpoch.current++; player.current?.pause(); setPlaying(false); updatePosition(Math.max(0, seekRequest.position));
    if (scroll.current) scroll.current.scrollLeft = Math.max(0, seekRequest.position * geometry.pixelsPerSecond - (viewportWidth - 112) / 3);
  }, [seekRequest?.id]);
  useEffect(() => {
    if (!playing || !scroll.current) return;
    const x = position * geometry.pixelsPerSecond, view = scroll.current;
    const usable = view.clientWidth - 112;
    if (x > view.scrollLeft + usable - 28 || x < view.scrollLeft) view.scrollLeft = Math.max(0, x - usable / 3);
  }, [position, playing, geometry.pixelsPerSecond]);

  async function action(fn: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await fn(); if (mounted.current) redraw((value) => value + 1); }
    catch (e) { if (mounted.current) setError(errorText(e)); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function startPlayback(at: number) {
    const epoch = ++playEpoch.current;
    const instance = player.current;
    document.querySelectorAll("audio").forEach((audio) => audio.pause());
    const schedule = buildAudioSchedule(snapshot, chapterId);
    if (!schedule.clips.length) throw new Error("当前章节没有可播放的片段，请检查静音和独听设置");
    const buffers = await loadBuffers(schedule);
    if (!mounted.current || player.current !== instance || playEpoch.current !== epoch) return;
    await instance?.play(schedule, buffers, at >= schedule.durationSec ? 0 : at);
    setPlaying(Boolean(instance?.playing));
  }
  async function play() {
    if (player.current?.playing) { updatePosition(player.current.pause()); setPlaying(false); }
    else await startPlayback(positionRef.current);
  }
  function seek(seconds: number) { playEpoch.current++; player.current?.pause(); setPlaying(false); updatePosition(Math.max(0, Math.min(contentDuration, seconds))); }
  async function exportMix() {
    await flushPendingDrafts(projectId);
    const frozenSnapshot = await getAudioProjectSnapshot(projectId);
    const schedule = buildAudioSchedule(frozenSnapshot, exportScope === "chapter" ? chapterId : undefined);
    if (!schedule.clips.length) throw new Error("请先将音频放入时间线");
    const buffers = await loadBuffers(schedule);
    const result = await renderAudioMix(schedule, buffers);
    const mediaId = createId("med");
    const chapter = frozenSnapshot.chapters.find((row) => row.id === chapterId);
    const filename = `${projectName}-${exportScope === "chapter" ? chapter?.title ?? "章节" : "完整项目"}.wav`;
    await addAudioExport(projectId, { chapterId: exportScope === "chapter" ? chapterId : undefined, scope: exportScope === "chapter" ? "chapter" : "project", chapterTitle: exportScope === "chapter" ? chapter?.title : undefined, fingerprint: JSON.stringify(schedule), format: "wav", mediaId, durationSec: result.durationSec }, { id: mediaId, projectId, filename, blob: result.blob, mimeType: "audio/wav" });
    downloadBlob(result.blob, filename);
    setNotice(result.attenuation < 1 ? `已导出 WAV；为避免削波，整体降低 ${Math.abs(result.attenuationDb).toFixed(1)} dB。` : "WAV 已保存到项目并开始下载。");
  }
  const shortcuts = useRef({ play, action, selected, history, position, splitAvailable });
  shortcuts.current = { play, action, selected, history, position, splitAvailable };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || isFormFieldTarget(event.target)) return;
      const latest = shortcuts.current;
      const command = event.metaKey || event.ctrlKey;
      let task: (() => Promise<unknown>) | undefined;
      if (event.code === "Space" && !command && !event.altKey) task = latest.play;
      else if (command && event.key.toLowerCase() === "z") task = event.shiftKey ? () => latest.history.redo() : () => latest.history.undo();
      else if (command && event.key.toLowerCase() === "y") task = () => latest.history.redo();
      else if (event.key === "Delete" && latest.selected && !command) task = () => latest.history.remove(latest.selected!);
      else if (event.key.toLowerCase() === "s" && !command && !event.altKey && latest.splitAvailable) task = () => latest.history.split(latest.selected!, latest.position);
      if (task) { event.preventDefault(); void latest.action(task); }
    };
    window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle);
  }, []);

  function scrub(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    seek((event.clientX - rect.left) / geometry.pixelsPerSecond);
  }
  function beginDrag(event: PointerEvent, clip: AudioClip, kind: DragState["kind"]) {
    event.stopPropagation(); if (event.button !== 0 || busyRef.current) return;
    event.preventDefault(); root.current?.focus({ preventScroll: true }); playEpoch.current++;
    onSelect(clip.id); player.current?.pause(); setPlaying(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { clip, kind, initialX: event.clientX, startSec: clip.startSec, trimStartSec: clip.trimStartSec, trimEndSec: clip.trimEndSec };
    dragRef.current = next; setDrag(next);
  }
  function moveDrag(event: PointerEvent) {
    event.stopPropagation(); const current = dragRef.current; if (!current) return;
    const clip = current.clip, take = snapshot.takes.find((row) => row.id === clip.takeId); if (!take) return;
    const delta = (event.clientX - current.initialX) / geometry.pixelsPerSecond;
    const targets = [0, positionRef.current, ...clips.filter((row) => row.id !== clip.id).flatMap((row) => [row.startSec, row.startSec + row.trimEndSec - row.trimStartSec])];
    const snap = (value: number, length = 0) => snapTimelinePosition(value, length, targets, geometry.pixelsPerSecond, snapping && !event.altKey);
    let next = { ...current };
    const minimum = Math.max(.02, clip.fadeInSec + clip.fadeOutSec);
    if (current.kind === "move") next.startSec = snap(clip.startSec + delta, clip.trimEndSec - clip.trimStartSec);
    else if (current.kind === "start") {
      const timelineStart = snap(clip.startSec + delta);
      next.trimStartSec = Math.min(clip.trimEndSec - minimum, Math.max(0, clip.trimStartSec - clip.startSec, clip.trimStartSec + timelineStart - clip.startSec));
      next.startSec = clip.startSec + next.trimStartSec - clip.trimStartSec;
    } else {
      const timelineEnd = snap(clip.startSec + clip.trimEndSec - clip.trimStartSec + delta);
      next.trimEndSec = Math.min(take.durationSec, Math.max(clip.trimStartSec + minimum, clip.trimStartSec + timelineEnd - clip.startSec));
    }
    dragRef.current = next; setDrag(next);
  }
  function endDrag(event: PointerEvent) {
    event.stopPropagation(); const current = dragRef.current; dragRef.current = undefined; setDrag(undefined);
    if (!current) return;
    const { clip, startSec, trimStartSec, trimEndSec } = current;
    if (startSec !== clip.startSec || trimStartSec !== clip.trimStartSec || trimEndSec !== clip.trimEndSec) void action(() => history.executePatch(clip, { startSec, trimStartSec, trimEndSec }));
  }
  function cancelDrag(event: PointerEvent) { event.stopPropagation(); dragRef.current = undefined; setDrag(undefined); }
  function addTrack(role: AudioTrack["role"]) { return action(() => addAudioTrack(projectId, { chapterId, role, name: role === "music" ? "背景音乐" : role === "effects" ? "音效" : "人声", order: tracks.length, gain: 1, muted: false, solo: false })); }

  return <section ref={root} className="at-dock" data-expanded={expanded} data-mobile-mode={mobileMode} aria-label="音频制作时间线" tabIndex={-1}>
    <div className="at-transport">
      <Button variant="ghost" size="icon-sm" aria-label={expanded ? "收起时间线" : "展开时间线"} aria-expanded={expanded} className="at-collapse" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown /> : <ChevronUp />}</Button>
      <Button variant="ghost" size="icon-sm" aria-label="回到开头" title="回到开头" disabled={busy} onClick={() => seek(0)}><SkipBack /></Button>
      <Button className="at-play" size="icon-sm" aria-label={playing ? "暂停" : "播放章节"} title="播放 / 暂停 · Space" disabled={busy || !clips.length} onClick={() => void action(play)}>{playing ? <Pause /> : <Play />}</Button>
      <Popover><PopoverTrigger asChild><Button variant="ghost" className="at-clock" aria-label="精确定位播放位置"><span>{timeLabel(position)}</span><span>/ {timeLabel(contentDuration)}</span></Button></PopoverTrigger><PopoverContent side="top" className="at-position-popover"><Field label="播放位置（秒）"><Input aria-label="播放位置（秒）" type="number" min={0} max={contentDuration} step={.1} value={Number(position.toFixed(1))} onChange={(event) => seek(Number(event.target.value) || 0)} /></Field></PopoverContent></Popover>
      <div className="at-edit-actions"><span className="at-divider"/><Button size="icon-sm" variant="ghost" disabled={busy || !history.canUndo} aria-label="撤销时间线编辑" title="撤销 · ⌘/Ctrl Z" onClick={() => void action(() => history.undo())}><RotateCcw /></Button><Button size="icon-sm" variant="ghost" disabled={busy || !history.canRedo} aria-label="重做时间线编辑" title="重做 · ⌘/Ctrl Shift Z" onClick={() => void action(() => history.redo())}><RotateCw /></Button><Button size="icon-sm" variant="ghost" disabled={busy || !splitAvailable} aria-label="在播放位置分割" title="在播放位置分割 · S" onClick={() => selected && void action(() => history.split(selected, position))}><Scissors /></Button></div>
      <div className="at-transport-space"/>
      <div className="at-zoom"><Button variant="ghost" size="icon-sm" aria-label="缩小时间线" disabled={zoom <= .5} onClick={() => setZoom(Math.max(.5, zoom / 1.5))}><ZoomOut /></Button><Button variant="ghost" size="sm" title="完整显示当前章节" onClick={() => { setZoom(1); if (scroll.current) scroll.current.scrollLeft = 0; }}><Expand size={13}/><span>适应</span></Button><Button variant="ghost" size="icon-sm" aria-label="放大时间线" disabled={zoom >= 12} onClick={() => setZoom(Math.min(12, zoom * 1.5))}><ZoomIn /></Button></div>
      <Popover open={inspector && Boolean(selected)} onOpenChange={setInspector}><PopoverTrigger asChild><Button size="icon-sm" variant={inspector ? "secondary" : "ghost"} disabled={!selected} aria-label="片段属性" title="片段属性"><SlidersHorizontal /></Button></PopoverTrigger><PopoverContent side="top" align="end" className="at-inspector-popover">{selected && <ClipInspector key={`${selected.id}:${selected.revision}`} clip={selected} tracks={tracks} title={timelineClipLabel(selected, snapshot).title} busy={busy} save={(patch) => action(() => history.executePatch(selected, patch))} remove={() => action(async () => { await history.remove(selected); setInspector(false); })}/>}</PopoverContent></Popover>
      <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="at-export" disabled={busy || !snapshot.clips.length}><Download size={14}/><span>{busy ? "处理中" : "导出"}</span></Button></PopoverTrigger><PopoverContent side="top" align="end" className="at-export-popover"><strong>导出声音作品</strong><p>48 kHz · 立体声 · WAV</p><Field label="导出范围"><WorkspaceSelect value={exportScope} onValueChange={setExportScope}><SelectOption value="chapter">当前章节</SelectOption><SelectOption value="project">完整项目</SelectOption></WorkspaceSelect></Field><Button className="w-full" disabled={busy} onClick={() => void action(exportMix)}><Download size={14}/>{busy ? "正在混合音频…" : "导出 WAV"}</Button></PopoverContent></Popover>
    </div>
    <div className="at-editor">
      <div className="at-toolbar"><span className="at-caption">时间线 <span>{clips.length} 个片段</span></span><div className="at-toolbar-actions"><Button variant={snapping ? "secondary" : "ghost"} size="icon-sm" aria-label="吸附片段边缘和播放头" aria-pressed={snapping} title="吸附 · 拖动时按 Alt 暂停吸附" onClick={() => setSnapping(!snapping)}><Magnet size={13}/></Button><Popover><PopoverTrigger asChild><Button variant="ghost" size="sm"><Plus size={13}/>音轨</Button></PopoverTrigger><PopoverContent side="top" align="end" className="at-track-menu">{(["voice", "music", "effects"] as const).map((role) => <Button variant="ghost" key={role} disabled={busy} onClick={() => void addTrack(role)}>{role === "voice" ? "人声音轨" : role === "music" ? "背景音乐音轨" : "音效音轨"}</Button>)}</PopoverContent></Popover></div></div>
      {!clips.length ? <div className="at-empty"><Music2 size={22}/><div><strong>让文字有声音</strong><p>选用配音版本，或录音、导入声音后放入时间线。</p></div>{onOpenSources && <Button variant="outline" size="sm" onClick={onOpenSources}><Plus size={13}/>添加声音</Button>}</div> : <div ref={scroll} className="at-scroll"><div className="at-sheet" style={{ width: geometry.width + 112 }}>
        <div className="at-ruler-row"><div className="at-ruler-label">秒</div><div className="at-ruler" style={{ width: geometry.width }} role="slider" tabIndex={0} aria-label="时间标尺，左右方向键定位" aria-valuemin={0} aria-valuemax={contentDuration} aria-valuenow={Math.min(position, contentDuration)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); seek(event.key === "Home" ? 0 : event.key === "End" ? contentDuration : position + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : .1)); } }} onPointerDown={(event) => { if (event.button !== 0 || busy) return; scrubRef.current = { resume: Boolean(player.current?.playing) }; event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }} onPointerMove={(event) => { if (scrubRef.current) scrub(event); }} onPointerUp={() => { const resume = scrubRef.current?.resume; scrubRef.current = undefined; if (resume) void action(() => startPlayback(positionRef.current)); }} onPointerCancel={() => { scrubRef.current = undefined; }}>
          {geometry.ticks.map((tick) => <span key={tick} className="at-tick" style={{ left: tick * geometry.pixelsPerSecond }}>{formatTimelineTick(tick, geometry.step)}</span>)}<div className="at-ruler-head" style={{ left: position * geometry.pixelsPerSecond }} />
        </div></div>
        {tracks.map((track) => <div className="at-track-row" key={track.id}><div className="at-track-label" data-role={track.role}><strong title={track.name}>{track.name}</strong><div className="at-track-controls"><Button size="icon-sm" variant={track.muted ? "secondary" : "ghost"} aria-label={`${track.name} 静音`} aria-pressed={track.muted} disabled={busy} onClick={() => void action(() => patchAudioTrack(projectId, track.id, track.revision, { muted: !track.muted }))}>M</Button><Button size="icon-sm" variant={track.solo ? "secondary" : "ghost"} aria-label={`${track.name} 独听`} aria-pressed={track.solo} disabled={busy} onClick={() => void action(() => patchAudioTrack(projectId, track.id, track.revision, { solo: !track.solo }))}>S</Button><Popover><PopoverTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`${track.name} 音量`}><Volume2 size={12}/></Button></PopoverTrigger><PopoverContent side="top" className="at-volume-popover"><Field label={`${track.name} · 音量`}><WorkspaceSlider label={`${track.name} 音量`} min={0} max={2} step={.05} defaultValue={track.gain} key={`${track.id}:${track.gain}`} onCommit={(gain) => void action(() => patchAudioTrack(projectId, track.id, track.revision, { gain }))}/></Field></PopoverContent></Popover></div></div><div className="at-lane" style={{ width: geometry.width, backgroundSize: `${geometry.step * geometry.pixelsPerSecond}px 100%` }} onPointerDown={(event) => { if (event.target !== event.currentTarget) return; seek((event.clientX - event.currentTarget.getBoundingClientRect().left) / geometry.pixelsPerSecond); root.current?.focus({ preventScroll: true }); }}>
          <div className="at-playhead" style={{ left: position * geometry.pixelsPerSecond }}/>
          {clips.filter((clip) => clip.trackId === track.id).map((clip) => { const take = snapshot.takes.find((row) => row.id === clip.takeId); const display = drag?.clip.id === clip.id ? { ...clip, startSec: drag.startSec, trimStartSec: drag.trimStartSec, trimEndSec: drag.trimEndSec } : clip; const label = timelineClipLabel(clip, snapshot); return <div key={clip.id} className="at-clip" data-role={track.role} data-selected={selectedId === clip.id} data-muted={track.muted} role="group" aria-label={`${label.speaker}：${label.title}，起点 ${clip.startSec.toFixed(1)} 秒`} style={{ left: display.startSec * geometry.pixelsPerSecond, width: Math.max(14, (display.trimEndSec - display.trimStartSec) * geometry.pixelsPerSecond) }} onPointerDown={(event) => beginDrag(event, clip, "move")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onDoubleClick={() => { onSelect(clip.id); setInspector(true); }}>
            <Button variant="ghost" className="at-clip-select" aria-pressed={selectedId === clip.id} aria-label={`选择 ${label.speaker}：${label.title}`} title={`${label.speaker} · ${label.title}`} onClick={() => { onSelect(clip.id); root.current?.focus({ preventScroll: true }); }}><span className="at-clip-title"><b>{label.speaker}</b>{label.title}</span>{take && <Waveform take={take} clip={display}/>}</Button>
            {(["start", "end"] as const).map((side) => <Button key={side} variant="ghost" className={`at-trim at-trim-${side}`} aria-label={side === "start" ? "拖动裁剪起点" : "拖动裁剪终点"} title="拖动裁剪；双击片段打开精确属性" disabled={busy} onPointerDown={(event) => beginDrag(event, clip, side)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}><span/></Button>)}
          </div>; })}
        </div></div>)}
      </div></div>}
      <div className="at-footer"><span>{selected ? "拖动移动 · 两端裁剪 · 双击编辑属性" : "选择片段开始剪辑"}</span><span>Space 播放<span className="at-desktop-hint"> · S 分割 · ⌘/Ctrl Z 撤销</span></span></div>
    </div>
    {(error || notice) && <div className="at-message" data-error={Boolean(error)} role={error ? "alert" : "status"}><span>{error || notice}</span><Button variant="ghost" size="icon-sm" aria-label="关闭提示" onClick={() => { setError(""); setNotice(""); }}><X size={12}/></Button></div>}
  </section>;
}

function Waveform({ take, clip }: { take: AudioTake; clip: AudioClip }) {
  const [peaks, setPeaks] = useState<ReturnType<typeof createWaveformPeaks>>([]);
  useEffect(() => { let cancelled = false; void (async () => {
    let buffer = cache.get(take.mediaId);
    if (!buffer) { const media = await db.media.get(take.mediaId); if (!media) return; buffer = await decodeAudioBlob(media.blob); cache.set(take.mediaId, buffer); }
    const next = createWaveformPeaks(buffer, 800); if (!cancelled) setPeaks(next);
  })().catch(() => undefined); return () => { cancelled = true; }; }, [take.mediaId]);
  const visible = peaks.slice(Math.floor(clip.trimStartSec / take.durationSec * peaks.length), Math.ceil(clip.trimEndSec / take.durationSec * peaks.length));
  const path = visible.map((peak, i) => `M${i / Math.max(1, visible.length - 1) * 800},${15 - peak.max * 13}V${15 - peak.min * 13}`).join(" ");
  return <svg className="at-waveform" viewBox="0 0 800 30" preserveAspectRatio="none" aria-hidden><path d={path} stroke="currentColor" strokeWidth={1}/></svg>;
}

function ClipInspector({ clip, tracks, title, busy, save, remove }: { clip: AudioClip; tracks: AudioTrack[]; title: string; busy: boolean; save: (patch: Partial<AudioClip>) => Promise<void>; remove: () => Promise<void> }) {
  const [values, setValues] = useState({ trackId: clip.trackId, startSec: String(clip.startSec), trimStartSec: String(clip.trimStartSec), trimEndSec: String(clip.trimEndSec), gain: String(clip.gain), fadeInSec: String(clip.fadeInSec), fadeOutSec: String(clip.fadeOutSec) });
  const fields = { startSec: "时间线位置", trimStartSec: "源裁剪起点", trimEndSec: "源裁剪终点", gain: "音量倍数", fadeInSec: "淡入时长", fadeOutSec: "淡出时长" } as const;
  return <form className="at-inspector" onSubmit={(event) => { event.preventDefault(); void save({ trackId: values.trackId, ...Object.fromEntries(Object.keys(fields).map((key) => [key, Number(values[key as keyof typeof fields])])) }); }}><strong>片段属性</strong><p className="at-inspector-title">{title}</p><Field label="所在音轨"><WorkspaceSelect value={values.trackId} onValueChange={(value) => setValues({ ...values, trackId: value })}>{tracks.map((track) => <SelectOption key={track.id} value={track.id}>{track.name}</SelectOption>)}</WorkspaceSelect></Field><div className="at-inspector-grid">{(Object.keys(fields) as Array<keyof typeof fields>).map((key) => <Field key={key} label={`${fields[key]}${key === "gain" ? "" : "（秒）"}`}><Input type="number" min={0} max={key === "gain" ? 4 : undefined} step={.01} required value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })}/></Field>)}</div><div className="at-inspector-actions"><Button size="icon-sm" variant="ghost" type="button" aria-label="移除片段（可撤销）" disabled={busy} onClick={() => void remove()}><Trash2 /></Button><Button size="sm" type="submit" disabled={busy}>应用修改</Button></div></form>;
}
