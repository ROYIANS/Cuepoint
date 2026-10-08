import {describe, expect, it} from "vitest";
import {runProjectCascadeBoundary, runThreadCascadeBoundary, runMaterialReleaseBoundary} from "./fixtures/d02/harness";

describe("extracted lifecycle commands", () => {
    it("rolls back a late project delete and preserves independent sources on success", async () => {
        expect((await runProjectCascadeBoundary()).lateFault).toBe(true);
    });
    it("rolls back thread orphan cleanup and retains production/material media on success", async () => {
        expect((await runThreadCascadeBoundary()).lateFault).toBe(true);
    });
    it("restores a released copy when its final event fails, then releases it on retry", async () => {
        expect((await runMaterialReleaseBoundary()).lateFault).toBe(true);
    });
});
