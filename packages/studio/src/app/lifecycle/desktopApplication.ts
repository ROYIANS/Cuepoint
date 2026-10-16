import {closeProductStorage, currentProductSession} from "../../platform/product/store";
import {createDesktopLifecyclePort} from "../../platform/runtime/desktopLifecycle";
import {productEffectAdmission} from "../../platform/runtime/effectAdmission";
import {isTauriRuntime} from "../../platform/runtime/runtimeIdentity";
import {clearMcpHostServices, mcpHostServices} from "../../platform/runtime/mcpServices";
import {shutdownSkillDirectoryImports} from "../../platform/runtime/skillImport";
import {shutdownNativeSaves} from "../../platform/runtime/nativeSystemServices";
import {agentExecution} from "../../features/agent/runtime/agentExecution";
import {chatDrafts} from "../../features/agent/runtime/chatDraftStore";
import {disposeMcpRuntime} from "../../features/agent/mcp/runtime/owner";
import {shutdownDesktopMediaImports} from "../../features/library/services/desktopMediaImport";
import {manualQuitGuards} from "../drafts/manualQuitGuards";
import {createApplicationQuit} from "./applicationQuit";

let installation: Promise<void> | undefined;

/** Install once per retained main document, after its authoritative store is ready. */
export function installDesktopApplicationLifecycle(): Promise<void> {
    if (!isTauriRuntime()) return Promise.resolve();
    installation ??= (async () => {
        const port = createDesktopLifecyclePort(await currentProductSession());
        const quit = createApplicationQuit(port, manualQuitGuards, {
            closeAdmission: () => productEffectAdmission.close(),
            stopAgent: () => agentExecution.shutdown(),
            stopReferences: () => chatDrafts.shutdown(),
            stopDesktopImports: shutdownDesktopMediaImports,
            stopNativeEffects: () => Promise.all([shutdownSkillDirectoryImports(), shutdownNativeSaves()]).then(() => undefined),
            async disposeMcp() {
                const host = mcpHostServices();
                const connections = await disposeMcpRuntime();
                const native = host ? await clearMcpHostServices(host) : {status: "drained" as const};
                return {status: connections.status === "drained" && native.status === "drained" ? "drained" : "draining"};
            },
            closeStorage: closeProductStorage,
        });
        await port.subscribe(quit.handle);
        quit.handle(await port.request({kind: "status"}));
    })();
    return installation;
}
