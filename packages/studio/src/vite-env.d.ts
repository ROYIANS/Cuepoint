/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_UMAMI_SCRIPT_URL?: string;
    readonly VITE_UMAMI_WEBSITE_ID?: string;
}

/** Injected by Vite `define` from package.json; absent under Vitest and the acceptance fixture. */
declare const __APP_VERSION__: string | undefined;
