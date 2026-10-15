import {useEffect, useRef, useState} from "react";
import {FileText, Music2, PackageOpen} from "../../ui/icons";
import {toast} from "sonner";
import {binaryByteLength} from "../../../domain/binary";
import {binaryPreviewMessage, useBinaryPreview} from "../../../lib/media";
import {readBinaryBlob, withBinaryReadLease} from "../../../lib/storage/binary";
import type {MaterialPayload} from "../../../domain/materials";
import {Button} from "../../ui/button";
import {isTauriRuntime} from "../../../lib/runtimeIdentity";
import {downloadBlob, isPublishedSaveError} from "../../../lib/runtimeSave";
import {MaterialDocumentPreview} from "./MaterialDocumentPreview";

export function MaterialPreview({payload, inspect = false}: { payload?: MaterialPayload; inspect?: boolean }) {
    const native = isTauriRuntime();
    const file = payload?.type === "file" ? payload : payload?.media.find((item) => item.mimeType.startsWith("image/"));
    const blob = file?.blob;
    const mime = file?.mimeType ?? "";
    const preview = useBinaryPreview(blob, mime.startsWith("image/") || mime.startsWith("video/") || (inspect && (mime.startsWith("audio/") || !native)));
    const url = preview.status === "ready" ? preview.url : undefined;
    const onPreviewError = preview.status === "ready" ? preview.onError : undefined;
    const [document, setDocument] = useState<{ source: typeof blob; blob: Blob }>();
    const [text, setText] = useState("");
    const saving = useRef(false);
    const [savingFile, setSavingFile] = useState(false);

    async function saveOriginal() {
        if (saving.current || payload?.type !== "file") return;
        saving.current = true;
        setSavingFile(true);
        try {
            const outcome = await downloadBlob(await readBinaryBlob(payload.blob), payload.filename);
            if (outcome === "saved") toast.success("原文件已保存");
            else toast.info("已取消保存原文件");
        } catch (error) {
            if (isPublishedSaveError(error)) toast.warning(error.message);
            else toast.error(error instanceof Error ? `保存原文件失败：${error.message}` : "保存原文件失败，请重试");
        } finally {
            saving.current = false;
            setSavingFile(false);
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        setText("");
        setDocument(undefined);
        if (inspect && blob && ["text/plain", "text/markdown", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime)) {
            void withBinaryReadLease(blob, async lease => {
                const loaded = await lease.readBlob(controller.signal);
                return {loaded, text: mime.startsWith("text/") ? await loaded.slice(0, 16000).text() : ""};
            }, controller.signal).then(value => {
                if (controller.signal.aborted) return;
                setText(value.text);
                setDocument({source: blob, blob: value.loaded});
            }).catch(() => {
                if (!controller.signal.aborted) setText("预览读取失败，素材可能已丢失或损坏，请重新导入。");
            });
        }
        return () => controller.abort();
    }, [blob, mime, inspect]);
    if (!payload) return <div className="material-preview"><PackageOpen aria-hidden/><span>读取预览…</span></div>;
    return <>
        <div className={`material-preview ${inspect ? "material-preview-inspect" : ""}`}>
            {blob && ["missing", "corrupt", "error"].includes(preview.status) ?
                <p role="alert">{binaryPreviewMessage(preview)}</p> : url && /^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(mime) ?
                    <img src={url} onError={onPreviewError} alt={inspect ? "素材预览" : ""} loading="lazy"/>
                    : url && mime.startsWith("video/") ?
                        <video src={url} onError={onPreviewError} controls={inspect} muted={!inspect} playsInline
                               preload="metadata"
                               aria-label="视频素材预览"/>
                        : mime.startsWith("audio/") ? <><Music2 aria-hidden/>{inspect && url ?
                                <audio src={url} onError={onPreviewError} controls preload="metadata"
                                       aria-label="音频素材预览"/> : <span>音频</span>}</>
                            : payload.type === "setting" ? <><PackageOpen
                                    aria-hidden/><span>{payload.entity.name || "创作设定"}</span></>
                                : inspect && text ?
                                    <pre>{text}{blob && binaryByteLength(blob) > 16000 ? "\n…仅预览前 16000 字节" : ""}</pre>
                                    : <><FileText aria-hidden/><span>{payload.filename}</span>{inspect &&
                                        <p>文档以文件形式保存，可提取文字预览或下载查看完整内容。</p>}{inspect && blob && ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime) &&
                                        document && document.source === blob &&
                                        <MaterialDocumentPreview blob={document.blob} mime={mime}/>}</>}
            {inspect && payload.type === "file" && (native ?
                <Button variant="outline" size="sm" disabled={savingFile} onClick={() => void saveOriginal()}>
                    {savingFile ? "正在保存原文件…" : "下载原文件"}
                </Button> : url &&
                <a href={url} download={payload.filename} className="material-download">下载原文件</a>)}
        </div>
        {inspect && payload.type === "setting" &&
            <dl className="material-setting-preview">{Object.entries(payload.entity).filter(([key, value]) => ["name", "bio", "appearance", "personality", "motivation", "voice", "location", "timeOfDay", "atmosphere", "geography", "lighting", "notes", "kind", "material", "size", "usage", "continuity", "palette", "lens", "composition", "negativePrompt"].includes(key) && typeof value === "string" && value.trim()).map(([key, value]) =>
                <div key={key}>
                    <dt>{({
                        name: "名称",
                        bio: "简介",
                        appearance: "外观",
                        personality: "性格",
                        motivation: "动机",
                        voice: "声音",
                        location: "地点",
                        timeOfDay: "时间",
                        atmosphere: "氛围",
                        geography: "空间",
                        lighting: "光线",
                        notes: "备注",
                        kind: "类型",
                        material: "材质",
                        size: "尺寸",
                        usage: "用途",
                        continuity: "连续性",
                        palette: "色彩",
                        lens: "镜头气质",
                        composition: "构图",
                        negativePrompt: "避免出现"
                    } as Record<string, string>)[key]}</dt>
                    <dd>{String(value)}</dd>
                </div>)}</dl>}</>;
}
