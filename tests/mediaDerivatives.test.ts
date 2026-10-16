import {describe, expect, it} from 'vitest';
import JSZip from 'jszip';
import {db} from '@/platform/product/store';
import {createProject} from '@/features/projects/commands/projects';
import {collectMediaIds, deleteMediaIfOrphans} from '@/features/library/commands/media';
import {reusableMedia} from '@/features/library/services/mediaPicker';
import {exportProjectZip, importProjectZip} from '@/app/workflows/packages/projectPackage';
import {adoptMaterialInProject, promoteLegacyMaterial} from '@/features/library/commands/materials';
import {addCharacter, setCharacterSlot} from '@/features/library/commands/assets';
import {copyStudioCharacter} from '@/features/library/commands/assetReuse';
import {emptySlot} from '@/features/library/models/slot';
import {STUDIO_LIBRARY_ID} from '@/features/library/models/ownership';
import {BUSINESS_TOOLS} from '@/features/video/agent/businessTools';
import {MATERIAL_TOOLS} from '@/features/library/agent/materialTools';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import type {AgentToolContext} from '@/features/agent/runtime/tools';
import {registeredTools} from './helpers/registeredTools';

async function pair(projectId: string, retained = true) {
    await db.media.bulkAdd([
        {id: 'source', projectId, filename: 'clip.mp4', mimeType: 'video/mp4', blob: new Blob(['video'], {type: 'video/mp4'}), libraryRetained: retained, thumbnailMediaId: 'thumbnail'},
        {id: 'thumbnail', projectId, filename: 'clip.thumbnail.png', mimeType: 'image/png', blob: new Blob(['png'], {type: 'image/png'}), derivative: {kind: 'video-thumbnail', sourceMediaId: 'source'}},
    ]);
}

