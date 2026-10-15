import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
import {chunkModuleReport, sharedPublic, sitePublicFiles} from "../../tooling/vite.shared";

export default defineConfig({
    envDir: "../..",
    publicDir: sharedPublic,
    plugins: [react(), chunkModuleReport(), sitePublicFiles()],
    build: {manifest: true, assetsDir: "assets/site", rollupOptions: {input: fileURLToPath(new URL("./landing.html", import.meta.url))}},
});
