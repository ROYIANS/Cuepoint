import {sanitizeText} from "./sanitize";
import {type ErrorInfo, toErrorInfo} from "./errorReport";

export type ErrorSource = "boundary" | "global" | "action";
export type ReportedError = { info: ErrorInfo; source: ErrorSource; actionName?: string; at: number };

const DEDUPE_WINDOW_MS = 1000;

let latest: ReportedError | null = null;
const listeners = new Set<() => void>();
const seen = new Map<string, number>();

export function subscribeLatestError(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getLatestError(): ReportedError | null {
    return latest;
}

/** An abort anywhere in a short `cause` chain is a normal cancellation, not an error to report. */
function isAbortError(cause: unknown): boolean {
    let current: unknown = cause;
    for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
        if ((current as { name?: unknown }).name === "AbortError") return true;
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

function fingerprint(info: ErrorInfo): string {
    const firstLine = info.message.split("\n")[0] ?? "";
    const frame = info.stack?.split("\n").find(line => /^\s*at\s|@/.test(line)) ?? "";
    return sanitizeText(`${info.name}|${firstLine}|${frame.trim()}`, 400);
}

/** Records the latest error for the details panel. Returns it, or null when ignored (abort) or duplicated within 1s. */
export function reportError(cause: unknown, options: {
    source: ErrorSource;
    actionName?: string
}): ReportedError | null {
    if (isAbortError(cause)) return null;
    const info = toErrorInfo(cause);
    const now = Date.now();
    const key = fingerprint(info);
    const previous = seen.get(key);
    for (const [k, at] of seen) if (now - at >= DEDUPE_WINDOW_MS) seen.delete(k);
    if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return null;
    seen.set(key, now);
    latest = {info, source: options.source, at: now, ...(options.actionName ? {actionName: options.actionName} : {})};
    for (const listener of [...listeners]) listener();
    return latest;
}

export function resetReportedErrorsForTests(): void {
    latest = null;
    seen.clear();
}
