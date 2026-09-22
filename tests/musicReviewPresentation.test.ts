import { describe, expect, it } from "vitest";
import { describeMusicReview } from "@/lib/agent/musicReviewPresentation";
import { defaultMusicSettings } from "@/domain/music";

describe("music confirmation wire presentation", () => {
  it("does not present custom-only draft values as submitted in Suno Simple", () => {
    const settings = { ...defaultMusicSettings("suno"), engine: "suno" as const, version: "v6" as const, custom: false, instrumental: false,
      prompt: "民谣", title: "unused title", style: "unused style", negativeTags: "unused tags", durationSec: 120 };
    const view = describeMusicReview(settings);
    expect(view).toMatchObject({ title: "根据描述生成歌曲", mode: "灵感模式", vocals: "带人声", duration: "自动时长", sections: [{ label: "创作描述", text: "民谣" }] });
    expect(view.wire).toEqual({ model: "suno", version: "v6", custom: false, instrumental: false, prompt: "民谣" });
    expect(JSON.stringify(view)).not.toContain("unused");
  });
  it("retains complete lyrics and negative styles for a custom song", () => {
    const lyrics = "[Verse]\n成年主唱\n".repeat(100) + "结尾最后一句";
    const view = describeMusicReview({ engine: "suno", version: "v6-wild", custom: true, instrumental: false, prompt: lyrics,
      title: "纸船", style: "远方合成童声", negativeTags: "electronic".repeat(190), durationSec: 180 });
    expect(view).toMatchObject({ title: "纸船", engine: "Suno v6-wild", duration: "180 秒", sections: [{ label: "歌词", text: lyrics }, { label: "风格", text: "远方合成童声" }] });
    expect(view.parameters[0].value).toHaveLength(1900);
    expect(view.note).toContain("不能保证精确执行");
  });
  it("does not label instrumental supplemental prompt as sung lyrics", () => {
    const view = describeMusicReview({ engine: "suno", version: "v6-mini", custom: true, instrumental: true, prompt: "", title: "", style: "钢琴", negativeTags: "" });
    expect(view).toMatchObject({ vocals: "纯音乐", sections: [{ label: "补充提示", text: "未提供补充提示" }, { label: "风格", text: "钢琴" }] });
  });
  it("shows Flow Music fields without inventing instrumental control", () => {
    const view = describeMusicReview({ engine: "flowmusic", title: "夏天", soundPrompt: "钢琴", lyrics: "", bpm: "90", lengthSec: 120, seed: "0" });
    expect(view).toMatchObject({ engine: "Flow Music", duration: "120 秒", vocals: "人声由描述与歌词引导", parameters: [{ label: "BPM", value: "90" }, { label: "随机种子", value: "0" }] });
    expect(view.wire).toEqual({ model: "flowmusic", title: "夏天", sound_prompt: "钢琴", lyrics: "", bpm: "90", length: 120, seed: "0" });
  });
});
