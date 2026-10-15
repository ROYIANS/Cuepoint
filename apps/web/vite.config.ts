import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {tanstackRouter} from "@tanstack/router-plugin/vite";
import {join} from "node:path";
import {appVersion, chunkModuleReport, sharedPublic, studioSource} from "../../tooling/vite.shared";

export default defineConfig({
    envDir: "../..",
    publicDir: sharedPublic,
    define: {__APP_VERSION__: JSON.stringify(appVersion)},
    plugins: [tanstackRouter({target: "react", autoCodeSplitting: true, routesDirectory: join(studioSource, "routes"), generatedRouteTree: join(studioSource, "routeTree.gen.ts")}), react(), tailwindcss(), chunkModuleReport()],
    build: {manifest: true, assetsDir: "assets/web"},
    worker: {format: "es"},
});
