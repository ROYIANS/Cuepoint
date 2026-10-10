import {resolve} from "node:path";
import {defineConfig} from "vitest/config";
const taskResearch = resolve(process.cwd(), ".trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research");
export default defineConfig({
  resolve: {alias: {
    "@/lib/checkpoint": resolve(taskResearch, "provisional-source/checkpoint.ts"),
    "@/lib/syncProvider": resolve(taskResearch, "provisional-source/syncProvider.ts"),
    "@": resolve(process.cwd(), "src"),
  }},
  test: {include: [".trellis/tasks/10-10-storage-checkpoint-plugin-foundation/research/independent-probes.test.ts"]},
});
