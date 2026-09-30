import Dexie, { type Transaction } from "dexie";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  PRODUCTION_TABLES, addEpisode, addShot, createProject, deleteEpisodeShots,
  patchShot, putMedia, restoreShots, setShotSlot,
} from "@/db/repo";
import { emptySlot } from "@/domain/slot";
import type { MediaRecord, Shot } from "@/domain/types";

async function seed(count = 2) {
  const project = await createProject("delete undo");
  const episode = await db.episodes.where("projectId").equals(project.id).first();
  if (!episode) throw new Error("missing fixture episode");
  const shots: Shot[] = [];
  for (let index = 0; index < count; index++) shots.push(await addShot(project.id, episode.id));
  return { project, episode, shots };
}

async function addMedia(projectId: string, id: string, kind: "image" | "video" = "image") {
  const mimeType = kind === "image" ? "image/png" : "video/mp4";
  const media: MediaRecord = { id, projectId, mimeType, filename: id, blob: new Blob([id], { type: mimeType }) };
  await putMedia(media);
  return media;
}

function rootTransaction(transaction: Transaction | undefined) {
  while (transaction?.parent) transaction = transaction.parent;
  return transaction;
}

async function databaseState() {
  return {
    shots: await db.shots.toArray(),
    media: await db.media.toArray(),
    projects: await db.projects.toArray(),
    episodes: await db.episodes.toArray(),
  };
}

