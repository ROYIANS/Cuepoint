import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// Finite E11 source lane; ordinary app imports continue consuming emitted packages.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: [
        "tests/agentExecutionService.test.ts",
        "tests/agentRuntimeOwnership.test.ts",
        "tests/agentRuntimeCredentials.test.ts",
        "tests/e02SubmissionPresentation.test.ts",
        "tests/e03ExecutionFeedback.test.ts",
        "tests/e03ExecutionPresentation.test.ts",
        "tests/b07ComposeSessions.test.ts",
        "tests/e04ReadingNavigation.test.ts",
        "tests/e04AgentQueryDeparture.test.ts",
        "tests/e11RetainedWork.test.ts",
        "tests/d03ChatOwners.test.ts",
        "tests/audioGenerationBatch.test.ts",
        "tests/agentGenerationBatch.test.ts",
        "tests/agentGenerationBatchSafety.test.ts",
        "tests/agentTaskWrapup.test.ts",
        "tests/e01ManualDraftDeparture.test.ts",
    ],
});
