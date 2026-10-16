import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// Finite source checks for E09; ordinary consumers still require emitted packages.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: [
        "packages/agent-core/src/skills.test.ts",
        "tests/installableSkills.test.ts",
        "tests/skillImportTransport.test.ts",
        "tests/browserSkillImport.test.ts",
        "tests/installedSkillsUi.test.tsx",
        "tests/installedSkillRuns.test.ts",
        "tests/installedSkillTools.test.ts",
        "tests/installedSkillProtocols.test.ts",
        "tests/agentRuns.test.ts",
        "tests/toolLoading.test.ts",
        "tests/contextPreviewSnapshot.test.ts",
        "tests/contextManagement.test.ts",
    ],
});
