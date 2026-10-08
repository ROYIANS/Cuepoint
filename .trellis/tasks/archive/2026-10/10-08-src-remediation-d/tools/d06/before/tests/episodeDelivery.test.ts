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
  type MediaRecord,
  type Prop,
  type VisualStyle,
} from "@/domain/types";
import {
  deriveEpisodeDelivery,
  episodeDeliveryCsv,
  episodeDeliveryFilename,
  escapeCsvCell,
} from "@/lib/episodeDelivery";

const media = new Map(["first-frame", "last-frame"].map((id) => [id, { id, projectId: "project", mimeType: "image/png", filename: "frame.png", blob: new Blob(["image"]) } satisfies MediaRecord]));

const project: Project = {
  id: "project",
  name: "测试/项目",
  mode: "series",
  aspectPreset: "16:9",
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
    status: "draft",
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
  it("resolves local prop names and inherited/none/explicit styles in delivery and CSV", () => {
    const props: Prop[] = [
      { id: "letter", projectId: project.id, name: '信, "封"', kind: "", notes: "", slots: {}, extra: {} },
      { id: "foreign-prop", projectId: "elsewhere", name: "不应显示", kind: "", notes: "", slots: {} },
    ];
    const styles: VisualStyle[] = [
      { id: "noir", projectId: project.id, name: "黑白", notes: "", slots: {} },
      { id: "warm", projectId: project.id, name: "暖色", notes: "", slots: {} },
      { id: "foreign-style", projectId: "elsewhere", name: "不应显示", notes: "", slots: {} },
    ];
    const inherited = { ...shot("001", 0), propIds: ["letter", "absent", "foreign-prop"] };
    const none = { ...shot("002", 1), styleId: null };
    const explicit = { ...shot("003", 2), styleId: "warm" };
    const missing = { ...shot("004", 3), styleId: "foreign-style" };
    const input = { project: { ...project, defaultStyleId: "noir" }, episode, shots: [inherited, none, explicit, missing], props, styles, characters: [], scenes: [], media };
    const delivery = deriveEpisodeDelivery(input);
    expect(delivery.rows.map((row) => [row.style, row.styleSource])).toEqual([
      ["黑白", "继承项目"], ["无风格", "不使用风格"], ["暖色", "镜头指定"], ["未知风格(foreign-style)", "镜头指定"],
    ]);
    expect(delivery.rows[0].props).toBe('信, "封"、未知道具(absent)、未知道具(foreign-prop)');
    const csv = episodeDeliveryCsv(delivery);
    expect(csv).toContain("场景,道具,风格,风格来源,备注");
    expect(csv).toContain('"信, ""封""、未知道具(absent)、未知道具(foreign-prop)"');
    expect(csv).not.toContain("不应显示");
    const changed = deriveEpisodeDelivery({ ...input, project: { ...project, defaultStyleId: "warm" } });
    expect(changed.rows.map((row) => row.style)).toEqual(["暖色", "无风格", "暖色", "未知风格(foreign-style)"]);
    expect(changed.rows.map((row) => row.durationSec)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(inherited).not.toHaveProperty("styleId");
  });

  it("keeps legacy shots valid without relations and avoids episode labels for film exports", () => {
    const input = { project: { ...project, mode: "film" as const }, episode, shots: [shot("001", 0)], props: [], styles: [], characters: [], scenes: [], media };
    const delivery = deriveEpisodeDelivery(input);
    expect(delivery.rows[0]).toMatchObject({ props: "", style: "无风格", styleSource: "继承项目" });
    expect(episodeDeliveryFilename(delivery)).toBe("测试-项目-分镜.csv");
    expect(deriveEpisodeDelivery({ ...input, project: { ...input.project, defaultStyleId: "absent" } }).rows[0].style).toBe("未知风格(absent)");
  });

  it("scopes and orders rows while resolving asset and beat names", () => {
    const foreignProjectShot = shot("foreign-project", 0);
    foreignProjectShot.projectId = "other-project";
    const delivery = deriveEpisodeDelivery({
      props: [],
      styles: [],
      media,
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
      status: "draft",
      statusLabel: "草稿",
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
      props: [],
      styles: [],
      media,
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
        props: [],
        styles: [],
        media,
        project,
        episode,
        shots: [incomplete],
        characters: [],
        scenes: [],
      }).rows[0].visualMediaId,
    ).toBe("first-frame");
  });

  it("requires valid local media and scene references without changing manual status", () => {
    const row = shot("broken", 0);
    row.status = "approved";
    row.firstFrame.result = { mediaId: "absent", kind: "image" };
    row.clip.result = { mediaId: "first-frame", kind: "image" };
    const input = { project, episode, shots: [row], characters: [], scenes: [], props: [], styles: [], media };
    expect(deriveEpisodeDelivery(input).rows[0]).toMatchObject({
      status: "approved", missing: ["scene", "firstFrame", "clip"], visualMediaId: undefined,
    });
    row.firstFrame.result = { mediaId: "first-frame", kind: "image" };
    row.clip.result = { mediaId: "movie", kind: "video" };
    const withMovie = new Map(media);
    withMovie.set("movie", { id: "movie", projectId: project.id, mimeType: "video/mp4", filename: "movie.mp4", blob: new Blob(["video"]) });
    expect(deriveEpisodeDelivery({ ...input, media: withMovie }).rows[0].missing).toEqual(["scene"]);
    withMovie.set("movie", { ...withMovie.get("movie")!, projectId: "foreign" });
    expect(deriveEpisodeDelivery({ ...input, media: withMovie }).rows[0].missing).toContain("clip");
    withMovie.set("movie", { ...withMovie.get("movie")!, projectId: project.id, blob: new Blob([]) });
    expect(deriveEpisodeDelivery({ ...input, media: withMovie }).rows[0].missing).toContain("clip");
    withMovie.set("movie", { ...withMovie.get("movie")!, mimeType: "image/png", blob: new Blob(["image"]) });
    expect(deriveEpisodeDelivery({ ...input, media: withMovie }).rows[0].missing).toContain("clip");
  });

  it("writes BOM-prefixed RFC 4180 rows and a safe filename", () => {
    const delivery = deriveEpisodeDelivery({
      props: [],
      styles: [],
      media,
      project,
      episode,
      shots: [shot("001", 0)],
      characters: [{ id: "character", name: "阿青" } as never],
      scenes: [{ id: "scene", name: "厨房" } as never],
    });
    const csv = episodeDeliveryCsv(delivery);

    expect(csv.startsWith("\uFEFF顺序,镜号,状态,场次")).toBe(true);
    expect(csv).toContain("草稿");
    expect(csv).toContain('"他说，""你好""\n再见"');
    expect(csv).toContain("\r\n");
    expect(episodeDeliveryFilename(delivery)).toBe("测试-项目-第2集 · 下雨-分镜.csv");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("exports Chinese status labels and defaults missing status to draft", () => {
    const approved = shot("001", 0);
    approved.status = "approved";
    const legacy = shot("002", 1);
    delete (legacy as { status?: string }).status;

    const delivery = deriveEpisodeDelivery({
      props: [],
      styles: [],
      media,
      project,
      episode,
      shots: [approved, legacy],
      characters: [{ id: "character", name: "阿青" } as never],
      scenes: [{ id: "scene", name: "厨房" } as never],
    });
    const csv = episodeDeliveryCsv(delivery);

    expect(delivery.rows.map((row) => row.statusLabel)).toEqual(["通过", "草稿"]);
    expect(csv).toContain("通过");
    expect(csv).toContain("草稿");
  });
});
