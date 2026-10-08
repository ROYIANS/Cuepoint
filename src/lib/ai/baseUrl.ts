/** Shared URL spelling only; provider route validation stays with each adapter. */
export function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, "");
}
