import type {AgentRun} from "../models/agent";
import type {AgentImageReference, AgentSelectedReferences} from "../../references/models/referenceInput";
import {useEffect, useRef, useState} from "react";
import {useProductQuery} from "../../../platform/product/queries";
import {FileDoc, FileMd, FilePdf, FileTxt, ImageIcon, Paperclip, X} from "../../../ui/icons";
import {binaryPreviewMessage, useBinaryPreview} from "../../library/services/media";
import {getReferenceSource} from "../../references/commands/references";
import {type ProjectReference, type ReferenceAttachment, type ReferenceKind, referenceLocatorLabel} from "../../references/models/references";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "../../../ui/dialog";
import "./references.css";

export const REFERENCE_STATUS_LABELS: Partial<Record<ProjectReference["status"], string>> = {
    partial: "部分解析",
    failed: "解析失败",
    unavailable: "已移除",
};

const FILE_LOOKS = {
    pdf: {color: "#e25c5c", Icon: FilePdf},
    docx: {color: "#4c8dff", Icon: FileDoc},
    md: {color: "#8b6cff", Icon: FileMd},
    txt: {color: "#e0a23a", Icon: FileTxt},
    image: {color: "#3f9d72", Icon: ImageIcon},
} as const;

function fileLook(filename: string, kind?: ReferenceKind) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (kind === "pdf" || ext === "pdf") return FILE_LOOKS.pdf;
    if (kind === "docx" || ext === "docx") return FILE_LOOKS.docx;
    if (ext === "md" || ext === "markdown") return FILE_LOOKS.md;
    if (kind === "image" || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return FILE_LOOKS.image;
    return FILE_LOOKS.txt;
}

function FileBadge({filename, kind}: {filename: string; kind?: ReferenceKind}) {
    const look = fileLook(filename, kind);
    return <span className="reference-file-badge" style={{background: look.color}} aria-hidden><look.Icon size={18}/></span>;
}

function useAttachmentFace(projectId: string | undefined, attachment: ReferenceAttachment) {
    const key = `${projectId ?? ""}/${attachment.referenceId}/${attachment.revision}`;
    const loaded = useProductQuery(async (db) => {
        if (!projectId) return {key, filename: undefined as string | undefined, kind: undefined as ReferenceKind | undefined, blob: undefined};
        const row = await db.projectReferences.get(attachment.referenceId);
        if (!row || row.projectId !== projectId) return {key, filename: undefined, kind: undefined, blob: undefined};
        const media = row.kind === "image" ? await db.media.get(row.mediaId) : undefined;
        return {key, filename: row.filename, kind: row.kind, blob: media?.projectId === projectId ? media.blob : undefined};
    }, [key]);
    const face = loaded?.key === key ? loaded : undefined;
    const preview = useBinaryPreview(face?.kind === "image" ? face.blob : undefined);
    return {filename: face?.filename, kind: face?.kind, preview};
}

