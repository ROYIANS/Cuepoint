const HIDDEN = "[已隐藏]";

function cleanUrl(raw: string): string {
    // Trailing punctuation belongs to the sentence, not to the URL.
    const match = /^(.*?)([.,;:!?)\]]*)$/.exec(raw);
    const url = match?.[1] ?? raw, tail = match?.[2] ?? "";
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}${tail}`;
    } catch {
        return HIDDEN + tail;
    }
}

/**
 * Pattern-based redaction for text that may leave the app (copy, file, issue link).
 * Order matters: URLs first, then credential shapes, local paths and opaque tokens.
 * Any failure yields a placeholder: omitting a field is safer than leaking it.
 */
export function sanitizeText(input: string, limit = 2000): string {
    try {
        let text = String(input)
            .replace(/https?:\/\/[^\s"'<>`]+/gi, cleanUrl)
            .replace(/Authorization\s*[:=]\s*[^\r\n]*/gi, `Authorization: ${HIDDEN}`)
            .replace(/Bearer\s+[^\s"',;]+/gi, `Bearer ${HIDDEN}`)
            .replace(/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]*)?/g, HIDDEN)
            .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, HIDDEN)
            .replace(/((?:cookie|set-cookie)\s*:\s*)[^\r\n]*/gi, `$1${HIDDEN}`)
            .replace(/((?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret(?:[_-]?key)?|client[_-]?secret|password|passwd|pwd)["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, `$1${HIDDEN}`)
            .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, `$1${HIDDEN}`)
            .replace(/\/Users\/(?:[^/\r\n]{1,40}(?=\/)|[^/\s]+)/g, "~")
            .replace(/\/home\/(?:[^/\r\n]{1,40}(?=\/)|[^/\s]+)/g, "~")
            .replace(/[A-Za-z]:\\Users\\(?:[^\\\r\n]{1,40}(?=\\)|[^\\\s]+)/gi, "~")
            .replace(/\b[A-Za-z0-9_]{32,}\b/g, HIDDEN);
        if (text.length > limit) text = `${text.slice(0, limit)}…`;
        return text;
    } catch {
        return HIDDEN;
    }
}

/** Route path only: query and hash are dropped, then the usual redaction applies. */
export function sanitizePath(pathname: string): string {
    try {
        const path = String(pathname).split(/[?#]/)[0] ?? "";
        return sanitizeText(path, 200);
    } catch {
        return HIDDEN;
    }
}
