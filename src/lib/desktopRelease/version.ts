export type UpdateClass = "update-available" | "up-to-date" | "ahead" | "unknown";

// Strict X.Y.Z: no sign, no prerelease/build suffix, no leading zeros (except a lone 0), safe integers only.
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value: unknown): [number, number, number] | undefined {
    if (typeof value !== "string") return undefined;
    const match = VERSION.exec(value);
    if (!match) return undefined;
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
    return parts.every(Number.isSafeInteger) ? parts : undefined;
}

/** `unknown` covers `dev`, missing or malformed versions on either side; numeric per-segment comparison otherwise. */
export function classifyUpdate(current: unknown, latest: unknown): UpdateClass {
    const a = parseVersion(current);
    const b = parseVersion(latest);
    if (!a || !b) return "unknown";
    for (let i = 0; i < 3; i += 1) {
        if (a[i] < b[i]) return "update-available";
        if (a[i] > b[i]) return "ahead";
    }
    return "up-to-date";
}
