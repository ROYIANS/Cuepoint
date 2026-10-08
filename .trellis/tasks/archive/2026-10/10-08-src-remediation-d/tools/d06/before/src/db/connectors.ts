import {type ConnectorConfig, type ConnectorDefinitionId, type ConnectorProtocol, type Id} from "@/domain/types";
import {db} from "./database";
import {normalizeBaseUrl} from "@/lib/ai/openaiCompatible";
import {createId, nowIso} from "@/lib/ids";

export async function listConnectors(): Promise<ConnectorConfig[]> {
    return db.connectors.orderBy("updatedAt").reverse().toArray();
}

export async function getConnectorByDefinition(
    definitionId: ConnectorDefinitionId,
): Promise<ConnectorConfig | undefined> {
    return db.connectors.where("definitionId").equals(definitionId).first();
}

export type UpsertConnectorInput = {
    definitionId: ConnectorDefinitionId;
    protocol: ConnectorProtocol;
    baseUrl: string;
    apiKey: string;
    label?: string;
};

/** One saved config per catalog definitionId. */
export async function upsertConnector(input: UpsertConnectorInput): Promise<ConnectorConfig> {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const apiKey = input.apiKey.trim();
    if (!baseUrl) throw new Error("请填写 Base URL");
    if (!apiKey) throw new Error("请填写 API Key");

    return db.transaction("rw", db.connectors, db.connectorAliases, async () => {
        const existing = await getConnectorByDefinition(input.definitionId);
        const record: ConnectorConfig = {
            id: existing?.id ?? createId("conn"),
            definitionId: input.definitionId,
            protocol: input.protocol,
            label: input.label?.trim() || undefined,
            baseUrl,
            apiKey,
            updatedAt: nowIso(),
        };
        await db.connectors.put(record);
        // Explicit edits (including key rotation) apply to retained historical IDs.
        await db.connectorAliases.where("definitionId").equals(input.definitionId).modify((alias) => {
            Object.assign(alias, {...record, id: alias.id});
        });
        return record;
    });
}

/** Resolve a frozen historical ID without exposing retired duplicates in pickers. */
export async function resolveConnector(id: Id): Promise<ConnectorConfig | undefined> {
    return (await db.connectors.get(id)) ?? db.connectorAliases.get(id);
}

export async function deleteConnector(id: Id): Promise<void> {
    await db.transaction("rw", db.connectors, db.connectorAliases, async () => {
        const config = await resolveConnector(id);
        if (!config) return;
        await db.connectors.where("definitionId").equals(config.definitionId).delete();
        await db.connectorAliases.where("definitionId").equals(config.definitionId).delete();
    });
}
