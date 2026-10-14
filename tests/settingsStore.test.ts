import {describe, expect, it, vi} from "vitest";
import {db} from "@/db/database";
import {putDeviceSetting} from "@/db/deviceSettings";
import {
    dueForAutoCheck, readAutoCheckUpdates, readLastUpdateCheckAt, readSettings, writeAutoCheckUpdates, writeLastUpdateCheckAt,
} from "@/components/settings/settingsStore";
import {interceptStoreTable} from "./helpers/storeFaults";

describe("device-local settings", () => {
    it("starts with automatic network checks off and no previous check, without writing defaults", async () => {
        expect(await readAutoCheckUpdates()).toBe(false);
        expect(await readLastUpdateCheckAt()).toBeUndefined();
        expect(await db.deviceSettings.count()).toBe(0);
    });

    it("preserves enabled and disabled preferences and successful check time through reopening", async () => {
        const at = Date.UTC(2026, 9, 14, 6);
        await writeAutoCheckUpdates(true);
        await writeLastUpdateCheckAt(at);
        db.close();
        await db.open();
        expect(await readAutoCheckUpdates()).toBe(true);
        expect(await readLastUpdateCheckAt()).toBe(at);
        expect((await db.deviceSettings.get("settings.autoCheckUpdates"))?.value).toBe(true);
        expect((await db.deviceSettings.get("settings.lastUpdateCheckAt"))?.value).toBe(at);

        await writeAutoCheckUpdates(false);
        db.close();
        await db.open();
        expect(await readAutoCheckUpdates()).toBe(false);
        expect(await readLastUpdateCheckAt()).toBe(at);
    });

    it.each([null, "true", "false", 0, 1, {}, [], {enabled: true}])("falls back to disabled for invalid boolean %j", async value => {
        await putDeviceSetting("settings.autoCheckUpdates", value);
        expect(await readAutoCheckUpdates()).toBe(false);
        expect((await db.deviceSettings.get("settings.autoCheckUpdates"))?.value).toEqual(value);
    });

    it.each([null, "2026-10-14", "1720000000000", true, 0, -1, 1.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, {}, []])(
        "treats invalid last-check timestamp %j as missing", async value => {
            await putDeviceSetting("settings.lastUpdateCheckAt", value);
            expect(await readLastUpdateCheckAt()).toBeUndefined();
        },
    );

    it("reads both preferences from the provided live-query snapshot without leaving its transaction", async () => {
        const at = Date.UTC(2026, 9, 14, 6);
        await writeAutoCheckUpdates(true);
        await writeLastUpdateCheckAt(at);
        const rootGet = vi.spyOn(db.deviceSettings, "get").mockRejectedValue(new Error("root handle escaped the transaction"));
        try {
            await expect(db.transaction("r", ["deviceSettings"], tx => readSettings(tx))).resolves.toEqual({autoCheck: true, lastCheck: at});
            expect(rootGet).not.toHaveBeenCalled();
        } finally {
            rootGet.mockRestore();
        }
    });

    it("applies the same default validation to live-query snapshots", async () => {
        await putDeviceSetting("settings.autoCheckUpdates", "true");
        await putDeviceSetting("settings.lastUpdateCheckAt", -1);
        await expect(db.transaction("r", ["deviceSettings"], tx => readSettings(tx))).resolves.toEqual({autoCheck: false, lastCheck: undefined});
    });

    it("uses safe defaults when the underlying read fails", async () => {
        const get = vi.spyOn(db.deviceSettings, "get").mockRejectedValue(new Error("read unavailable"));
        try {
            await expect(readAutoCheckUpdates()).resolves.toBe(false);
            await expect(readLastUpdateCheckAt()).resolves.toBeUndefined();
            expect(get).toHaveBeenCalledWith("settings.autoCheckUpdates");
            expect(get).toHaveBeenCalledWith("settings.lastUpdateCheckAt");
        } finally {
            get.mockRestore();
        }
    });

    it("lets the caller report a reached write failure, keeps the old preference and permits retry", async () => {
        await writeAutoCheckUpdates(true);
        const failure = new Error("device settings unavailable");
        let reached = false;
        const fault = interceptStoreTable(db, "deviceSettings", "put", async () => {
            reached = true;
            throw failure;
        });
        try {
            await expect(writeAutoCheckUpdates(false)).rejects.toBe(failure);
            expect(reached).toBe(true);
            expect(await readAutoCheckUpdates()).toBe(true);
        } finally {
            fault.mockRestore();
        }
        await writeAutoCheckUpdates(false);
        expect(await readAutoCheckUpdates()).toBe(false);
    });
});

describe("automatic update interval", () => {
    const at = Date.UTC(2026, 9, 14);
    const day = 24 * 60 * 60 * 1000;

    it("permits the first check and exactly the 24-hour boundary", () => {
        expect(dueForAutoCheck(undefined, at)).toBe(true);
        expect(dueForAutoCheck(at, at + day)).toBe(true);
        expect(dueForAutoCheck(at, at + day + 1)).toBe(true);
    });

    it("does not repeat early or after the local clock moves backwards", () => {
        expect(dueForAutoCheck(at, at)).toBe(false);
        expect(dueForAutoCheck(at, at + day - 1)).toBe(false);
        expect(dueForAutoCheck(at, at - 1)).toBe(false);
    });
});
