import {defineConfig} from "vitest/config";
import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 24 || major === 24 && minor < 11) {
    throw new Error("Agent source validation requires Node >=24.11 for the actual Todo SQLite host");
}
await import("node:sqlite");

export default defineConfig({
    resolve: {alias: createAgentSourceAliases()},
    test: {
        environment: "node",
        setupFiles: [],
        clearMocks: true,
        pool: "forks",
        maxWorkers: 1,
        include: [
            "packages/agent-core/src/resourceCapabilities.test.ts",
            "packages/agent-core/src/runtime.test.ts",
            "packages/agent-core/src/tools.test.ts",
            "packages/agent-core/src/compaction.test.ts",
            "tests/agentTodoSource.test.ts",
        ],
    },
});
