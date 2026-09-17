import Dexie, { type Table } from "dexie";
import type {
  Character,
  Episode,
  MediaRecord,
  Project,
  Prop,
  Scene,
  Shot,
  VisualStyle,
} from "@/domain/types";
import { DEFAULT_VISIBLE_COLUMNS, normalizeEpisodeStory, normalizeSeriesStory } from "@/domain/types";
import { parseShotPictureSlots } from "@/domain/slot";
import { createId, nowIso } from "@/lib/ids";

export class AifenjingDB extends Dexie {
  projects!: Table<Project, string>;
  characters!: Table<Character, string>;
  scenes!: Table<Scene, string>;
  props!: Table<Prop, string>;
  styles!: Table<VisualStyle, string>;
  episodes!: Table<Episode, string>;
  shots!: Table<Shot, string>;
  media!: Table<MediaRecord, string>;

  constructor() {
    super("aifenjing");
    this.version(1).stores({
      projects: "id, updatedAt",
      characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt",
      shots: "id, projectId, order",
      media: "id, projectId",
    });
    this.version(2).stores({
      projects: "id, updatedAt",
      characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt",
      props: "id, projectId, updatedAt",
      styles: "id, projectId, updatedAt",
      shots: "id, projectId, order",
      media: "id, projectId",
    });
    this.version(3)
      .stores({
        projects: "id, updatedAt",
        characters: "id, projectId, updatedAt",
        scenes: "id, projectId, updatedAt",
        props: "id, projectId, updatedAt",
        styles: "id, projectId, updatedAt",
        episodes: "id, projectId, order, updatedAt",
        shots: "id, projectId, episodeId, order",
        media: "id, projectId",
      })
      .upgrade(async (tx) => {
        const projects = await tx.table("projects").toArray();
        const episodesTable = tx.table("episodes");
        const shotsTable = tx.table("shots");
        const at = nowIso();

        for (const project of projects) {
          const existing = await episodesTable.where("projectId").equals(project.id).count();
          if (existing > 0) continue;

          const rawStory =
            project.story && typeof project.story === "object"
              ? (project.story as Record<string, unknown>)
              : {};
          const episodeStory = normalizeEpisodeStory(rawStory);
          const episodeId = createId("ep");
          await episodesTable.add({
            id: episodeId,
            projectId: project.id,
            order: 0,
            title: "",
            story: episodeStory,
            createdAt: String(project.createdAt ?? at),
            updatedAt: at,
          });
          await tx.table("projects").put({
            ...project,
            story: normalizeSeriesStory(rawStory),
            columnSettings: { visible: [...DEFAULT_VISIBLE_COLUMNS] },
          });

          const shots = await shotsTable.where("projectId").equals(project.id).toArray();
          for (const shot of shots) {
            const record = { ...(shot as Record<string, unknown>) };
            const slots = parseShotPictureSlots(record);
            delete record.frame;
            delete record.reference;
            delete record.frameMediaId;
            delete record.referenceMediaId;
            await shotsTable.put({
              ...record,
              episodeId: String(record.episodeId ?? episodeId),
              ...slots,
            });
          }
        }
      });
  }
}

export const db = new AifenjingDB();
