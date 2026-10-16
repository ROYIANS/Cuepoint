import {describe, expect, it, vi} from 'vitest';
import {db} from '@/platform/product/store';
import {createProject} from '@/features/projects/commands/projects';
import {deleteProject} from '@/features/projects/commands/lifecycle';
import {admitDesktopMediaImport, publishDesktopMediaImportItem, readDesktopMediaImport, transitionDesktopMediaImport} from '@/features/library/commands/desktopMediaImport';
import type {DesktopMediaImportSelection} from '@/features/library/models/desktopMediaImport';
import type {DesktopImportProvenance} from '@/features/library/models/media';
import {Sha256} from '@/platform/media/sha256';
import {UnknownCommitError} from '@/platform/storage/errors';
import {failStoreTableOnce} from './helpers/storeFaults';
import {createChatThread} from '@/features/agent/commands/chat';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {targetRevision} from '@/platform/data/revision';
import type {AgentToolCall} from '@/features/agent/models/agent';

async function fixture() {
    const project = await createProject('native import');
    const source = new Blob(['video'], {type: 'video/mp4'}), thumbnail = new Blob(['png'], {type: 'image/png'});
    const selection: DesktopMediaImportSelection = {grantId: 'grant', scanId: 'scan', revision: 'manifest-v1', items: [{entryId: 'entry', revision: 'file-v1', filename: 'clip.mp4', mimeType: 'video/mp4', byteLength: source.size, sourceMediaId: 'source', thumbnailMediaId: 'thumbnail'}]};
    const provenance: DesktopImportProvenance = {version: 1, importId: 'import', itemId: 'entry', grantId: 'grant', scanId: 'scan', entryRevision: 'file-v1',
        sourceHash: new Sha256().update(new TextEncoder().encode('video')).digest(), thumbnail: {preset: 'thumbnail-v1', contentHash: new Sha256().update(new TextEncoder().encode('png')).digest(), width: 640, height: 360, atSeconds: 0}, decoder: {name: 'ffmpeg', version: 'FFmpeg 8.0.3'}};
    const input = {id: 'import', projectId: project.id, actor: {kind: 'human'} as const, selection};
    const admission = await admitDesktopMediaImport(input);
    const running = await transitionDesktopMediaImport(input.id, project.id, admission.import.revision, 'running');
    return {project, input, running, publication: {importId: input.id, projectId: project.id, itemId: 'entry', expectedRevision: running.revision, source, thumbnail, provenance}};
}

async function agentFixture() {
    const f = await fixture();
    await db.desktopMediaImports.delete(f.input.id);
    const thread = await createChatThread({projectId: f.project.id});
    const run = await beginAgentRun({threadId: thread.id, connector: {id: 'fixture', definitionId: 'openai-compatible', protocol: 'openai-compatible', baseUrl: 'https://fixture.invalid/v1', apiKey: 'not-real', updatedAt: '2026-10-16'}, model: 'fixture', content: '导入本地视频'});
    await db.agentRuns.update(run.id, {enabledToolNames: ['desktop_media_import'], toolLoading: undefined});
    const actor = {kind: 'agent', runId: run.id, threadId: thread.id, callId: 'import-call'} as const;
    const call: AgentToolCall = {id: actor.callId, runId: run.id, threadId: thread.id, providerCallId: actor.callId, step: 1, order: 0, name: 'desktop_media_import', title: '导入选中的本地视频', arguments: JSON.stringify({grantId: f.input.selection.grantId, scanId: f.input.selection.scanId, entryIds: ['entry']}), effect: 'write', highRisk: false, requiresConfirmation: true, atomic: false,
        decision: 'approve', decidedAt: '2026-10-16', preview: {summary: '导入 1 个本地视频', changes: ['clip.mp4'], revision: targetRevision({projectId: f.project.id, selection: f.input.selection})}, status: 'running', createdAt: '2026-10-16', updatedAt: '2026-10-16'};
    await db.agentToolCalls.add(call);
    return {...f, input: {...f.input, actor}, call};
}

