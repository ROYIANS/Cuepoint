import Dexie from "dexie";
import {db} from "@/db/database";
import {createProject, patchProjectOutput} from "@/db/projects";
import {addShot, deleteShots, deleteEpisodeShots, restoreShots, setShotSlot} from "@/db/shots";
import {addEpisode, deleteEpisode, restoreEpisode, addStoryBeat} from "@/db/episodes";
import {addCharacter, addScene, addProp, addStyle, deleteCharacter, deleteScene, deleteProp, deleteStyle, setCharacterSlot, setSceneSlot, setPropSlot, setStyleSlot} from "@/db/assets";
import {createChatThread} from "@/db/chat";
import {deleteChatThread} from "@/db/cascadeCommands";
import {releaseMaterialUse} from "@/db/assetReuse";
import {promoteLegacyMaterial, adoptMaterialInProject} from "@/db/materials";
import {removeProjectReference} from "@/db/references";
import {emptySlot} from "@/domain/slot";
import {check, media, slot, job, batch, item, at, currentSources, retentionSources, type RetentionSource} from "./seeds";
import {observe} from "./instrumentation";
import {PRODUCTION_TABLES} from "@/db/productionShared";

async function normalize(value: unknown): Promise<unknown> {
    if (value instanceof Blob) return {type: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer()))};
    if (Array.isArray(value)) return Promise.all(value.map(normalize));
    if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await normalize(item)])));
    return value;
}
export async function snapshot() {
    const rows: Record<string, unknown> = {};
    for (const table of db.tables) rows[table.name] = await normalize(await table.toArray());
    return JSON.stringify(rows);
}
export async function rejects(action: () => Promise<unknown>, message: string) {
    let error: unknown; try {await action();} catch (caught) {error = caught;}
    check(error instanceof Error && error.message.includes(message), `expected rejection ${message}; got ${String(error)}`);
}
export const commandNames = ["deleteShots", "deleteEpisodeShots", "deleteEpisode", "deleteCharacter", "deleteScene", "deleteProp", "deleteStyle", "deleteChatThread", "setCharacterSlot", "setSceneSlot", "setPropSlot", "setStyleSlot", "setShotSlot", "releaseMaterialUse", "patchProjectOutput", "removeProjectReference"] as const;
export type CommandName = typeof commandNames[number];
export async function prepareCommand(name: CommandName, size = 3) {
    const project = await createProject(`E04 ${name}`), episode = (await db.episodes.where("projectId").equals(project.id).first())!;
    const ids = Array.from({length: size}, (_, i) => `${name}-${i}`);
    await db.media.bulkPut(ids.map(id => media(id, project.id)));
    const shot = await addShot(project.id, episode.id), sibling = await addShot(project.id, episode.id);
    await db.shots.update(shot.id, {firstFrame: slot([...ids, ...ids])});
    let execute: () => Promise<unknown>, undo: ((value: unknown) => Promise<void>) | undefined;
    let releaseUseId: string | undefined;
    if (name === "deleteShots") execute = () => deleteShots([shot.id, shot.id, "missing"]);
    else if (name === "deleteEpisodeShots") {
        execute = () => deleteEpisodeShots(episode.id, [shot.id]);
        undo = value => {const saved = value as Awaited<ReturnType<typeof deleteEpisodeShots>>; check(saved?.media.length === size, "committed shot snapshot"); return restoreShots(saved.shots, saved.media);};
    } else if (name === "deleteEpisode") {
        await addEpisode(project.id); execute = () => deleteEpisode(episode.id);
        undo = value => {const saved = value as Awaited<ReturnType<typeof deleteEpisode>>; check(saved?.media.length === size, "committed episode snapshot"); return restoreEpisode(saved);};
    } else if (name === "deleteChatThread") {
        await db.shots.update(shot.id, {firstFrame: emptySlot()});
        const thread = await createChatThread();
        await db.agentGenerationJobs.bulkPut(ids.map(id => ({...job(`job-${id}`, project.id), threadId: thread.id, result: {mediaId: id, kind: "image" as const}})));
        await db.agentGenerationBatches.put({...batch("removed-batch", project.id), threadId: thread.id, applications: [{itemId: "removed-item", jobId: `job-${ids[0]}`, targetKey: "missing", baseline: "old", beforeRevision: "old", afterRevision: "old", at, result: {mediaId: ids[0], kind: "image"}}]});
        await db.agentGenerationBatchItems.put({...item("removed-item", project.id), threadId: thread.id, draft: {...item("removed-item", project.id).draft, inputs: [{mediaId: ids[0], role: "reference-image"}]}});
        await db.chatMessages.put({id: "removed-message", threadId: thread.id, role: "user", content: "keep on rollback", createdAt: at});
        execute = () => deleteChatThread(thread.id);
    } else if (name === "setShotSlot") execute = () => setShotSlot(shot.id, "firstFrame", emptySlot());
    else if (name === "patchProjectOutput" || name === "removeProjectReference") {
        check(size === 1, "single-candidate command"); await db.shots.update(shot.id, {firstFrame: emptySlot()});
        if (name === "patchProjectOutput") {await patchProjectOutput(project.id, {coverMediaId: ids[0]}); execute = () => patchProjectOutput(project.id, {coverMediaId: null, aspectPreset: "9:16"});}
        else {
            await currentSources.find(source => source.name === "reference ready")!.put(ids[0], project.id);
            await db.referenceChunks.put({id: "removed-chunk", projectId: project.id, referenceId: `source-${ids[0]}`, revision: 1, index: 0, text: "parsed local bytes", locator: {kind: "lines", start: 1, end: 1}});
            execute = () => removeProjectReference(project.id, `source-${ids[0]}`);
        }
    } else {
        await db.shots.update(shot.id, {firstFrame: emptySlot()});
        const beat = await addStoryBeat(episode.id);
        if (name.includes("Character") || name === "releaseMaterialUse") {
            const asset = await addCharacter(project.id); await db.characters.update(asset.id, {slots: {front: slot(ids), side: slot(ids)}});
            await db.shots.update(sibling.id, {characterIds: [asset.id]}); await db.episodes.update(episode.id, {story: {...(await db.episodes.get(episode.id))!.story, beats: [{...beat, characterIds: [asset.id]}]}});
            if (name === "deleteCharacter") execute = () => deleteCharacter(asset.id);
            else if (name === "setCharacterSlot") {await db.characters.update(asset.id, {slots: {front: slot(ids)}}); execute = () => setCharacterSlot(asset.id, "front", emptySlot());}
            else {
                const material = await promoteLegacyMaterial("character", asset.id, {kind: "global"});
                const destination = await createProject("adopted setting"); const use = await adoptMaterialInProject(material.id, destination.id);
                // Remove the adopted owner first. Flags/use retain every immutable copied Blob.
                await deleteCharacter(use.targetId); await db.media.bulkDelete(ids);
                ids.splice(0, ids.length, ...use.mediaIds); releaseUseId = use.id;
                execute = () => releaseMaterialUse(use.id);
            }
        } else if (name.includes("Scene")) {
            const asset = await addScene(project.id); await db.scenes.update(asset.id, {slots: {wide: slot(ids)}});
            await db.shots.update(sibling.id, {sceneId: asset.id}); await db.episodes.update(episode.id, {story: {...(await db.episodes.get(episode.id))!.story, beats: [{...beat, sceneId: asset.id}]}});
            execute = name === "deleteScene" ? () => deleteScene(asset.id) : () => setSceneSlot(asset.id, "wide", emptySlot());
        } else if (name.includes("Prop")) {
            const asset = await addProp(project.id); await db.props.update(asset.id, {slots: {hero: slot(ids)}}); await db.shots.update(sibling.id, {propIds: [asset.id]});
            execute = name === "deleteProp" ? () => deleteProp(asset.id) : () => setPropSlot(asset.id, "hero", emptySlot());
        } else {
            const asset = await addStyle(project.id); await db.styles.update(asset.id, {slots: {look: slot(ids)}}); await db.projects.update(project.id, {defaultStyleId: asset.id}); await db.shots.update(sibling.id, {styleId: asset.id});
            execute = name === "deleteStyle" ? () => deleteStyle(asset.id) : () => setStyleSlot(asset.id, "look", emptySlot());
        }
    }
    return {ids, execute: execute!, undo, projectId: project.id, releaseUseId};
}
export async function commandRollback(name: CommandName) {
    const prepared = await prepareCommand(name, ["patchProjectOutput", "removeProjectReference"].includes(name) ? 1 : 3), before = await snapshot();
    let deletes = 0, failureReached = false, escapedSnapshot = false;
    const originalDelete = db.media.delete;
    db.media.delete = function(id) {return Dexie.Promise.resolve().then(async () => {
        await originalDelete.call(db.media, id);
        if (prepared.ids.includes(id)) {
            deletes++; check(!await db.media.get(id), "fault must follow actual Blob deletion");
            if (deletes === Math.min(2, prepared.ids.length)) {failureReached = true; throw new Error("E04 later actual media mutation fault");}
        }
    });};
    try {await rejects(async () => {await prepared.execute(); escapedSnapshot = true;}, "E04 later actual media mutation fault");}
    finally {db.media.delete = originalDelete;}
    check(failureReached && !escapedSnapshot && await snapshot() === before, `${name}: whole state/Blobs rollback`);
    const value = await prepared.execute();
    check((await db.media.bulkGet(prepared.ids)).every(row => row === undefined), `${name}: retry orphan collection`);
    if (prepared.undo) {await prepared.undo(value); check((await db.media.bulkGet(prepared.ids)).every(row => row?.blob.size), `${name}: snapshot restores Blobs`);}
    return {name, realDeletesBeforeFailure: deletes, failureReached, escapedSnapshot, rollback: "all tables recursively including immutable version payloads and Blob bytes", retry: true, undo: !!prepared.undo};
}
export async function commandWork(name: CommandName, size: number) {
    const prepared = await prepareCommand(name, size);
    const {scans} = await observe(prepared.execute);
    const history = scans.filter(s => (s.method === "query" || s.method === "cursor") && ["productionProposals", "agentGenerationJobs", "agentGenerationBatches", "agentGenerationBatchItems"].includes(s.table) && s.index === "projectId");
    check(history.length === 4, `${name}: one history set for one owner`);
    const current = scans.filter(s => (s.method === "query" || s.method === "cursor") && s.index == null && s.rangeType === 3 && retentionSources.some(source => !source.history && source.table === s.table));
    // release has one earlier materialUses conflict read; all other mutation reads are indexed.
    const expected = name === "releaseMaterialUse" ? 15 : 14;
    check(current.length === expected, `${name}: expected ${expected} current passes, got ${current.length}`);
    check((await db.media.bulkGet(prepared.ids)).every(row => row === undefined), `${name}: no orphan escaped`);
    const stores = [...new Set(scans.flatMap(s => s.stores))].sort();
    check(PRODUCTION_TABLES.every(t => stores.includes(t.name)), `${name}: original scope`);
    return {name, size, currentPasses: current.length, historyPasses: history.length, scans, stores};
}
export async function releaseEventRollback() {
    const prepared = await prepareCommand("releaseMaterialUse"), before = await snapshot();
    const originalAdd = db.materialEvents.add; let failed = false, copiesGone = false;
    db.materialEvents.add = function(row, key) {return Dexie.Promise.resolve().then(async () => {
        if (row.action === "release") {
            copiesGone = (await db.media.bulkGet(prepared.ids)).every(record => record === undefined);
            check(copiesGone && !await db.materialUses.get(prepared.releaseUseId!), "event fault follows ALL copy/binding deletions");
            failed = true; throw new Error("E04 final release event fault");
        }
        return originalAdd.call(db.materialEvents, row, key);
    });};
    try {await rejects(prepared.execute, "E04 final release event fault");} finally {db.materialEvents.add = originalAdd;}
    check(failed && copiesGone && await snapshot() === before, "release event restores flags/copies/library/event bytes");
    const originalBulk = db.media.bulkGet; let clearedBeforeSnapshot = false;
    db.media.bulkGet = function(keys) {
        if (keys.length === prepared.ids.length && keys.every(id => prepared.ids.includes(id))) {
            const captured = originalBulk.call(db.media, keys);
            return captured.then(records => {if (records.every(row => row && row.libraryRetained === false)) clearedBeforeSnapshot = true; return records;});
        }
        return originalBulk.call(db.media, keys);
    };
    try {await prepared.execute();} finally {db.media.bulkGet = originalBulk;}
    check(clearedBeforeSnapshot, "all retained flags false before batch bulk read/snapshot");
    check(await db.materialEvents.filter(row => row.action === "release").count() === 1, "release event once");
    return {copies: prepared.ids.length, copiesGone, clearedBeforeSnapshot, rollback: true, oneEventOnRetry: true};
}
export async function retainedReleaseRollback(source: RetentionSource) {
    const prepared = await prepareCommand("releaseMaterialUse"), records = await db.media.bulkGet(prepared.ids), last = records.at(-1)!;
    await source.put(last.id, last.projectId); const before = await snapshot(); let actualDeletes = 0;
    const original = db.media.delete;
    db.media.delete = function(id) {return Dexie.Promise.resolve().then(async () => {await original.call(db.media, id); actualDeletes++;});};
    try {await rejects(prepared.execute, "暂时不能移除");} finally {db.media.delete = original;}
    check(await snapshot() === before, `${source.name}: release restores all copies/use/flags/events`);
    check(source.table === "materialUses" || actualDeletes >= 2, `${source.name}: later retained candidate rolls back earlier actual deletes`);
    return {source: source.name, actualDeletes, rollback: true};
}
export async function outerTransactionRollback(name: "deleteShots" | "deleteEpisodeShots" = "deleteShots") {
    const prepared = await prepareCommand(name), before = await snapshot(); let innerDeleted = false;
    await rejects(() => db.transaction("rw", db.tables, async () => {
        const native = Dexie.currentTransaction!.idbtrans;
        await prepared.execute(); innerDeleted = !await db.media.get(prepared.ids[0]);
        check(innerDeleted && Dexie.currentTransaction!.idbtrans === native, "nested command returned in same root after real delete");
        throw new Error("E04 outer receipt failure");
    }), "E04 outer receipt failure");
    check(innerDeleted && await snapshot() === before, "outer failure restores inner rows/Blobs");
    return {innerDeleted, outerRollback: true};
}

export async function releaseDuplicateMissing() {
    const prepared = await prepareCommand("releaseMaterialUse");
    await db.materialUses.update(prepared.releaseUseId!, {mediaIds: [...prepared.ids, ...prepared.ids, "missing-copy"]});
    const {scans} = await observe(prepared.execute);
    const history = scans.filter(scan => scan.index === "projectId" && ["productionProposals", "agentGenerationJobs", "agentGenerationBatches", "agentGenerationBatchItems"].includes(scan.table));
    check(history.length === 4 && !await db.materialUses.get(prepared.releaseUseId!), "duplicate/missing release remains one operation");
    check((await db.media.bulkGet(prepared.ids)).every(row => row === undefined), "duplicate/missing release collects all real copies");
    check(scans.filter(scan => scan.method === "mutate:delete" && scan.table === "media").length === prepared.ids.length, "real copies deleted once");
    return {copies: prepared.ids.length, duplicateAndMissing: true, oneHistorySnapshot: true};
}
