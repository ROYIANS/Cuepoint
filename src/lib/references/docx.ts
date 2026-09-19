import JSZip from "jszip";
import { extractRawText } from "mammoth/mammoth.browser";
import { REFERENCE_LIMITS as LIMITS } from "@/domain/references";
import { chunkReferenceUnits } from "./parse";

interface EntryStream {
  on(event: "data", callback: (data: Uint8Array) => void): EntryStream;
  on(event: "error", callback: (error: Error) => void): EntryStream;
  on(event: "end", callback: () => void): EntryStream;
  pause(): void;
  resume(): void;
}

/** Check ZIP directory sizes before allocating inflated XML. ZIP64/encrypted packages are not supported. */
export function preflightDocx(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === view.byteLength) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("DOCX 压缩包已损坏");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true) || count === 65535 || count > LIMITS.zipEntries) throw new Error("DOCX 压缩结构过于复杂或不受支持");
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) throw new Error("DOCX 压缩目录已损坏");
    if (view.getUint16(offset + 8, true) & 1) throw new Error("请先移除 DOCX 密码保护");
    total += view.getUint32(offset + 24, true);
    if (total > LIMITS.decompressedBytes) throw new Error("DOCX 解压后超过 64 MB，请拆分文档");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset !== eocd) throw new Error("DOCX 压缩目录无效");
}

export async function parseDocxReference(buffer: ArrayBuffer) {
  preflightDocx(buffer);
  const zip = await JSZip.loadAsync(buffer);
  if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml")) throw new Error("不是有效的 DOCX 文档");
  // Stream every entry with a real output cap as central directory sizes are untrusted.
  // Repack validated bytes as STORE so Mammoth never inflates unvalidated input.
  const clean = new JSZip();
  let total = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const parts: Uint8Array[] = [];
      let length = 0;
      // JSZip 3.x implements this bounded streaming API but omits its declaration.
      const stream = (entry as typeof entry & { internalStream(type: "uint8array"): EntryStream }).internalStream("uint8array");
      stream.on("data", (data: Uint8Array) => {
        total += data.byteLength; length += data.byteLength;
        if (total > LIMITS.decompressedBytes) { stream.pause(); reject(new Error("DOCX 实际解压内容超过 64 MB，请拆分文档")); return; }
        parts.push(data);
      }).on("error", reject).on("end", () => {
        const result = new Uint8Array(length); let at = 0;
        for (const part of parts) { result.set(part, at); at += part.length; }
        resolve(result);
      }).resume();
    });
    clean.file(entry.name, bytes);
  }
  const result = await extractRawText({ arrayBuffer: await clean.generateAsync({ type: "arraybuffer", compression: "STORE" }) });
  const parsed = chunkReferenceUnits(result.value.replace(/\r\n?/g, "\n").split(/\n\n/), "paragraph");
  parsed.warnings.push("DOCX 仅提取文字段落，不包含图片、排版或可靠页码");
  parsed.warnings.push(...result.messages.slice(0, 20).map((message) => message.message.slice(0, 500)));
  if (!parsed.coverage.characters) parsed.warnings.push("文档没有可提取的文字");
  return parsed;
}
