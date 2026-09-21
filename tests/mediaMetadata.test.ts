import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createProject, putMedia, updateProject } from "@/db/repo";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";

async function fixture() {
  const project = await createProject("metadata");
  await putMedia({ id: "media-original", projectId: project.id, filename: "原始文件.jfif", mimeType: "image/jpeg", blob: new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" }) });
  await updateProject(project.id, { coverMediaId: "media-original" });
  return JSZip.loadAsync(await exportProjectZip(project.id));
}

describe("project media metadata", () => {
  it("keeps old ZIPs readable, including legacy JFIF extensions", async () => {
    const zip = await fixture();
    zip.remove("mediaMetadata.json");
    const restored = await importProjectZip(await zip.generateAsync({ type: "blob" }));
    const media = (await db.media.where("projectId").equals(restored.id).first())!;
    expect(media.mimeType).toBe("image/jpeg");
    expect(media.blob.type).toBe("image/jpeg");
  });

  it.each(["foreign owner", "duplicate ID", "invalid MIME", "missing metadata", "missing file"])("rejects %s before writing the imported project", async kind => {
    const zip = await fixture();
    const rows = JSON.parse(await zip.file("mediaMetadata.json")!.async("string"));
    if (kind === "foreign owner") rows[0].projectId = "foreign";
    if (kind === "duplicate ID") rows.push(rows[0]);
    if (kind === "invalid MIME") rows[0].mimeType = "image/jpeg\r\ninvalid";
    if (kind === "missing metadata") rows.pop();
    if (kind === "missing file") zip.remove("media/media-original.jfif");
    zip.file("mediaMetadata.json", JSON.stringify(rows));
    const before = await db.projects.count();
    await expect(importProjectZip(await zip.generateAsync({ type: "blob" }))).rejects.toThrow();
    expect(await db.projects.count()).toBe(before);
  });
});
