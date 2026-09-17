import Dexie, { type Table } from "dexie";
import type {
  Character,
  MediaRecord,
  Project,
  Scene,
  Shot,
} from "@/domain/types";

export class AifenjingDB extends Dexie {
  projects!: Table<Project, string>;
  characters!: Table<Character, string>;
  scenes!: Table<Scene, string>;
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
  }
}

export const db = new AifenjingDB();
