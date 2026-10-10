import {resolve} from "node:path";
import {defineConfig} from "vitest/config";

export default defineConfig({
  resolve: {alias: {"@": resolve(process.cwd(), "src")}},
  test: {
    include: [".trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes.test.ts"],
    clearMocks: true,
  },
});
