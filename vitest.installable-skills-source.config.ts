import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// Finite source checks for E09; ordinary consumers still require emitted packages.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: [
        "packages/agent-core/src/skills.test.ts",
        "tests/installableSkills.test.ts",
    ],
});
