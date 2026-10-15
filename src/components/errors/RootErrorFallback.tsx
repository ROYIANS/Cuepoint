import {Component, type ReactNode} from "react";
import {friendlyMessage} from "@/lib/diagnostics/friendlyMessage";
import {reportError} from "@/lib/diagnostics/reportError";
import {openErrorDetails} from "./errorDetailsStore";

/** Outermost fallback: plain elements and Tailwind tokens only; no router, database or AppFrame. */
export function RootErrorFallback({title, description, error}: {
    title?: string;
    description?: string;
    error?: unknown
}) {
    const friendly = friendlyMessage(error);
    return (
        <main role="alert" className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
            <div className="max-w-lg space-y-4">
                <h1 className="text-2xl font-semibold">{title ?? "应用遇到了问题"}</h1>
                <p className="text-muted-foreground">{description ?? `${friendly.title}。已保存的文件会保留，请重新加载应用。`}</p>
                <div className="flex gap-2">
                    <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                            onClick={() => window.location.reload()}>重新加载
                    </button>
                    <button type="button" className="rounded-md border px-4 py-2 text-sm"
                            onClick={openErrorDetails}>查看详情
                    </button>
                </div>
            </div>
        </main>
    );
}

/** Minimal hand-written boundary (no dependency). Never resets itself. */
export class RootErrorBoundary extends Component<{ children: ReactNode }, { error: { cause: unknown } | null }> {
    state: { error: { cause: unknown } | null } = {error: null};

    static getDerivedStateFromError(cause: unknown) {
        return {error: {cause}};
    }

    componentDidCatch(cause: unknown) {
        reportError(cause, {source: "boundary"});
    }

    render() {
        return this.state.error ? <RootErrorFallback error={this.state.error.cause}/> : this.props.children;
    }
}
