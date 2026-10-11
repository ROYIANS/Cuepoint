import { fileURLToPath, URL } from "node:url";
import {dirname,resolve} from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [{
    name: "d05-original-material-export-compatibility",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "@/db/database" && importer?.replaceAll("\\", "/").includes("/tests/fixtures/sourceSnapshots/")) {
        return fileURLToPath(new URL("./tests/fixtures/shared-storage/rawBrowserDatabase.ts", import.meta.url));
      }
      const target=source.startsWith(".") && importer ? resolve(dirname(importer),source) : source;
      if (!source.includes("?fixture-original") && (source === "@/lib/storage/store" || target === fileURLToPath(new URL("./src/lib/storage/store", import.meta.url)) || target === fileURLToPath(new URL("./src/lib/storage/store.ts", import.meta.url)))) {
        return fileURLToPath(new URL("./tests/fixtures/shared-storage/storeFactory.ts", import.meta.url));
      }
      if (process.env.CUEPOINT_TOOL_COVERAGE_DIR && !source.includes("?coverage-original") && (source === "@/lib/agent/toolDefinition" || target === fileURLToPath(new URL("./src/lib/agent/toolDefinition", import.meta.url)) || target === fileURLToPath(new URL("./src/lib/agent/toolDefinition.ts", import.meta.url)))) {
        return fileURLToPath(new URL("./tests/fixtures/shared-storage/toolDefinitionCoverage.ts", import.meta.url));
      }
      if (process.env.CUEPOINT_STORAGE_TEST_OWNER === "sqlite" && (source === "@/db/database" || target === fileURLToPath(new URL("./src/db/database", import.meta.url)) || target === fileURLToPath(new URL("./src/db/database.ts", import.meta.url)))) {
        return fileURLToPath(new URL("./tests/fixtures/shared-storage/nativeDatabase.ts", import.meta.url));
      }
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
    ...(process.env.CUEPOINT_STORAGE_TEST_OWNER === "sqlite" ? {maxWorkers:2,testTimeout:20000,hookTimeout:20000} : {}),
  },
});
