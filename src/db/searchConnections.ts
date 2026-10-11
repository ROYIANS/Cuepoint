import type {ProductStore} from "@/lib/storage/types";
import {db as productDb} from './database';
import {getGeneralAgentConfig} from './agentSettings';
import type {SearchConnectionState} from '@/domain/search';
import {createId, nowIso} from '@/lib/ids';

export async function getSearchConnectionState(store?: ProductStore): Promise<SearchConnectionState> {
    const db = store ?? productDb;
    const config = await db.searchConnections.get('tavily');
    return {configured: !!config?.apiKey, enabled: !!config?.enabled, revision: config?.revision};
}

export async function saveSearchConnection(input: { apiKey?: string; enabled: boolean }, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction('rw', [db.searchConnections, db.agents].flat(), async (db) => {
        const previous = await db.searchConnections.get('tavily');
        const apiKey = input.apiKey?.trim() || previous?.apiKey;
        if (!apiKey || apiKey.length > 2048 || /\s/.test(apiKey)) throw new Error('请填写有效的 Tavily API Key');
        await db.searchConnections.put({
            id: 'tavily',
            provider: 'tavily',
            apiKey,
            enabled: input.enabled,
            revision: createId('searchcfg'),
            updatedAt: nowIso()
        });
        if (input.enabled) {
            const agent = await getGeneralAgentConfig(db);
            await db.agents.update(agent.id, {
                enabledSkillIds: [...new Set([...(agent.enabledSkillIds ?? []), 'web-research'])],
                updatedAt: nowIso()
            });
        }
    });
}

export async function removeSearchConnection(store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.searchConnections.delete('tavily');
}
