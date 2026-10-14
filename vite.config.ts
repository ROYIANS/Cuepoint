import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const appVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

// Emits dist/.vite/chunk-modules.json (chunk file -> source module paths) so
// scripts/landing-budget.mjs can verify the landing entry's real module closure.
function chunkModuleReport(): Plugin {
  return {
    name: "landing-chunk-module-report",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks: Record<string, string[]> = {};
      for (const [file, item] of Object.entries(bundle)) {
        if (item.type !== "chunk") continue;
        chunks[file] = item.moduleIds
          .filter(id => !id.startsWith("\0"))
          .map(id => relative(rootDirectory, id.split("?")[0]).replaceAll("\\", "/"));
      }
      this.emitFile({ type: "asset", fileName: ".vite/chunk-modules.json", source: JSON.stringify(chunks) });
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    chunkModuleReport(),
  ],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        landing: fileURLToPath(new URL("./landing.html", import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
