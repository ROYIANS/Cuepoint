import type {ComponentProps, ReactNode} from "react";
import {cn} from "@/lib/utils";

/** Shared presentation only: feature owners retain data, drafts and scrollports. */
export function PageHeader({title, description, count, back, actions, dense = false, className}: {
    title: ReactNode;
    description?: ReactNode;
    count?: ReactNode;
    back?: ReactNode;
    actions?: ReactNode;
    dense?: boolean;
    className?: string;
}) {
    return <header className={cn("page-header", dense && "page-header-dense", className)}>
        <div className="page-header-copy">
            {back ? <div className="page-header-back">{back}</div> : null}
            <div className="page-header-heading"><h1>{title}</h1>{count != null ? <span className="page-header-count">{count}</span> : null}</div>
            {description ? <div className="page-header-description">{description}</div> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>;
}

export function PageToolbar({className, ...props}: ComponentProps<"div">) {
    return <div className={cn("page-toolbar", className)} {...props}/>;
}

export function PageContent({mode = "collection", className, ...props}: ComponentProps<"div"> & {
    mode?: "collection" | "detail" | "document" | "workbench";
}) {
    return <div className={cn("page-content", `page-content-${mode}`, className)} {...props}/>;
}

export function PageState({title, description, action, kind = "empty", compact = false, className}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    kind?: "loading" | "empty" | "missing" | "error";
    compact?: boolean;
    className?: string;
}) {
    return <div className={cn("page-state", compact && "page-state-compact", className)} role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}>
        <p className="page-state-title">{title}</p>
        {description ? <div className="page-state-description">{description}</div> : null}
        {action ? <div className="page-state-action">{action}</div> : null}
    </div>;
}
