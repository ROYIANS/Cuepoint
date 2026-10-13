import {sanitizePath} from "./sanitize";

export type Breadcrumb = {kind: "route" | "action"; label: string; at: string};

const BREADCRUMB_LIMIT = 30;

let crumbs: Breadcrumb[] = [];

/**
 * Memory-only trail of recent navigation and named actions (never persisted).
 * `label` MUST be a route path or a fixed operation name such as "send-message".
 * NEVER pass user input, message text, prompts, file names or any creative content.
 */
export function addBreadcrumb(kind: Breadcrumb["kind"], label: string): void {
    const safe = kind === "route" ? sanitizePath(label) : label.slice(0, 80);
    crumbs.push({kind, label: safe, at: new Date().toISOString()});
    if (crumbs.length > BREADCRUMB_LIMIT) crumbs = crumbs.slice(-BREADCRUMB_LIMIT);
}

export function getBreadcrumbs(): readonly Breadcrumb[] {
    return crumbs;
}

export function clearBreadcrumbs(): void {
    crumbs = [];
}