describe('shared desktop media import admission and atomic publication', () => {
    it('admits only the real approved frozen Agent selection and rechecks confirmation before publication', async () => {
        const f = await agentFixture();
        for (const patch of [{decision: undefined}, {decision: 'reject' as const}, {requiresConfirmation: false}, {effect: 'read' as const}, {atomic: true}, {preview: {...f.call.preview!, revision: 'substituted'}}]) {
            await db.agentToolCalls.put({...f.call, ...patch});
            await expect(admitDesktopMediaImport(f.input)).rejects.toThrow('确认');
            expect(await db.desktopMediaImports.count()).toBe(0);
        }
        await db.agentToolCalls.put(f.call);
        await expect(admitDesktopMediaImport({...f.input, selection: {...f.input.selection, items: f.input.selection.items.map(item => ({...item, filename: 'substituted.mp4'}))}})).rejects.toThrow('确认');
        const admission = await admitDesktopMediaImport(f.input);
        expect(admission.admitted).toBe(true);
        const running = await transitionDesktopMediaImport(f.input.id, f.project.id, admission.import.revision, 'running');
        await db.agentToolCalls.update(f.call.id, {decision: 'reject'});
        await expect(publishDesktopMediaImportItem({...f.publication, expectedRevision: running.revision})).rejects.toThrow('确认');
        expect(await db.media.count()).toBe(0);
        await db.agentToolCalls.put(f.call);
        expect((await publishDesktopMediaImportItem({...f.publication, expectedRevision: running.revision})).published).toBe(true);
    });
    it('admits real human identity, exact-deduplicates stable intent and atomically writes both media plus receipt', async () => {
        const f = await fixture();
        expect((await admitDesktopMediaImport(f.input)).admitted).toBe(false);
        await db.projects.update(f.project.id, {name: 'concurrent authored edit'});
        const result = await publishDesktopMediaImportItem(f.publication);
        expect(result.published).toBe(true); expect(result.import.status).toBe('completed');
        expect((await db.media.get('source'))).toMatchObject({libraryRetained: true, thumbnailMediaId: 'thumbnail', source: f.publication.provenance});
        expect((await db.media.get('thumbnail'))).toMatchObject({derivative: {kind: 'video-thumbnail', sourceMediaId: 'source'}});
        expect((await db.projects.get(f.project.id))!.name).toBe('concurrent authored edit');
        expect((await publishDesktopMediaImportItem(f.publication))).toMatchObject({published: false, receipt: result.receipt});
        expect(await db.media.count()).toBe(2);
        expect((await readDesktopMediaImport('import', f.project.id)).receipts).toHaveLength(1);
    });
    it('rolls both files and receipt back when the actual receipt write fails', async () => {
        const f = await fixture(), fault = failStoreTableOnce(db, 'desktopMediaImports', 'put', new Error('receipt unavailable'));
        try {await expect(publishDesktopMediaImportItem(f.publication)).rejects.toThrow('receipt unavailable');} finally {fault.mockRestore();}
        expect(await db.media.count()).toBe(0);
        expect((await readDesktopMediaImport('import', f.project.id))).toMatchObject({status: 'running', receipts: []});
        expect((await publishDesktopMediaImportItem(f.publication)).published).toBe(true);
    });
    it('rejects stale selection/hash and a replaced frozen intent before product effects', async () => {
        const f = await fixture();
        await expect(admitDesktopMediaImport({...f.input, selection: {...f.input.selection, revision: 'replacement'}})).rejects.toThrow('不可替换');
        await expect(publishDesktopMediaImportItem({...f.publication, provenance: {...f.publication.provenance, entryRevision: 'changed'}})).rejects.toThrow('冻结选择');
        await expect(publishDesktopMediaImportItem({...f.publication, source: new Blob(['other'], {type: 'video/mp4'})})).rejects.toThrow('哈希');
        expect(await db.media.count()).toBe(0);
    });
    it('serializes duplicate admissions and refuses a fabricated Agent execution identity', async () => {
        const project = await createProject('scope');
        const selection: DesktopMediaImportSelection = {grantId: 'grant', scanId: 'scan', revision: 'v', items: [{entryId: 'entry', revision: 'v', filename: 'x.mp4', mimeType: 'video/mp4', byteLength: 1, sourceMediaId: 'a', thumbnailMediaId: 'b'}]};
        const input = {id: 'batch', projectId: project.id, actor: {kind: 'human'} as const, selection};
        const results = await Promise.all([admitDesktopMediaImport(input), admitDesktopMediaImport(input)]);
        expect(results.filter(result => result.admitted)).toHaveLength(1);
        await expect(admitDesktopMediaImport({...input, id: 'fake', actor: {kind: 'agent', runId: 'run', threadId: 'thread', callId: 'call'}})).rejects.toThrow('执行归属');
        expect(await db.desktopMediaImports.count()).toBe(1);
    });
    it('retains readback after lost admission acknowledgement without permission to start twice', async () => {
        const project = await createProject('scope'), original = db.transaction.bind(db);
        const selection: DesktopMediaImportSelection = {grantId: 'grant', scanId: 'scan', revision: 'v', items: [{entryId: 'entry', revision: 'v', filename: 'x.mp4', mimeType: 'video/mp4', byteLength: 1, sourceMediaId: 'a', thumbnailMediaId: 'b'}]};
        const spy = vi.spyOn(db, 'transaction').mockImplementationOnce(async (mode, tables, callback) => {
            await original(mode, tables, callback); throw new UnknownCommitError('operation', 'workspace');
        });
        try {expect((await admitDesktopMediaImport({id: 'batch', projectId: project.id, actor: {kind: 'human'}, selection})).admitted).toBe(false);} finally {spy.mockRestore();}
        expect(await db.desktopMediaImports.count()).toBe(1);
    });
    it('stops before publication, preserves a committed late stop and never resumes unknown work', async () => {
        const f = await fixture();
        const unknown = await transitionDesktopMediaImport('import', f.project.id, f.running.revision, 'unknown');
        await expect(transitionDesktopMediaImport('import', f.project.id, unknown.revision, 'running')).rejects.toThrow('重复启动');
        await expect(publishDesktopMediaImportItem({...f.publication, expectedRevision: unknown.revision})).rejects.toThrow('已停止');
        const stopped = await transitionDesktopMediaImport('import', f.project.id, unknown.revision, 'stopped');
        expect(stopped.status).toBe('stopped'); expect(await db.media.count()).toBe(0);
    });
    it('deleting the owner cascades admission and prevents late callback resurrection', async () => {
        const f = await fixture(); await deleteProject(f.project.id);
        expect(await db.desktopMediaImports.count()).toBe(0);
        await expect(publishDesktopMediaImportItem(f.publication)).rejects.toThrow('项目');
        expect(await db.media.count()).toBe(0);
    });
});
