/** Historical text fields accept JSON scalars; objects and arrays are never text. */
export type LegacyScalar = string | number | boolean | null | undefined;

export function isLegacyScalar(value: unknown): value is LegacyScalar {
    return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** Local persisted prose recovers malformed compound values without changing storage. */
export function recoverLegacyText(value: unknown, fallback = ""): string {
    return isLegacyScalar(value) ? String(value ?? fallback) : fallback;
}

/** Keep historical scalar member spelling (including null); discard compound references. */
export function recoverLegacyIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter(isLegacyScalar).map((id) => String(id));
}
