import Dexie from "dexie";
import { db } from "@/db/database";
import { createProject } from "@/db/projects";
import {
  createProjectMemory, deleteProjectMemory, MemoryConflictError,
  replaceProjectMemory, setProjectMemoryStatus, updateProjectMemory,
} from "@/db/projectMemories";
import type { MemoryInput, ProjectMemory, ProjectMemoryVersion } from "@/domain/projectMemory";
import type { Project } from "@/domain/types";

const input: MemoryInput = {
  category: "convention", title: "Memory", topicKey: "visual",
  body: "Warm palette", applicability: "Flashback scenes", tags: ["visual"],
};
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function seed() {
  const project = await createProject("Native memory transactions");
  const old = (await createProjectMemory(project.id, input)).memory;
  const next = (await createProjectMemory(project.id, {...input, topicKey: "other", body: "Cool palette"})).memory;
  return {project, old, next};
}
async function snapshot() {
  return JSON.stringify({projects: await db.projects.toArray(), memories: await db.projectMemories.toArray(), versions: await db.projectMemoryVersions.toArray()});
}
async function rejected(run: () => Promise<unknown>, text: string) {
  try { await run(); }
  catch (error) {check(error instanceof Error && error.message.includes(text), `Unexpected rejection: ${String(error)}`); return error.message;}
  throw new Error(`Expected rejection: ${text}`);
}
async function reset() { await db.delete(); await db.open(); }

async function scopes() {
  await reset();
  const s = await seed();
  const observations: {command: string; storeNames: string[]; mode: string}[] = [];
  let command = "";
  const observe = (row: Project) => {
    const tx = Dexie.currentTransaction;
    check(tx, "No active memory transaction");
    observations.push({command, storeNames: Array.from(tx.idbtrans.objectStoreNames).sort(), mode: tx.idbtrans.mode});
    return row;
  };
  db.projects.hook("reading", observe);
  try {
    command = "createProjectMemory";
    const third = (await createProjectMemory(s.project.id, {...input, topicKey: "third", body: "Third palette"})).memory;
    command = "updateProjectMemory";
    await updateProjectMemory(s.project.id, s.old.id, {...input, body: "Revised"}, 1);
    command = "setProjectMemoryStatus";
    await setProjectMemoryStatus(s.project.id, s.old.id, "disabled", 2);
    command = "replaceProjectMemory";
    await replaceProjectMemory(s.project.id, s.old.id, s.next.id, {oldRevision: 3, newRevision: 1});
    command = "deleteProjectMemory";
    await deleteProjectMemory(s.project.id, third.id, 1);
  } finally { db.projects.hook("reading").unsubscribe(observe); }
  const versions = await db.projectMemoryVersions.toArray();
  check((await db.projectMemories.get(s.old.id))?.status === "superseded", "Old memory must be superseded");
  check(versions.filter(row => row.memoryId === s.old.id).length === 4, "Complete old history");
  check(versions.filter(row => row.memoryId === s.next.id).length === 2, "Complete replacement history");
  return {observations, totalStores: db.tables.length, finalVersions: versions.length};
}

