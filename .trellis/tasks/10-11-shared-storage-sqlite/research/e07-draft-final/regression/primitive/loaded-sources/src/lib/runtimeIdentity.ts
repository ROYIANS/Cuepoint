/** Native service identity is independent of the selected product storage owner. */
export function isTauriRuntime(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.__TAURI_INTERNALS__?.invoke === "function"
    );
}
