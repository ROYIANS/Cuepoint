import { db } from './database';
import { getGeneralAgentConfig } from './agentSettings';
import type { SearchConnectionState } from '@/domain/search';
import { createId, nowIso } from '@/lib/ids';

export async function getSearchConnectionState(): Promise<SearchConnectionState> {
  const config = await db.searchConnections.get('tavily');
  return { configured: !!config?.apiKey, enabled: !!config?.enabled, revision: config?.revision };
}
export async function saveSearchConnection(input: { apiKey?: string; enabled: boolean }): Promise<void> {
  await db.transaction('rw', db.searchConnections, db.agents, async () => {
    const previous = await db.searchConnections.get('tavily');
    const apiKey = input.apiKey?.trim() || previous?.apiKey;
    if (!apiKey || apiKey.length > 2048 || /\s/.test(apiKey)) throw new Error('请填写有效的 Tavily API Key');
    await db.searchConnections.put({ id: 'tavily', provider: 'tavily', apiKey, enabled: input.enabled, revision: createId('searchcfg'), updatedAt: nowIso() });
    if (input.enabled) {
      const agent = await getGeneralAgentConfig();
      await db.agents.update(agent.id, { enabledSkillIds: [...new Set([...(agent.enabledSkillIds ?? []), 'web-research'])], updatedAt: nowIso() });
    }
  });
}
export async function removeSearchConnection(): Promise<void> { await db.searchConnections.delete('tavily'); }
