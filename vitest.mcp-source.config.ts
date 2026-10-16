import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// Finite E10 source lane. Ordinary app resolution still consumes emitted packages.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: ["tests/mcpCatalogue.test.ts", "tests/mcpManifest.test.ts", "tests/mcpNativePort.test.ts", "tests/mcpConnections.test.ts", "tests/mcpAgentSurface.test.ts", "tests/mcpAgentExecution.test.ts", "tests/agentJobs.test.ts", "tests/agentJobsUi.test.ts", "tests/agentRuns.test.ts", "tests/toolLoading.test.ts", "tests/contextPreviewSnapshot.test.ts", "tests/agentRuntimeClaimRaces.test.ts", "tests/mcp*.test.tsx"],
});
