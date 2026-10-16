import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// Finite E10 source lane. Ordinary app resolution still consumes emitted packages.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: ["tests/mcpCatalogue.test.ts", "tests/mcpManifest.test.ts", "tests/mcp*.test.tsx"],
});