describe('video derivative ownership closure', () => {
    it('hides derivatives from Agent media searches and refuses direct thumbnail promotion before effects', async () => {
        const project = await createProject('agent selection'); await pair(project.id);
        const thread = await createChatThread({projectId: project.id});
        const run = await beginAgentRun({threadId: thread.id, connector: {id: 'fixture', definitionId: 'openai-compatible', protocol: 'openai-compatible', baseUrl: 'https://fixture.invalid/v1', apiKey: 'not-real', updatedAt: '2026-10-16'}, model: 'fixture', content: '选择视频素材'});
        const context: AgentToolContext = {runId: run.id, threadId: thread.id, callId: 'read', projectId: project.id, signal: new AbortController().signal};
        const tools = registeredTools([...BUSINESS_TOOLS, ...MATERIAL_TOOLS]);
        const businessSearch = tools.find(tool => tool.name === 'business_search')!;
        const business = await businessSearch.execute(businessSearch.parseArguments({kind: 'media', ownerId: project.id}), context) as {total: number; items: {id: string}[]};
        expect(business.total).toBe(1); expect(business.items.map(item => item.id)).toEqual(['source']);
        const materialSearch = tools.find(tool => tool.name === 'material_search')!;
        const material = await materialSearch.execute(materialSearch.parseArguments({source: 'legacy', legacyKind: 'media', query: ''}), context) as {total: number; items: {sourceId: string}[]};
        expect(material.total).toBe(1); expect(material.items.map(item => item.sourceId)).toEqual(['source']);
        const promote = tools.find(tool => tool.name === 'material_promote')!;
        const args = promote.parseArguments({source: 'media', sourceId: 'thumbnail', scope: {kind: 'global'}});
        await expect(promote.prepare!(args, context)).rejects.toThrow('缩略图');
        await expect(promoteLegacyMaterial('media', 'thumbnail', {kind: 'global'})).rejects.toThrow('缩略图');
        expect(await db.libraryMaterials.count()).toBe(0); expect(await db.materialVersions.count()).toBe(0);
        expect(await db.media.count()).toBe(2);
    });
    it('retains the derivative only through a retained root and hides it from ordinary pickers', async () => {
        const project = await createProject('root'); await pair(project.id);
        expect(await collectMediaIds(project.id)).toEqual(new Set(['source', 'thumbnail']));
        expect(reusableMedia(await db.media.toArray(), project.id, ['image', 'video']).map(record => record.id)).toEqual(['source']);
        await deleteMediaIfOrphans(['thumbnail']); expect(await db.media.count()).toBe(2);
        await db.media.update('source', {libraryRetained: false});
        expect(await collectMediaIds(project.id)).toEqual(new Set());
        await deleteMediaIfOrphans(['source']); expect(await db.media.count()).toBe(0);
    });
    it('backs up both byte carriers and remaps their reciprocal IDs on project-package import', async () => {
        const project = await createProject('zip'); await pair(project.id);
        const imported = await importProjectZip(await exportProjectZip(project.id));
        const records = await db.media.where('projectId').equals(imported.id).toArray();
        const source = records.find(record => record.mimeType === 'video/mp4')!, thumbnail = records.find(record => record.mimeType === 'image/png')!;
        expect(source.thumbnailMediaId).toBe(thumbnail.id); expect(thumbnail.derivative?.sourceMediaId).toBe(source.id);
        expect(source.id).not.toBe('source'); expect(thumbnail.id).not.toBe('thumbnail');
        expect(await (source.blob as Blob).text()).toBe('video'); expect(await (thumbnail.blob as Blob).text()).toBe('png');
        expect(await collectMediaIds(imported.id)).toEqual(new Set([source.id, thumbnail.id]));
    });
    it('rejects missing/cross-linked thumbnail metadata before importing any project rows', async () => {
        const project = await createProject('zip'); await pair(project.id);
        const zip = await JSZip.loadAsync(await exportProjectZip(project.id));
        const metadata = JSON.parse(await zip.file('mediaMetadata.json')!.async('string')) as Array<{id: string; thumbnailMediaId?: string}>;
        metadata.find(record => record.id === 'source')!.thumbnailMediaId = 'missing';
        zip.file('mediaMetadata.json', JSON.stringify(metadata));
        await expect(importProjectZip(await zip.generateAsync({type: 'blob'}))).rejects.toThrow('缺失');
        expect(await db.projects.count()).toBe(1); expect(await db.media.count()).toBe(2);
    });
    it('copies a studio setting together with its dependent PNG into the selected project', async () => {
        await pair(STUDIO_LIBRARY_ID, false);
        const character = await addCharacter(STUDIO_LIBRARY_ID);
        await setCharacterSlot(character.id, 'front', {...emptySlot(), referenceVideoIds: ['source']});
        const project = await createProject('copy'), copy = await copyStudioCharacter(project.id, character.id);
        const id = copy.slots.front!.referenceVideoIds[0], source = (await db.media.get(id))!, thumbnail = (await db.media.get(source.thumbnailMediaId!))!;
        expect(source.projectId).toBe(project.id); expect(thumbnail.projectId).toBe(project.id);
        expect(thumbnail.derivative?.sourceMediaId).toBe(source.id); expect(thumbnail.id).not.toBe('thumbnail');
    });
    it('preserves immutable file-material thumbnail snapshots through source deletion and adoption', async () => {
        const project = await createProject('original'); await pair(project.id);
        const material = await promoteLegacyMaterial('media', 'source', {kind: 'global'});
        const version = (await db.materialVersions.where('materialId').equals(material.id).first())!;
        expect(version.payload.type === 'file' && version.payload.media).toHaveLength(2);
        await db.media.bulkDelete(['source', 'thumbnail']);
        const destination = await createProject('adopted'), use = await adoptMaterialInProject(material.id, destination.id);
        const source = (await db.media.get(use.targetId))!, thumbnail = (await db.media.get(source.thumbnailMediaId!))!;
        expect(use.mediaIds).toContain(thumbnail.id); expect(thumbnail.derivative?.sourceMediaId).toBe(source.id);
        expect(thumbnail.libraryRetained).toBe(false); expect(await (thumbnail.blob as Blob).text()).toBe('png');
    });
});
