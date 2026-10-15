import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// Explicit source validation only; normal tests retain artifact freshness checks.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: [
        "tests/agentJobs.test.ts",
        "tests/agentJobProducers.test.ts",
        "tests/agentJobsUi.test.ts",
        "tests/webResearch.test.ts",
        "tests/webResearchRuntime.test.ts",
        "tests/agentRuntimeOwnership.test.ts",
        "tests/agentRuntimeClaimRaces.test.ts",
        "tests/storageRegistryHash.test.ts",
        "tests/toolLoading.test.ts",
        "tests/d05ToolCatalog.test.ts",
        "tests/sharedRegisteredToolArguments.test.ts",
    ],
});
