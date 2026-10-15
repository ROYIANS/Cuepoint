import {describe, expect, it} from "vitest";
import JSZip from "jszip";
import {assertReferenceSignature, chunkReferenceUnits, decodeReferenceText, identifyReference, parseTextReference} from "@/features/references/documents/parse";
import {parseDocxReference, preflightDocx} from "@/features/references/documents/docx";
import {REFERENCE_LIMITS} from "@/features/references/models/references";

const png = () => new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64"));
async function docx(text = "第一段", second = "第二段") {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:p><w:r><w:t>${second}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

describe("local reference extraction", () => {
  it("validates types, size and actual signatures instead of trusting MIME", () => {
    expect(identifyReference({ name: "image.PNG", size: 1 })).toEqual({ kind: "image", mimeType: "image/png" });
    expect(() => identifyReference({ name: "x.exe", size: 1 })).toThrow("支持");
    expect(() => identifyReference({ name: "x.txt", size: 6 * 1024 * 1024 })).toThrow("过大");
    expect(() => assertReferenceSignature(new TextEncoder().encode("html"), "pdf", "application/pdf")).toThrow("不符");
    expect(() => assertReferenceSignature(png(), "image", "image/png")).not.toThrow();
  });
  it("decodes UTF8 and BOM UTF16, rejects corrupt encoding and binary", () => {
    expect(decodeReferenceText(new Uint8Array([255, 254, 65, 0, 66, 0]).buffer)).toBe("AB");
    expect(decodeReferenceText(new Uint8Array([254, 255, 0, 65]).buffer)).toBe("A");
    expect(() => decodeReferenceText(new Uint8Array([255]).buffer)).toThrow("编码");
    expect(() => decodeReferenceText(new Uint8Array([0, 1]).buffer)).toThrow("编码");
    expect(parseTextReference(new ArrayBuffer(0)).warnings).toContain("文件为空，没有可发送的正文");
  });
  it("keeps exact line/page locators and marks extraction truncation", () => {
    const parsed = chunkReferenceUnits(["one", "two", "three"], "lines");
    expect(parsed.chunks[0]).toMatchObject({ text: "one\ntwo\nthree", locator: { kind: "lines", start: 1, end: 3 } });
    const partial = chunkReferenceUnits(["first", "", "last"], "page", 6);
    expect(partial.coverage).toMatchObject({ totalUnits: 6, processedUnits: 3, emptyUnits: [2], truncated: true });
    expect(partial.chunks[1].locator.start).toBe(3);
    expect(chunkReferenceUnits(["x".repeat(REFERENCE_LIMITS.characters + 2)], "lines").coverage).toMatchObject({ truncated: true, processedUnits: 0, characters: REFERENCE_LIMITS.characters });
  });
  it("extracts actual DOCX raw text, preserves paragraphs and rejects malformed/oversized ZIP", async () => {
    const bytes = await docx("hello", "世界");
    const parsed = await parseDocxReference(bytes);
    expect(parsed.chunks.map((part) => part.text).join("\n")).toContain("世界");
    expect(parsed.chunks[0].locator.kind).toBe("paragraph");
    expect(parsed.warnings.join()).toContain("不包含图片");
    expect(() => preflightDocx(new Uint8Array([80, 75, 3, 4]).buffer)).toThrow("损坏");
    const altered = bytes.slice(0); const view = new DataView(altered);
    for (let i = 0; i < view.byteLength - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 100_000_000, true); break; }
    expect(() => preflightDocx(altered)).toThrow("64 MB");
  });
});
