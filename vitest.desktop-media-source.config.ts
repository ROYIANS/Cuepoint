import {createAgentSourceAliases} from "./tooling/agent-source-exports.ts";
import {createStudioVitestConfig} from "./tooling/vitest.studio.ts";

// E08's necessary source lane; normal artifact freshness checks remain separate.
export default createStudioVitestConfig({
    aliases: createAgentSourceAliases(),
    include: [
        "tests/desktopMediaImports.test.ts",
        "tests/nativePreparedBinary.test.ts",
        "tests/mediaDerivatives.test.ts",
        "tests/desktopMediaTools.test.ts",
        "tests/desktopMediaTransport.test.ts",
        "tests/desktopMediaWorkflow.test.ts",
        "tests/desktopMediaUi.test.ts",
        "tests/nativeBinaryAccess.test.ts",
        "tests/projectPackage.test.ts",
        "tests/projectPackageRelations.test.ts",
        "tests/materialLibrary.test.ts",
        "tests/materialIntegration.test.ts",
        "tests/materialPreviewSave.test.ts",
        "tests/mediaPicker.test.ts",
        "tests/mediaPreviewFailure.test.ts",
        "tests/storageRegistryHash.test.ts",
        "tests/sharedStorageContract.test.ts",
        "tests/toolLoading.test.ts",
        "tests/d05ToolCatalog.test.ts",
        "tests/sharedRegisteredToolArguments.test.ts",
    ],
});
