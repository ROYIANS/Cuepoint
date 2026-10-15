import {nowIso} from "../identity";

export function pickPatch<T extends object>(patch: T, keys: readonly (keyof T)[]): Partial<T> {
    return Object.fromEntries(keys.filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]])) as Partial<T>;
}

export function assertTextPatch(patch: object, mediaFields: readonly string[]): void {
    if (mediaFields.some(field => Object.hasOwn(patch, field))) {
        throw new Error("媒体字段请通过专用槽位接口保存");
    }
}

export function touch<T extends { updatedAt: string }>(record: T): T {
    return {...record, updatedAt: nowIso()};
}