function SourcePreview({projectId, attachment, chunkIndex}: {
    projectId: string;
    attachment: ReferenceAttachment;
    chunkIndex?: number
}) {
    const [attempt, setAttempt] = useState(0);
    const key = `${projectId}/${attachment.referenceId}/${attachment.revision}`;
    const loaded = useProductQuery(async (db) => {
        try {
            return {key, data: await getReferenceSource(projectId, attachment, db), error: undefined};
        } catch (error) {
            return {key, data: undefined, error: error instanceof Error ? error.message : "读取资料失败"};
        }
    }, [key, attempt]);
    const result = loaded?.key === key ? loaded : undefined;
    const source = result?.data;
    const image = useBinaryPreview(source?.reference.kind === "image" ? source.media.blob : undefined);
    const [visible, setVisible] = useState(Math.max(20, (chunkIndex ?? 0) + 1));
    const targetRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (source && chunkIndex !== undefined) targetRef.current?.scrollIntoView({block: "center"});
    }, [source, chunkIndex]);
    if (!result) return <p role="status">正在读取资料…</p>;
    if (!source) return <div className="reference-error" role="alert"><p>{result.error}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>重新读取</button></div>;
    const {reference, chunks} = source;
    const status = REFERENCE_STATUS_LABELS[reference.status];
    return <>
        <div className="reference-source-meta"><FileBadge filename={reference.filename} kind={reference.kind}/><strong>{reference.filename}</strong>{status && <span>{status}</span>}
        </div>
        {reference.warnings.map((warning, i) => <p className="reference-warning" key={i}>{warning}</p>)}
        {reference.coverage.emptyUnits.length > 0 &&
            <p className="reference-warning">没有可提取文字的单元：{reference.coverage.emptyUnits.join("、")}</p>}
        <div className="reference-preview">
            {reference.kind === "image" ? image.status === "ready" ?
                <img src={image.url} onError={image.onError} alt={reference.filename}/> :
                <p role="status">{binaryPreviewMessage(image)}</p> : chunks.length ? <>{chunks.slice(0, visible).map((chunk) =>
                    <section key={chunk.id} ref={chunk.index === chunkIndex ? targetRef : undefined}
                             className={chunk.index === chunkIndex ? "reference-cited-chunk" : undefined}><span
                        className="reference-locator">{referenceLocatorLabel(chunk.locator)} · 片段 {chunk.index + 1}</span>
                        <pre>{chunk.text}</pre>
                    </section>)}{visible < chunks.length && <button type="button"
                                                                    onClick={() => setVisible((n) => n + 20)}>继续查看（还有 {chunks.length - visible} 段）</button>}</> :
                <p>文件中没有提取到文字。</p>}
        </div>
    </>;
}

export function ReferenceSourceLink({projectId, attachment, label, chunkIndex}: {
    projectId: string;
    attachment: ReferenceAttachment;
    label?: string;
    chunkIndex?: number
}) {
    const [open, setOpen] = useState(false);
    const loaded = useProductQuery(async (db) => {
        try {
            return {
                projectId,
                id: attachment.referenceId,
                row: await db.projectReferences.get(attachment.referenceId) ?? null
            };
        } catch {
            return {projectId, id: attachment.referenceId, row: null};
        }
    }, [projectId, attachment.referenceId]);
    const row = loaded?.projectId === projectId && loaded.id === attachment.referenceId && loaded.row?.projectId === projectId ? loaded.row : undefined;
    return <>
        <button type="button" className="reference-source-link" onClick={() => setOpen(true)}
                title={row?.filename ?? label}><FileBadge filename={row?.filename ?? label ?? "参考资料"} kind={row?.kind}/><span>{label ?? row?.filename ?? "参考资料"}</span>{row?.status === "unavailable" &&
            <small>已移除</small>}</button>
        <Dialog open={open} onOpenChange={setOpen}><DialogContent
            className="reference-dialog"><DialogHeader><DialogTitle>{row?.filename ?? "来源资料"}</DialogTitle></DialogHeader>{open &&
            <SourcePreview key={`${projectId}/${attachment.referenceId}/${attachment.revision}`} projectId={projectId}
                           attachment={attachment} chunkIndex={chunkIndex}/>}</DialogContent></Dialog></>;
}

function AttachmentChip({projectId, attachment, onRemove}: {
    projectId?: string;
    attachment: ReferenceAttachment;
    onRemove?: (attachment: ReferenceAttachment) => void;
}) {
    const [open, setOpen] = useState(false);
    const face = useAttachmentFace(projectId, attachment);
    const filename = face.filename ?? "参考资料";
    const shown = face.kind === "image" && face.preview.status === "ready";
    return <span className={`reference-chip${shown ? " is-image" : " is-file"}`}>
        <button type="button" className="reference-chip-body" title={filename} onClick={() => projectId && setOpen(true)}>
            {shown ? <img src={face.preview.status === "ready" ? face.preview.url : ""} onError={face.preview.status === "ready" ? face.preview.onError : undefined} alt={filename}/> : <>
                {face.filename ? <FileBadge filename={filename} kind={face.kind}/> : <Paperclip size={16} aria-hidden/>}
                <span className="reference-chip-name">{filename}</span>
            </>}
        </button>
        {onRemove && <button type="button" className="reference-chip-remove" aria-label="从消息中移除附件" onClick={() => onRemove(attachment)}><X size={12} aria-hidden/></button>}
        {projectId && <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reference-dialog"><DialogHeader><DialogTitle>{filename}</DialogTitle></DialogHeader>{open &&
            <SourcePreview key={`${projectId}/${attachment.referenceId}/${attachment.revision}`} projectId={projectId} attachment={attachment}/>}</DialogContent></Dialog>}
    </span>;
}

