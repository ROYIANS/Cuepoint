import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { REFERENCE_LIMITS, type ParsedReference } from "@/domain/references";
import { assertReferenceSignature } from "@/lib/references/parse";

/** Reuse the bounded document parsers; display plain text, never document HTML. */
export function MaterialDocumentPreview({ blob, mime }: { blob: Blob; mime: string }) {
  const [text, setText] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);
  async function read() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setPending(true); setError("");
    try {
      if (blob.size > REFERENCE_LIMITS.documentBytes) throw new Error(`文件超过 ${REFERENCE_LIMITS.documentBytes / 1024 / 1024} MB，请下载后查看。`);
      const buffer = await blob.arrayBuffer(); controller.signal.throwIfAborted();
      const kind = mime === "application/pdf" ? "pdf" : "docx";
      assertReferenceSignature(new Uint8Array(buffer), kind, mime);
      const parsed = kind === "pdf" ? await (await import("@/lib/references/pdf")).parsePdfReference(buffer, controller.signal) : await readDocx(buffer, controller.signal);
      if (!controller.signal.aborted) setText(parsed.chunks.map((chunk) => chunk.text).join("\n").slice(0, 16000) || "没有可提取的文字，请下载原文件查看。");
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "无法预览，请下载原文件查看。"); }
    finally { if (!controller.signal.aborted) { setPending(false); active.current = null; } }
  }
  return <div className="material-document-text">{text ? <><p>文字摘录（最多 16000 字，排版以原文件为准）</p><pre>{text}</pre></> : <Button variant="outline" size="sm" disabled={pending} onClick={() => void read()}>{pending ? "提取文字中…" : "预览文档文字"}</Button>}{error && <p role="alert" className="material-error">{error}</p>}</div>;
}

function readDocx(buffer: ArrayBuffer, signal: AbortSignal): Promise<ParsedReference> {
  const worker = new Worker(new URL("../../../lib/references/docx.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown, result?: ParsedReference) => { clearTimeout(timer); signal.removeEventListener("abort", abort); worker.terminate(); if (error) reject(error); else resolve(result!); };
    const abort = () => finish(new Error("预览已取消"));
    const timer = setTimeout(() => finish(new Error("文档提取超时，请下载原文件查看。")), REFERENCE_LIMITS.workerTimeoutMs);
    worker.onmessage = (event: MessageEvent<{ result?: ParsedReference; error?: string }>) => finish(event.data.error ? new Error(event.data.error) : undefined, event.data.result);
    worker.onerror = () => finish(new Error("无法读取文档，请下载原文件查看。"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort(); else worker.postMessage(buffer, [buffer]);
  });
}
