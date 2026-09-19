import type { AgentRun } from "@/domain/agent";
import type { AgentSelectedReferences, AgentImageReference } from "@/domain/referenceInput";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { db } from "@/db/database";
import { getReferenceSource } from "@/db/references";
import { referenceLocatorLabel, type ReferenceAttachment, type ProjectReference } from "@/domain/references";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./references.css";

export const REFERENCE_STATUS_LABELS: Record<ProjectReference["status"], string> = { parsing: "解析中", ready: "可使用", partial: "部分解析", failed: "解析失败", unavailable: "已移除" };
export function ReferenceIcon({ kind }: { kind?: string }) { return kind === "image" ? <ImageIcon size={16} aria-hidden /> : <FileText size={16} aria-hidden />; }

function SourcePreview({ projectId, attachment, chunkIndex }: { projectId: string; attachment: ReferenceAttachment; chunkIndex?: number }) {
  const [attempt, setAttempt] = useState(0);
  const key = `${projectId}/${attachment.referenceId}/${attachment.revision}`;
  const loaded = useLiveQuery(async () => {
    try { return { key, data: await getReferenceSource(projectId, attachment), error: undefined }; }
    catch (error) { return { key, data: undefined, error: error instanceof Error ? error.message : "读取资料失败" }; }
  }, [key, attempt]);
  const result = loaded?.key === key ? loaded : undefined;
  const source = result?.data;
  const [image, setImage] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!source || source.reference.kind !== "image") return;
    const url = URL.createObjectURL(source.media.blob);
    setImage({ blob: source.media.blob, url });
    return () => URL.revokeObjectURL(url);
  }, [source?.media.blob, source?.reference.kind]);
  const [visible, setVisible] = useState(Math.max(20, (chunkIndex ?? 0) + 1));
  const targetRef = useRef<HTMLElement>(null);
  useEffect(() => { if (source && chunkIndex !== undefined) targetRef.current?.scrollIntoView({ block: "center" }); }, [source, chunkIndex]);
  if (!result) return <p role="status">正在读取资料…</p>;
  if (!source) return <div className="reference-error" role="alert"><p>{result.error}</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>重新读取</button><p>历史消息中的引用会保留；不可用的资料无法参与新的请求。</p></div>;
  const { reference, chunks } = source;
  return <>
    <div className="reference-source-meta"><ReferenceIcon kind={reference.kind} /><strong>{reference.filename}</strong><span>v{reference.revision} · {REFERENCE_STATUS_LABELS[reference.status]}</span></div>
    <p className="reference-note">{reference.kind === "image" ? "原始图片 · 发送后由所选模型读取" : `已提取 ${reference.coverage.characters.toLocaleString()} 字符 · 处理 ${reference.coverage.processedUnits}/${reference.coverage.totalUnits} 个来源单元。这里是提取预览，不代表模型已完整阅读。`}</p>
    {reference.warnings.map((warning, i) => <p className="reference-warning" key={i}>{warning}</p>)}
    {reference.coverage.emptyUnits.length > 0 && <p className="reference-warning">没有可提取文字的单元：{reference.coverage.emptyUnits.join("、")}</p>}
    <div className="reference-preview">
      {reference.kind === "image" ? image?.blob === source.media.blob && <img src={image.url} alt={reference.filename} /> : chunks.length ? <>{chunks.slice(0, visible).map((chunk) => <section key={chunk.id} ref={chunk.index === chunkIndex ? targetRef : undefined} className={chunk.index === chunkIndex ? "reference-cited-chunk" : undefined}><span className="reference-locator">{referenceLocatorLabel(chunk.locator)} · 片段 {chunk.index + 1}</span><pre>{chunk.text}</pre></section>)}{visible < chunks.length && <button type="button" onClick={() => setVisible((n) => n + 20)}>继续查看（还有 {chunks.length - visible} 段）</button>}</> : <p>文件中没有提取到文字。</p>}
    </div>
  </>;
}