describe("episode shot deletion snapshots", () => {
  it("restores the latest committed text, all slot references and Blob results after a stale render", async () => {
    const { project, episode, shots } = await seed(1);
    const old = await addMedia(project.id, "old result");
    await setShotSlot(shots[0].id, "firstFrame", { ...emptySlot(), result: { mediaId: old.id, kind: "image" } });
    const rendered = (await db.shots.get(shots[0].id))!;
    const media = await Promise.all([
      addMedia(project.id, "image reference"), addMedia(project.id, "video reference", "video"),
      addMedia(project.id, "new first"), addMedia(project.id, "new last"), addMedia(project.id, "new clip", "video"),
    ]);
    await patchShot(rendered.id, { content: "latest content", notes: "latest notes" });
    await setShotSlot(rendered.id, "firstFrame", {
      prompt: "latest first", referenceImageIds: [media[0].id], referenceVideoIds: [media[1].id],
      result: { mediaId: media[2].id, kind: "image" },
    });
    await setShotSlot(rendered.id, "lastFrame", {
      ...emptySlot(), prompt: "latest last", referenceImageIds: [media[0].id], result: { mediaId: media[3].id, kind: "image" },
    });
    await setShotSlot(rendered.id, "clip", {
      ...emptySlot(), prompt: "latest clip", referenceVideoIds: [media[1].id], result: { mediaId: media[4].id, kind: "video" },
    });
    const committed = (await db.shots.get(rendered.id))!;
    expect(rendered.content).not.toBe(committed.content);
    expect(rendered.firstFrame).not.toEqual(committed.firstFrame);

    const snapshot = await deleteEpisodeShots(episode.id, [rendered.id]);
    expect(snapshot).toMatchObject({ projectId: project.id, episodeId: episode.id, shots: [committed] });
    if (!snapshot) throw new Error("missing deletion snapshot");
    expect(snapshot.media.map((record) => record.id).sort()).toEqual(media.map((record) => record.id).sort());
    for (const record of snapshot.media) {
      expect(record.blob).toBeInstanceOf(Blob);
      expect(await record.blob.text()).toBe(record.id);
    }
    expect(await db.shots.get(rendered.id)).toBeUndefined();
    expect(await db.media.toArray()).toEqual([]);
    await restoreShots(snapshot.shots, snapshot.media);
    expect(await db.shots.get(rendered.id)).toEqual(committed);
    for (const record of media) {
      const restored = (await db.media.get(record.id))!;
      expect(restored).toMatchObject({ projectId: project.id, filename: record.filename, mimeType: record.mimeType });
      expect(await restored.blob.text()).toBe(record.id);
    }
    expect(await db.media.get(old.id)).toBeUndefined();
  });

  it("captures media under the same production transaction that deletes the shot", async () => {
    const { project, episode, shots } = await seed(1);
    const media = await addMedia(project.id, "transaction result");
    await setShotSlot(shots[0].id, "firstFrame", { ...emptySlot(), result: { mediaId: media.id, kind: "image" } });
    const readTransactions: Array<Transaction | undefined> = [];
    let deleteTransaction: Transaction | undefined;
    const onRead = (record: MediaRecord | undefined) => {
      if (record?.id === media.id) readTransactions.push(rootTransaction(Dexie.currentTransaction));
      return record;
    };
    const onDelete = () => { deleteTransaction = rootTransaction(Dexie.currentTransaction); };
    db.media.hook("reading", onRead);
    db.shots.hook("deleting", onDelete);
    try {
      const snapshot = await deleteEpisodeShots(episode.id, [shots[0].id]);
      expect(snapshot?.media.map((record) => record.id)).toEqual([media.id]);
    } finally {
      db.media.hook("reading").unsubscribe(onRead);
      db.shots.hook("deleting").unsubscribe(onDelete);
    }
    expect(deleteTransaction).toBeDefined();
    expect(deleteTransaction?.mode).toBe("readwrite");
    expect(deleteTransaction?.storeNames).toEqual(expect.arrayContaining(PRODUCTION_TABLES.map((table) => table.name)));
    expect(readTransactions.length).toBeGreaterThan(0);
    for (const transaction of readTransactions) expect(transaction).toBe(deleteTransaction);
  });

  it("snapshots shared media even while retained, then recovers it after deleting the final references", async () => {
    const { project, episode, shots } = await seed();
    const media = await addMedia(project.id, "shared result");
    const shared = { ...emptySlot(), result: { mediaId: media.id, kind: "image" as const } };
    for (const shot of shots) await setShotSlot(shot.id, "firstFrame", shared);
    const first = await deleteEpisodeShots(episode.id, [shots[0].id]);
    if (!first) throw new Error("missing partial deletion snapshot");
    expect(first.media.map((record) => record.id)).toEqual([media.id]);
    expect(await db.media.get(media.id)).toBeDefined();
    expect((await db.shots.get(shots[1].id))?.firstFrame).toEqual(shared);
    await restoreShots(first.shots, first.media);
    const both = await deleteEpisodeShots(episode.id, shots.map((shot) => shot.id));
    if (!both) throw new Error("missing full deletion snapshot");
    expect(both.media.map((record) => record.id)).toEqual([media.id]);
    expect(await db.media.get(media.id)).toBeUndefined();
    await restoreShots(both.shots, both.media);
    expect((await db.media.get(media.id))?.blob).toBeInstanceOf(Blob);
    expect(await (await db.media.get(media.id))!.blob.text()).toBe(media.id);
    for (const shot of shots) expect((await db.shots.get(shot.id))?.firstFrame).toEqual(shared);
  });

  it("restores multiple deleted shots to their original positions regardless of selection order", async () => {
    const { episode, shots } = await seed(5);
    const snapshot = await deleteEpisodeShots(episode.id, [shots[3].id, shots[1].id]);
    if (!snapshot) throw new Error("missing deletion snapshot");
    expect(snapshot.shots.map((shot) => shot.id)).toEqual([shots[3].id, shots[1].id]);
    const remaining = await db.shots.where("episodeId").equals(episode.id).sortBy("order");
    expect(remaining.map((shot) => shot.id)).toEqual([shots[0].id, shots[2].id, shots[4].id]);
    expect(remaining.map((shot) => shot.order)).toEqual([1, 2, 3]);
    await restoreShots(snapshot.shots, snapshot.media);
    expect(await db.shots.where("episodeId").equals(episode.id).sortBy("order")).toEqual(shots);
  });

  it("returns undefined for an empty selection without validating or changing the scope", async () => {
    const { episode } = await seed();
    const before = await databaseState();
    await expect(deleteEpisodeShots(episode.id, [])).resolves.toBeUndefined();
    await expect(deleteEpisodeShots("missing episode", [])).resolves.toBeUndefined();
    expect(await databaseState()).toEqual(before);
  });

  it.each(["missing shot", "foreign episode", "foreign project", "wrong owner", "duplicate", "missing episode"] as const)(
    "rejects %s targets before any partial deletion, reindex or cleanup",
    async (invalid) => {
      const { project, episode, shots } = await seed();
      const media = await addMedia(project.id, "protected result");
      await setShotSlot(shots[0].id, "firstFrame", { ...emptySlot(), result: { mediaId: media.id, kind: "image" } });
      let episodeId = episode.id;
      let ids = shots.map((shot) => shot.id);
      if (invalid === "missing shot") ids[1] = "missing";
      if (invalid === "foreign episode") {
        const other = await addEpisode(project.id);
        ids[1] = (await addShot(project.id, other.id)).id;
      }
      if (invalid === "foreign project" || invalid === "wrong owner") {
        const other = await createProject("foreign");
        const otherEpisode = (await db.episodes.where("projectId").equals(other.id).first())!;
        if (invalid === "foreign project") ids[1] = (await addShot(other.id, otherEpisode.id)).id;
        else await db.shots.update(ids[1], { projectId: other.id });
      }
      if (invalid === "duplicate") ids = [shots[0].id, shots[0].id];
      if (invalid === "missing episode") episodeId = "missing episode";
      const before = await databaseState();
      await expect(deleteEpisodeShots(episodeId, ids)).rejects.toThrow();
      expect(await databaseState()).toEqual(before);
    },
  );

  it.each(["second delete", "reindex", "project touch", "media cleanup"] as const)(
    "returns no successful snapshot and rolls back every change on %s failure",
    async (failure) => {
      const { project, episode, shots } = await seed(3);
      const media = await addMedia(project.id, "rollback result");
      await setShotSlot(shots[0].id, "firstFrame", { ...emptySlot(), result: { mediaId: media.id, kind: "image" } });
      const before = await databaseState();
      const failDelete = (key: unknown) => { if (key === shots[1].id) throw new Error("delete storage failure"); };
      const failWrite = () => { throw new Error("delete storage failure"); };
      if (failure === "second delete") db.shots.hook("deleting", failDelete);
      if (failure === "reindex") db.shots.hook("updating", failWrite);
      if (failure === "project touch") db.projects.hook("updating", failWrite);
      if (failure === "media cleanup") db.media.hook("deleting", failWrite);
      let resolved = false;
      try {
        await expect(deleteEpisodeShots(episode.id, [shots[0].id, shots[1].id]).then((snapshot) => {
          resolved = true;
          return snapshot;
        })).rejects.toThrow("delete storage failure");
      } finally {
        db.shots.hook("deleting").unsubscribe(failDelete);
        db.shots.hook("updating").unsubscribe(failWrite);
        db.projects.hook("updating").unsubscribe(failWrite);
        db.media.hook("deleting").unsubscribe(failWrite);
      }
      expect(resolved).toBe(false);
      expect(await databaseState()).toEqual(before);
      const snapshot = await deleteEpisodeShots(episode.id, [shots[0].id, shots[1].id]);
      expect(snapshot).toMatchObject({ projectId: project.id, episodeId: episode.id });
    },
  );

  it("keeps the existing ID conflict guard and rolls back media restoration when undo is rejected", async () => {
    const { project, episode, shots } = await seed(1);
    const media = await addMedia(project.id, "conflicting undo result");
    await setShotSlot(shots[0].id, "firstFrame", { ...emptySlot(), result: { mediaId: media.id, kind: "image" } });
    const snapshot = await deleteEpisodeShots(episode.id, [shots[0].id]);
    if (!snapshot) throw new Error("missing deletion snapshot");
    await db.shots.add({ ...shots[0], content: "new row owns this ID" });
    const before = await databaseState();
    await expect(restoreShots(snapshot.shots, snapshot.media)).rejects.toThrow("镜头已存在");
    expect(await databaseState()).toEqual(before);
    expect(await db.media.get(media.id)).toBeUndefined();
  });
});
