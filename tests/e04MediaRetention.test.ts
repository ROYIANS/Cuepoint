import {describe, expect, it} from "vitest";
import {retentionSources, isolatedSource, mixedOwnerParity, snapshotFreshness, workCount, nativeScheduling} from "./fixtures/e04-media/retention";
import {commandNames, commandRollback, commandWork, releaseEventRollback, retainedReleaseRollback, outerTransactionRollback, releaseDuplicateMissing} from "./fixtures/e04-media/commands";

import {orphanReceiptRollback, shotReceiptRollback} from "./fixtures/e04-media/receipt";

describe("E04 media retention batch", () => {
    it.each(retentionSources)("isolates $name and collects its final orphan", async source => {expect(await isolatedSource(source)).toMatchObject({source: source.name});});
    it("matches original scalar semantics for mixed record owners and scoped backup", async () => {expect(await mixedOwnerParity()).toMatchObject({parity: true, backupProjection: true});});
    it.each(retentionSources.filter(source => source.retains))("refreshes $name after later writes in one outer transaction", async source => {expect(await snapshotFreshness(source)).toMatchObject({freshAdditionAndRemoval: true});});
    it.each([1, 30])("bounds native-request work for %i distinct/duplicate retained candidates", async size => {expect(await workCount(size)).toMatchObject({passes: 14 + 4 * Math.min(3, size)});});
    it("measures original repeated scans on retained duplicates", async () => {expect(await workCount(4, true)).toMatchObject({passes: 144});});
    it.each(commandNames)("rolls back later real media deletion in %s and succeeds on retry", async name => {expect(await commandRollback(name)).toMatchObject({failureReached: true, escapedSnapshot: false, retry: true});});
    it.each(commandNames.filter(name => !["patchProjectOutput", "removeProjectReference"].includes(name)).flatMap(name => [1, 12].map(size => ({name, size}))))("bounds $name at $size candidates", async ({name, size}) => {expect(await commandWork(name, size)).toMatchObject({historyPasses: 4});});
    it("deduplicates missing and duplicate copied media on release", async () => {expect(await releaseDuplicateMissing()).toMatchObject({duplicateAndMissing: true, oneHistorySnapshot: true});});
    it("clears all copied flags before one snapshot and rolls back final release event", async () => {expect(await releaseEventRollback()).toMatchObject({copies: 3, clearedBeforeSnapshot: true, rollback: true});});
    it.each(retentionSources.filter(source => source.retains && (source.history || ["archived cover", "character result", "reference ready", "superseded material use", "unplaced audio take"].includes(source.name))))("rolls back multi-copy release retained by $name", async source => {expect(await retainedReleaseRollback(source)).toMatchObject({rollback: true});});
    it("rolls back the actual orphan tool deletion and receipt ledger together", async () => {expect(await orphanReceiptRollback()).toMatchObject({rollback: true, replay: true});});
    it("rolls back batched shot media and its actual business receipt", async () => {expect(await shotReceiptRollback()).toMatchObject({receiptCreatedBeforeFailure: true, rollback: true, replay: true});});
    it.each(["deleteShots", "deleteEpisodeShots"] as const)("does not commit nested %s before the outer evidence boundary", async name => {expect(await outerTransactionRollback(name)).toMatchObject({outerRollback: true});});
    it("keeps all batch mutations in one transaction before an overlapping writer", async () => {expect(await nativeScheduling()).toMatchObject({sameNativeTransaction: true});});
});