export function ReferenceSourceLink({ projectId, attachment, label, chunkIndex }: { projectId: string; attachment: ReferenceAttachment; label?: string; chunkIndex?: number }) {
  const [open, setOpen] = useState(false);
  const loaded = useLiveQuery(async () => {
    try { return { projectId, id: attachment.referenceId, row: await db.projectReferences.get(attachment.referenceId) ?? null }; }
    catch { return { projectId, id: attachment.referenceId, row: null }; }
  }, [projectId, attachment.referenceId]);
  const row = loaded?.projectId === projectId && loaded.id === attachment.referenceId && loaded.row?.projectId === projectId ? loaded.row : undefined;
  return <><button type="button" className="reference-source-link" onClick={() => setOpen(true)} title={row?.filename ?? label}><ReferenceIcon kind={row?.kind} /><span>{label ?? row?.filename ?? "参考资料"}</span>{row?.status === "unavailable" && <small>已移除</small>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="reference-dialog"><DialogHeader><DialogTitle>来源资料</DialogTitle><DialogDescription>原始内容与提取结果 · 只在发送或工具读取时分享给模型</DialogDescription></DialogHeader>{open && <SourcePreview key={`${projectId}/${attachment.referenceId}/${attachment.revision}`} projectId={projectId} attachment={attachment} chunkIndex={chunkIndex} />}</DialogContent></Dialog></>;
}

export function ReferenceAttachments({ projectId, attachments, onRemove }: { projectId?: string; attachments: ReferenceAttachment[]; onRemove?: (attachment: ReferenceAttachment) => void }) {
  if (!attachments.length) return null;
  return <div className="reference-chips" aria-label="已附加的资料">{attachments.map((attachment) => <span className="reference-chip" key={`${attachment.referenceId}/${attachment.revision}`}>{projectId ? <ReferenceSourceLink projectId={projectId} attachment={attachment} /> : <><Paperclip size={14} />参考资料</>}{onRemove && <button type="button" aria-label="从消息中移除附件" title="仅从草稿中移除，项目资料仍保留" onClick={() => onRemove(attachment)}><X size={14} /></button>}</span>)}</div>;
}

export function ReferenceMessageSources({ context, run, content }: { context?: AgentSelectedReferences; run?: AgentRun; content: string }) {
  const audits = run?.referenceAudit ?? [];
  const inputs = [...(context ? [context] : []), ...audits.flatMap((audit) => audit.inputs)];
  const citations = [...content.matchAll(/(ref_[a-zA-Z0-9-]+)@(\d+)#(\d+)/g)].flatMap((match) => {
    const referenceId = match[1]; const revision = Number(match[2]); const chunkIndex = Number(match[3]);
    const input = inputs.find((input) => input.references.some((item) => item.referenceId === referenceId && item.revision === revision));
    return input ? [{ projectId: input.projectId, referenceId, revision, chunkIndex }] : [];
  }).filter((item, i, all) => all.findIndex((other) => other.projectId === item.projectId && other.referenceId === item.referenceId && other.revision === item.revision && other.chunkIndex === item.chunkIndex) === i);
  if (!inputs.length) return null;
  return <div className="reference-message-sources">{context && <ReferenceAttachments projectId={context.projectId} attachments={context.references} />}{citations.length > 0 && <div className="reference-chips">{citations.map((citation) => <ReferenceSourceLink key={`${citation.referenceId}/${citation.revision}/${citation.chunkIndex}`} projectId={citation.projectId} attachment={citation} chunkIndex={citation.chunkIndex} label={`引用 · 片段 ${citation.chunkIndex + 1}`} />)}</div>}{audits.length > 0 && <details><summary>请求资料记录 · {audits.length} 次请求</summary>{audits.map((audit) => <section key={audit.step}><strong>第 {audit.step} 次请求</strong>{audit.inputs.map((input, index) => <div key={index}><ReferenceAttachments projectId={input.projectId} attachments={input.references} />{input.images?.filter((image) => !image.reference).map((image) => <ProjectImageSource key={image.mediaId} image={image} />)}{input.coverage?.map((coverage) => <p className="reference-note" key={`${coverage.referenceId}/${coverage.revision}`}>{coverage.filename} · {coverage.kind === "image" ? input.images?.some((image) => image.reference?.referenceId === coverage.referenceId && image.reference.revision === coverage.revision) ? "本轮图片输入（图像 token 为估算）" : "图片来源记录（本轮不含图片像素）" : `包含 ${coverage.includedChunkIndices.length}/${coverage.totalChunks} 段，${coverage.includedCharacters.toLocaleString()} 字符${coverage.partial ? " · 部分内容" : ""}`}{coverage.warnings.length > 0 ? ` · ${coverage.warnings.join("；")}` : ""}</p>)}</div>)}</section>)}</details>}</div>;
}

function ProjectImageSource({ image }: { image: AgentImageReference }) {
  const [open, setOpen] = useState(false);
  const key = `${image.projectId}/${image.mediaId}`;
  const loaded = useLiveQuery(async () => {
    try {
      const media = open && await db.projects.get(image.projectId) ? await db.media.get(image.mediaId) : undefined;
      return { key, media: media?.projectId === image.projectId && ["image/png", "image/jpeg", "image/webp"].includes(media.mimeType) ? media : null };
    } catch { return { key, media: null }; }
  }, [key, open]);
  const media = loaded?.key === key ? loaded.media : undefined;
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>();
  useEffect(() => { if (!media) return; const url = URL.createObjectURL(media.blob); setPreview({ blob: media.blob, url }); return () => URL.revokeObjectURL(url); }, [media?.blob]);
  return <><button className="reference-source-link" type="button" onClick={() => setOpen(true)}><ImageIcon size={14} /><span>{image.filename} · 本轮图片输入</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="reference-dialog"><DialogHeader><DialogTitle>{image.filename}</DialogTitle><DialogDescription>为本次请求准备的项目图片；不代表请求已经发出。图像 token 用量为估算。</DialogDescription></DialogHeader><div className="reference-preview">{media === undefined ? <p>加载中…</p> : !media ? <p>原始图片已不可用，历史引用记录仍保留。</p> : preview?.blob === media.blob && <img src={preview.url} alt={image.filename} />}</div></DialogContent></Dialog></>;
}
