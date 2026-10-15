// Pure display formatters for the download area.

/** 1234 -> "1.2k"; the decimal is floored so a count never reads higher than it is. */
export function formatStars(count: number): string {
    if (!Number.isFinite(count) || count < 0) return "";
    const whole = Math.floor(count);
    if (whole < 1000) return String(whole);
    const tenths = Math.floor(whole / 100) / 10;
    return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)}k`;
}

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** ISO timestamp -> "2026年10月13日" (UTC date, so the text does not depend on the visitor's zone). */
export function formatPublished(iso: string | undefined): string {
    if (!iso) return "";
    const time = Date.parse(iso);
    if (Number.isNaN(time)) return "";
    const date = new Date(time);
    return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}
