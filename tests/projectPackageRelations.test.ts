import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { addCharacter, createProject, putMedia } from "@/db/repo";
import { PACKAGE_FORMAT } from "@/domain/types";
import { exportProjectZip, importProjectZip, PackageError } from "@/lib/projectPackage";

type Raw = Record<string, unknown>;
function modernRecords(): { episodes: Raw[]; shots: Raw[] } {
  return {
    episodes: [
      { id: "first", order: 0, story: { beats: [{ id: "beat-a", title: "A" }] }, unknownEpisode: { retained: true } },
      { id: "second", order: 1, story: { beats: [{ id: "beat-b", title: "B" }] } },
    ],
    shots: [
      { id: "shot-a", episodeId: "first", beatId: "beat-a", unknownShot: ["retained"] },
      { id: "shot-b", episodeId: "second", beatId: "beat-b" },
    ],
  };
}

async function packageBlob(episodes: Raw[] | undefined, shots: Raw[], project: Raw = {}): Promise<Blob> {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({ format: PACKAGE_FORMAT }));
  zip.file("project.json", JSON.stringify({ id: "original", name: "relation test", mode: "series", unknownProject: 42, ...project }));
  if (episodes !== undefined) zip.file("episodes.json", JSON.stringify(episodes));
  zip.file("shots.json", JSON.stringify(shots));
  for (const name of ["characters", "scenes", "props", "styles"]) {
    zip.file(`${name}.json`, JSON.stringify([{ id: name, name }]));
  }
  zip.file("media/unused.png", new Uint8Array([1, 2, 3]));
  return zip.generateAsync({ type: "blob" });
}

async function seedAndSnapshot() {
  const project = await createProject("existing data");
  await addCharacter(project.id);
  await putMedia({ id: "existing-media", projectId: project.id, kind: "image", filename: "existing.png",
    mimeType: "image/png", blob: new Blob(["existing"]), createdAt: project.createdAt });
  return snapshot();
}

async function snapshot() {
  return Promise.all(db.tables.map(async (table) => ({ table: table.name, rows: await table.toArray() })));
}

const invalidCases: { name: string; mutate: (episodes: Raw[], shots: Raw[]) => void }[] = [
  { name: "absent episodeId before parseShot fallback", mutate: (_, shots) => { delete shots[0].episodeId; } },
  { name: "null episodeId before parseShot fallback", mutate: (_, shots) => { shots[0].episodeId = null; } },
  { name: "foreign episodeId", mutate: (_, shots) => { shots[0].episodeId = "outside"; } },
  { name: "empty episodeId", mutate: (_, shots) => { shots[0].episodeId = ""; } },
  { name: "numeric episodeId", mutate: (_, shots) => { shots[0].episodeId = 3; } },
  { name: "beat from another episode", mutate: (_, shots) => { shots[0].beatId = "beat-b"; } },
  { name: "unknown beat", mutate: (_, shots) => { shots[0].beatId = "outside"; } },
  { name: "duplicate episode IDs", mutate: (episodes) => { episodes[1].id = "first"; } },
  { name: "duplicate shot IDs", mutate: (_, shots) => { shots[1].id = "shot-a"; } },
  { name: "duplicate episode IDs after primitive coercion", mutate: (episodes) => { episodes[0].id = 7; episodes[1].id = "7"; } },
  { name: "duplicate shot IDs after primitive coercion", mutate: (_, shots) => { shots[0].id = 7; shots[1].id = "7"; } },
  { name: "duplicate beats within one episode", mutate: (episodes) => { episodes[0].story = { beats: [{ id: "beat-a" }, { id: "beat-a" }] }; } },
  { name: "duplicate explicit beat IDs that parser coercion would merge", mutate: (episodes, shots) => {
    episodes[0].story = { beats: [{ id: 7 }, { id: "7" }] }; delete shots[0].beatId;
  } },
  { name: "synthesized beat ID colliding with an explicit identity", mutate: (episodes, shots) => {
    episodes[0].story = { beats: [{ title: "missing identity" }, { id: "beat_0", title: "explicit identity" }] }; shots[0].beatId = "beat_0";
  } },
  { name: "reference to a beat ID synthesized by normalization", mutate: (episodes, shots) => {
    episodes[0].story = { beats: [{ title: "no original identity" }] }; shots[0].beatId = "beat_0";
  } },
  { name: "reference to a coerced numeric beat ID", mutate: (episodes, shots) => {
    episodes[0].story = { beats: [{ id: 7 }] }; shots[0].beatId = "7";
  } },
];

