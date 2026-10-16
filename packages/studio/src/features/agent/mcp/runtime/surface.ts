import type {ProductStore} from "../../../../platform/storage/types";
import type {McpRunGeneration, McpRunSnapshot} from "../models/manifest";
import type {McpConnectionOwner} from "./connections";
import {readMcpCatalogueRecord} from "./records";
import {composeMcpRunSnapshot} from "./snapshot";

/** Pure composition used by admission and preview, after every real foundation is known. */
export function composeMcpSurface(generations: readonly McpRunGeneration[], foundationNames: readonly string[]): McpRunSnapshot | undefined {
    return generations.length ? composeMcpRunSnapshot(generations, foundationNames) : undefined;
}

/** Store reads only; caller already owns its transaction. No native or network IO. */
export async function assertMcpSnapshotCurrent(snapshot: McpRunSnapshot | undefined, owner: McpConnectionOwner | undefined, store: ProductStore): Promise<void> {
    if (!snapshot?.generations.length) return;
    const catalogue = await readMcpCatalogueRecord(store);
    for (const generation of snapshot.generations) {
        const row = catalogue.entries.find(item => item.serverId === generation.binding.serverId);
        if (!row?.enabled || row.configRevision !== generation.binding.configRevision || !owner?.isCurrent(generation.binding)) throw new Error("MCP 连接已变化，请重新发送或连接后开始新的执行");
    }
}
