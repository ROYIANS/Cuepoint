import { useEffect, useState } from "react";
import { FileText, Music2, PackageOpen } from "lucide-react";
import type { MaterialPayload } from "@/domain/materials";
import { MaterialDocumentPreview } from "./MaterialDocumentPreview";

export function MaterialPreview({ payload, inspect = false }: { payload?: MaterialPayload; inspect?: boolean }) {
  const file = payload?.type === "file" ? payload : payload?.media.find((item) => item.mimeType.startsWith("image/"));
  const blob = file?.blob;
  const mime = file?.mimeType ?? "";
  const [url, setUrl] = useState<string>();
  const [text, setText] = useState("");
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const next = URL.createObjectURL(blob); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  useEffect(() => {
    let active = true; setText("");
    if (inspect && (mime === "text/plain" || mime === "text/markdown") && blob) void blob.slice(0, 16000).text().then((value) => { if (active) setText(value); }).catch(() => { if (active) setText("预览读取失败，可下载原文件查看。"); });
    return () => { active = false; };
  }, [blob, mime, inspect]);
  if (!payload) return <div className="material-preview"><PackageOpen aria-hidden /><span>读取预览…</span></div>;
  return <><div className={`material-preview ${inspect ? "material-preview-inspect" : ""}`}>
    {url && /^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(mime) ? <img src={url} alt={inspect ? "素材预览" : ""} loading="lazy" />
      : url && mime.startsWith("video/") ? <video src={url} controls={inspect} muted={!inspect} playsInline preload="metadata" aria-label="视频素材预览" />
      : mime.startsWith("audio/") ? <><Music2 aria-hidden />{inspect && url ? <audio src={url} controls preload="metadata" aria-label="音频素材预览" /> : <span>音频</span>}</>
      : payload.type === "setting" ? <><PackageOpen aria-hidden /><span>{payload.entity.name || "创作设定"}</span></>
      : inspect && text ? <pre>{text}{blob && blob.size > 16000 ? "\n…仅预览前 16000 字节" : ""}</pre>
      : <><FileText aria-hidden /><span>{payload.filename}</span>{inspect && <p>文档以文件形式保存，可提取文字预览或下载查看完整内容。</p>}{inspect && blob && ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime) && <MaterialDocumentPreview key={url} blob={blob} mime={mime} />}</>}
    {inspect && payload.type === "file" && url && <a href={url} download={payload.filename} className="material-download">下载原文件</a>}
  </div>{inspect && payload.type === "setting" && <dl className="material-setting-preview">{Object.entries(payload.entity).filter(([key, value]) => ["name", "bio", "appearance", "personality", "motivation", "voice", "location", "timeOfDay", "atmosphere", "geography", "lighting", "notes", "kind", "material", "size", "usage", "continuity", "palette", "lens", "composition", "negativePrompt"].includes(key) && typeof value === "string" && value.trim()).map(([key, value]) => <div key={key}><dt>{({ name: "名称", bio: "简介", appearance: "外观", personality: "性格", motivation: "动机", voice: "声音", location: "地点", timeOfDay: "时间", atmosphere: "氛围", geography: "空间", lighting: "光线", notes: "备注", kind: "类型", material: "材质", size: "尺寸", usage: "用途", continuity: "连续性", palette: "色彩", lens: "镜头气质", composition: "构图", negativePrompt: "避免出现" } as Record<string, string>)[key]}</dt><dd>{String(value)}</dd></div>)}</dl>}</>;
}
