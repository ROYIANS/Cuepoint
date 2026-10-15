import {actualStoreScope,interceptStoreBackend} from "./helpers/storeBackendFaults";
import {interceptStoreTable} from "./helpers/storeFaults";
import { describe, expect, it } from "vitest";
import { db } from "@/platform/product/store";
import { createProject } from "@/features/projects/commands/projects";
import {
  createProjectMemory, deleteProjectMemory, MemoryConflictError,
  replaceProjectMemory, setProjectMemoryStatus, updateProjectMemory,
} from "@/features/memory/commands/projectMemories";
import type {ProjectMemory,ProjectMemoryVersion} from "@/features/memory/models/projectMemory";
import type { MemoryInput } from "@/features/memory/models/projectMemory";

const input: MemoryInput = {
  category: "convention", title: "Memory", topicKey: "visual",
  body: "Warm palette", applicability: "Flashback scenes", tags: ["visual"],
};
const stores = ["projectMemories", "projectMemoryVersions", "projects"];
const commands = ["create", "update", "status", "replace", "delete"] as const;
async function seed() {
  const project = await createProject("Memory transactions");
  const old = (await createProjectMemory(project.id, input)).memory;
  const next = (await createProjectMemory(project.id, {...input, topicKey: "other", body: "Cool palette"})).memory;
  return {project, old, next};
}
async function snapshot() {
  return {
    projects: await db.projects.toArray(),
    memories: await db.projectMemories.toArray(),
    versions: await db.projectMemoryVersions.toArray(),
  };
}
async function run(name: typeof commands[number], s: Awaited<ReturnType<typeof seed>>, owner = s.project.id, revision = 1) {
  switch (name) {
    case "create": return createProjectMemory(owner, {...input, body: "Replacement"}, {replace: {id: s.old.id, expectedRevision: revision}});
    case "update": return updateProjectMemory(owner, s.old.id, {...input, body: "Revised"}, revision);
    case "status": return setProjectMemoryStatus(owner, s.old.id, "disabled", revision);
    case "replace": return replaceProjectMemory(owner, s.old.id, s.next.id, {oldRevision: revision, newRevision: 1});
    case "delete": return deleteProjectMemory(owner, s.old.id, revision);
  }
}

