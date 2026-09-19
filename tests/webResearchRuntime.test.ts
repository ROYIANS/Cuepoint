import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { beginAgentRun, interruptThreadRuns } from '@/db/agentRuns';
import { resolveAgentToolApproval } from '@/db/agentTools';
import { getSearchConnectionState, saveSearchConnection } from '@/db/searchConnections';
import { updateGeneralAgentConfig } from '@/db/agentSettings';
import { createChatThread, deleteChatThread } from '@/db/repo';
import { executeChatRun, resumeChatRun } from '@/lib/agent/runChat';
import { provesCompletedEffect, validateTaskSources } from '@/db/agentTaskRecords';
import type { ConnectorConfig } from '@/domain/types';
import type { AgentPermissionMode } from '@/domain/agent';
import * as toolRepo from '@/db/agentTools';

const connector: ConnectorConfig = { id: 'model', name: 'Fixture', definitionId: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'model-secret', updatedAt: '2026-09-19' };
const secret = 'tvly-private-secret';
const search = { name: 'web_search', args: { query: 'night lighting' } };
function tool(name: string, args: unknown, protocol = 'chat-completions') {
  const argumentsText = JSON.stringify(args);
  return protocol === 'responses' ? Response.json({ status: 'completed', output: [{ type: 'function_call', call_id: name, name, arguments: argumentsText }] }) : Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: name, type: 'function', function: { name, arguments: argumentsText } }] }, finish_reason: 'tool_calls' }] });
}
function answer(protocol = 'chat-completions') { return protocol === 'responses' ? Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '来源 https://example.com/research' }] }] }) : Response.json({ choices: [{ message: { content: '来源 https://example.com/research' }, finish_reason: 'stop' }] }); }
async function begin(mode: AgentPermissionMode = 'full') {
  await updateGeneralAgentConfig({ permissionMode: mode, enabledSkillIds: [] });
  await saveSearchConnection({ apiKey: secret, enabled: true });
  const thread = await createChatThread();
  return beginAgentRun({ threadId: thread.id, connector, model: 'fixture', content: 'research' });
}
const serviceResult = () => Response.json({ results: [{ title: 'Research', url: 'https://example.com/research', content: 'lighting summary', raw_content: 'lighting extracted text' }] });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('actual durable web tool lifecycle', () => {
  it.each(['chat-completions', 'responses'] as const)('searches then reads via %s and preserves sources without credentials', async (protocol) => {
    const run = await begin(); await db.agentRuns.update(run.id, { protocol });
    const service = vi.fn(async () => serviceResult()); vi.stubGlobal('fetch', service);
    const bodies: string[] = [];
    const model = vi.fn(async (_url, init) => { bodies.push(String(init?.body)); return bodies.length === 1 ? tool(search.name, search.args, protocol) : bodies.length === 2 ? tool('web_read', { url: 'https://example.com/research' }, protocol) : answer(protocol); });
    await executeChatRun((await db.agentRuns.get(run.id))!, connector.apiKey, new AbortController(), model);
    expect(service).toHaveBeenCalledTimes(2); expect(model).toHaveBeenCalledTimes(3);
    expect(bodies[1]).toContain('lighting summary'); expect(bodies[2]).toContain('lighting extracted text');
    const calls = await db.agentToolCalls.toArray();
    expect(calls.every((call) => call.status === 'completed' && !provesCompletedEffect(call))).toBe(true);
    expect(JSON.stringify([await db.agentRuns.toArray(), calls, await db.chatMessages.toArray(), bodies])).not.toContain(secret);
    expect((await db.agentRuns.get(run.id))?.status).toBe('completed');
    await db.agentRuns.update(run.id, { taskId: 'task' });
    await expect(validateTaskSources({ id: 'task', threadId: run.threadId }, [{ type: 'tool', id: calls[0].id }], 'observation', 'ai')).resolves.toBeUndefined();
    await expect(validateTaskSources({ id: 'task', threadId: run.threadId }, [{ type: 'tool', id: calls[0].id }], 'result', 'ai')).rejects.toThrow('完成结果');
  });
  it('retains ask approval over reopen, refuses changed config before HTTP and never silently re-prepares', async () => {
    const run = await begin('ask');
    const service = vi.fn(async () => serviceResult()); vi.stubGlobal('fetch', service);
    await executeChatRun(run, connector.apiKey, new AbortController(), async () => tool(search.name, search.args));
    const call = (await db.agentToolCalls.toArray())[0];
    expect(call.status).toBe('awaiting_approval'); expect(service).not.toHaveBeenCalled();
    db.close(); await db.open();
    const approvedRevision = call.preview?.revision;
    await saveSearchConnection({ apiKey: 'replacement-key', enabled: true });
    expect((await getSearchConnectionState()).revision).not.toBe(approvedRevision);
    await resolveAgentToolApproval(run.id, call.id, 'approve');
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => answer());
    expect(service).not.toHaveBeenCalled();
    expect((await db.agentToolCalls.get(call.id))?.preview?.revision).toBe(approvedRevision);
    expect(JSON.parse((await db.agentToolCalls.get(call.id))!.result!)).toMatchObject({ ok: false, code: 'configuration_changed' });
  });
  it('allows assist network tools but rejected ask requests never dispatch', async () => {
    const service = vi.fn(async () => serviceResult()); vi.stubGlobal('fetch', service);
    const ask = await begin('ask');
    await executeChatRun(ask, connector.apiKey, new AbortController(), async () => tool(search.name, search.args));
    const call = (await db.agentToolCalls.toArray())[0];
    await resolveAgentToolApproval(ask.id, call.id, 'reject');
    await resumeChatRun(ask.id, connector.apiKey, new AbortController(), async () => answer());
    expect(service).not.toHaveBeenCalled();
    const assist = await begin('assist'); let rounds = 0;
    await executeChatRun(assist, connector.apiKey, new AbortController(), async () => ++rounds === 1 ? tool(search.name, search.args) : answer());
    expect(service).toHaveBeenCalledTimes(1);
  });
  it('saves stopped results and resumes after reopen without repeating the service request', async () => {
    const run = await begin(), controller = new AbortController();
    const service = vi.fn(async () => { controller.abort(); throw new Error('stopped'); }); vi.stubGlobal('fetch', service);
    await executeChatRun(run, connector.apiKey, controller, async () => tool(search.name, search.args));
    const call = (await db.agentToolCalls.toArray())[0];
    expect(call.status).toBe('completed'); expect(JSON.parse(call.result!)).toMatchObject({ code: 'cancelled', serviceMayHaveRun: true });
    db.close(); await db.open();
    await interruptThreadRuns(run.threadId);
    await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => answer());
    expect(service).toHaveBeenCalledTimes(1);
  });
  it('does not resurrect deleted thread/calls when fetch finishes', async () => {
    const run = await begin();
    const service = vi.fn(async () => { await deleteChatThread(run.threadId); return serviceResult(); }); vi.stubGlobal('fetch', service);
    await executeChatRun(run, connector.apiKey, new AbortController(), async () => tool(search.name, search.args));
    expect(service).toHaveBeenCalledTimes(1); expect(await db.agentRuns.count()).toBe(0); expect(await db.agentToolCalls.count()).toBe(0);
  });
  it('keeps a post-service persistence failure unknown and blocks resubmission', async () => {
    const run = await begin(); const original = toolRepo.transitionToolCall;
    const service = vi.fn(async () => serviceResult()); vi.stubGlobal('fetch', service);
    vi.spyOn(toolRepo, 'transitionToolCall').mockImplementation(async (runId, callId, from, to, extra) => { if (to === 'completed') throw new Error('storage unavailable'); return original(runId, callId, from, to, extra); });
    await executeChatRun(run, connector.apiKey, new AbortController(), async () => tool(search.name, search.args));
    expect((await db.agentToolCalls.toArray())[0].status).toBe('unknown');
    await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => answer())).rejects.toThrow('不确定');
    expect(service).toHaveBeenCalledTimes(1);
  });
  it('prepares an accepted 2048-char URL with bounded display while retaining exact arguments', async () => {
    const run = await begin('ask');
    const url = 'https://example.com/' + 'a'.repeat(2028);
    await executeChatRun(run, connector.apiKey, new AbortController(), async () => tool('web_read', { url }));
    const call = (await db.agentToolCalls.toArray())[0];
    expect(call.status).toBe('awaiting_approval'); expect(call.preview?.changes[0].length).toBeLessThan(2000);
    expect(JSON.parse(call.arguments).url).toBe(url);
  });
});