async function rollback() {
  await reset();
  const s = await seed(), before = await snapshot();
  const add = db.projectMemoryVersions.add.bind(db.projectMemoryVersions);
  let actualHistoryInsertions = 0;
  db.projectMemoryVersions.add = (row: ProjectMemoryVersion) => Dexie.Promise.resolve().then(async () => {
    const key = await add(row);
    check((await db.projectMemories.get(row.memoryId))?.revision === 2, "Actual revision write before fault");
    check(!!await db.projectMemoryVersions.get(key), "Actual history insertion before fault");
    actualHistoryInsertions++;
    throw new Error("native fault after history insertion");
  });
  let historyFailure: string;
  try { historyFailure = await rejected(() => updateProjectMemory(s.project.id, s.old.id, {...input, body: "Fault revision"}, 1), "native fault after history"); }
  finally { db.projectMemoryVersions.add = add; }
  check(await snapshot() === before, "History failure must roll back all rows");
  const put = db.projectMemories.put.bind(db.projectMemories);
  let laterFailures = 0;
  db.projectMemories.put = (row: ProjectMemory) => Dexie.Promise.resolve().then(async () => {
    if (row.id !== s.old.id) {
      const old = await db.projectMemories.get(s.old.id);
      check(old?.status === "superseded" && old.supersededBy === row.id, "Actual old-row replacement before later fault");
      const history = await db.projectMemoryVersions.where("memoryId").equals(s.old.id).toArray();
      check(history.some(version => version.revision === 2 && version.snapshot.supersededBy === row.id), "Actual old history before later fault");
      laterFailures++;
      throw new Error("native later replacement fault");
    }
    return put(row);
  });
  const replacementFailures: string[] = [];
  try {
    replacementFailures.push(await rejected(() => createProjectMemory(s.project.id, {...input, body: "New replacement"}, {replace: {id: s.old.id, expectedRevision: 1}}), "native later replacement fault"));
    check(await snapshot() === before, "Creation replacement must roll back");
    replacementFailures.push(await rejected(() => replaceProjectMemory(s.project.id, s.old.id, s.next.id, {oldRevision: 1, newRevision: 1}), "native later replacement fault"));
    check(await snapshot() === before, "Existing replacement must roll back");
  } finally { db.projectMemories.put = put; }
  const retry = await updateProjectMemory(s.project.id, s.old.id, {...input, body: "Successful retry"}, 1);
  check(retry.revision === 2, "Retry uses original unchanged CAS");
  return {actualHistoryInsertions, laterFailures, historyFailure, replacementFailures, retryRevision: retry.revision};
}