export function ReferenceAttachments({projectId, attachments, onRemove}: {
    projectId?: string;
    attachments: readonly Readonly<ReferenceAttachment>[];
    onRemove?: (attachment: ReferenceAttachment) => void
}) {
    if (!attachments.length) return null;
    return <div className="reference-chips" aria-label="已附加的资料">{attachments.map((attachment) =>
        <AttachmentChip key={`${attachment.referenceId}/${attachment.revision}`} projectId={projectId} attachment={attachment} onRemove={onRemove}/>)}</div>;
}

export function ReferenceMessageSources({context, run, content}: {
    context?: AgentSelectedReferences;
    run?: AgentRun;
    content: string
}) {
    const audits = run?.referenceAudit ?? [];
    const inputs = [...(context ? [context] : []), ...audits.flatMap((audit) => audit.inputs)];
    const citations = [...content.matchAll(/(ref_[a-zA-Z0-9-]+)@(\d+)#(\d+)/g)].flatMap((match) => {
        const referenceId = match[1];
        const revision = Number(match[2]);
        const chunkIndex = Number(match[3]);
        const input = inputs.find((input) => input.references.some((item) => item.referenceId === referenceId && item.revision === revision));
        return input ? [{projectId: input.projectId, referenceId, revision, chunkIndex}] : [];
    }).filter((item, i, all) => all.findIndex((other) => other.projectId === item.projectId && other.referenceId === item.referenceId && other.revision === item.revision && other.chunkIndex === item.chunkIndex) === i);
    if (!inputs.length) return null;
    return <div className="reference-message-sources">{context &&
        <ReferenceAttachments projectId={context.projectId} attachments={context.references}/>}{citations.length > 0 &&
        <div className="reference-chips">{citations.map((citation) => <ReferenceSourceLink
            key={`${citation.referenceId}/${citation.revision}/${citation.chunkIndex}`} projectId={citation.projectId}
            attachment={citation} chunkIndex={citation.chunkIndex}
            label={`引用 · 片段 ${citation.chunkIndex + 1}`}/>)}</div>}{audits.flatMap((audit) => audit.inputs.flatMap((input) => input.images?.filter((image) => !image.reference) ?? [])).map((image) =>
        <ProjectImageSource key={image.mediaId} image={image}/>)}</div>;
}

function ProjectImageSource({image}: { image: AgentImageReference }) {
    const [open, setOpen] = useState(false);
    const key = `${image.projectId}/${image.mediaId}`;
    const loaded = useProductQuery(async (db) => {
        try {
            const media = open && await db.projects.get(image.projectId) ? await db.media.get(image.mediaId) : undefined;
            return {
                key,
                media: media?.projectId === image.projectId && ["image/png", "image/jpeg", "image/webp"].includes(media.mimeType) ? media : null
            };
        } catch {
            return {key, media: null};
        }
    }, [key, open]);
    const media = loaded?.key === key ? loaded.media : undefined;
    const preview = useBinaryPreview(media?.blob);
    return <>
        <button className="reference-source-link" type="button" onClick={() => setOpen(true)}><ImageIcon
            size={14}/><span>{image.filename}</span></button>
        <Dialog open={open} onOpenChange={setOpen}><DialogContent
            className="reference-dialog"><DialogHeader><DialogTitle>{image.filename}</DialogTitle></DialogHeader>
            <div className="reference-preview">{media === undefined ? <p>加载中…</p> : !media ?
                <p>原始图片已不可用，历史引用记录仍保留。</p> : preview.status === "ready" ?
                    <img src={preview.url} onError={preview.onError} alt={image.filename}/> :
                    <p role="status">{binaryPreviewMessage(preview)}</p>}</div>
        </DialogContent></Dialog></>;
}
