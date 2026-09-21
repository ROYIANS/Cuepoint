import { describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { beginAgentRun } from '@/db/agentRuns';
import { createChatThread } from '@/db/repo';
import { createFileMaterial } from '@/db/materials';
import { queueMaterialImage } from '@/lib/agent/materialImageInput';
import { assertImageQueueCapacity } from '@/lib/agent/imageQueue';
import type { AgentToolContext } from '@/lib/agent/tools';
import type { AgentReferenceInput } from '@/domain/referenceInput';
const connector = { id: 'fixture', definitionId: 'openai-compatible', baseUrl: 'https://fixture.test/v1', apiKey: 'fixture', updatedAt: '2026-09-21' };
const pngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
const png = () => new File([pngBytes], 'actual.png', { type: 'image/png' });
async function run(vision = true, projectId?: string) {
  const thread = await createChatThread({ projectId });
  return beginAgentRun({ threadId: thread.id, model: 'fixture-model', connector, content: '看图', modelMetadata: { source: 'provider', vision } });
}
const ctx = (r: Awaited<ReturnType<typeof run>>): AgentToolContext => ({ runId: r.id, threadId: r.threadId, projectId: r.projectId, callId: `image-${r.id}`, signal: new AbortController().signal });
describe('material image queue validation', () => {
  it('rejects non-vision models before creating a successful tool result', async () => {
    const r = await run(false), m = await createFileMaterial(png(), { kind: 'global' });
    await expect(queueMaterialImage(m.id, 1, ctx(r))).rejects.toThrow();
    expect(await db.agentToolCalls.where('runId').equals(r.id).count()).toBe(0);
  });
  it('validates actual signatures and dimensions, rejecting MIME-spoofed text', async () => {
    const r = await run(), spoof = await createFileMaterial(new File(['not png'], 'fake.png', { type: 'image/png' }), { kind: 'global' });
    await expect(queueMaterialImage(spoof.id, 1, ctx(r))).rejects.toThrow('文件内容');
    const m = await createFileMaterial(png(), { kind: 'global' });
    const result = await queueMaterialImage(m.id, 1, ctx(r));
    expect(result.referenceInput.images?.[0]).toMatchObject({ mimeType: 'image/png', size: pngBytes.length });
  });
  it('counts appended and completed unappended image reads across sources', async () => {
    const r = await run(), m = await createFileMaterial(png(), { kind: 'global' });
    const input: AgentReferenceInput = { projectId: 'studio', references: [], images: [{ projectId: 'studio', mediaId: 'x', filename: 'x.png', mimeType: 'image/png', size: 10 }] };
    await db.agentRuns.update(r.id, { continuationMessages: Array.from({ length: 9 }, (_, i) => ({ role: 'user' as const, content: `x${i}`, referenceInput: input })) });
    await expect(queueMaterialImage(m.id, 1, ctx(r))).resolves.toMatchObject({ status: 'queued' });
    await db.agentRuns.update(r.id, { continuationMessages: Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `x${i}`, referenceInput: input })) });
    await expect(queueMaterialImage(m.id, 1, ctx(r))).rejects.toThrow('10 张');
    await db.agentRuns.update(r.id, { continuationMessages: [] });
    for (let i = 0; i < 10; i++) await db.agentToolCalls.add({ id: `call-${i}`, providerCallId: `call-${i}`, runId: r.id, threadId: r.threadId, step: i + 1, order: 0, name: i % 2 ? 'material_read_image' : 'read_project_image', title: 'image', arguments: '{}', effect: 'read', highRisk: false, status: 'completed', result: JSON.stringify({ referenceInput: input }), createdAt: '2026-09-21', updatedAt: '2026-09-21' });
    await expect(assertImageQueueCapacity(ctx(r))).rejects.toThrow('10 张');
    await db.agentToolCalls.delete('call-9');
    await db.agentRuns.update(r.id, { continuationMessages: [{ role: 'user', content: 'already appended', sourceToolCallId: 'call-0', referenceInput: input }] });
    await expect(assertImageQueueCapacity(ctx(r))).resolves.toBeUndefined();
  });
});
