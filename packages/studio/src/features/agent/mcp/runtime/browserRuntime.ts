import {createBrowserMcpServices} from "../../../../platform/runtime/browserMcp";
import {installMcpHostServices, mcpHostServices} from "../../../../platform/runtime/mcpServices";
import {getProductStorage} from "../../../../platform/runtime/storageProfile";
import {getMcpCatalogue} from "../queries/catalogue";

/** Named feature integration: the fixed ProductStore remains the catalogue authority. */
export async function installBrowserMcpRuntime(): Promise<void> {
    if (getProductStorage().storage !== "indexeddb" || mcpHostServices()) return;
    const host = createBrowserMcpServices({readCatalogue: () => getMcpCatalogue()});
    try {await host.initialize(); installMcpHostServices(host);} catch {await host.dispose();}
}