describe("modern ZIP original episode and beat relationships", () => {
  it.each(invalidCases)("rejects $name without changing any existing table", async ({ mutate }) => {
    const before = await seedAndSnapshot();
    const { episodes, shots } = modernRecords();
    mutate(episodes, shots);
    await expect(importProjectZip(await packageBlob(episodes, shots))).rejects.toBeInstanceOf(PackageError);
    expect(await snapshot()).toEqual(before);
  });

  it("roundtrips valid modern links, episode-scoped equal beat IDs and unknown extra fields", async () => {
    const { episodes, shots } = modernRecords();
    episodes[0].story = { beats: [{ id: "beat-a", title: "A" }, { title: "unreferenced missing identity" }] };
    episodes[1].story = { beats: [{ id: "beat-a", title: "B" }] };
    shots[1].beatId = "beat-a";
    // IDs in separate imported domains do not collide.
    shots[0].id = "first";
    shots.push({ id: "unassigned", episodeId: "first" });
    const imported = await importProjectZip(await packageBlob(episodes, shots));
    for (const project of [imported, await importProjectZip(await exportProjectZip(imported.id))]) {
      const importedEpisodes = await db.episodes.where("projectId").equals(project.id).sortBy("order");
      const importedShots = await db.shots.where("projectId").equals(project.id).toArray();
      expect(importedEpisodes[0].story.beats).toHaveLength(2);
      expect(new Set(importedEpisodes[0].story.beats.map((beat) => beat.id)).size).toBe(2);
      expect(importedEpisodes[0].story.beats[0].id).not.toBe(importedEpisodes[1].story.beats[0].id);
      for (const episode of importedEpisodes) {
        const assigned = importedShots.find((shot) => shot.episodeId === episode.id && shot.beatId);
        expect(assigned?.beatId).toBe(episode.story.beats[0].id);
      }
      expect(importedShots.filter((shot) => !shot.beatId)).toHaveLength(1);
      expect(project.extra?.unknownProject).toBe(42);
      expect(importedEpisodes[0].extra?.unknownEpisode).toEqual({ retained: true });
      expect(importedShots.find((shot) => shot.extra?.unknownShot)?.extra?.unknownShot).toEqual(["retained"]);
    }
  });

  it("rolls back every imported row and media on a storage failure after parent insertion", async () => {
    const before = await seedAndSnapshot();
    const { episodes, shots } = modernRecords();
    const blob = await packageBlob(episodes, shots);
    const fail = () => { throw new Error("injected imported shot failure"); };
    db.shots.hook("creating", fail);
    try {
      await expect(importProjectZip(blob)).rejects.toThrow("injected imported shot failure");
    } finally {
      db.shots.hook("creating").unsubscribe(fail);
    }
    expect(await snapshot()).toEqual(before);
  });
});

it.each([undefined, []])("retains legacy first-episode and synthesized-beat roundtrip for episodes=%j", async (episodes) => {
  const blob = await packageBlob(episodes, [
    { id: "legacy-shot", episodeId: "old-unknown-episode", beatId: "beat_0" },
    { id: "no-episode" },
  ], { story: { beats: [{ title: "legacy beat" }] } });
  const imported = await importProjectZip(blob);
  for (const project of [imported, await importProjectZip(await exportProjectZip(imported.id))]) {
    const importedEpisodes = await db.episodes.where("projectId").equals(project.id).toArray();
    const shots = await db.shots.where("projectId").equals(project.id).toArray();
    expect(importedEpisodes).toHaveLength(1);
    expect(shots).toHaveLength(2);
    expect(shots.every((shot) => shot.episodeId === importedEpisodes[0].id)).toBe(true);
    expect(shots.find((shot) => shot.beatId)?.beatId).toBe(importedEpisodes[0].story.beats[0].id);
    expect(shots.filter((shot) => !shot.beatId)).toHaveLength(1);
  }
});
