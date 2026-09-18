import { describe, expect, it } from "vitest";
import { applyGenerationSelection } from "@/lib/agent/generationReviewDraft";
import { profileRequest, type GenerationSubmitArgs } from "@/lib/agent/generationProfiles";

function video(inputs: GenerationSubmitArgs["inputs"]): GenerationSubmitArgs {
  return { connectorId: "old", model: "MiniMax-H3", target: { kind: "shot", projectId: "project", episodeId: "episode", entityId: "shot", slot: "clip" },
    prompt: "保留用户修改的描述", inputs, parameters: { mode: "text", duration: 5, resolution: "2K", aspectRatio: "16:9" } };
}

describe("generation review selection changes", () => {
  it.each([
    { inputs: [], mode: "text" },
    { inputs: [{ mediaId: "first", role: "first-frame" as const }], mode: "frames" },
    { inputs: [{ mediaId: "last", role: "last-frame" as const }], mode: "frames" },
    { inputs: [{ mediaId: "ref", role: "reference-image" as const }], mode: "reference" },
    { inputs: [{ mediaId: "ref-video", role: "reference-video" as const }], mode: "reference" },
  ])("derives $mode from fixed input roles instead of the saved default", ({ inputs, mode }) => {
    const draft = video(inputs);
    const next = applyGenerationSelection(draft, { connectorId: "hub", model: "veo-3.1-fast-generate-preview", parameters: { mode: "text", duration: 8, resolution: "720p", aspectRatio: "9:16" } }, "aihubmix");
    expect(next.parameters.mode).toBe(mode);
    expect(next.prompt).toBe(draft.prompt);
    expect(next.target).toEqual(draft.target);
    expect(next.inputs).toEqual(draft.inputs);
    expect(next.parameters.aspectRatio).toBe("9:16");
  });

  it("removes an inapplicable APIMart frame ratio without mutating draft or preference", () => {
    const draft = video([{ mediaId: "first", role: "first-frame" }]);
    const selection = { connectorId: "new", model: "MiniMax-H3", parameters: { aspectRatio: "9:16", duration: 8 } };
    const beforeDraft = structuredClone(draft), beforeSelection = structuredClone(selection);
    const next = applyGenerationSelection(draft, selection, "apimart");
    expect(next.parameters).toEqual({ mode: "frames", duration: 8 });
    expect(draft).toEqual(beforeDraft);
    expect(selection).toEqual(beforeSelection);
    expect(profileRequest(next, "apimart").parameters.duration).toBe(8);
  });

  it("replaces image profile parameters without carrying incompatible provider fields", () => {
    const draft: GenerationSubmitArgs = { ...video([]), model: "gpt-image-2", target: { kind: "character", projectId: "project", entityId: "character", slot: "front" }, parameters: { size: "16:9", resolution: "4k" } };
    const next = applyGenerationSelection(draft, { connectorId: "hub", model: "gpt-image-2", parameters: { size: "1536x1024", quality: "high" } }, "aihubmix");
    expect(next.parameters).toEqual({ size: "1536x1024", quality: "high" });
    expect(next.prompt).toBe(draft.prompt);
    expect(profileRequest(next, "aihubmix").kind).toBe("image");
  });

  it("preserves an unfinished prompt while switching configuration", () => {
    for (const prompt of ["", "  尚在编辑\n"]) {
      const next = applyGenerationSelection({ ...video([]), prompt }, { connectorId: "new", model: "MiniMax-H3", parameters: {} }, "apimart");
      expect(next.prompt).toBe(prompt);
    }
  });

  it("keeps incompatible explicit settings for visible validation instead of silently correcting them", () => {
    const next = applyGenerationSelection(video([{ mediaId: "ref", role: "reference-image" }]), { connectorId: "hub", model: "veo-3.1-fast-generate-preview", parameters: { duration: 4, resolution: "1080p" } }, "aihubmix");
    expect(next.parameters).toEqual({ mode: "reference", duration: 4, resolution: "1080p" });
    expect(() => profileRequest(next, "aihubmix")).toThrow("8 秒");
    const mixed = applyGenerationSelection(video([{ mediaId: "first", role: "first-frame" }, { mediaId: "ref", role: "reference-image" }]), { connectorId: "new", model: "MiniMax-H3", parameters: {} }, "apimart");
    expect(mixed.inputs).toHaveLength(2);
    expect(() => profileRequest(mixed, "apimart")).toThrow("不匹配");
  });
});