describe("E04 manual memory transaction closure", () => {
  it.each(commands)("%s uses exactly three actual IndexedDB stores", async name => {
    const s = await seed(), seen: string[][] = [];
    const spy=await interceptStoreBackend(db,"projects","get",async (backend,_args,next)=> {
      const actual=await actualStoreScope(db,backend);expect(actual.mode).toBe("readwrite");seen.push(actual.names);return next();
    });
    try { await run(name,s); } finally {spy.mockRestore();}
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(names => JSON.stringify(names) === JSON.stringify(stores))).toBe(true);
    if (name === "delete") {
      expect(await db.projectMemories.get(s.old.id)).toBeUndefined();
      expect(await db.projectMemoryVersions.where("memoryId").equals(s.old.id).count()).toBe(0);
      expect(await db.projectMemoryVersions.where("memoryId").equals(s.next.id).count()).toBe(1);
    } else if (name === "replace" || name === "create") {
      const old = await db.projectMemories.get(s.old.id);
      expect(old?.status).toBe("superseded");
      expect(old?.revision).toBe(2);
      expect(await db.projectMemoryVersions.where("memoryId").equals(s.old.id).count()).toBe(2);
    } else {
      const row = await db.projectMemories.get(s.old.id);
      expect(row?.revision).toBe(2);
      expect((await db.projectMemoryVersions.where("memoryId").equals(s.old.id).toArray()).find(version => version.revision === 2)?.snapshot).toEqual(row);
    }
  });

  it.each(commands)("%s rejects stale CAS without changing rows or history", async name => {
    const s = await seed(), before = await snapshot();
    await expect(run(name, s, s.project.id, 0)).rejects.toThrow("已更新");
    expect(await snapshot()).toEqual(before);
  });
  it.each(commands)("%s rejects a foreign owner without changing rows or history", async name => {
    const s = await seed(), foreign = await createProject("Foreign"), before = await snapshot();
    await expect(run(name, s, foreign.id)).rejects.toThrow("不属于");
    expect(await snapshot()).toEqual(before);
  });
  it.each(commands)("%s rejects missing/studio owners", async name => {
    const s = await seed(), before = await snapshot();
    for (const owner of ["missing", "studio"]) await expect(run(name, s, owner)).rejects.toThrow("项目不存在");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["create", "update", "status"] as const)("%s rolls back after a real history insertion", async name => {
    const s = await seed(), before = await snapshot();
    let observed = false;
    const spy=interceptStoreTable(db,"projectMemoryVersions","add",async (tx,args,next)=> {
      const [row]=args as [ProjectMemoryVersion];
      const key = await next() as string;
      observed = true;
      expect(await tx.projectMemories.get(row.memoryId)).toEqual(row.snapshot);
      expect(await tx.projectMemoryVersions.get(key)).toEqual({...row, versionId: key});
      throw new Error("fault after actual history insertion");
    });
    try { await expect(run(name, s)).rejects.toThrow("fault after actual history"); }
    finally { spy.mockRestore(); }
    expect(observed).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it.each(["create", "replace"] as const)("%s rolls back the superseded row/history when later replacement persistence fails", async name => {
    const s = await seed(), before = await snapshot();
    let observed = false;
    const spy=interceptStoreTable(db,"projectMemories","put",async (tx,args,next)=> {
      const [row]=args as [ProjectMemory];
      if (row.id !== s.old.id) {
        const old = await tx.projectMemories.get(s.old.id);
        expect(old?.status).toBe("superseded");
        expect(old?.supersededBy).toBe(row.id);
        const history = await tx.projectMemoryVersions.where("memoryId").equals(s.old.id).toArray();
        expect(history).toHaveLength(2);
        expect(history.find(version => version.revision === 2)?.snapshot).toEqual(old);
        observed = true;
        throw new Error("fault at later replacement put");
      }
      return next();
    });
    try { await expect(run(name, s)).rejects.toThrow("fault at later replacement"); }
    finally { spy.mockRestore(); }
    expect(observed).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it("delete rolls back the actual current-row deletion on a later history delete fault", async () => {
    const s = await seed(), before = await snapshot();
    let observed = false;
    const current=interceptStoreTable(db,"projectMemories","delete",async (tx,args,next)=> {
      await next();expect(await tx.projectMemories.get(args[0] as string)).toBeUndefined();observed=true;
    });
    const history=await interceptStoreBackend(db,"projectMemoryVersions","mutate",async (_backend,args,next)=> {
      if ((args[0] as {kind:string}).kind === "delete") {expect(observed).toBe(true);throw new Error("history deletion fault");}return next();
    });
    try { await expect(run("delete",s)).rejects.toThrow("history deletion fault"); }
    finally {current.mockRestore();history.mockRestore();}
    expect(observed).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it("normalized concurrent duplicates preserve a disabled reviewed row", async () => {
    const s = await seed();
    await setProjectMemoryStatus(s.project.id, s.old.id, "disabled", 1);
    const before = await snapshot();
    const rows = await Promise.all([input, {...input, body: " Ｗａｒｍ   palette ", applicability: "Flashback   scenes"}].map(value => createProjectMemory(s.project.id, value)));
    expect(rows.every(result => result.duplicate && result.memory.id === s.old.id && result.memory.status === "disabled")).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it("normalized same-topic conflicts and activation conflicts preserve current/history", async () => {
    const s = await seed();
    const before = await snapshot();
    await expect(createProjectMemory(s.project.id, {...input, topicKey: " ＶＩＳＵＡＬ ", body: "Different"})).rejects.toBeInstanceOf(MemoryConflictError);
    await expect(updateProjectMemory(s.project.id, s.next.id, {...input, topicKey: " ＶＩＳＵＡＬ ", body: "Different"}, 1)).rejects.toBeInstanceOf(MemoryConflictError);
    expect(await snapshot()).toEqual(before);
    await setProjectMemoryStatus(s.project.id, s.old.id, "disabled", 1);
    await createProjectMemory(s.project.id, {...input, body: "Different"});
    const disabled = await snapshot();
    await expect(setProjectMemoryStatus(s.project.id, s.old.id, "active", 2)).rejects.toBeInstanceOf(MemoryConflictError);
    expect(await snapshot()).toEqual(disabled);
  });

  it("replacement compares both revisions, both owners and unrelated normalized conflicts", async () => {
    const s = await seed(), foreign = await createProject("Foreign");
    const foreignRow = (await createProjectMemory(foreign.id, input)).memory;
    const before = await snapshot();
    await expect(replaceProjectMemory(s.project.id, s.old.id, s.next.id, {oldRevision: 1, newRevision: 0})).rejects.toThrow("已更新");
    await expect(replaceProjectMemory(s.project.id, s.old.id, foreignRow.id, {oldRevision: 1, newRevision: 1})).rejects.toThrow("不属于");
    await expect(replaceProjectMemory(s.project.id, s.old.id, s.old.id, {oldRevision: 1, newRevision: 1})).rejects.toThrow("自身");
    expect(await snapshot()).toEqual(before);
    await setProjectMemoryStatus(s.project.id, s.next.id, "disabled", 1);
    await createProjectMemory(s.project.id, {...input, topicKey: " ＯＴＨＥＲ ", body: "Third active rule"});
    const conflicting = await snapshot();
    await expect(replaceProjectMemory(s.project.id, s.old.id, s.next.id, {oldRevision: 1, newRevision: 2})).rejects.toBeInstanceOf(MemoryConflictError);
    expect(await snapshot()).toEqual(conflicting);
  });

  it("manual child commands still join a broad outer atomic transaction and roll back", async () => {
    const s = await seed(), before = await snapshot();
    await expect(db.transaction("rw", db.tables, async db => {
      await updateProjectMemory(s.project.id, s.old.id, {...input, body: "Nested write"}, 1, db);
      await setProjectMemoryStatus(s.project.id, s.next.id, "disabled", 1, db);
      expect((await db.projectMemories.get(s.old.id))?.body).toBe("Nested write");
      throw new Error("outer evidence failure");
    })).rejects.toThrow("outer evidence failure");
    expect(await snapshot()).toEqual(before);
  });
});
