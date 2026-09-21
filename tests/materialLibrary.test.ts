import { describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { createProject, addCharacter, patchCharacter, deleteProject } from '@/db/repo';
import { STUDIO_LIBRARY_ID } from '@/domain/types';
import { emptySlot } from '@/domain/slot';
import { createIpProfile, bindProjectIp, setIpArchived, updateIpProfile } from '@/db/ipProfiles';
import { createFileMaterial, promoteMaterial, promoteLegacyMaterial, addFileMaterialVersion, updateMaterialMetadata, useMaterialInProject, updateMaterialUse, refreshSettingMaterial, setMaterialArchived, deleteMaterial } from '@/db/materials';
const png = (body = 'image') => new File([body], 'image.png', { type: 'image/png' });
const globalScope = { kind: 'global' } as const;

describe('IP ownership', () => {
  it('supports optional links, validates identities and keeps bound projects when archived', async () => {
    const project = await createProject('Film');
    const ip = await createIpProfile({ name: '  美食博主  ', audience: '独居' });
    expect(ip.name).toBe('美食博主');
    await bindProjectIp(project.id, ip.id);
    await setIpArchived(ip.id, true);
    expect(await db.projectIpLinks.get(project.id)).toMatchObject({ ipId: ip.id });
    const other = await createProject('Other');
    await expect(bindProjectIp(other.id, ip.id)).rejects.toThrow('未归档');
    await expect(bindProjectIp('missing', null)).rejects.toThrow('项目');
    await bindProjectIp(project.id, null);
    expect(await db.projectIpLinks.get(project.id)).toBeUndefined();
    expect(await db.projects.get(project.id)).toBeDefined();
  });
  it('serializes concurrent edits using revisions', async () => {
    const ip = await createIpProfile({ name: 'Name' });
    const results = await Promise.allSettled([updateIpProfile(ip.id, { name: 'A' }, 1), updateIpProfile(ip.id, { name: 'B' }, 1)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await db.ipProfiles.get(ip.id))?.revision).toBe(2);
    await expect(updateIpProfile(ip.id, { name: '' }, 2)).rejects.toThrow('名称');
  });
});

describe('material snapshots and references', () => {
  it('validates files and scope without partial records', async () => {
    for (const file of [new File([], 'empty.png', { type: 'image/png' }), new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }), new File(['<html>'], 'x.html', { type: 'text/plain' })]) {
      await expect(createFileMaterial(file, globalScope)).rejects.toThrow();
    }
    await expect(createFileMaterial(png(), { kind: 'ip', id: 'missing' })).rejects.toThrow('IP');
    expect(await db.libraryMaterials.count()).toBe(0);
    expect(await db.materialVersions.count()).toBe(0);
    for (const [name, type] of [['song.mp3', 'audio/mpeg'], ['notes.txt', 'text/plain'], ['clip.mp4', 'video/mp4']]) {
      await createFileMaterial(new File(['data'], name, { type }), globalScope);
    }
    expect(await db.libraryMaterials.count()).toBe(3);
  });
  it('keeps immutable version snapshots and serializes metadata/file conflicts', async () => {
    const material = await createFileMaterial(png('v1'), globalScope);
    const results = await Promise.allSettled([addFileMaterialVersion(material.id, png('v2'), 1), updateMaterialMetadata(material.id, { name: 'changed' }, 1)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const first = await db.materialVersions.where('[materialId+revision]').equals([material.id, 1]).first();
    expect(first?.payload.type === 'file' && await first.payload.blob.text()).toBe('v1');
    expect(await db.materialVersions.count()).toBe(2);
    await updateMaterialMetadata(material.id, { notes: 'note' }, 2);
    expect(await db.materialVersions.count()).toBe(3);
  });
  it('promotes independent bytes that survive source media and project deletion', async () => {
    const source = await createProject('Source');
    await db.media.add({ id: 'original', projectId: source.id, filename: 'pic.png', mimeType: 'image/png', blob: png('original') });
    const material = await promoteLegacyMaterial('media', 'original', globalScope);
    await deleteProject(source.id);
    expect(await db.media.get('original')).toBeUndefined();
    const target = await createProject('Target');
    const use = await useMaterialInProject(material.id, target.id);
    expect(await (await db.media.get(use.targetId))!.blob.text()).toBe('original');
  });
  it('pins adopted media, is idempotent and updates through a new target without rewriting old content', async () => {
    const project = await createProject('Target');
    const material = await createFileMaterial(png('v1'), globalScope);
    const [use, same] = await Promise.all([useMaterialInProject(material.id, project.id), useMaterialInProject(material.id, project.id)]);
    expect(same.id).toBe(use.id);
    await addFileMaterialVersion(material.id, png('v2'), 1);
    expect(await (await db.media.get(use.targetId))!.blob.text()).toBe('v1');
    const next = await updateMaterialUse(use.id);
    expect(next.revision).toBe(2);
    expect(next.targetId).not.toBe(use.targetId);
    expect(await (await db.media.get(next.targetId))!.blob.text()).toBe('v2');
    expect(await db.materialUses.get(use.id)).toMatchObject({ supersededBy: next.id });
    await expect(updateMaterialUse(use.id)).rejects.toThrow('已有更新');
    await setMaterialArchived(material.id, true);
    await expect(useMaterialInProject(material.id, project.id)).rejects.toThrow('归档');
    await expect(deleteMaterial(material.id)).rejects.toThrow('使用');
  });
  it('requires archive and protects derivation provenance until the derived item is removed', async () => {
    const original = await createFileMaterial(png(), globalScope);
    const ip = await createIpProfile({ name: 'IP' });
    const promoted = await promoteMaterial(original.id, { kind: 'ip', id: ip.id });
    await expect(deleteMaterial(original.id)).rejects.toThrow('归档');
    await setMaterialArchived(original.id, true);
    await expect(deleteMaterial(original.id)).rejects.toThrow('来源');
    await setMaterialArchived(promoted.id, true);
    await deleteMaterial(promoted.id);
    await deleteMaterial(original.id);
    expect(await db.materialVersions.count()).toBe(0);
    expect(await db.materialEvents.where('materialId').equals(original.id).count()).toBeGreaterThan(0);
  });
  it('clones settings and remaps media, rejects unsafe refresh and locally modified update', async () => {
    const character = await addCharacter(STUDIO_LIBRARY_ID);
    await patchCharacter(character.id, { name: '饭团' });
    await db.media.add({ id: 'face', projectId: STUDIO_LIBRARY_ID, filename: 'face.png', mimeType: 'image/png', blob: png('face') });
    await db.characters.update(character.id, { slots: { front: { ...emptySlot(), result: { mediaId: 'face', kind: 'image' } } } });
    const material = await promoteLegacyMaterial('character', character.id, globalScope);
    const project = await createProject('Target');
    const use = await useMaterialInProject(material.id, project.id);
    const cloned = (await db.characters.get(use.targetId))!;
    expect(cloned.projectId).toBe(project.id);
    expect(cloned.slots.front?.result?.mediaId).not.toBe('face');
    await patchCharacter(character.id, { name: '饭团新版' });
    await refreshSettingMaterial(material.id, 1);
    await patchCharacter(cloned.id, { name: '项目修改' });
    await expect(updateMaterialUse(use.id)).rejects.toThrow('本地修改');
    expect((await db.characters.get(cloned.id))?.name).toBe('项目修改');
    await db.characters.delete(character.id);
    await expect(refreshSettingMaterial(material.id, 2)).rejects.toThrow('来源');
    expect((await db.libraryMaterials.get(material.id))?.revision).toBe(2);
    // Already captured revision remains usable after deletion of original entity and bytes.
    await db.media.delete('face');
    const another = await createProject('Another');
    const anotherUse = await useMaterialInProject(material.id, another.id);
    expect((await db.characters.get(anotherUse.targetId))?.name).toBe('饭团新版');
  });
  it('rejects foreign or wrong-kind media in source settings before creating snapshots', async () => {
    const character = await addCharacter(STUDIO_LIBRARY_ID);
    const other = await createProject('Other');
    await db.media.add({ id: 'foreign', projectId: other.id, filename: 'x.png', mimeType: 'image/png', blob: png() });
    await db.characters.update(character.id, { slots: { front: { ...emptySlot(), result: { mediaId: 'foreign', kind: 'image' } } } });
    await expect(promoteLegacyMaterial('character', character.id, globalScope)).rejects.toThrow('同一项目');
    expect(await db.libraryMaterials.count()).toBe(0);
  });
  it('rolls back cloned media and project changes when adoption persistence fails', async () => {
    const material = await createFileMaterial(png(), globalScope);
    const project = await createProject('Target');
    const failure = vi.spyOn(db.materialUses, 'add').mockRejectedValueOnce(new Error('quota'));
    try { await expect(useMaterialInProject(material.id, project.id)).rejects.toThrow('quota'); } finally { failure.mockRestore(); }
    expect(await db.media.count()).toBe(0);
    expect(await db.materialUses.count()).toBe(0);
    expect((await db.projects.get(project.id))?.updatedAt).toBe(project.updatedAt);
  });
});

describe('material concurrent lifecycle edges', () => {
  it('rejects stale draft edits even after archive followed by restore', async () => {
    const material = await createFileMaterial(png(), globalScope);
    await setMaterialArchived(material.id, true);
    await setMaterialArchived(material.id, false);
    await expect(updateMaterialMetadata(material.id, { name: 'stale' }, material.revision)).rejects.toThrow('已更新');
    expect((await db.libraryMaterials.get(material.id))?.revision).toBe(3);
    expect(await db.materialVersions.count()).toBe(3);
  });
  it('recreates deleted adoption targets instead of returning a dangling use', async () => {
    const material = await createFileMaterial(png(), globalScope);
    const project = await createProject('Target');
    const use = await useMaterialInProject(material.id, project.id);
    await db.media.delete(use.targetId);
    const replacement = await useMaterialInProject(material.id, project.id);
    expect(replacement.targetId).not.toBe(use.targetId);
    expect(await db.media.get(replacement.targetId)).toBeDefined();
  });
  it('rejects archived project and IP owners and destination projects', async () => {
    const material = await createFileMaterial(png(), globalScope);
    const project = await createProject('Target');
    await db.projects.update(project.id, { archivedAt: new Date().toISOString() });
    await expect(useMaterialInProject(material.id, project.id)).rejects.toThrow('归档');
    await expect(createFileMaterial(png(), { kind: 'project', id: project.id })).rejects.toThrow('归档');
    await expect(bindProjectIp(project.id, null)).rejects.toThrow('归档');
    const ip = await createIpProfile({ name: 'IP' });
    const shared = await createFileMaterial(png(), { kind: 'ip', id: ip.id });
    await setIpArchived(ip.id, true);
    const active = await createProject('Active');
    await expect(useMaterialInProject(shared.id, active.id)).rejects.toThrow('归档');
    await expect(promoteMaterial(shared.id, globalScope)).rejects.toThrow('归档');
  });
  it('serializes competing explicit version updates and keeps both historical targets', async () => {
    const material = await createFileMaterial(png(), globalScope);
    const project = await createProject('Target');
    const use = await useMaterialInProject(material.id, project.id);
    await addFileMaterialVersion(material.id, png('new'), 1);
    const results = await Promise.allSettled([updateMaterialUse(use.id), updateMaterialUse(use.id)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.materialUses.count()).toBe(2);
    expect(await db.media.count()).toBe(2);
  });
  it('updates untouched settings through a new snapshot and preserves the original record', async () => {
    const character = await addCharacter(STUDIO_LIBRARY_ID);
    await patchCharacter(character.id, { name: 'Old' });
    const material = await promoteLegacyMaterial('character', character.id, globalScope);
    const project = await createProject('Target');
    const use = await useMaterialInProject(material.id, project.id);
    await patchCharacter(character.id, { name: 'New' });
    await refreshSettingMaterial(material.id, 1);
    const replacement = await updateMaterialUse(use.id);
    expect((await db.characters.get(use.targetId))?.name).toBe('Old');
    expect((await db.characters.get(replacement.targetId))?.name).toBe('New');
  });
});

describe('IP lifecycle and binding concurrency', () => {
  it('invalidates old drafts across archive/restore and rejects editing archived profiles', async () => {
    const ip = await createIpProfile({ name: 'IP' });
    await setIpArchived(ip.id, true);
    await expect(updateIpProfile(ip.id, { name: 'Blocked' }, 2)).rejects.toThrow('恢复');
    await setIpArchived(ip.id, false);
    await expect(updateIpProfile(ip.id, { name: 'Stale' }, 1)).rejects.toThrow('已更新');
    await updateIpProfile(ip.id, { positioning: 'Current' }, 3);
    expect(await db.ipProfiles.get(ip.id)).toMatchObject({ name: 'IP', revision: 4, positioning: 'Current' });
  });
  it('preserves existing binding when a replacement IP is invalid or archived', async () => {
    const project = await createProject('Project');
    const ip = await createIpProfile({ name: 'Active' });
    const archived = await createIpProfile({ name: 'Archived' });
    await setIpArchived(archived.id, true);
    await bindProjectIp(project.id, ip.id);
    await expect(bindProjectIp(project.id, archived.id)).rejects.toThrow('未归档');
    await expect(bindProjectIp(project.id, 'missing')).rejects.toThrow('未归档');
    expect((await db.projectIpLinks.get(project.id))?.ipId).toBe(ip.id);
  });
  it('serializes archive against new binding and never deletes an existing project', async () => {
    const project = await createProject('Project');
    const ip = await createIpProfile({ name: 'IP' });
    const results = await Promise.allSettled([setIpArchived(ip.id, true), bindProjectIp(project.id, ip.id)]);
    expect(results[0].status).toBe('fulfilled');
    // Either the association committed first, or the later bind was rejected.
    if (results[1].status === 'fulfilled') expect((await db.projectIpLinks.get(project.id))?.ipId).toBe(ip.id);
    else expect(await db.projectIpLinks.get(project.id)).toBeUndefined();
    expect(await db.projects.get(project.id)).toBeDefined();
  });
});

describe('adoption scope authorization', () => {
  it('allows only the owning project to adopt project materials, including idempotent calls', async () => {
    const owner = await createProject('Owner');
    const other = await createProject('Other');
    const material = await createFileMaterial(png(), { kind: 'project', id: owner.id });
    await expect(useMaterialInProject(material.id, other.id)).rejects.toThrow('所属项目');
    const use = await useMaterialInProject(material.id, owner.id);
    expect((await useMaterialInProject(material.id, owner.id)).id).toBe(use.id);
    expect(await db.materialUses.count()).toBe(1);
    expect(await db.media.where('projectId').equals(other.id).count()).toBe(0);
  });
  it('requires the same IP on initial adoption and rechecks it before idempotence or updates', async () => {
    const ip = await createIpProfile({ name: 'IP' });
    const otherIp = await createIpProfile({ name: 'Other IP' });
    const project = await createProject('Project');
    const material = await createFileMaterial(png(), { kind: 'ip', id: ip.id });
    await expect(useMaterialInProject(material.id, project.id)).rejects.toThrow('同一 IP');
    await bindProjectIp(project.id, otherIp.id);
    await expect(useMaterialInProject(material.id, project.id)).rejects.toThrow('同一 IP');
    await bindProjectIp(project.id, ip.id);
    const use = await useMaterialInProject(material.id, project.id);
    await bindProjectIp(project.id, null);
    await expect(useMaterialInProject(material.id, project.id)).rejects.toThrow('同一 IP');
    await expect(updateMaterialUse(use.id)).rejects.toThrow('同一 IP');
    await addFileMaterialVersion(material.id, png('new'), 1);
    await expect(updateMaterialUse(use.id)).rejects.toThrow('同一 IP');
    expect(await db.materialUses.count()).toBe(1);
    expect(await db.media.get(use.targetId)).toBeDefined();
    await bindProjectIp(project.id, ip.id);
    expect((await updateMaterialUse(use.id)).revision).toBe(2);
  });
  it('rejects same-revision update when its target was deleted instead of returning dangling records', async () => {
    const project = await createProject('Project');
    const material = await createFileMaterial(png(), globalScope);
    const use = await useMaterialInProject(material.id, project.id);
    await db.media.delete(use.targetId);
    await expect(updateMaterialUse(use.id)).rejects.toThrow('重新加入');
    const replacement = await useMaterialInProject(material.id, project.id);
    expect(await db.media.get(replacement.targetId)).toBeDefined();
  });
});
