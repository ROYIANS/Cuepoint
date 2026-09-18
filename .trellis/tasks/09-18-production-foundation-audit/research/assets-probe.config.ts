import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../../../src", import.meta.url)) } },
  test: {
    include: [".trellis/tasks/09-18-production-foundation-audit/research/assets-repo.probe.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
