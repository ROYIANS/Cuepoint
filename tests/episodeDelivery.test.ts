import { describe, expect, it } from "vitest";
import { emptySlot } from "@/domain/slot";
import {
  DEFAULT_SHOT_SETTINGS,
  emptyEpisodeStory,
  emptySeriesStory,
  emptySetting,
  type Episode,
  type Project,
  type Shot,
} from "@/domain/types";
import {
  deriveEpisodeDelivery,
  episodeDeliveryCsv,
  episodeDeliveryFilename,
  escapeCsvCell,
} from "@/lib/episodeDelivery";

const project: Project = {
  id: "project",
  name: "测试/项目",
  mode: "series",
  createdAt: "",
  updatedAt: "",
  columnSettings: { visible: ["content", "category", "notes"] },
  shotSettings: DEFAULT_SHOT_SETTINGS,
  story: emptySeriesStory(),
  setting: emptySetting(),
};

const episode: Episode = {
  id: "episode",
  projectId: project.id,
  order: 1,
  title: "下雨",
  story: {
    ...emptyEpisodeStory(),
    beats: [
      {
        id: "beat",
        title: "室内",
        content: "",
        characterIds: [],
        timeOfDay: "",
      },
    ],
  },
  createdAt: "",
  updatedAt: "",
};

function shot(id: string, order: number, episodeId = episode.id): Shot {
  return {
    id,
    projectId: project.id,
    episodeId,
    order,
    shotNumber: id,
    firstFrame: emptySlot(),
    lastFrame: emptySlot(),
    clip: emptySlot(),
    category: "近景",
    durationSec: 2.5,
    content: '他说，"你好"\n再见',
    notes: "中文",
    sceneCloseup: "",
    sound: "",
    emotion: "",
    cameraAngle: "",
    cameraGear: "",
    focalLength: "",
    characterIds: ["character"],
    sceneId: "scene",
    beatId: "beat",
  };
}

describe("episode delivery", () => {
  it("scopes and orders rows while resolving asset and beat names", () => {
    const foreignProjectShot = shot("foreign-project", 0);
    foreignProjectShot.projectId = "other-project";
    const delivery = deriveEpisodeDelivery({
      project,
      episode,
      shots: [
        shot("002", 2),
        shot("foreign-episode", 0, "other"),
        foreignProjectShot,
        shot("001", 1),
      ],
      characters: [{ id: "character", name: "阿青" } as never],
      scenes: [{ id: "scene", name: "厨房" } as never],
    });

    expect(delivery.rows.map((row) => row.shotNumber)).toEqual(["001", "002"]);
    expect(delivery.rows[0]).toMatchObject({
      order: 1,
      beat: "室内",
      characters: "阿青",
      scene: "厨房",
    });
    expect(delivery.beatCount).toBe(1);
    expect(delivery.totalDurationSec).toBe(5);
    expect(delivery.columns).toEqual([{ id: "category", label: "类别" }]);
  });

  it("reports readiness gaps and prefers first-frame then last-frame media", () => {
    const incomplete = shot("001", 0);
    incomplete.content = "";
    incomplete.durationSec = 0;
    incomplete.sceneId = undefined;
    incomplete.lastFrame.result = { mediaId: "last-frame", kind: "image" };

    const delivery = deriveEpisodeDelivery({
      project,
      episode,
      shots: [incomplete],
      characters: [],
      scenes: [],
    });

    expect(delivery.rows[0].visualMediaId).toBe("last-frame");
    expect(delivery.rows[0].missing).toEqual([
      "content",
      "duration",
      "scene",
      "firstFrame",
      "clip",
    ]);

    incomplete.firstFrame.result = { mediaId: "first-frame", kind: "image" };
    expect(
      deriveEpisodeDelivery({
        project,
        episode,
        shots: [incomplete],
        characters: [],
        scenes: [],
      }).rows[0].visualMediaId,
    ).toBe("first-frame");
  });

  it("writes BOM-prefixed RFC 4180 rows and a safe filename", () => {
    const delivery = deriveEpisodeDelivery({
      project,
      episode,
      shots: [shot("001", 0)],
      characters: [{ id: "character", name: "阿青" } as never],
      scenes: [{ id: "scene", name: "厨房" } as never],
    });
    const csv = episodeDeliveryCsv(delivery);

    expect(csv.startsWith("\uFEFF顺序,镜号")).toBe(true);
    expect(csv).toContain('"他说，""你好""\n再见"');
    expect(csv).toContain("\r\n");
    expect(episodeDeliveryFilename(delivery)).toBe("测试-项目-第2集 · 下雨-分镜.csv");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });
});
