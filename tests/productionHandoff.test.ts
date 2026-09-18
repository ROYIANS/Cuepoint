import Dexie from "dexie";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { addEpisode, addScene, addShot, createProject, patchShot } from "@/db/repo";
import { emptySlot } from "@/domain/slot";
import type { MediaKind } from "@/domain/types";
import { registerPendingDraft } from "@/lib/debouncedDraft";
import { exportProductionHandoff, HANDOFF_FORMAT } from "@/lib/productionHandoff";

async function fixture() {
  const project = await createProject("雨夜送信", "film");
  const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
  const shot = await addShot(project.id, episode.id);
  const scene = await addScene(project.id);
  await patchShot(shot.id, { content: "信使推开门。", durationSec: 5, sceneId: scene.id });
  return { project, episode, shot, scene };
}

async function media(projectId: string, id: string, kind: MediaKind, filename = "original.bin", bytes = [0, 1, 255, 128]) {
  await db.media.put({ id, projectId, filename, mimeType: `${kind}/${kind === "image" ? "png" : "mp4"}`, blob: new Blob([new Uint8Array(bytes)]) });
  return { ...emptySlot(), result: { mediaId: id, kind } };
}

interface ManifestShot {
  shotId: string; content: string; notes: string; order: number; warnings: string[];
  media: Record<string, { state: string; path?: string; originalFilename?: string; byteSize?: number }>;
  folder: string;
}
interface Manifest { format: string; missingCount: number; project: { name: string }; shots: ManifestShot[] }
async function unpack(blob: Blob) {
  const zip = await JSZip.loadAsync(blob);
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as Manifest;
  return { zip, manifest };
}

