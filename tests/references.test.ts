import { parseReferencePackage } from "@/lib/references/package";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { db } from "@/db/database";
import { createProject, createChatThread, deleteChatThread, deleteMediaIfOrphan, deleteProject, putMedia, updateProject } from "@/db/repo";
import { getReferenceSource, listProjectReferences, readProjectReference, removeProjectReference, searchProjectReferences } from "@/db/references";
import { importReferenceFile, registerProjectImage, retryReferenceImport } from "@/lib/references/import";
import { assertReferenceSignature, chunkReferenceUnits, decodeReferenceText, identifyReference, parseTextReference } from "@/lib/references/parse";
import { parseDocxReference, preflightDocx } from "@/lib/references/docx";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import { REFERENCE_LIMITS, referenceAttachment } from "@/domain/references";
import { createId } from "@/lib/ids";

const textFile = (content = "第一场：雨夜\n角色：林一\n保持红色雨伞", name = "剧本.md") => new File([content], name, { type: "text/markdown" });
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

describe("project shared references", () => {
  it("deduplicates same-project concurrent imports without crossing owners", async () => {
    const a = await createProject("A"); const b = await createProject("B");
    const [one, two] = await Promise.all([importReferenceFile(a.id, textFile()), importReferenceFile(a.id, textFile())]);
    expect(one.id).toBe(two.id);
    expect(await db.media.where("projectId").equals(a.id).count()).toBe(1);
    const foreign = await importReferenceFile(b.id, textFile());
    expect(foreign.mediaId).not.toBe(one.mediaId);
    await expect(getReferenceSource(b.id, referenceAttachment(one))).rejects.toThrow("不属于");
    await expect(getReferenceSource(a.id, { referenceId: one.id, revision: 2 })).rejects.toThrow("版本");
    expect((await searchProjectReferences(a.id, "红色"))[0].reference.id).toBe(one.id);
    expect((await readProjectReference(a.id, referenceAttachment(one))).chunks[0].text).toContain("雨伞");
  });
  it("cancels locally, persists recovery, retries same identity, and never revives removed sources", async () => {
    const project = await createProject("A"); const abort = new AbortController();
    const failed = await importReferenceFile(project.id, textFile(), { signal: abort.signal, onProgress: () => abort.abort() });
    expect(failed.status).toBe("failed");
    await expect(getReferenceSource(project.id, referenceAttachment(failed))).rejects.toThrow("尚未");
    const retried = await retryReferenceImport(project.id, failed.id);
    expect(retried.id).toBe(failed.id); expect(retried.status).toBe("ready");
    expect(await db.media.count()).toBe(1);
    await removeProjectReference(project.id, failed.id);
    expect(await searchProjectReferences(project.id, "")).toEqual([]);
    await expect(retryReferenceImport(project.id, failed.id)).rejects.toThrow("不可用");
    await expect(getReferenceSource(project.id, referenceAttachment(retried))).rejects.toThrow("移除");
    expect(await db.media.get(retried.mediaId)).toBeUndefined();
    expect(await db.referenceChunks.count()).toBe(0);
    expect((await importReferenceFile(project.id, textFile())).id).not.toBe(failed.id);
  });
  it("reference ownership retains media across thread deletion; shared business image survives withdrawal", async () => {
    const project = await createProject("A"); const reference = await importReferenceFile(project.id, textFile());
    await deleteMediaIfOrphan(reference.mediaId);
    expect(await db.media.get(reference.mediaId)).toBeDefined();
    const thread = await createChatThread({ projectId: project.id }); await deleteChatThread(thread.id);
    expect((await listProjectReferences(project.id)).length).toBe(1);
    const mediaId = createId("med"); await putMedia({ id: mediaId, projectId: project.id, filename: "generated.png", mimeType: "image/png", blob: new Blob([png()], { type: "image/png" }) });
    await updateProject(project.id, { coverMediaId: mediaId });
    const image = await registerProjectImage(project.id, mediaId);
    expect(image.mediaId).toBe(mediaId);
    await removeProjectReference(project.id, image.id);
    expect(await db.media.get(mediaId)).toBeDefined();
    await deleteProject(project.id);
    expect(await db.projectReferences.count()).toBe(0); expect(await db.referenceChunks.count()).toBe(0); expect(await db.media.count()).toBe(0);
  });
  it("counts merged line separators consistently and roundtrips a capped multiline source", async () => {
    const project = await createProject("长剧本");
    const body = Array.from({ length: 100_000 }, () => "0123456789").join("\n");
    const reference = await importReferenceFile(project.id, textFile(body, "long.txt"));
    const source = await getReferenceSource(project.id, referenceAttachment(reference));
    expect(source.reference.status).toBe("partial");
    expect(source.reference.coverage.truncated).toBe(true);
    const characters = source.chunks.reduce((sum, part) => sum + part.text.length, 0);
    expect(characters).toBe(source.reference.coverage.characters);
    expect(characters).toBeLessThanOrEqual(REFERENCE_LIMITS.characters);
    const restored = await importProjectZip(await exportProjectZip(project.id));
    const [copy] = await listProjectReferences(restored.id);
    const copied = await getReferenceSource(restored.id, referenceAttachment(copy));
    expect(copied.reference.coverage).toEqual(source.reference.coverage);
    expect(copied.chunks.map((part) => part.text)).toEqual(source.chunks.map((part) => part.text));
    expect(() => parseReferencePackage([{ ...reference, status: "ready" }], source.chunks, project.id)).toThrow("不一致");
    expect(() => parseReferencePackage([{ ...reference, coverage: { ...reference.coverage, characters: characters - 1 } }], source.chunks, project.id)).toThrow("不一致");
    const asPdf = { ...reference, kind: "pdf", status: "ready", coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [1], characters: 0, truncated: false } };
    expect(() => parseReferencePackage([asPdf], [], project.id)).toThrow("不一致");
  });
  it("roundtrips source/chunks with fresh ownership and rejects tampered source bytes atomically", async () => {
    const project = await createProject("A"); const reference = await importReferenceFile(project.id, textFile());
    const archive = await exportProjectZip(project.id);
    const restored = await importProjectZip(archive);
    const [copy] = await listProjectReferences(restored.id);
    expect(copy.id).not.toBe(reference.id); expect(copy.digest).toBe(reference.digest);
    expect((await getReferenceSource(restored.id, referenceAttachment(copy))).media.filename).toBe("剧本.md");
    const zip = await JSZip.loadAsync(archive);
    zip.file(`media/${reference.mediaId}.md`, "篡改");
    await expect(importProjectZip(await zip.generateAsync({ type: "blob" }))).rejects.toThrow("大小不符");
    expect(await db.projects.count()).toBe(2);
    const foreign = await JSZip.loadAsync(archive);
    const rows = JSON.parse(await foreign.file("references.json")!.async("string")); rows[0].projectId = "other";
    foreign.file("references.json", JSON.stringify(rows));
    await expect(importProjectZip(await foreign.generateAsync({ type: "blob" }))).rejects.toThrow("归属");
  });
});
