import Dexie from "dexie";
import {db} from "@/db/database";
import {deleteMediaIfOrphan, deleteMediaIfOrphans, collectMediaIds} from "@/db/media";
import {PRODUCTION_TABLES} from "@/db/productionShared";
import {deleteMediaIfOrphan as originalDelete} from "../sourceSnapshots/e04-media/src/db/media";
import {check, media, retentionSources, historySources, currentSources, type RetentionSource} from "./seeds";
import {observe} from "./instrumentation";

export async function isolatedSource(source: RetentionSource) {
    const id = `candidate-${source.name}`, owner = "media-owner";
    await db.media.put(media(id, owner));
    const remove = await source.put(id, source.history ? owner : "foreign-owner");
    await deleteMediaIfOrphans([id, id, undefined, "", "missing"]);
    check(!!await db.media.get(id) === source.retains, `${source.name}: isolated retention`);
    if (source.retains) {
        await remove(); await deleteMediaIfOrphan(id);
        check(!await db.media.get(id), `${source.name}: last reference collection`);
    }
    return {source: source.name, retained: source.retains, lastReferenceCollected: source.retains};
}
export async function mixedOwnerParity() {
    const owners = ["project-A", "project-B", "studio"], ids: string[] = [];
    for (const owner of owners) for (const [index, source] of historySources.entries()) {
        const same = `${owner}-${index}-same`, foreign = `${owner}-${index}-foreign`;
        ids.push(same, foreign); await db.media.bulkPut([media(same, owner), media(foreign, owner)]);
        await source.put(same, owner); await source.put(foreign, `foreign-${owner}`);
    }
    const globalId = "global-foreign-current"; ids.push(globalId);
    await db.media.put(media(globalId, "studio")); await currentSources.find(s => s.name === "unplaced audio take")!.put(globalId, "foreign-owner");
    const records = await db.media.toArray();
    for (const id of ids) await originalDelete(id);
    const before = (await db.media.toArray()).map(row => row.id);
    await db.media.bulkPut(records);
    await deleteMediaIfOrphans([...ids, ...ids, "missing", undefined]);
    const after = (await db.media.toArray()).map(row => row.id);
    check(JSON.stringify(after) === JSON.stringify(before), "mixed owner original/current parity");
    check(after.length === owners.length * historySources.length + 1, "foreign history must not retain; global current must retain");
    const scoped = await collectMediaIds("studio");
    check(!scoped.has(globalId) && !scoped.has("studio-0-same"), "backup projection excludes foreign-current and histories");
    check((await collectMediaIds()).has(globalId), "global backup/current includes foreign current");
    return {owners, candidates: ids.length, kept: after.length, parity: true, backupProjection: true};
}
export async function snapshotFreshness(source: RetentionSource) {
    const owner = "fresh-owner", first = "first-orphan", second = "second-later-retained";
    await db.media.bulkPut([media(first, owner), media(second, owner)]);
    await db.transaction("rw", PRODUCTION_TABLES, async () => {
        await deleteMediaIfOrphans([first]); check(!await db.media.get(first), "first mutation must happen");
        const remove = await source.put(second, owner);
        await deleteMediaIfOrphans([second]); check(await db.media.get(second), `${source.name}: later addition visible`);
        await remove(); await deleteMediaIfOrphans([second]); check(!await db.media.get(second), `${source.name}: later removal visible`);
    });
    return {source: source.name, freshAdditionAndRemoval: true};
}
export async function workCount(size: number, original = false, ownerCount = 3) {
    const owners = Array.from({length: ownerCount}, (_, i) => `owner-${i}`), ids: string[] = [];
    for (let i = 0; i < size; i++) {const id = `work-${i}`; ids.push(id); await db.media.put(media(id, owners[i % owners.length], true));}
    // Add unrelated history rows: indexed owner reads must not visit them.
    for (const source of historySources) await source.put(`unrelated-${source.name}`, "unrelated-owner");
    const observed = await observe(async () => {
        if (original) for (const id of [...ids, ...ids]) await originalDelete(id);
        else await deleteMediaIfOrphans([...ids, ...ids, undefined, "missing"]);
    });
    const scans = observed.scans.filter(scan => scan.method === "query" || scan.method === "cursor");
    const actualOwners = new Set(ids.map((_, i) => owners[i % owners.length])).size;
    const expectedPasses = original ? 18 * size * 2 : 14 + 4 * actualOwners;
    check(scans.length === expectedPasses, `work passes: expected ${expectedPasses}, actual ${scans.length}`);
    const mediaReads = observed.scans.filter(scan => scan.table === "media" && ["getMany", "get"].includes(scan.method));
    if (!original) check(mediaReads.length === 1 && mediaReads[0].keys === size + 1, "one deduplicated bulk read including missing id");
    const stores = [...new Set(observed.scans.flatMap(scan => scan.stores))].sort();
    check(JSON.stringify(stores) === JSON.stringify(PRODUCTION_TABLES.map(t => t.name).sort()), "complete 25-table production scope");
    check(scans.filter(s => s.table.startsWith("agentGeneration") || s.table === "productionProposals").every(s => s.rows === 0), "unrelated history rows excluded");
    return {size, actualOwners, original, passes: scans.length, rows: scans.reduce((n, s) => n + s.rows, 0), mediaReads, scans, stores, limitation: "Request/cursor work counts; elapsed latency is not inferred"};
}
export async function nativeScheduling() {
    const ids = Array.from({length: 24}, (_, i) => `schedule-${i}`);
    await db.media.bulkPut(ids.map(id => media(id, "schedule-owner")));
    const events: string[] = [];
    let competing: Promise<void> | undefined, originalRoot: IDBTransaction | undefined;
    const firstDelete = db.media.delete;
    db.media.delete = function(id) {return Dexie.Promise.resolve().then(async () => {
        if (!competing) {
            originalRoot = Dexie.currentTransaction!.idbtrans;
            await firstDelete.call(db.media, id); events.push("first-real-delete");
            // Explicitly leave the parent context to enqueue an overlapping native writer.
            competing = Dexie.ignoreTransaction(() => db.transaction("rw", PRODUCTION_TABLES, async () => {
                events.push("competing-start");
                check(!await db.media.get(ids[0]), "overlapping writer ran before cleanup commit");
                check((await db.media.bulkGet(ids)).every(row => row === undefined), "partial batch escaped");
            }));
            return;
        }
        check(Dexie.currentTransaction!.idbtrans === originalRoot, "batch escaped original native transaction");
        return firstDelete.call(db.media, id);
    });};
    try {await deleteMediaIfOrphans(ids); events.push("cleanup-resolved"); await competing;}
    finally {db.media.delete = firstDelete;}
    check(events[0] === "first-real-delete" && events.includes("competing-start"), "scheduling seam reached");
    return {events, candidates: ids.length, sameNativeTransaction: true, overlappingWriterSawWholeCommit: true};
}
export {retentionSources};
