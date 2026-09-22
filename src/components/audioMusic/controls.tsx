import { Children as ReactChildren, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { ChevronRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const EMPTY_VALUE = "__workspace_no_selection__";
/** Keep one set of studio selection primitives across both workspaces. */
export function WorkspaceSelect({ value, onValueChange, disabled, className, children, "aria-label": ariaLabel }: {
  value: string; onValueChange: (value: string) => void; disabled?: boolean; className?: string; children: ReactNode; "aria-label"?: string;
}) {
  return <Select value={value || EMPTY_VALUE} onValueChange={(next) => onValueChange(next === EMPTY_VALUE ? "" : next)} disabled={disabled}>
    <SelectTrigger aria-label={ariaLabel} className={`aw-select ${className ?? ""}`}><SelectValue /></SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>;
}
export function SelectOption({ value, children }: { value: string; children: ReactNode }) {
  return <SelectItem value={value || EMPTY_VALUE}>{children}</SelectItem>;
}
/** Adapt scalar workspace values to the shared shadcn slider. */
export function WorkspaceSlider({ value, defaultValue, min = 0, max = 1, step = 0.01, onChange, onCommit, label, disabled, className }: {
  value?: number; defaultValue?: number; min?: number; max?: number; step?: number; onChange?: (value: number) => void; onCommit?: (value: number) => void; label: string; disabled?: boolean; className?: string;
}) {
  return <Slider
    className={`aw-slider ${className ?? ""}`}
    value={value === undefined ? undefined : [value]}
    defaultValue={defaultValue === undefined ? [min] : [defaultValue]}
    min={min} max={max} step={step}
    onValueChange={onChange ? ([next]) => onChange(next) : undefined}
    onValueCommit={onCommit ? ([next]) => onCommit(next) : undefined}
    aria-label={label} disabled={disabled}
  />;
}
export function SourcePlayer({ src, title, autoplay = false }: { src: string; title: string; autoplay?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    const stop = (event: Event) => { if (event.target !== audio.current) audio.current?.pause(); };
    document.addEventListener("play", stop, true);
    const element = audio.current;
    return () => { document.removeEventListener("play", stop, true); element?.pause(); };
  }, []);
  useEffect(() => { setPosition(0); setDuration(0); setPlaying(false); setError(""); }, [src]);
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  return <div className="aw-custom-player">
    <audio ref={audio} src={src} autoPlay={autoplay} preload="metadata" onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)} onPlay={() => { setPlaying(true); document.dispatchEvent(new CustomEvent("audio-workspace-audition")); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError("此音频无法播放，请检查文件格式或重新导入。")} />
    <Button size="icon-sm" variant="ghost" aria-label={`${playing ? "暂停" : "播放"} ${title}`} onClick={() => { if (playing) audio.current?.pause(); else void audio.current?.play().catch(() => setError("播放被浏览器阻止，请再次点击播放。")); }}>{playing ? <Pause size={16} /> : <Play size={16} />}</Button>
    <span className="aw-time">{format(position)}</span>
    <WorkspaceSlider label={`${title} 播放进度`} className="aw-playback-slider" value={Math.min(position, duration)} max={duration || 1} disabled={!duration} step={0.01} onChange={(seconds) => { if (audio.current) audio.current.currentTime = seconds; setPosition(seconds); }} />
    <span className="aw-time aw-muted">{format(duration)}</span>
    <Button size="icon-sm" variant="ghost" aria-label={volume ? "静音试听" : "恢复试听音量"} onClick={() => { const next = volume ? 0 : 1; if (audio.current) audio.current.volume = next; setVolume(next); }}>{volume ? <Volume2 size={15} /> : <VolumeX size={15} />}</Button>
    <WorkspaceSlider label="试听音量" className="aw-volume-slider" value={volume} onChange={(next) => { if (audio.current) audio.current.volume = next; setVolume(next); }} />
    {error && <span role="alert" className="aw-error">{error}</span>}
  </div>;
}

const DisclosureContext = createContext({ open: false, toggle: () => {} });
export function Disclosure({ children, defaultOpen = false, className = "" }: { children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return <DisclosureContext.Provider value={{ open, toggle: () => setOpen((value) => !value) }}><section data-aw-disclosure className={className}>{ReactChildren.map(children, (child) => isValidElement(child) && child.type === DisclosureTitle ? child : open ? child : null)}</section></DisclosureContext.Provider>;
}
export function DisclosureTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { open, toggle } = useContext(DisclosureContext);
  return <Button variant="ghost" type="button" aria-expanded={open} className={`aw-disclosure-title ${className}`} onClick={toggle}><ChevronRight size={13} className={open ? "rotate-90" : ""} />{children}</Button>;
}
