import { REFERENCE_LIMITS as LIMITS } from "@/domain/references";
import { chunkReferenceUnits } from "./parse";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Only package-owned asset URLs can be resolved; a document cannot choose a remote URL.
const cmapAssets = import.meta.glob<string>("../../../node_modules/pdfjs-dist/cmaps/*.bcmap", { query: "?url", import: "default", eager: true });
const fontAssets = import.meta.glob<string>("../../../node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}", { query: "?url", import: "default", eager: true });
async function packageAsset(assets: Record<string, string>, filename: string) {
  const entry = Object.entries(assets).find(([path]) => path.split("/").at(-1) === filename);
  if (!entry) throw new Error("PDF 所需字体映射不受支持");
  const response = await fetch(entry[1]);
  if (!response.ok) throw new Error("本地 PDF 字体资源加载失败，请刷新重试");
  return new Uint8Array(await response.arrayBuffer());
}
class LocalCMaps {
  async fetch({ name }: { name: string }) { return { cMapData: await packageAsset(cmapAssets, `${name}.bcmap`), isCompressed: true }; }
}
class LocalFonts {
  fetch({ filename }: { filename: string }) { return packageAsset(fontAssets, filename); }
}

export async function parsePdfReference(buffer: ArrayBuffer, signal?: AbortSignal) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: buffer, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, useWasm: false, useWorkerFetch: false, CMapReaderFactory: LocalCMaps, StandardFontDataFactory: LocalFonts });
  const cancel = () => { void task.destroy(); };
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, LIMITS.workerTimeoutMs);
  try {
    signal?.throwIfAborted();
    const document = await task.promise;
    const pages: string[] = [];
    let length = 0;
    for (let number = 1; number <= Math.min(document.numPages, LIMITS.pages); number++) {
      signal?.throwIfAborted();
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
        pages.push(text); length += text.length;
      } finally { page.cleanup(); }
      if (length >= LIMITS.characters) break;
    }
    const parsed = chunkReferenceUnits(pages, "page", document.numPages);
    parsed.warnings.push("PDF 按页提取文字，阅读顺序与排版可能与原件不同");
    if (!parsed.coverage.characters) throw new Error("PDF 没有可提取文字，可能是扫描件；请使用文字型 PDF、TXT 或 DOCX");
    if (parsed.coverage.emptyUnits.length) parsed.warnings.push(`第 ${parsed.coverage.emptyUnits.join("、")} 页没有可提取文字，可能包含扫描内容`);
    return parsed;
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (error instanceof Error && error.name === "PasswordException") throw new Error("PDF 有密码保护，请解锁后重新上传");
    if (error instanceof Error && error.name === "InvalidPDFException") throw new Error("PDF 已损坏或结构不受支持，请重新导出为文字型 PDF 后上传");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); await task.destroy(); }
}
