import {toast} from "sonner";
import {friendlyMessage} from "@/lib/diagnostics/friendlyMessage";
import {reportError, type ErrorSource} from "@/lib/diagnostics/reportError";
import {openErrorDetails} from "./errorDetailsStore";

function notify(cause: unknown, source: ErrorSource, title: string | undefined, actionName: string | undefined): void {
    const reported = reportError(cause, {source, ...(actionName ? {actionName} : {})});
    if (!reported) return;
    const friendly = friendlyMessage(cause);
    toast.error(title ?? friendly.title, {
        ...(friendly.hint ? {description: friendly.hint} : {}),
        action: {label: "查看详情", onClick: openErrorDetails},
    });
}

/** Unified non-crash error exit: friendly toast plus a "查看详情" action. */
export function showError({title, cause, actionName}: {title?: string; cause: unknown; actionName?: string}): void {
    notify(cause, "action", title, actionName);
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
