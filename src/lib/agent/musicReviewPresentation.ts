import type { MusicSettings } from "@/domain/music";
import { musicWireInput } from "@/lib/audioGeneration/input";

/** Review the exact adapter request, never relabel unused draft fields as submitted. */
export function describeMusicReview(settings: MusicSettings) {
  const wire = musicWireInput(settings);
  if (wire.model === "flowmusic") return {
    title: wire.title?.trim() || "未命名音乐",
    engine: "Flow Music", mode: "音乐生成", vocals: "人声由描述与歌词引导",
    duration: wire.length === undefined ? "自动时长" : `${wire.length} 秒`,
    sections: [
      { label: "风格与声音描述", text: wire.sound_prompt || "未填写，由歌词引导生成" },
      { label: "歌词", text: wire.lyrics || "未提供歌词" },
    ],
    parameters: [
      { label: "BPM", value: wire.bpm ?? "自动" },
      { label: "随机种子", value: wire.seed ?? "自动" },
    ],
    note: "人声与声部分配由描述引导，不能保证精确执行。",
    wire,
  };
  return {
    title: wire.title?.trim() || (wire.custom ? "未命名音乐" : "根据描述生成歌曲"),
    engine: `Suno ${wire.version}`, mode: wire.custom ? "自定义" : "灵感模式",
    vocals: wire.instrumental ? "纯音乐" : "带人声",
    duration: wire.duration === undefined ? "自动时长" : `${wire.duration} 秒`,
    sections: [
      { label: wire.custom ? wire.instrumental ? "补充提示" : "歌词" : "创作描述", text: wire.prompt || "未提供补充提示" },
      ...(wire.custom ? [{ label: "风格", text: wire.style || "未指定风格" }] : []),
    ],
    parameters: wire.custom ? [{ label: "排除风格", value: wire.negative_tags || "未设置" }] : [],
    note: wire.custom
      ? "人声与声部分配由提示词引导，不能保证精确执行。"
      : "本次只提交创作描述、模型版本与人声设置；草稿中的自定义标题、风格和时长不参与提交。",
    wire,
  };
}
