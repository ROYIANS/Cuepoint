import {describe, expect, it} from "vitest";
import {runBatchBoundary, runSingleBoundary, runTaskGuardBoundary} from "./fixtures/d01/harness";

describe("D01 command and preparation boundaries", () => {
    it("flushes and hashes outside Dexie through single preview and atomic apply", async () => {
        expect(await runSingleBoundary()).toMatchObject({hashOutsideTransactions: true, flushOutsideTransactions: true});
    });
    it("flushes and hashes outside Dexie through batch prepare, confirm and apply; target reads join rollback", async () => {
        expect(await runBatchBoundary()).toMatchObject({hashOutsideTransactions: true, flushOutsideTransactions: true});
    });
    it("keeps both task and manual record commands behind the shared preparation guard", async () => {
        expect(await runTaskGuardBoundary()).toEqual({blockedManualCommands: 2, guardRecovered: true});
    });
});
