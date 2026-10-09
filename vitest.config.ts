import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [{
    name: "d05-original-material-export-compatibility",
    enforce: "pre",
    resolveId(source, importer) {
      if ((source === "@/db/materials" || source === fileURLToPath(new URL("./src/db/materials", import.meta.url))) && importer?.replaceAll("\\", "/").endsWith("/tests/fixtures/sourceSnapshots/d05/src/lib/agent/materialTools.ts")) {
        return fileURLToPath(new URL("./tests/fixtures/e07/original-materials-adapter.ts", import.meta.url));
      }
    },
  }],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
  },
});
