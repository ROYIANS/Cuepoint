import { REFERENCE_LIMITS as LIMITS, type ParsedReference, type ReferenceKind } from "@/domain/references";

export function identifyReference(file: Pick<File, "name" | "size">): { kind: ReferenceKind; mimeType: string } {
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  const formats: Record<string, [ReferenceKind, string]> = {
    png: ["image", "image/png"], jpg: ["image", "image/jpeg"], jpeg: ["image", "image/jpeg"], webp: ["image", "image/webp"],
    txt: ["text", "text/plain"], md: ["text", "text/markdown"], markdown: ["text", "text/markdown"],
    pdf: ["pdf", "application/pdf"], docx: ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  };
  const format = ext && formats[ext];
  if (!format) throw new Error("支持 PNG、JPEG、WebP、TXT、Markdown、文字型 PDF 和 DOCX");
  const [kind, mimeType] = format;
  const max = kind === "image" ? LIMITS.imageBytes : kind === "text" ? LIMITS.textBytes : LIMITS.documentBytes;
  if (file.size > max) throw new Error(`文件过大：此格式最多 ${max / 1024 / 1024} MB`);
  return { kind, mimeType };
}

export function assertReferenceSignature(bytes: Uint8Array, kind: ReferenceKind, mime: string) {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  const valid = kind === "text" || (kind === "pdf" && ascii(0, 5) === "%PDF-") ||
    (kind === "docx" && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4) ||
    (mime === "image/png" && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) ||
    (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    (mime === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP");
  if (!valid) throw new Error("文件内容与扩展名不符，或文件已损坏");
}

export function decodeReferenceText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    if (text.includes("\0")) throw new Error("binary");
    return text.replace(/\r\n?/g, "\n");
  } catch { throw new Error("无法读取文本编码，请保存为 UTF-8 或带 BOM 的 UTF-16 后重试"); }
}

/** Units are real source pages / lines / extracted paragraphs, never invented PDF layout. */
export function chunkReferenceUnits(units: string[], kind: "page" | "lines" | "paragraph", totalUnits = units.length): ParsedReference {
  const chunks: ParsedReference["chunks"] = [];
  const emptyUnits: number[] = [];
  let characters = 0;
  let processedUnits = 0;
  let truncated = units.length < totalUnits || units.length > LIMITS.sourceUnits;
  for (let i = 0; i < Math.min(units.length, LIMITS.sourceUnits); i++) {
    const text = units[i];
    if (!text.trim() && kind === "page") emptyUnits.push(i + 1);
    let offset = 0;
    while (offset < text.length) {
      const previous = chunks.at(-1);
      const pieceLength = Math.min(LIMITS.chunkCharacters, text.length - offset);
      const merge = kind !== "page" && previous && previous.text.length + pieceLength + 1 <= LIMITS.chunkCharacters;
      // Coverage and the extraction cap count exactly the persisted chunk text,
      // including separators inserted when real source units share a chunk.
      const separator = merge ? 1 : 0;
      const remaining = LIMITS.characters - characters - separator;
      if (remaining <= 0) break;
      const part = text.slice(offset, offset + Math.min(pieceLength, remaining));
      if (merge) {
        previous.text += "\n" + part; previous.locator.end = i + 1;
      } else chunks.push({ index: chunks.length, text: part, locator: { kind, start: i + 1, end: i + 1 } });
      characters += part.length + separator;
      offset += part.length;
    }
    if (offset === text.length) processedUnits++;
    else { truncated = true; break; }
    if (characters >= LIMITS.characters && i < units.length - 1) { truncated = true; break; }
  }
  return { chunks, coverage: { totalUnits, processedUnits, emptyUnits, characters, truncated }, warnings: truncated ? ["文件较长，仅提取了部分正文；未覆盖内容不会自动发送"] : [] };
}

export function parseTextReference(buffer: ArrayBuffer): ParsedReference {
  const text = decodeReferenceText(buffer);
  let totalUnits = 1;
  for (const character of text) if (character === "\n") totalUnits++;
  const result = chunkReferenceUnits(text.split("\n", LIMITS.sourceUnits), "lines", totalUnits);
  if (!result.chunks.some((chunk) => chunk.text.trim())) result.warnings.push("文件为空，没有可发送的正文");
  return result;
}
