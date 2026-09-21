import { describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { createChatThread, createProject } from '@/db/repo';
import { createIpProfile, bindProjectIp } from '@/db/ipProfiles';
import { createFileMaterial, setMaterialArchived } from '@/db/materials';
import { beginAgentRun } from '@/db/agentRuns';
import { appendToolResults } from '@/db/agentTools';
import { queueMaterialImage } from '@/lib/agent/materialImageInput';
import { readMaterialText } from '@/lib/agent/materialContent';
import { materializeChatMessages, materializeResponseItems } from '@/lib/ai/referenceWire';
import { toResponseInput } from '@/lib/ai/responsesStream';
import type { AgentReferenceInput } from '@/domain/referenceInput';
import type { AgentRun, AgentToolCall } from '@/domain/agent';
const connector = { id: 'fixture', definitionId: 'openai-compatible', baseUrl: 'https://fixture.test/v1', apiKey: 'fixture', updatedAt: '2026-09-21' };
async function begin(projectId?: string, vision = true) {
  const thread = await createChatThread({ projectId });
  return beginAgentRun({ threadId: thread.id, model: 'fixture-model', connector, content: '查看素材', modelMetadata: { source: 'provider', vision } });
}
const context = (run: AgentRun) => ({ runId: run.id, threadId: run.threadId, projectId: run.projectId, callId: `read-${run.id}`, signal: new AbortController().signal });
async function save(run: AgentRun, name: string, args: unknown, result: { referenceInput: AgentReferenceInput }) {
  const id = context(run).callId;
  const call: AgentToolCall = { id, providerCallId: id, runId: run.id, threadId: run.threadId, step: 1, order: 0, name, title: name, arguments: JSON.stringify(args), status: 'completed', effect: 'read', highRisk: false, result: JSON.stringify(result), createdAt: run.createdAt, updatedAt: run.createdAt };
  await db.agentToolCalls.add(call);
  await appendToolResults(run.id);
  return result.referenceInput;
}
const scope = (run: AgentRun) => ({ runId: run.id, projectId: run.projectId, model: run.model, visionCapability: run.visionCapability });
const messages = (input: AgentReferenceInput) => [{ role: 'user' as const, content: '查看实际内容', referenceInput: input }];
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const image = () => new File([Uint8Array.from(atob(png), char => char.charCodeAt(0))], 'visual.png', { type: 'image/png' });
describe('versioned material references at the model transport boundary', () => {
  it('sends actual immutable library pixels in both protocols without persisting base64', async () => {
    const run = await begin(), material = await createFileMaterial(image(), { kind: 'global' });
    const args = { materialId: material.id, revision: 1 };
    const result = await queueMaterialImage(material.id, 1, context(run));
    const input = await save(run, 'material_read_image', args, result);
    const chat = JSON.stringify(await materializeChatMessages(messages(input), scope(run)));
    const responses = JSON.stringify(await materializeResponseItems(toResponseInput(messages(input)), scope(run)));
    const pixels = `data:image/png;base64,${png}`;
    expect(chat).toContain(pixels); expect(responses).toContain(pixels);
    expect(chat).not.toContain('referenceInput'); expect(responses).not.toContain('readCallId');
    expect(JSON.stringify(await db.agentRuns.get(run.id))).not.toContain('base64');
    expect((await db.agentRuns.get(run.id))?.continuationMessages?.filter(row => row.referenceInput)).toHaveLength(1);
    await appendToolResults(run.id);
    expect((await db.agentRuns.get(run.id))?.continuationMessages?.filter(row => row.referenceInput)).toHaveLength(1);
  });
  it('blocks archived material, changed bytes and foreign-run provenance before dispatch', async () => {
    const run = await begin(), material = await createFileMaterial(image(), { kind: 'global' });
    const input = await save(run, 'material_read_image', { materialId: material.id, revision: 1 }, await queueMaterialImage(material.id, 1, context(run)));
    const other = await begin();
    await expect(materializeChatMessages(messages(input), scope(other))).rejects.toThrow('当前执行');
    await setMaterialArchived(material.id, true);
    await expect(materializeChatMessages(messages(input), scope(run))).rejects.toThrow('归档');
    await setMaterialArchived(material.id, false);
    const version = await db.materialVersions.where('[materialId+revision]').equals([material.id, 1]).first();
    await db.materialVersions.update(version!.id, { payload: { type: 'file', filename: 'visual.png', mimeType: 'image/png', blob: new Blob(['replaced-pixels!!!!']) } });
    await expect(materializeResponseItems(toResponseInput(messages(input)), scope(run))).rejects.toThrow(/变化/);
  });
  it('blocks IP material after project unlink and unsupported vision models', async () => {
    const project = await createProject('创作'), ip = await createIpProfile({ name: '美食 IP' });
    await bindProjectIp(project.id, ip.id);
    const material = await createFileMaterial(image(), { kind: 'ip', id: ip.id });
    const run = await begin(project.id);
    const input = await save(run, 'material_read_image', { materialId: material.id, revision: 1 }, await queueMaterialImage(material.id, 1, context(run)));
    await expect(materializeChatMessages(messages(input), { ...scope(run), visionCapability: { supported: false, source: 'provider' } })).rejects.toThrow();
    await bindProjectIp(project.id, null);
    await expect(materializeChatMessages(messages(input), scope(run))).rejects.toThrow('不属于');
  });
  it('validates text provenance without requiring vision, and rejects withdrawal on replay', async () => {
    const run = await begin(undefined, false), material = await createFileMaterial(new File(['创作方向与配色'], 'guide.txt', { type: 'text/plain' }), { kind: 'global' });
    const args = { materialId: material.id, revision: 1 };
    const input = await save(run, 'material_read_text', args, await readMaterialText(args, context(run)));
    await expect(materializeChatMessages(messages(input), scope(run))).resolves.toEqual([{ role: 'user', content: '查看实际内容' }]);
    await setMaterialArchived(material.id, true);
    await expect(materializeResponseItems(toResponseInput(messages(input)), scope(run))).rejects.toThrow('归档');
  });
});
