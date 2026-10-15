import {getDeviceSetting, putDeviceSetting} from "../commands/deviceSettings";
import type {StoreTx} from "../../../platform/storage/types";

const SETTING_AUTO_CHECK_UPDATES = "settings.autoCheckUpdates";
const SETTING_LAST_UPDATE_CHECK = "settings.lastUpdateCheckAt";

/** Local-first default: nothing reaches GitHub until the user asks for it. */
const AUTO_CHECK_UPDATES_DEFAULT = false;
const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const parseAutoCheck = (raw: unknown) => typeof raw === "boolean" ? raw : undefined;
const parseLastCheck = (raw: unknown) => typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 && raw <= 8_640_000_000_000_000 ? raw : undefined;

/** Live settings reads stay inside the query's transaction snapshot. */
export async function readSettings(tx: StoreTx): Promise<{ autoCheck: boolean; lastCheck: number | undefined }> {
    const enabled = await tx.deviceSettings.get(SETTING_AUTO_CHECK_UPDATES);
    const checked = await tx.deviceSettings.get(SETTING_LAST_UPDATE_CHECK);
    return {
        autoCheck: parseAutoCheck(enabled?.value) ?? AUTO_CHECK_UPDATES_DEFAULT,
        lastCheck: parseLastCheck(checked?.value)
    };
}

export async function readAutoCheckUpdates(): Promise<boolean> {
    const value = await getDeviceSetting(SETTING_AUTO_CHECK_UPDATES, parseAutoCheck);
    return value ?? AUTO_CHECK_UPDATES_DEFAULT;
}

export async function readLastUpdateCheckAt(): Promise<number | undefined> {
    return getDeviceSetting(SETTING_LAST_UPDATE_CHECK, parseLastCheck);
}

export async function writeAutoCheckUpdates(enabled: boolean): Promise<void> {
    await putDeviceSetting(SETTING_AUTO_CHECK_UPDATES, enabled);
}

export async function writeLastUpdateCheckAt(at: number): Promise<void> {
    await putDeviceSetting(SETTING_LAST_UPDATE_CHECK, at);
}

export function dueForAutoCheck(lastCheckAt: number | undefined, now: number): boolean {
    return lastCheckAt === undefined || now - lastCheckAt >= AUTO_CHECK_INTERVAL_MS;
}
