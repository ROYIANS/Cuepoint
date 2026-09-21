import { describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { addCharacter, createChatThread, createProject } from '@/db/repo';
import { createIpProfile, bindProjectIp, setIpArchived } from '@/db/ipProfiles';
import { createFileMaterial, promoteLegacyMaterial, updateMaterialMetadata, useMaterialInProject, setMaterialArchived } from '@/db/materials';
import { beginAgentRun } from '@/db/agentRuns';
import { MATERIAL_TOOLS } from '@/lib/agent/materialTools';
import { MATERIAL_TOOL_NAMES } from '@/lib/agent/materialToolNames';
import { requiresToolApproval } from '@/lib/agent/tools';
import type { AgentRun, AgentToolCall } from '@/domain/agent';
import type { AgentToolContext } from '@/lib/agent/tools';
import { createId } from '@/lib/ids';
import { registerPendingDraft } from '@/lib/debouncedDraft';
const connector = { id: 'fixture', definitionId: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'secret', updatedAt: '2026-09-21' };
async function runFor(projectId?: string) {
  const thread = await createChatThread({ projectId });
  const run = await beginAgentRun({ threadId: thread.id, connector, model: 'model', content: '整理素材' });
  await db.agentRuns.update(run.id, { enabledToolNames: [...(run.enabledToolNames ?? []), ...MATERIAL_TOOL_NAMES] });
  return run;
}
async function prepared(run: AgentRun, name: string, args: unknown) {
  const tool = MATERIAL_TOOLS.find(item => item.name === name)!;
  const parsed = tool.parseArguments(args);
  const context: AgentToolContext = { runId: run.id, threadId: run.threadId, callId: createId('call'), projectId: run.projectId, signal: new AbortController().signal };
  const preview = await tool.prepare?.(parsed, context);
  context.preview = preview;
  const call: AgentToolCall = { id: context.callId, runId: run.id, threadId: run.threadId, providerCallId: context.callId, step: 1, order: 0, name, title: tool.title, arguments: JSON.stringify(args), effect: tool.effect, highRisk: tool.highRisk(parsed), status: 'running', createdAt: '2026-09-21', updatedAt: '2026-09-21', atomic: tool.atomic, preview };
  await db.agentToolCalls.add(call);
  return { context, preview, call, execute: () => tool.execute(parsed, context) };
}
async function invoke(run: AgentRun, name: string, args: unknown) { return (await prepared(run, name, args)).execute(); }
function file(text = 'hello world', name = 'notes.txt') { return new File([text], name, { type: 'text/plain' }); }

describe('Agent material scope and bounded reads', () => {
  it('strict schemas reject paths, unknown fields, oversized reads and missing version', () => {
    const read = MATERIAL_TOOLS.find(tool => tool.name === 'material_read_text')!;
    expect(() => read.parseArguments({ materialId: 'x', revision: 1, limit: 4 })).toThrow();
    expect(() => read.parseArguments({ materialId: 'x', revision: 1, url: 'file:///secret' })).toThrow();
    expect(() => read.parseArguments({ materialId: 'x' })).toThrow();
    const promote = MATERIAL_TOOLS.find(tool => tool.name === 'material_promote')!;
    expect(() => promote.parseArguments({ source: 'library', sourceId: 'x', scope: { kind: 'ip', id: 'i' } })).toThrow();
    expect(() => promote.parseArguments({ source: 'media', sourceId: 'x', scope: { kind: 'global', id: 'i' } })).toThrow();
  });
  it('bound searches and reads expose only shared, own project and current linked IP', async () => {
    const project = await createProject('A'), other = await createProject('B');
    const ip = await createIpProfile({ name: 'IP-A' }), otherIp = await createIpProfile({ name: 'IP-B' });
    await bindProjectIp(project.id, ip.id);
    const global = await createFileMaterial(file(), { kind: 'global' });
    const own = await createFileMaterial(file(), { kind: 'project', id: project.id });
    const linked = await createFileMaterial(file(), { kind: 'ip', id: ip.id });
    const foreign = await createFileMaterial(file(), { kind: 'project', id: other.id });
    const foreignIp = await createFileMaterial(file(), { kind: 'ip', id: otherIp.id });
    const run = await runFor(project.id);
    const found = await invoke(run, 'material_search', { query: '' }) as { items: { id: string }[] };
    expect(found.items.map(row => row.id).sort()).toEqual([global.id, own.id, linked.id].sort());
    await expect(invoke(run, 'material_read', { materialId: foreign.id })).rejects.toThrow('不属于');
    await expect(invoke(run, 'material_read', { materialId: foreignIp.id })).rejects.toThrow('不属于');
    await bindProjectIp(project.id, null);
    await expect(invoke(run, 'material_read', { materialId: linked.id })).rejects.toThrow('不属于');
  });
  it('reads immutable document versions with actual text, pagination, provenance and no Blob', async () => {
    const run = await runFor();
    const material = await createFileMaterial(file('A'.repeat(17000)), { kind: 'global' });
    await updateMaterialMetadata(material.id, { name: 'Renamed' }, 1);
    const read = await invoke(run, 'material_read_text', { materialId: material.id, revision: 1, limit: 1 }) as { chunks: { text: string; citation: string }[]; nextStart: number; partial: boolean; referenceInput: { material: { digest: string; revision: number } } };
    expect(read.chunks[0].text).toBe('A'.repeat(4000));
    expect(read.chunks[0].citation).toBe(`${material.id}@1#0`);
    expect(read.nextStart).toBe(1); expect(read.partial).toBe(true);
    expect(read.referenceInput.material.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(read.referenceInput.material.revision).toBe(1);
    expect(JSON.stringify(read)).not.toMatch(/base64|"blob"/);
    const next = await invoke(run, 'material_read_text', { materialId: material.id, revision: 1, start: 1, limit: 3 }) as { chunks: unknown[] };
    expect(next.chunks).toHaveLength(3);
    await setMaterialArchived(material.id, true);
    await expect(invoke(run, 'material_read_text', { materialId: material.id, revision: 1 })).rejects.toThrow('已归档');
  });
  it('refuses to pretend audio/video metadata is content', async () => {
    const material = await createFileMaterial(new File(['audio'], 'music.mp3', { type: 'audio/mpeg' }), { kind: 'global' });
    const run = await runFor();
    await expect(invoke(run, 'material_read_text', { materialId: material.id, revision: 1 })).rejects.toThrow('不能声称');
    const result = await invoke(run, 'material_read', { materialId: material.id });
    expect(JSON.stringify(result)).not.toContain('blob');
    expect(JSON.stringify(result)).toContain('未观看或听取');
  });
  it.each(['ip', 'project'] as const)('hides setting contents when its %s owner is archived but retains metadata', async (ownerKind) => {
    const project = await createProject('A');
    const ip = await createIpProfile({ name: 'IP' });
    const character = await addCharacter(project.id);
    await db.characters.update(character.id, { description: 'Private character narrative' });
    const material = await promoteLegacyMaterial('character', character.id, { kind: ownerKind, id: ownerKind === 'ip' ? ip.id : project.id });
    const run = await runFor();
    expect(JSON.stringify(await invoke(run, 'material_read', { materialId: material.id }))).toContain('Private character narrative');
    if (ownerKind === 'ip') await setIpArchived(ip.id, true);
    else await db.projects.update(project.id, { archivedAt: '2026-09-21' });
    const result = await invoke(run, 'material_read', { materialId: material.id });
    expect(result).toMatchObject({ material: { id: material.id }, contentAvailable: false });
    expect(result).not.toHaveProperty('setting');
    expect(JSON.stringify(result)).not.toContain('Private character narrative');
  });
});

describe('Agent material writes preserve immutable approval and project copies', () => {
  it('forces confirmation for formal IP promotion even in full mode, snapshots exactly once', async () => {
    const ip = await createIpProfile({ name: '美食博主' });
    const source = await createFileMaterial(file('IP guide'), { kind: 'global' });
    const run = await runFor();
    const tool = MATERIAL_TOOLS.find(item => item.name === 'material_promote')!;
    expect(requiresToolApproval('full', tool, {})).toBe(true);
    const pending = await prepared(run, tool.name, { source: 'library', sourceId: source.id, expectedRevision: 1, scope: { kind: 'ip', id: ip.id } });
    expect(pending.preview?.changes.join('\n')).toContain('正式专属');
    expect(await db.libraryMaterials.count()).toBe(1);
    const first = await pending.execute();
    expect(await pending.execute()).toEqual(first);
    expect(await db.libraryMaterials.count()).toBe(2);
    const cloned = (await db.libraryMaterials.toArray()).find(row => row.id !== source.id)!;
    expect(cloned.source).toEqual({ materialId: source.id, revision: 1 });
    expect(cloned.scope).toEqual({ kind: 'ip', id: ip.id });
    expect((await db.agentToolCalls.get(pending.call.id))?.status).toBe('completed');
  });
  it('stale revision and changed scope owner cannot use old approval', async () => {
    const run = await runFor();
    const ip = await createIpProfile({ name: 'A' });
    const source = await createFileMaterial(file(), { kind: 'global' });
    const metadata = await prepared(run, 'material_update_metadata', { materialId: source.id, revision: 1, patch: { tags: ['美食'] } });
    await updateMaterialMetadata(source.id, { notes: 'manual edit' }, 1);
    await expect(metadata.execute()).rejects.toThrow('已更新');
    expect((await db.libraryMaterials.get(source.id))?.tags).toEqual([]);
    const promote = await prepared(run, 'material_promote', { source: 'library', sourceId: source.id, expectedRevision: 2, scope: { kind: 'ip', id: ip.id } });
    await db.ipProfiles.update(ip.id, { revision: 2, name: 'Changed' });
    await expect(promote.execute()).rejects.toThrow('已变化');
    expect(await db.libraryMaterials.count()).toBe(1);
  });
  it('business write and ledger roll back together on persistence failure', async () => {
    const material = await createFileMaterial(file(), { kind: 'global' });
    const pending = await prepared(await runFor(), 'material_update_metadata', { materialId: material.id, revision: 1, patch: { tags: ['美食'] } });
    const spy = vi.spyOn(db.agentToolCalls, 'update').mockRejectedValueOnce(new Error('fixture save failed'));
    await expect(pending.execute()).rejects.toThrow('fixture save failed');
    spy.mockRestore();
    expect((await db.libraryMaterials.get(material.id))?.revision).toBe(1);
    expect(await db.materialVersions.where('materialId').equals(material.id).count()).toBe(1);
  });
  it('adopts and explicitly adds new copy without changing old file, refusing another project destination', async () => {
    const project = await createProject('A'), other = await createProject('B'), run = await runFor(project.id);
    const material = await createFileMaterial(file('original'), { kind: 'global' });
    await expect(invoke(run, 'material_use', { materialId: material.id, revision: 1, projectId: other.id })).rejects.toThrow('当前项目');
    const first = await invoke(run, 'material_use', { materialId: material.id, revision: 1, projectId: project.id }) as { use: { id: string; targetId: string; revision: number } };
    await updateMaterialMetadata(material.id, { tags: ['new'] }, 1);
    const next = await invoke(run, 'material_update_use', { useId: first.use.id, revision: 2 }) as typeof first;
    expect(next.use.targetId).not.toBe(first.use.targetId);
    expect(await db.media.get(first.use.targetId)).toBeTruthy();
    expect((await db.materialUses.get(first.use.id))?.revision).toBe(1);
    expect((await db.materialUses.get(next.use.id))?.revision).toBe(2);
    await invoke(run, 'material_archive', { materialId: material.id, revision: 2, archived: true });
    expect(await db.media.get(first.use.targetId)).toBeTruthy();
  });
  it('release removes idle copies but actual project references remain protected', async () => {
    const project = await createProject('A'), run = await runFor(project.id);
    const material = await createFileMaterial(file(), { kind: 'global' });
    const use = await useMaterialInProject(material.id, project.id);
    await db.projects.update(project.id, { coverMediaId: use.targetId });
    await expect(invoke(run, 'material_release', { useId: use.id })).rejects.toThrow('仍被');
    expect(await db.materialUses.get(use.id)).toBeTruthy();
    await db.projects.update(project.id, { coverMediaId: undefined });
    await invoke(run, 'material_release', { useId: use.id });
    expect(await db.materialUses.get(use.id)).toBeUndefined();
    expect(await db.media.get(use.targetId)).toBeUndefined();
    expect(await db.libraryMaterials.get(material.id)).toBeTruthy();
  });
  it('releases its own unused copy after IP unlink without reopening source or foreign-project access', async () => {
    const project = await createProject('A'), foreign = await createProject('B');
    const ip = await createIpProfile({ name: 'Former IP' });
    await bindProjectIp(project.id, ip.id);
    await bindProjectIp(foreign.id, ip.id);
    const material = await createFileMaterial(file('old IP guide', 'project-copy.txt'), { kind: 'ip', id: ip.id });
    const ownUse = await useMaterialInProject(material.id, project.id);
    const foreignUse = await useMaterialInProject(material.id, foreign.id);
    await bindProjectIp(project.id, null);
    await updateMaterialMetadata(material.id, { name: 'Private updated source name' }, 1);
    const run = await runFor(project.id);
    await expect(invoke(run, 'material_read', { materialId: material.id })).rejects.toThrow('不属于');
    await expect(invoke(run, 'material_update_use', { useId: ownUse.id, revision: 2 })).rejects.toThrow('不属于');
    await expect(invoke(run, 'material_release', { useId: foreignUse.id })).rejects.toThrow('当前项目');
    const pending = await prepared(run, 'material_release', { useId: ownUse.id });
    expect(pending.preview?.changes.join('\n')).toContain('project-copy.txt');
    expect(pending.preview?.changes.join('\n')).not.toContain('Private updated source name');
    expect(pending.preview?.target?.href).toBe(`/p/${project.id}`);
    await pending.execute();
    expect(await db.materialUses.get(ownUse.id)).toBeUndefined();
    expect(await db.media.get(ownUse.targetId)).toBeUndefined();
    expect(await db.materialUses.get(foreignUse.id)).toBeTruthy();
    expect(await db.media.get(foreignUse.targetId)).toBeTruthy();
    expect(await db.libraryMaterials.get(material.id)).toBeTruthy();
  });
  it('flushes pending project edits before release and does not flush another project before rejecting it', async () => {
    const project = await createProject('A'), foreign = await createProject('B');
    const material = await createFileMaterial(file(), { kind: 'global' });
    const use = await useMaterialInProject(material.id, project.id);
    const foreignUse = await useMaterialInProject(material.id, foreign.id);
    const run = await runFor(project.id);
    const saveCover = vi.fn(async () => { await db.projects.update(project.id, { coverMediaId: use.targetId }); });
    const foreignSave = vi.fn(async () => {});
    const stop = registerPendingDraft(project.id, saveCover), stopForeign = registerPendingDraft(foreign.id, foreignSave);
    try {
      await expect(invoke(run, 'material_release', { useId: foreignUse.id })).rejects.toThrow('当前项目');
      expect(foreignSave).not.toHaveBeenCalled();
      await expect(invoke(run, 'material_release', { useId: use.id })).rejects.toThrow('仍被');
      expect(saveCover).toHaveBeenCalled();
      expect(await db.media.get(use.targetId)).toBeTruthy();
    } finally { stop(); stopForeign(); }
  });

});
