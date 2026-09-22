import { WorkspaceSelect, SelectOption, Disclosure, DisclosureTitle, SourcePlayer, type AudioPlaybackActions } from "@/components/audioMusic/controls";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useMedia } from "@/lib/media";
import { downloadBlob } from "@/lib/projectPackage";
import { refreshAudioGeneration } from "@/lib/audioGeneration/runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DraftStatus } from "@/components/ui/draft-status";
import { useDebouncedDraft } from "@/lib/debouncedDraft";
import { Download, LoaderCircle, RefreshCw, Volume2 } from "lucide-react";
import type { AudioGenerationStatus } from "@/domain/audioGeneration";
import "./workspace.css";
export function errorText(error: unknown) { return error instanceof Error ? error.message : "操作失败，请重试"; }
export function timeLabel(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`; }
export function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <label className="aw-field"><span>{label}</span>{children}</label>; }
export function Empty({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <div className="aw-empty"><Volume2 size={28} aria-hidden/><h3>{title}</h3><p>{children}</p></div>; }
export function SavedText({ projectId, rowId, field, value, label, multiline = false, placeholder, save }: {
    projectId: string;
    rowId: string;
    field: string;
    value: string;
    label: string;
    multiline?: boolean;
    placeholder?: string;
    save: (text: string, baseline: string) => Promise<void>;
}) {
    const { draft, setDraft, status, error, retry, useLatest } = useDebouncedDraft({ scope: projectId, draftKey: `${rowId}:${field}`, initialValue: value, persist: save });
    const props = { value: draft, placeholder, "aria-label": label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value) };
    return <div className="aw-saved-field">{multiline ? <Textarea {...props} rows={4}/> : <Input {...props}/>}<DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest}/></div>;
}
export function ConnectionSelect({ value, onChange }: {
    value: string;
    onChange: (id: string) => void;
}) {
    const connections = useLiveQuery(() => db.connectors.toArray());
    const choices = (connections ?? []).filter((item) => item.definitionId === "apimart" && item.apiKey.trim());
    return <Field label="生成连接"><WorkspaceSelect value={value} onValueChange={(value) => onChange(value)}><SelectOption value="">选择 APIMart 连接</SelectOption>{choices.map((item) => <SelectOption value={item.id} key={item.id}>{item.label || "APIMart"}</SelectOption>)}</WorkspaceSelect>{choices.length === 0 && <small>请在连接与模型中添加 APIMart 连接后生成。</small>}</Field>;
}
export function AudioPlayer({ mediaId, title, compact = false, autoplay = false, ...playback }: {
    mediaId?: string;
    title: string;
    compact?: boolean;
    autoplay?: boolean;
} & AudioPlaybackActions) {
    const media = useMedia(mediaId);
    return <div className={compact ? "aw-audition" : "aw-player"}>
    {!compact && <div className="aw-player-title"><Volume2 size={18}/><div><strong>{title || "试听作品"}</strong><small>{mediaId ? "本地音频" : "选择一个版本或作品开始试听"}</small></div></div>}
    {media ? <SourcePlayer key={mediaId} src={media.url} title={title} autoplay={autoplay} {...playback} /> : <span className="aw-muted">{mediaId ? "音频加载中或已不可用" : "尚未选择音频"}</span>}
    {mediaId && !compact && <Button variant="ghost" size="icon" aria-label="下载原始音频" onClick={() => void db.media.get(mediaId).then((record) => { if (record)
        downloadBlob(record.blob, record.filename); })}><Download size={16}/></Button>}
  </div>;
}
const statuses: Record<AudioGenerationStatus, string> = { prepared: "已准备", submitting: "正在提交", uncertain: "提交结果待确认", submitted: "排队中", running: "生成中", "remote-completed": "等待下载", downloading: "保存音频中", saved: "已保存到项目", failed: "生成失败", "target-conflict": "结果已保留，请重新选择目标" };
const pausedJobIds = new Set<string>();
/** Mounted by each project workspace, independent of collapsed or sheet-based panels. */
export function useProjectAudioJobs(projectId: string) {
    const jobs = useLiveQuery(() => db.audioGenerationJobs.where("projectId").equals(projectId).toArray(), [projectId]);
    const latest = useRef(jobs);
    latest.current = jobs;
    const polledAt = useRef(new Map<string, number>());
    useEffect(() => {
        let running = false;
        const timer = window.setInterval(() => {
            if (running)
                return;
            const job = latest.current?.filter((j) => j.projectId === projectId && !j.dormant && !pausedJobIds.has(j.id) && ["submitted", "running", "remote-completed", "downloading", "submitting"].includes(j.status)).sort((a, b) => (polledAt.current.get(a.id) ?? 0) - (polledAt.current.get(b.id) ?? 0))[0];
            if (!job)
                return;
            running = true;
            polledAt.current.set(job.id, Date.now());
            void refreshAudioGeneration(projectId, job.id).then((updated) => { if (updated.error)
                pausedJobIds.add(job.id); }).catch((e: unknown) => { pausedJobIds.add(job.id); void e; }).finally(() => { running = false; });
        }, 7000);
        return () => window.clearInterval(timer);
    }, [projectId]);
}
export function GenerationJobs({ projectId, mode = "disclosure" }: {
    projectId: string;
    mode?: "disclosure" | "activity";
}) {
    const jobs = useLiveQuery(() => db.audioGenerationJobs.where("projectId").equals(projectId).reverse().sortBy("createdAt"), [projectId]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState<string>();
    if (!jobs?.length) return null;
    const renderJob = (job: (typeof jobs)[number]) => <div className="aw-job" key={job.id}><div><strong>{job.input.kind === "speech" ? "文字转语音" : job.input.settings.title || (job.input.settings.engine === "suno" ? "Suno" : "Flow Music")}</strong><small>{statuses[job.status]}{job.dormant ? " · 导入的历史记录" : ""}</small>{job.error && <p className="aw-error">{job.error}</p>}{job.status === "uncertain" && <p className="aw-muted">请在服务商侧确认提交状态。系统不会重复提交此请求。</p>}</div>{(job.taskIds.length > 0 || job.results.length > 0 || ["uncertain", "submitting"].includes(job.status)) && job.status !== "saved" && !job.dormant && <Button disabled={busy === job.id} size="icon-sm" variant="ghost" aria-label="刷新任务或重试下载" onClick={() => { setBusy(job.id); pausedJobIds.delete(job.id); setError(""); void refreshAudioGeneration(projectId, job.id).catch((e: unknown) => setError(errorText(e))).finally(() => setBusy(undefined)); }}>{busy === job.id ? <LoaderCircle className="animate-spin"/> : <RefreshCw />}</Button>}</div>;
    if (mode === "activity") {
        const active = jobs.filter((job) => !job.dormant && job.status !== "saved");
        const history = jobs.filter((job) => job.dormant || job.status === "saved");
        return <section className="aw-jobs aw-job-activity" aria-label="音乐生成任务">
            {error && <p role="alert" className="aw-error">{error}</p>}
            {active.map(renderJob)}
            {history.length > 0 && <Disclosure><DisclosureTitle>生成记录 <span>{history.length}</span></DisclosureTitle>{history.map(renderJob)}</Disclosure>}
        </section>;
    }
    return <Disclosure className="aw-jobs" defaultOpen={jobs.some((job) => !["saved", "failed"].includes(job.status))}><DisclosureTitle>生成任务 <span>{jobs.length}</span></DisclosureTitle>{error && <p role="alert" className="aw-error">{error}</p>}{jobs.map(renderJob)}</Disclosure>;
}