describe("production handoff", () => {
  it("exports ordered original bytes, full text and links while excluding unrelated and private records", async () => {
    const { project, episode, shot, scene } = await fixture();
    const second = await addShot(project.id, episode.id);
    const otherEpisode = await addEpisode(project.id);
    const otherShot = await addShot(project.id, otherEpisode.id);
    const otherProject = await createProject("UNRELATED_PROJECT");
    const longText = '镜头对白，含"引号"\n'.repeat(500);
    await db.projects.update(project.id, { extra: { apiKey: "SECRET_KEY" } });
    await db.shots.update(otherShot.id, { content: "OTHER_EPISODE_TEXT" });
    await db.shots.update(shot.id, {
      order: 5, content: longText, notes: "长备注\n第二行", sceneId: scene.id,
      firstFrame: { ...await media(project.id, "frame", "image", "原图.png"), prompt: "完整素材描述\n第二段" },
      clip: await media(project.id, "video", "video", "原视频.mp4"),
      extra: { apiKey: "SHOT_SECRET" },
    });
    await db.shots.update(second.id, { order: 0, content: "排在第一", sceneId: scene.id, durationSec: 4,
      firstFrame: await media(project.id, "frame2", "image"), clip: await media(project.id, "video2", "video") });
    await media(project.id, "unused", "image", "UNRELATED_MEDIA.png", [88]);
    await media(otherProject.id, "other-media", "image", "FOREIGN.png", [99]);
    await db.connectors.put({ id: "secret", definitionId: "apimart", protocol: "openai-compatible", baseUrl: "https://secret.example", apiKey: "CONNECTOR_SECRET", updatedAt: "now" });
    const progress: number[] = [];
    const result = await exportProductionHandoff(project.id, episode.id, (value) => progress.push(value));
    const { zip, manifest } = await unpack(result.blob);
    expect(result).toMatchObject({ shotCount: 2, missingCount: 0, filename: "雨夜送信-素材交付.zip" });
    expect(manifest.format).toBe(HANDOFF_FORMAT);
    expect(manifest.shots.map((row) => row.shotId)).toEqual([second.id, shot.id]);
    expect(manifest.shots[1].content).toBe(longText);
    expect(manifest.shots[1].notes).toBe("长备注\n第二行");
    expect(manifest.shots[1].media.lastFrame.state).toBe("empty");
    expect(await zip.file(`${manifest.shots[1].folder}/shot.txt`)!.async("string")).toContain(longText);
    expect(await zip.file(`${manifest.shots[1].folder}/shot.txt`)!.async("string")).toContain("完整素材描述\n第二段");
    expect(await zip.file("shots.csv")!.async("string")).toContain('"镜头对白，含""引号""');
    for (const row of manifest.shots) {
      for (const slot of Object.values(row.media)) {
        if (slot.path) expect([...await zip.file(slot.path)!.async("uint8array")]).toEqual([0, 1, 255, 128]);
      }
    }
    const textFiles = await Promise.all(Object.values(zip.files).filter((file) => !file.dir && /\.(json|md|csv|txt)$/.test(file.name)).map((file) => file.async("string")));
    const text = textFiles.join("\n");
    for (const excluded of ["SECRET_KEY", "SHOT_SECRET", "CONNECTOR_SECRET", "OTHER_EPISODE_TEXT", "UNRELATED_PROJECT", "UNRELATED_MEDIA", "FOREIGN.png"]) expect(text).not.toContain(excluded);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(100);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(true);
  });

  it("keeps duplicate and hostile names in unique portable paths, retaining original filenames", async () => {
    const { project, episode, shot } = await fixture();
    const second = await addShot(project.id, episode.id);
    const filename = "../../路径\\逃逸/" + "😀".repeat(80) + ".png";
    const slot = await media(project.id, "shared", "image", filename);
    for (const id of [shot.id, second.id]) await db.shots.update(id, { shotNumber: "../" + "镜".repeat(100), firstFrame: slot, lastFrame: slot, clip: slot });
    const { zip, manifest } = await unpack((await exportProductionHandoff(project.id, episode.id)).blob);
    const paths = manifest.shots.flatMap((row) => Object.values(row.media).map((item) => item.path!));
    expect(new Set(paths).size).toBe(6);
    for (const path of paths) {
      expect(path.split("/")).toHaveLength(3);
      expect(path.split("/").every((part) => part !== "." && part !== ".." && new TextEncoder().encode(part).length <= 255)).toBe(true);
      expect(path).not.toContain("\\");
      expect(path).toMatch(/\.png$/);
      expect(zip.file(path)).not.toBeNull();
    }
    expect(manifest.shots[0].media.firstFrame.originalFilename).toBe(filename);
    expect(manifest.shots[0].media.clip.state).toBe("placeholder");
    expect(manifest.missingCount).toBe(2);
  });

  it("reports broken, foreign, mismatched and empty files without exporting invalid data", async () => {
    const { project, episode, shot } = await fixture();
    const other = await createProject("FOREIGN");
    const second = await addShot(project.id, episode.id);
    await db.shots.update(shot.id, {
      firstFrame: { ...emptySlot(), result: { mediaId: "deleted", kind: "image" } },
      lastFrame: await media(other.id, "foreign", "image", "PRIVATE_FILENAME"),
      clip: { ...(await media(project.id, "mismatch", "image")), result: { mediaId: "mismatch", kind: "video" } },
    });
    await db.shots.update(second.id, { firstFrame: await media(project.id, "empty", "image", "empty.png", []), clip: await media(project.id, "still", "image", "placeholder.png") });
    const { zip, manifest } = await unpack((await exportProductionHandoff(project.id, episode.id)).blob);
    expect(manifest.shots[0].media.firstFrame.state).toBe("missing");
    expect(manifest.shots[0].media.lastFrame.state).toBe("foreign");
    expect(manifest.shots[0].media.clip.state).toBe("wrong-kind");
    expect(manifest.shots[1].media.firstFrame.state).toBe("empty-file");
    expect(manifest.shots[1].media.clip.state).toBe("placeholder");
    expect(JSON.stringify(manifest)).not.toContain("PRIVATE_FILENAME");
    const files = Object.values(zip.files).filter((file) => !file.dir && !/\.(json|md|csv|txt)$/.test(file.name));
    expect(files).toHaveLength(1);
    expect(await zip.file("missing.md")!.async("string")).toContain("仍缺少完成的视频");
  });

  it("flushes pending project drafts and rejects failed drafts before producing a stale package", async () => {
    const { project, episode, shot } = await fixture();
    let fail = true;
    let active = true;
    const unregister = registerPendingDraft(project.id, async () => {
      if (!active) return;
      if (fail) throw new Error("磁盘保存失败");
      await patchShot(shot.id, { content: "刚输入的草稿" });
    });
    try {
      await expect(exportProductionHandoff(project.id, episode.id)).rejects.toThrow("磁盘保存失败");
      fail = false;
      const { manifest } = await unpack((await exportProductionHandoff(project.id, episode.id)).blob);
      expect(manifest.shots[0].content).toBe("刚输入的草稿");
    } finally { active = false; unregister(); }
  });

  it("captures project, shots and blobs in one coherent read snapshot while edits queue", async () => {
    const { project, episode, shot } = await fixture();
    await db.shots.update(shot.id, { firstFrame: await media(project.id, "snapshot-media", "image") });
    let edit: Promise<unknown> | undefined;
    const onRead = (value: typeof project) => {
      if (value?.id === project.id && !edit) edit = Dexie.ignoreTransaction(() => db.transaction("rw", db.projects, db.shots, db.media, async () => {
        await db.projects.update(project.id, { name: "AFTER" });
        await db.shots.update(shot.id, { content: "AFTER", firstFrame: emptySlot() });
        await db.media.delete("snapshot-media");
      }));
      return value;
    };
    db.projects.hook("reading", onRead);
    let blob: Blob;
    try { blob = (await exportProductionHandoff(project.id, episode.id)).blob; }
    finally { db.projects.hook("reading").unsubscribe(onRead); }
    await edit;
    const { zip, manifest } = await unpack(blob);
    expect(manifest.project.name).toBe("雨夜送信");
    expect(manifest.shots[0].content).toBe("信使推开门。");
    expect([...await zip.file(manifest.shots[0].media.firstFrame.path!)!.async("uint8array")]).toEqual([0, 1, 255, 128]);
    expect((await db.projects.get(project.id))!.name).toBe("AFTER");
  });

  it("rejects missing, foreign and empty episodes and labels series exports", async () => {
    const { project, episode } = await fixture();
    const other = await createProject("Other");
    const empty = await addEpisode(project.id);
    await expect(exportProductionHandoff(project.id, "missing")).rejects.toThrow("找不到");
    await expect(exportProductionHandoff(other.id, episode.id)).rejects.toThrow("找不到");
    await expect(exportProductionHandoff(project.id, empty.id)).rejects.toThrow("没有镜头");
    await db.projects.update(project.id, { mode: "series" });
    expect((await exportProductionHandoff(project.id, episode.id)).filename).toContain("第1集");
  });

  it("flags invalid asset links without including foreign names or asset metadata", async () => {
    const { project, episode, shot } = await fixture();
    const other = await createProject("Other");
    const foreignScene = await addScene(other.id);
    await db.scenes.update(foreignScene.id, { name: "FOREIGN_SCENE_NAME", notes: "FOREIGN_ASSET_NOTES" });
    await db.shots.update(shot.id, { sceneId: foreignScene.id, characterIds: ["missing-character"], propIds: ["missing-prop"], styleId: "missing-style", beatId: "missing-beat" });
    const { manifest, zip } = await unpack((await exportProductionHandoff(project.id, episode.id)).blob);
    expect(manifest.shots[0].warnings).toEqual(expect.arrayContaining([
      "场景未关联或已不存在", "角色关联失效：missing-character", "道具关联失效：missing-prop",
      "风格关联失效：missing-style", "场次关联失效：missing-beat",
    ]));
    const content = JSON.stringify(manifest) + await zip.file("shots.csv")!.async("string");
    expect(content).not.toContain("FOREIGN_SCENE_NAME");
    expect(content).not.toContain("FOREIGN_ASSET_NOTES");
  });
});
