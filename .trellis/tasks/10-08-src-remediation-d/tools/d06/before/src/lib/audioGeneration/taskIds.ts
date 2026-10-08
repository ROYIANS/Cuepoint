/** Shared provider/query/storage/import rules; IDs remain opaque, including encoded slashes. */
export function isAudioTaskId(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim() || value.length > 512 || value === "." || value === "..") return false;
    for (const character of value) {
        const point = character.codePointAt(0) ?? 0;
        // Lone surrogates cannot be encoded as a URL segment; valid pairs remain opaque.
        if (point <= 0x1f || point >= 0x7f && point <= 0x9f || point >= 0xd800 && point <= 0xdfff) return false;
    }
    return true;
}

/** Duplicate provider or legacy IDs refer to one task. Never discard malformed identities. */
export function canonicalizeAudioTaskIds(value: unknown): string[] {
    if (!Array.isArray(value) || !Array.from(value).every(isAudioTaskId)) throw new Error("音乐任务 ID 无效；请保留任务记录，不要重复提交");
    const unique = [...new Set<string>(value)];
    if (unique.length > 100) throw new Error("音乐任务 ID 超过 100 个；请保留任务记录，不要重复提交");
    return unique;
}

/** New storage/import requires canonical IDs; prepared and speech jobs may have none. */
export function validateAudioTaskIds(value: unknown): asserts value is string[] {
    const unique = canonicalizeAudioTaskIds(value);
    if (!Array.isArray(value) || unique.length !== value.length) throw new Error("音乐任务 ID 重复");
}
