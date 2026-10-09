import {db} from "@/db/database";
import {isolatedSource, mixedOwnerParity, snapshotFreshness, workCount, nativeScheduling, retentionSources} from "./retention";
import {commandNames, commandRollback, commandWork, releaseEventRollback, retainedReleaseRollback, outerTransactionRollback, releaseDuplicateMissing} from "./commands";
import {orphanReceiptRollback, shotReceiptRollback} from "./receipt";

async function reset<T>(operation: () => Promise<T>) {await db.delete(); await db.open(); return operation();}
const bridge = {
    progress: {} as Record<string, unknown>,
    async run() {
        const isolated: Awaited<ReturnType<typeof isolatedSource>>[] = [];
        const freshness: Awaited<ReturnType<typeof snapshotFreshness>>[] = [];
        const rollbacks: Awaited<ReturnType<typeof commandRollback>>[] = [];
        const callerCounts: Awaited<ReturnType<typeof commandWork>>[] = [];
        const retainedReleases: Awaited<ReturnType<typeof retainedReleaseRollback>>[] = [];
        const counts: Awaited<ReturnType<typeof workCount>>[] = [];
        Object.assign(bridge.progress, {isolated, freshness, rollbacks, callerCounts, retainedReleases, counts});
        for (const source of retentionSources) isolated.push(await reset(() => isolatedSource(source)));
        const parity = await reset(mixedOwnerParity);
        for (const source of retentionSources.filter(source => source.retains)) freshness.push(await reset(() => snapshotFreshness(source)));
        for (const size of [1, 30]) {
            counts.push(await reset(() => workCount(size, true)));
            counts.push(await reset(() => workCount(size)));
        }
        for (const name of commandNames) {
            rollbacks.push(await reset(() => commandRollback(name)));
            for (const size of ["patchProjectOutput", "removeProjectReference"].includes(name) ? [1] : [1, 12]) callerCounts.push(await reset(() => commandWork(name, size)));
        }
        for (const source of retentionSources.filter(source => source.retains && (source.history || ["archived cover", "character result", "reference ready", "superseded material use", "unplaced audio take"].includes(source.name)))) retainedReleases.push(await reset(() => retainedReleaseRollback(source)));
        const releaseDuplicate = await reset(releaseDuplicateMissing), releaseEvent = await reset(releaseEventRollback), outer = await reset(outerTransactionRollback), receipt = await reset(orphanReceiptRollback), shotReceipt = await reset(shotReceiptRollback), scheduling = await reset(nativeScheduling);
        db.close();
        return {isolated, parity, freshness, counts, rollbacks, callerCounts, retainedReleases, releaseDuplicate, releaseEvent, outer, receipt, shotReceipt, scheduling};
    },
};
Object.assign(window, {e04Media: bridge});
document.getElementById("state")!.textContent = "ready";
