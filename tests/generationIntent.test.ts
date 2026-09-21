import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { addShot, createProject, patchProjectDetails, patchShot, putMedia } from "@/db/repo";
import { defaultImageGeneration, defaultVideoGeneration } from "@/domain/output";
import { buildProductionContext } from "@/lib/productionContext";
import { generationIntentToProposalInput, prepareGenerationIntent, transitionGenerationIntent, validateGenerationIntent } from "@/lib/generationIntent";

async function setup(slot: "firstFrame" | "clip" = "firstFrame") {
  const project = await createProject("intent");
  const episode = (await db.episodes.where("projectId").equals(project.id).first())!;
  const shot = await addShot(project.id, episode.id);
  await patchProjectDetails(project.id, { generationDefaults: { image: defaultImageGeneration(), video: defaultVideoGeneration() } });
  const context = await buildProductionContext(project.id, episode.id, shot.id);
  const target = { kind: "shot" as const, projectId: project.id, episodeId: episode.id, entityId: shot.id, slot };
  return { context, target };
}
const media = (projectId: string, id: string, mimeType = "image/png") => putMedia({ id, projectId, filename: id, mimeType, blob: new Blob(["bytes"]) });

describe("generation intent boundary", () => {
  it.each([
    ["gpt-image-2.5-flare", { quality: "max" }],
    ["gpt-image-2.5-sunburst", { quality: "high" }],
    ["gpt-image-2.5-ext", { version: "sunburst" }],
  ] as const)("preserves %s settings from project context into validated intent", async (model, settings) => {
    const { target } = await setup();
    const image = { ...defaultImageGeneration("16:9", model), ...settings, extra: { secret: "PRIVATE_EXTRA" } };
    await patchProjectDetails(target.projectId, { generationDefaults: { image } });
    const context = await buildProductionContext(target.projectId, target.episodeId, target.entityId);
    expect(context.output.image).toMatchObject(settings);
    expect(JSON.stringify(context.output)).not.toContain("PRIVATE_EXTRA");
    const intent = await prepareGenerationIntent({ context, target, prompt: "镜头" });
    expect(intent.parameters).toMatchObject(settings);
    expect(() => validateGenerationIntent({ ...intent, parameters: { ...intent.parameters, ...(model.endsWith("ext") ? { quality: "high" } : { version: "flare" }) } })).toThrow();
  });
  it("rejects image-only quality/version parameters on video intents", async () => {
    const { context, target } = await setup("clip");
    const intent = await prepareGenerationIntent({ context, target, prompt: "motion" });
    for (const extra of [{ quality: "high" }, { version: "flare" }]) {
      expect(() => validateGenerationIntent({ ...intent, parameters: { ...intent.parameters, ...extra } })).toThrow("不兼容");
    }
  });
  it("prepares profile-validated explicit parameters without rewriting authored timing or attaching anything", async () => {
    const { context, target } = await setup("clip");
    const intent = await prepareGenerationIntent({ context, target, prompt: "雨夜" });
    expect(intent).toMatchObject({ status: "prepared", provider: "apimart", model: "MiniMax-H3", parameters: { duration: 5, resolution: "2K", mode: "text", prompt: "雨夜" } });
    expect((await db.shots.get(target.entityId))?.durationSec).toBe(0);
    expect((await db.shots.get(target.entityId))?.clip.result).toBeUndefined();
  });
  it("refuses unknown secrets and incompatible native parameters", async () => {
    const { context, target } = await setup();
    const intent = await prepareGenerationIntent({ context, target, prompt: "图像" });
    for (const extra of [{ apiKey: "secret" }, { headers: {} }, { duration: 5 }, { n: 2 }]) expect(() => validateGenerationIntent({ ...intent, parameters: { ...intent.parameters, ...extra } })).toThrow();
    expect(() => validateGenerationIntent({ ...intent, target: { ...target, slot: undefined } })).toThrow("槽位");
    expect(() => validateGenerationIntent({ ...intent, model: "unverified" })).toThrow("模型");
    expect(() => validateGenerationIntent({ ...intent, baseRevision: "secret" })).toThrow("版本");
  });
  it("requires explicit input roles and enforces mode/media-kind compatibility", async () => {
    const { context, target } = await setup("clip");
    await media(target.projectId, "first"); await media(target.projectId, "last"); await media(target.projectId, "video", "video/mp4");
    const config = { video: { ...defaultVideoGeneration(), mode: "frames", aspectRatio: "adaptive" } };
    await expect(prepareGenerationIntent({ context, target, prompt: "motion", config })).rejects.toThrow("首帧");
    await expect(prepareGenerationIntent({ context, target, prompt: "motion", config, inputs: [{ mediaId: "first", role: "reference-image" }] })).rejects.toThrow("首帧");
    const intent = await prepareGenerationIntent({ context, target, prompt: "motion", config, inputs: [{ mediaId: "first", role: "first-frame" }, { mediaId: "last", role: "last-frame" }] });
    expect(intent.parameters.aspect_ratio).toBeUndefined();
    await expect(prepareGenerationIntent({ context, target, prompt: "motion", config, inputs: [{ mediaId: "video", role: "first-frame" }] })).rejects.toThrow("类型");
    await expect(prepareGenerationIntent({ context, target, prompt: "motion", inputs: [{ mediaId: "first", role: "first-frame" }] })).rejects.toThrow("文字");
    await expect(prepareGenerationIntent({ context, target, prompt: "motion", config: { video: { ...defaultVideoGeneration(), mode: "reference" } }, inputs: [{ mediaId: "video", role: "reference-video" }] })).resolves.toMatchObject({ status: "prepared" });
  });
  it("rejects foreign, missing and empty media inputs", async () => {
    const { context, target } = await setup();
    const other = await createProject("other"); await media(other.id, "foreign");
    await putMedia({ id: "empty", projectId: target.projectId, filename: "empty", mimeType: "image/png", blob: new Blob([]) });
    for (const mediaId of ["foreign", "missing", "empty"]) await expect(prepareGenerationIntent({ context, target, prompt: "image", inputs: [{ mediaId, role: "reference-image" }] })).rejects.toThrow("素材");
  });
  it("rejects stale, mismatched and deleted targets", async () => {
    const { context, target } = await setup();
    await expect(prepareGenerationIntent({ context, target: { ...target, episodeId: "elsewhere" }, prompt: "image" })).rejects.toThrow("上下文");
    await patchShot(target.entityId, { notes: "manual edit" });
    await expect(prepareGenerationIntent({ context, target, prompt: "image" })).rejects.toThrow("已修改");
    await db.shots.delete(target.entityId);
    await expect(prepareGenerationIntent({ context, target, prompt: "image" })).rejects.toThrow("不存在");
  });
  it("allows explicit transitions but no restart, partial/failed completion, or silent automatic writes", async () => {
    const { context, target } = await setup(); await media(target.projectId, "result");
    const prepared = await prepareGenerationIntent({ context, target, prompt: "image" });
    expect(() => transitionGenerationIntent(prepared, "succeeded", { result: { mediaId: "result", kind: "image" } })).toThrow("不能");
    const submitted = transitionGenerationIntent(prepared, "submitted", { providerTaskId: "task" });
    const running = transitionGenerationIntent(submitted, "running");
    expect(() => transitionGenerationIntent(running, "succeeded")).toThrow("完整结果");
    expect(() => transitionGenerationIntent(running, "succeeded", { result: { mediaId: "result", kind: "video" } })).toThrow("类型");
    const failed = transitionGenerationIntent(running, "failed", { error: "failed" });
    await expect(generationIntentToProposalInput(failed)).rejects.toThrow("完整成功");
    expect(() => transitionGenerationIntent(failed, "submitted")).toThrow("不能");
    const succeeded = transitionGenerationIntent(running, "succeeded", { result: { mediaId: "result", kind: "image" } });
    const input = await generationIntentToProposalInput(succeeded);
    expect(input).toMatchObject({ expectedRevision: prepared.baseRevision, change: { kind: "slot-result", result: { mediaId: "result", kind: "image" } }, source: { intentId: prepared.id, providerTaskId: "task" } });
    expect((await db.shots.get(target.entityId))?.firstFrame.result).toBeUndefined();
    await patchShot(target.entityId, { notes: "manual" });
    await expect(generationIntentToProposalInput(succeeded)).rejects.toThrow("已修改");
  });
  it("rechecks result ownership and existence when converting to a proposal", async () => {
    const { context, target } = await setup(); const other = await createProject("other"); await media(other.id, "foreign");
    const prepared = await prepareGenerationIntent({ context, target, prompt: "image" });
    const submitted = transitionGenerationIntent(prepared, "submitted");
    for (const id of ["missing", "foreign"]) {
      const done = transitionGenerationIntent(submitted, "succeeded", { result: { mediaId: id, kind: "image" } });
      await expect(generationIntentToProposalInput(done)).rejects.toThrow("素材");
    }
  });
});
