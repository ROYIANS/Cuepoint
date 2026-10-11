import type {ProductStore} from "@/lib/storage/types";
import {type ConnectorConfig, type ConnectorDefinitionId, type ConnectorProtocol, type Id} from "@/domain/types";
import {db as productDb} from "./database";
import {normalizeBaseUrl} from "@/lib/ai/openaiCompatible";
import {createId, nowIso} from "@/lib/ids";

export async function listConnectors(store?: ProductStore): Promise<ConnectorConfig[]> {
    const db = store ?? productDb;
    return db.connectors.orderBy("updatedAt").reverse().toArray();
}

async function getConnectorByDefinition(
    definitionId: ConnectorDefinitionId, store?: ProductStore
): Promise<ConnectorConfig | undefined> {
    const db = store ?? productDb;
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
export async function upsertConnector(input: UpsertConnectorInput, store?: ProductStore): Promise<ConnectorConfig> {
    const db = store ?? productDb;
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const apiKey = input.apiKey.trim();
    if (!baseUrl) throw new Error("请填写 Base URL");
    if (!apiKey) throw new Error("请填写 API Key");

    return db.transaction("rw", [db.connectors, db.connectorAliases].flat(), async (db) => {
        const existing = await getConnectorByDefinition(input.definitionId, db);
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
export async function resolveConnector(id: Id, store?: ProductStore): Promise<ConnectorConfig | undefined> {
    const db = store ?? productDb;
    return (await db.connectors.get(id)) ?? db.connectorAliases.get(id);
}

export async function deleteConnector(id: Id, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction("rw", [db.connectors, db.connectorAliases].flat(), async (db) => {
        const config = await resolveConnector(id, db);
        if (!config) return;
        await db.connectors.where("definitionId").equals(config.definitionId).delete();
        await db.connectorAliases.where("definitionId").equals(config.definitionId).delete();
    });
}
