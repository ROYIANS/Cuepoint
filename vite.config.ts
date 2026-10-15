// Repository integration fixtures use this configuration. Application builds
// are owned by apps/web, apps/site and apps/desktop.
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {sharedPublic, studioSource} from "./tooling/vite.shared";

import {assertAgentPackageFreshness} from "./tooling/agent-package-inputs";

await assertAgentPackageFreshness();

export default defineConfig({
    publicDir: sharedPublic,
    plugins: [react(), tailwindcss()],
    resolve: {alias: {"@": studioSource}},
    worker: {format: "es"},
});
