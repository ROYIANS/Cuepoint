/** Injected by the Vite build (and the desktop frontend worker); "dev" outside a build. */
export function appVersion(): string {
    return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
}
