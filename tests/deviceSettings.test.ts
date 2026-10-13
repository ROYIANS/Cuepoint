import JSZip from "jszip";
import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {
    DEVICE_SETTING_MAX_BYTES, deleteDeviceSetting, getDeviceSetting, putDeviceSetting,
} from "@/db/deviceSettings";
import {exportProjectZip} from "@/lib/projectPackage";
import {PRODUCT_SCHEMA} from "@/lib/storage/schema";

const asNumber = (raw: unknown) => (typeof raw === "number" ? raw : undefined);

describe("device settings table", () => {
    it("is registered as a device-scoped keyed table", () => {
        expect(PRODUCT_SCHEMA.deviceSettings).toEqual({keyPath: "key", scope: "device", indexes: []});
    });

    it("persists device-local keyed values through the shared store", async () => {
        await putDeviceSetting("modelCatalog", {v: 1, n: 7});
        const parse = (raw: unknown) => (raw as {n?: number})?.n;
        expect(await getDeviceSetting("modelCatalog", parse)).toBe(7);
        const row = await db.deviceSettings.get("modelCatalog");
        expect(row?.updatedAt).toMatch(/^\d{4}-/);
        await putDeviceSetting("modelCatalog", {v: 1, n: 8});
        expect(await getDeviceSetting("modelCatalog", parse)).toBe(8);
        await deleteDeviceSetting("modelCatalog");
        expect(await getDeviceSetting("modelCatalog", parse)).toBeUndefined();
        await expect(deleteDeviceSetting("modelCatalog")).resolves.toBeUndefined();
    });

    it("reads corrupt, unvalidated or failing values as undefined", async () => {
        await putDeviceSetting("k1", "not-a-number");
        expect(await getDeviceSetting("k1", asNumber)).toBeUndefined();
        expect(await getDeviceSetting("k1", () => {throw new Error("bad");})).toBeUndefined();
        expect(await getDeviceSetting("absent", asNumber)).toBeUndefined();
        expect(await getDeviceSetting("bad key!", asNumber)).toBeUndefined();
    });

    it("rejects invalid keys and oversize or unserializable values before writing", async () => {
        for (const key of ["", " ", "a b", "-x", "x".repeat(129), "中文"]) {
            await expect(putDeviceSetting(key, 1)).rejects.toThrow();
        }
        await expect(putDeviceSetting("big", "x".repeat(DEVICE_SETTING_MAX_BYTES))).rejects.toThrow(/2 MiB/);
        await expect(putDeviceSetting("undef", undefined)).rejects.toThrow();
        await expect(deleteDeviceSetting("")).rejects.toThrow();
        expect(await db.deviceSettings.count()).toBe(0);
        await putDeviceSetting("edge", "x".repeat(DEVICE_SETTING_MAX_BYTES - 2));
        expect(await db.deviceSettings.count()).toBe(1);
    });

    it("never appears in project package exports", async () => {
        await putDeviceSetting("secret-ish", {marker: "DEVICE_ONLY_MARKER"});
        const project = await createProject("device settings export");
        const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
        const names = Object.keys(zip.files);
        expect(names.some(name => name.includes("deviceSettings"))).toBe(false);
        for (const name of names) {
            if (zip.files[name].dir || /\.(png|jpe?g|webp|mp4|wav|mp3)$/i.test(name)) continue;
            expect(await zip.files[name].async("string")).not.toContain("DEVICE_ONLY_MARKER");
        }
    });
});
