import {toast} from "sonner";
import {sanitizeText} from "@/lib/diagnostics/sanitize";
import {friendlyMessage} from "@/lib/diagnostics/friendlyMessage";
import {reportError, type ErrorSource} from "@/lib/diagnostics/reportError";
import {openErrorDetails} from "./errorDetailsStore";

function notify(cause: unknown, source: ErrorSource, title: string | undefined, actionName: string | undefined, detail?: string): void {
    const reported = reportError(cause, {source, ...(actionName ? {actionName} : {})});
    if (!reported) return;
    const friendly = friendlyMessage(cause);
    toast.error(title ?? friendly.title, {
        ...(detail ? {description: sanitizeText(detail, 200)} : friendly.hint ? {description: friendly.hint} : {}),
        action: {label: "查看详情", onClick: openErrorDetails},
    });
}

/** Unified non-crash error exit: friendly toast plus a "查看详情" action. `detail` is an actionable business message shown (sanitized) instead of the generic hint; actionName must be a fixed label. */
export function showError({title, cause, actionName, detail}: {title?: string; cause: unknown; actionName?: string; detail?: string}): void {
    notify(cause, "action", title, actionName, detail);
}

/** Non-blocking notice for errors nothing else caught; never replaces the page. */
export function installGlobalErrorHandlers(target: Window = window): () => void {
    const onError = (event: ErrorEvent) => {
        if (/ResizeObserver loop/.test(event.message)) return;
        notify(event.error ?? event.message, "global", "出了点问题", undefined);
    };
    const onRejection = (event: PromiseRejectionEvent) => notify(event.reason, "global", "出了点问题", undefined);
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    return () => {
        target.removeEventListener("error", onError);
        target.removeEventListener("unhandledrejection", onRejection);
    };
}
