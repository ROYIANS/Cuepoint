/** Give the already-published echo a bounded rendering opportunity before preparation/HTTP. */
export function yieldSubmissionPaint(): Promise<void> {
    if (typeof requestAnimationFrame !== "function" || typeof document === "undefined") return Promise.resolve();
    return new Promise(resolve => {
        let first = 0, second = 0;
        const finish = () => {clearTimeout(fallback); cancelAnimationFrame(first); cancelAnimationFrame(second); resolve();};
        // Hidden/throttled documents must not indefinitely hold an execution lock.
        const fallback = setTimeout(finish, 80);
        if (document.visibilityState !== "hidden") first = requestAnimationFrame(() => {second = requestAnimationFrame(finish);});
    });
}
