import { describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { beginAgentRun, finishAgentRun, interruptThreadRuns } from '@/db/agentRuns';
import { createAgentTaskForThread } from '@/db/agentTasks';
import { saveToolRound, transitionToolCall } from '@/db/agentTools';
import { getReferenceSource, removeProjectReference } from '@/db/references';
import { addCharacter, createChatThread, createProject, putMedia } from '@/db/repo';
import type { ConnectorConfig } from '@/domain/types';
import { BUILTIN_TOOLS, type AgentToolContext } from '@/lib/agent/tools';
import { prepareAgentGeneration, submitAgentGeneration } from '@/lib/agent/generationRuntime';
import type { GenerationSubmitArgs } from '@/lib/agent/generationProfiles';
import { REFERENCE_TOOLS } from '@/lib/agent/referenceTools';
import { executeChatRun } from '@/lib/agent/runChat';
import { getProjectContext } from '@/lib/agent/projectContext';
import { listModels, testConnection } from '@/lib/ai/openaiCompatible';

const chat: ConnectorConfig = { id: 'audit-chat', definitionId: 'openai-compatible', baseUrl: 'https://audit.test/v1', apiKey: 'audit-secret-only', updatedAt: '2026-09-21' };
async function claim(runId: string, threadId: string, name: string, args: unknown): Promise<AgentToolContext> {
  const providerId = `provider-${name}`;
  await saveToolRound(runId, '', [{ id: providerId, type: 'function', function: { name, arguments: JSON.stringify(args) } }], [{ title: name, effect: name === 'submit_generation' ? 'network' : 'read', highRisk: false }]);
  const call = (await db.agentToolCalls.where('runId').equals(runId).toArray()).find(row => row.providerCallId === providerId)!;
  await transitionToolCall(runId, call.id, ['pending'], 'running');
  return { runId, threadId, callId: call.id, signal: new AbortController().signal };
}

describe('full audit: Agent boundary reproductions (known defects)', () => {
  // These positive safety assertions intentionally fail on the audited revision.
  it('single generation must stop before paid POST if connector is removed while reference upload is pending', async () => {
    const project = await createProject('audit generation');
    const asset = await addCharacter(project.id);
    const config: ConnectorConfig = { ...chat, id: 'audit-generation', definitionId: 'apimart', baseUrl: 'https://generation.test/v1' };
    await db.connectors.put(config);
    await putMedia({ id: 'audit-input', projectId: project.id, mimeType: 'image/png', filename: 'reference.png', blob: new Blob(['reference fixture'], { type: 'image/png' }) });
    const thread = await createChatThread({ projectId: project.id });
    const run = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'generate' });
    const args: GenerationSubmitArgs = { connectorId: config.id, model: 'gpt-image-2', target: { kind: 'character', projectId: project.id, entityId: asset.id, slot: 'front' }, prompt: 'audit', parameters: {}, inputs: [{ mediaId: 'audit-input', role: 'reference-image' }] };
    const context = await claim(run.id, thread.id, 'submit_generation', args);
    context.preview = await prepareAgentGeneration(args, context);
    let paidPosts = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes('/uploads/')) {
        await db.connectors.delete(config.id);
        return Response.json({ url: 'https://cdn.test/upload.png' });
      }
      if (init?.method === 'POST') { paidPosts++; return Response.json({ code: 200, data: [{ task_id: 'paid-after-delete' }] }); }
      throw new Error('fixture: no polling expected after connector deletion');
    });
    await submitAgentGeneration(args, context, { fetchImpl, maxPolls: 1 }).catch(() => undefined);
    expect(await db.connectors.get(config.id)).toBeUndefined();
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/uploads/'))).toBe(true);
    expect(paidPosts).toBe(0);
  });

  it('task_read must not retransmit a withdrawn reference cached in a previous tool result', async () => {
    const project = await createProject('audit references');
    const thread = await createChatThread({ projectId: project.id });
    await createAgentTaskForThread(thread.id, { title: 'audit task', goal: 'review references' });
    const marker = 'WITHDRAWN_SOURCE_SENTINEL_AUDIT';
    const blob = new Blob([marker], { type: 'text/plain' });
    await putMedia({ id: 'audit-document', projectId: project.id, filename: 'audit.txt', mimeType: 'text/plain', blob });
    const reference = { referenceId: 'audit-reference', revision: 1 };
    await db.projectReferences.add({ id: reference.referenceId, projectId: project.id, mediaId: 'audit-document', digest: 'fixture-digest', kind: 'text', filename: 'audit.txt', mimeType: 'text/plain', size: blob.size, revision: 1, status: 'ready', operationId: 'fixture', coverage: { totalUnits: 1, processedUnits: 1, emptyUnits: [], characters: marker.length, truncated: false }, warnings: [], createdAt: '2026-09-21', updatedAt: '2026-09-21' });
    await db.referenceChunks.add({ id: 'audit-chunk', projectId: project.id, referenceId: reference.referenceId, revision: 1, index: 0, text: marker, locator: { kind: 'lines', start: 1, end: 1 } });
    const first = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'read source' });
    const context = await claim(first.id, thread.id, 'project_reference_read', reference);
    const value = await REFERENCE_TOOLS.find(tool => tool.name === 'project_reference_read')!.execute(reference, context);
    await transitionToolCall(first.id, context.callId, ['running'], 'completed', { result: JSON.stringify(value) });
    await finishAgentRun(first.id, 'completed', { content: 'Reference inspected.' });
    await removeProjectReference(project.id, reference.referenceId);
    await expect(getReferenceSource(project.id, reference)).rejects.toThrow('已移除');
    const next = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'inspect task sources' });
    const requests: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      requests.push(String(init?.body));
      if (requests.length === 1) return Response.json({ choices: [{ message: { content: '', tool_calls: [{ id: 'task-read', type: 'function', function: { name: 'task_read', arguments: JSON.stringify({ source: { type: 'tool', id: context.callId } }) } }] }, finish_reason: 'tool_calls' }] });
      return Response.json({ choices: [{ message: { content: 'done' }, finish_reason: 'stop' }] });
    });
    await executeChatRun(next, chat.apiKey, new AbortController(), fetchImpl);
    expect(requests).toHaveLength(2);
    expect(requests[0]).not.toContain(marker);
    expect(requests[1].includes(marker)).toBe(false);
  });

  it('project context should preserve the selected Image Ext version', async () => {
    const project = await createProject('audit image defaults');
    await db.projects.update(project.id, { generationDefaults: { image: { provider: 'apimart', profileVersion: '2026-09-18', model: 'gpt-image-2.5-ext', size: '16:9', resolution: '2k', version: 'sunburst' } } });
    const context = await getProjectContext(project.id);
    expect(JSON.parse(context.content).generationDefaults.image.version).toBe('sunburst');
  });

  it.each([listModels, testConnection])('generic connector errors must redact echoed API keys (%#)', async (probe) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(`Invalid API key: ${chat.apiKey}`, { status: 401 }));
    const result = await probe(chat, fetchImpl);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(chat.apiKey);
  });

  it('a crashed atomic update_run_plan claim should remain safely resumable', async () => {
    const thread = await createChatThread();
    const run = await beginAgentRun({ threadId: thread.id, connector: chat, model: 'audit-model', content: 'plan' });
    const tool = BUILTIN_TOOLS.find(item => item.name === 'update_run_plan')!;
    const args = { steps: [{ id: 'step', title: 'Work', status: 'in_progress' }] };
    await saveToolRound(run.id, '', [{ id: 'plan-call', type: 'function', function: { name: tool.name, arguments: JSON.stringify(args) } }], [{ title: tool.title, effect: tool.effect, highRisk: tool.highRisk(args), atomic: tool.atomic, recovery: tool.recovery }]);
    const call = (await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
    await transitionToolCall(run.id, call.id, ['pending'], 'running');
    // Simulate reload between claim and the atomic mutation/result transaction.
    db.close(); await db.open();
    await interruptThreadRuns(thread.id);
    expect((await db.agentRuns.get(run.id))?.plan).toBeUndefined();
    expect((await db.agentToolCalls.get(call.id))?.status).toBe('pending');
  });
});