async function guards() {
  await reset();
  const s = await seed(), foreign = await createProject("Foreign owner");
  const foreignMemory = (await createProjectMemory(foreign.id, input)).memory;
  const before = await snapshot(), rejections: string[] = [];
  rejections.push(await rejected(() => updateProjectMemory(s.project.id, s.old.id, input, 0), "已更新"));
  rejections.push(await rejected(() => deleteProjectMemory(foreign.id, s.old.id, 1), "不属于"));
  rejections.push(await rejected(() => replaceProjectMemory(s.project.id, s.old.id, foreignMemory.id, {oldRevision: 1, newRevision: 1}), "不属于"));
  const conflict = await rejected(() => createProjectMemory(s.project.id, {...input, topicKey: " ＶＩＳＵＡＬ ", body: "Conflict"}), "同主题");
  check(conflict === new MemoryConflictError([s.old.id]).message, "Normalized conflict");
  check(await snapshot() === before, "Protected rejections preserve all rows");
  await setProjectMemoryStatus(s.project.id, s.old.id, "disabled", 1);
  const disabled = await snapshot();
  const duplicate = await createProjectMemory(s.project.id, {...input, body: " Ｗａｒｍ   palette ", applicability: "Flashback   scenes"});
  check(duplicate.duplicate && duplicate.memory.id === s.old.id && duplicate.memory.status === "disabled", "Normalized duplicate cannot reactivate");
  check(await snapshot() === disabled, "Duplicate cannot append history");
  return {rejections, conflict, duplicate: {idMatched: duplicate.memory.id === s.old.id, status: duplicate.memory.status}, unchangedSnapshots: 2};
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}
let scheduling: {
  events: string[]; held: boolean; released: boolean; unrelatedCompleted: boolean;
  secondHistoryWrites: number; completed?: {firstRevision: number; secondError: string; finalRevision: number; historyRevisions: number[]};
  release: () => void; done: Promise<void>;
} | undefined;
async function beginScheduling() {
  await reset();
  const s = await seed(), gate = deferred(), entered = deferred(), events: string[] = [];
  const add = db.projectMemoryVersions.add.bind(db.projectMemoryVersions);
  let writes = 0;
  const state = {
    events, held: false, released: false, unrelatedCompleted: false, secondHistoryWrites: 0,
    completed: undefined as {firstRevision: number; secondError: string; finalRevision: number; historyRevisions: number[]} | undefined,
    release: () => {state.released = true; events.push("release-requested"); gate.resolve();},
    done: Promise.resolve(),
  };
  scheduling = state;
  db.projectMemoryVersions.add = (row: ProjectMemoryVersion) => Dexie.Promise.resolve().then(async () => {
    const key = await add(row);
    writes++;
    if (writes === 1) {
      events.push("first-history-inserted"); state.held = true; entered.resolve();
      // Only this test seam keeps the real transaction alive until the runner releases it.
      await Dexie.waitFor(gate.promise, 15000);
      events.push("first-resumed");
    } else { state.secondHistoryWrites++; }
    return key;
  });
  const first = updateProjectMemory(s.project.id, s.old.id, {...input, body: "First concurrent edit"}, 1);
  // Attach rejection immediately so faults cannot become unhandled browser rejections.
  const firstResult = first.then(row => ({row}), error => ({error: String(error)}));
  await entered.promise;
  events.push("second-command-submitted");
  // These are independent command invocations, never child transactions of the held writer.
  const second = Dexie.ignoreTransaction(() => updateProjectMemory(s.project.id, s.old.id, {...input, body: "Stale competing edit"}, 1));
  const secondResult = second.then(() => "unexpected success", error => {events.push("second-cas-rejected"); return String(error);});
  const unrelated = Dexie.ignoreTransaction(() => db.transaction("rw", db.media, async () => {
    await db.media.put({id: "e04-unrelated", projectId: s.project.id, mimeType: "text/plain", filename: "fixture.txt", blob: new Blob(["unrelated"])});
    events.push("unrelated-media-written"); state.unrelatedCompleted = true;
  }));
  state.done = Dexie.ignoreTransaction(async () => {
    try {
      const [firstOutcome, secondError] = await Promise.all([firstResult, secondResult, unrelated]);
      check("row" in firstOutcome && firstOutcome.row, `First update failed: ${JSON.stringify(firstOutcome)}`);
      check(secondError.includes("已更新"), "Same-owner competitor must reject stale CAS");
      const final = await db.projectMemories.get(s.old.id);
      check(final?.body === "First concurrent edit" && final.revision === 2, "First commit retained");
      const history = await db.projectMemoryVersions.where("memoryId").equals(s.old.id).toArray();
      check(history.length === 2 && state.secondHistoryWrites === 0, "Serialized competitor wrote no history");
      state.completed = {firstRevision: firstOutcome.row.revision, secondError, finalRevision: final.revision, historyRevisions: history.map(row => row.revision).sort()};
    } finally { db.projectMemoryVersions.add = add; }
  });
  // The external bridge awaits done; attach an immediate observer during the held phase.
  void state.done.catch(error => {events.push(`failure:${String(error)}`);});
  return {held: state.held, storeNames: Array.from(db.tables, table => table.name).sort()};
}
function schedulingState() {
  check(scheduling, "No scheduling scenario");
  const {events, held, released, unrelatedCompleted, secondHistoryWrites, completed} = scheduling;
  return {events: [...events], held, released, unrelatedCompleted, secondHistoryWrites, completed};
}
async function finishScheduling() {
  check(scheduling, "No scheduling scenario");
  scheduling.release(); await scheduling.done;
  return schedulingState();
}

window.e04Memory = {scopes, rollback, guards, beginScheduling, schedulingState, finishScheduling};
declare global { interface Window { e04Memory: {scopes: typeof scopes; rollback: typeof rollback; guards: typeof guards; beginScheduling: typeof beginScheduling; schedulingState: typeof schedulingState; finishScheduling: typeof finishScheduling}; } }
document.querySelector("#state")!.textContent = "Actual repository commands ready";
