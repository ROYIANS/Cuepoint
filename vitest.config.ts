import {assertAgentPackageFreshness} from "./tooling/agent-package-inputs";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

await assertAgentPackageFreshness();

export default createStudioVitestConfig();
