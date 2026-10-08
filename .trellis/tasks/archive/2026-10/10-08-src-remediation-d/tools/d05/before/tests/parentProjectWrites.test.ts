import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {addCharacter, addProp, addScene, addStyle} from "@/db/assets";
import {createProject} from "@/db/projects";
import {deleteProject} from "@/db/cascadeCommands";
import {PRODUCTION_TABLES} from "@/db/productionShared";
import {putMedia} from "@/db/media";
import { STUDIO_LIBRARY_ID, type Id, type MediaRecord } from "@/domain/types";

function media(projectId: Id): MediaRecord {
  return {
    id: "prepared-media", projectId, kind: "image", filename: "prepared.png",
    mimeType: "image/png", blob: new Blob(["prepared"], { type: "image/png" }),
    createdAt: "2026-09-30T00:00:00.000Z",
  };
}

const creators = [
  { name: "character", table: db.characters, create: addCharacter },
  { name: "scene", table: db.scenes, create: addScene },
  { name: "prop", table: db.props, create: addProp },
  { name: "style", table: db.styles, create: addStyle },
  { name: "media", table: db.media, create: (id: Id) => putMedia(media(id)) },
];

describe.each(creators)("$name parent project writes", ({ table, create }) => {
  it("rejects a prepared callback that finishes after its project was deleted", async () => {
    const project = await createProject("deleted during preparation");
    let finishPreparation!: () => void;
    const prepared = new Promise<void>((resolve) => { finishPreparation = resolve; });
    const lateWrite = prepared.then(() => create(project.id));
    await deleteProject(project.id);
    finishPreparation();
    await expect(lateWrite).rejects.toThrow("项目不存在");
    expect(await table.count()).toBe(0);
    expect(await db.projects.get(project.id)).toBeUndefined();
  });

  it("rolls back the child if touching the existing parent fails", async () => {
    const project = await createProject("touch failure");
    // Guarantee a real timestamp change so Dexie invokes the updating hook.
    project.updatedAt = "2000-01-01T00:00:00.000Z";
    await db.projects.update(project.id, {updatedAt: project.updatedAt});
    let hookReached = false;
    const fail = () => { hookReached = true; throw new Error("injected parent touch failure"); };
    db.projects.hook("updating", fail);
    try {
      await expect(create(project.id)).rejects.toThrow("injected parent touch failure");
    } finally {
      db.projects.hook("updating").unsubscribe(fail);
    }
    expect(hookReached).toBe(true);
    expect(await table.count()).toBe(0);
    expect(await db.projects.get(project.id)).toEqual(project);
  });

  it("allows studio ownership without creating a project row", async () => {
    await create(STUDIO_LIBRARY_ID);
    expect((await table.toArray())[0]?.projectId).toBe(STUDIO_LIBRARY_ID);
    expect(await db.projects.count()).toBe(0);
  });

  it("holds only the child and projects tables and touches the parent", async () => {
    const project = await createProject("normal parent");
    await db.projects.update(project.id, { updatedAt: "2000-01-01T00:00:00.000Z" });
    const checkTransaction = () => {
      expect(Dexie.currentTransaction?.storeNames.slice().sort()).toEqual([table.name, "projects"].sort());
    };
    table.hook("creating", checkTransaction);
    try {
      await create(project.id);
    } finally {
      table.hook("creating").unsubscribe(checkTransaction);
    }
    expect(await table.count()).toBe(1);
    expect((await db.projects.get(project.id))?.updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
  });
});

it("keeps all five nested writes compatible with a wider Agent transaction and its rollback", async () => {
  const project = await createProject("Agent transaction");
  await expect(db.transaction("rw", PRODUCTION_TABLES, async () => {
    for (const { create } of creators) await create(project.id);
    throw new Error("abort wider Agent transaction");
  })).rejects.toThrow("abort wider Agent transaction");
  for (const { table } of creators) expect(await table.count()).toBe(0);
  expect(await db.projects.get(project.id)).toEqual(project);
  await db.transaction("rw", PRODUCTION_TABLES, async () => {
    for (const { create } of creators) await create(project.id);
  });
  for (const { table } of creators) expect(await table.count()).toBe(1);
});
