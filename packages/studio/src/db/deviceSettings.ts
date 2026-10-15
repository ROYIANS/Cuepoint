import type {ProductStore} from "../lib/storage/types";
import {db as productDb} from "./database";
import {nowIso} from "../lib/ids";

export const DEVICE_SETTING_MAX_BYTES = 2 * 1024 * 1024;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function assertKey(key: string): void {
    if (typeof key !== "string" || !KEY_PATTERN.test(key)) throw new Error("设备设置键无效");
}

/** Reads one device-local value. Missing, unreadable or invalid data all yield undefined. */
export async function getDeviceSetting<T>(
    key: string, parse: (raw: unknown) => T | undefined, store?: ProductStore,
): Promise<T | undefined> {
    try {
        assertKey(key);
        const row = await (store ?? productDb).deviceSettings.get(key);
        if (!row) return undefined;
        return parse(row.value);
    } catch {
        return undefined;
    }
}

export async function putDeviceSetting(key: string, value: unknown, store?: ProductStore): Promise<void> {
    assertKey(key);
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error("设备设置值无法序列化");
    if (new TextEncoder().encode(text).byteLength > DEVICE_SETTING_MAX_BYTES) throw new Error("设备设置值超过 2 MiB 上限");
    const db = store ?? productDb;
    const updatedAt = nowIso();
    await db.transaction("rw", ["deviceSettings"], async tx => {
        await tx.deviceSettings.put({key, value, updatedAt});
    });
}

export async function deleteDeviceSetting(key: string, store?: ProductStore): Promise<void> {
    assertKey(key);
    const db = store ?? productDb;
    await db.transaction("rw", ["deviceSettings"], async tx => {
        await tx.deviceSettings.delete(key);
    });
}
