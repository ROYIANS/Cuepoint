import {describe, expect, it, vi} from 'vitest';
import {db} from '@/platform/product/store';
import {createChatThread} from '@/features/agent/commands/chat';
import {createProject} from '@/features/projects/commands/projects';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {transitionToolCall} from '@/features/agent/commands/agentTools';
import {deleteChatThread} from '@/features/agent/commands/lifecycle';
import {deleteProject} from '@/features/projects/commands/lifecycle';
import {admitAgentJob, AgentJobAdmissionError, AGENT_JOB_LIMITS, checkpointAgentJob, clearAgentJobResult, markAgentJobRunning, publishAgentJob,
    readAgentJob, readAgentJobPage, recoverAgentJobs, stopAgentJob, type AgentJobContext} from '@/features/agent/commands/agentJobs';
import type {AgentJob, AgentJobOutputMetadata, AgentJobReader, AgentJobSelection} from '@/features/agent/models/agentJob';
import {withExecutionOwnership, type ThreadOwnership} from '@/features/agent/runtime/runOwnership';
import {UnknownCommitError} from '@/platform/storage/errors';
import {failStoreTableOnce, interceptStoreTable} from './helpers/storeFaults';
import type {ConnectorConfig} from '@/features/settings/models/connector';
import {saveFixtureToolRound} from './helpers/toolDispatch';
import {putMedia} from '@/features/library/commands/media';
import {PRODUCT_SCHEMA} from '@/platform/storage/schema';
import schema from '@/platform/storage/schema.json';
import {browserDatabase} from '@/platform/storage/browserDatabase';

const connector: ConnectorConfig = {id: 'cx', definitionId: 'openai-compatible', label: 'test', protocol: 'openai-compatible', baseUrl: 'https://model.test/v1', apiKey: 'private-key', updatedAt: 'now'};
async function fixture(kind: AgentJobSelection['kind'] = 'web_read', project = false) {
    const ownerProject = project ? await createProject('Job project') : undefined;
    const thread = await createChatThread({projectId: ownerProject?.id});
    await db.connectors.put(connector);
    const run = await beginAgentRun({threadId: thread.id, connector, model: 'test', content: 'report'});
    await db.agentRuns.update(run.id, {toolLoading: undefined, enabledToolNames: [...new Set([...(run.enabledToolNames ?? []), kind, 'read_job_result'])]});
    await saveFixtureToolRound(run.id, '', [{id: 'wire', type: 'function', function: {name: kind, arguments: '{}'}}], [{title: kind, effect: kind === 'web_read' ? 'network' : 'read', highRisk: false}]);
    const call = (await db.agentToolCalls.where('runId').equals(run.id).first())!;
    await transitionToolCall(run.id, call.id, ['pending'], 'running');
    const context: AgentJobContext = {runId: run.id, threadId: thread.id, callId: call.id, projectId: ownerProject?.id};
    const reader: AgentJobReader = {threadId: thread.id, projectId: ownerProject?.id, original: {runId: run.id, callId: call.id}};
    const selection: AgentJobSelection = kind === 'web_read' ? {kind, urls: ['https://source.test/a']} : {kind, media: []};
    return {context, reader, selection, run, call, thread, project: ownerProject};
}
async function completedWeb(text = 'report') {
    const f = await fixture(), admission = await admitAgentJob(f.context, f.selection);
    let job = await markAgentJobRunning(f.context, admission.job.id, admission.job.revision, {serviceMayHaveRun: true});
    job = await checkpointAgentJob(f.context, job.id, job.revision, {completed: 1});
    const result = await publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text, metadata: {coverage: 'provider_extraction'}});
    return {...f, job: (await db.agentJobs.get(job.id))!, result};
}

describe('owned retained Agent jobs', () => {
    it('publishes complete chunks and original bounded call result together and clears without rewriting history', async () => {
        const text = ('正文 😀 \0\n'.repeat(15000));
        const f = await completedWeb(text);
        const call = (await db.agentToolCalls.get(f.call.id))!;
        expect(call.status).toBe('completed'); expect(call.result!.length).toBeLessThanOrEqual(16000);
        expect(f.result.output!.preview.length).toBeLessThanOrEqual(8000);
        expect((await db.agentJobs.get(f.job.id))!.reservedBytes).toBe(new TextEncoder().encode(text).byteLength);
        expect(await db.agentJobResultChunks.where('jobId').equals(f.job.id).count()).toBeGreaterThan(1);
        expect(schema.tables).toEqual(PRODUCT_SCHEMA);
        if (browserDatabase) {
            expect(browserDatabase.agentJobs.schema.indexes.find(index => index.name === 'callId')!.unique).toBe(true);
            expect(browserDatabase.agentJobResultChunks.schema.indexes.find(index => index.name === '[jobId+ordinal]')!.unique).toBe(true);
        }
        await expect(db.agentJobs.add({...f.job, id: 'duplicate-job'})).rejects.toMatchObject({code: 'constraint'});
        const chunk = (await db.agentJobResultChunks.where('jobId').equals(f.job.id).first())!;
        await expect(db.agentJobResultChunks.add({...chunk, id: 'duplicate-chunk'})).rejects.toMatchObject({code: 'constraint'});
        let content = '', offset = 0;
        do {
            const page = await readAgentJobPage(f.reader, f.job.id, offset, 6000);
            expect(page.available).toBe(true); if (!page.available) throw new Error('missing');
            expect(JSON.stringify(page).length).toBeLessThanOrEqual(16000);
            content += page.text; if (page.nextOffset === undefined) break;
            expect(page.nextOffset).toBeGreaterThan(offset); offset = page.nextOffset;
        } while (true);
        expect(content).toBe(text);
        await clearAgentJobResult(f.reader, f.job.id);
        expect(await db.agentJobResultChunks.where('jobId').equals(f.job.id).count()).toBe(0);
        expect(await readAgentJobPage(f.reader, f.job.id)).toEqual({available: false, reason: 'cleared'});
        expect((await db.agentToolCalls.get(f.call.id))!.result).toBe(call.result);
        const replay = await admitAgentJob(f.context, f.selection);
        expect(replay.admitted).toBe(false); expect(replay.result).toEqual(JSON.parse(call.result!));
        expect(await publishAgentJob(f.context, f.job.id, 1, {status: 'completed', text: 'replacement'})).toEqual(replay.result);
        expect(await db.agentJobs.count()).toBe(1);
    });
    it('rejects insufficient surrogate pages and permits current later read calls without granting foreign threads', async () => {
        const f = await completedWeb('😀tail');
        await expect(readAgentJobPage(f.reader, f.job.id, 0, 1)).rejects.toThrow('至少 2');
        const page = await readAgentJobPage(f.reader, f.job.id, 1, 2);
        expect(page).toMatchObject({available: true, offset: 0, text: '😀', nextOffset: 2});
        const foreign = await createChatThread();
        expect(await readAgentJobPage({...f.reader, threadId: foreign.id}, f.job.id)).toMatchObject({available: false});
        expect(await readAgentJob({threadId: f.thread.id}, f.job.id)).toBeUndefined();
        await saveFixtureToolRound(f.run.id, '', [{id: 'reader', type: 'function', function: {name: 'read_job_result', arguments: '{}'}}], [{title: 'read', effect: 'read', highRisk: false}]);
        const readerCall = (await db.agentToolCalls.where('runId').equals(f.run.id).toArray()).find(call => call.name === 'read_job_result')!;
        await transitionToolCall(f.run.id, readerCall.id, ['pending'], 'running');
        expect(await readAgentJobPage({threadId: f.thread.id, caller: {runId: f.run.id, callId: readerCall.id}}, f.job.id, 2, 4)).toMatchObject({available: true, text: 'tail'});
    });
    it.each([
        {label: 'omitted metadata', metadata: undefined},
        {label: 'undefined optional metadata fields', metadata: {urls: undefined, retrievedAt: undefined, requestId: 'request', coverage: undefined}},
    ] satisfies {label: string; metadata: AgentJobOutputMetadata | undefined}[])('publishes readable canonical descriptors with $label', async ({metadata}) => {
        const f = await fixture(), {job: initial} = await admitAgentJob(f.context, f.selection);
        let job = await markAgentJobRunning(f.context, initial.id, initial.revision);
        job = await checkpointAgentJob(f.context, job.id, job.revision, {completed: 1});
        const result = await publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text: 'readable 😀', metadata});
        const retained = (await db.agentJobs.get(job.id))!;
        const original = JSON.parse((await db.agentToolCalls.get(f.call.id))!.result!);
        expect(retained.output).toStrictEqual(original.output);
        expect(result.output).toStrictEqual(original.output);
        expect(await readAgentJobPage(f.reader, job.id)).toMatchObject({available: true, text: 'readable 😀'});
        if (metadata) expect(retained.output!.metadata).toStrictEqual({requestId: 'request'});
        else expect(Object.hasOwn(retained.output!, 'metadata')).toBe(false);
        await db.agentJobs.update(job.id, {output: {...retained.output!, byteLength: 1}});
        await expect(readAgentJobPage(f.reader, job.id)).rejects.toThrow('完成记录与保存内容不一致');
    });
    it('admits a call only once and reserves quota before any producer starts', async () => {
        const f = await fixture();
        const [a, b] = await Promise.all([admitAgentJob(f.context, f.selection), admitAgentJob(f.context, f.selection)]);
        expect([a.admitted, b.admitted].filter(Boolean)).toHaveLength(1);
        expect(a.job.id).toBe(b.job.id); expect(await db.agentJobs.count()).toBe(1);
        expect(a.job.reservedBytes).toBe(AGENT_JOB_LIMITS.outputBytes);
        await expect(clearAgentJobResult(f.reader, a.job.id)).rejects.toThrow('先停止');
        const full = await fixture();
        await db.agentJobs.update(a.job.id, {threadId: full.thread.id, reservedBytes: AGENT_JOB_LIMITS.threadBytes});
        await expect(admitAgentJob(full.context, full.selection)).rejects.toMatchObject({name: 'AgentJobAdmissionError', kind: 'byte_quota'});
        expect(await db.agentJobs.where('callId').equals(full.call.id).count()).toBe(0);
    });
    it('distinguishes bounded metadata count exhaustion from byte cleanup and rejects oversized output', async () => {
        const f = await fixture(), {job} = await admitAgentJob(f.context, f.selection);
        await db.agentJobs.bulkAdd(Array.from({length: 127}, (_, i): AgentJob => ({...job, id: `count-${i}`, callId: `count-call-${i}`, reservedBytes: 0})));
        const next = await fixture(); await db.agentJobs.where('threadId').equals(f.thread.id).modify({threadId: next.thread.id});
        const refusal = admitAgentJob(next.context, next.selection);
        await expect(refusal).rejects.toBeInstanceOf(AgentJobAdmissionError);
        await expect(refusal).rejects.toMatchObject({kind: 'job_limit', message: expect.stringContaining('删除')});
        await expect(publishAgentJob(f.context, job.id, job.revision, {status: 'failed', text: '中'.repeat(700000)})).rejects.toThrow('限制');
    });
    it('rolls back chunk staging, descriptor and original completion together on a late ledger write failure', async () => {
        const f = await fixture(), admission = await admitAgentJob(f.context, f.selection);
        let job = await markAgentJobRunning(f.context, admission.job.id, 1);
        job = await checkpointAgentJob(f.context, job.id, job.revision, {completed: 1});
        const failure = failStoreTableOnce(db, 'agentToolCalls', 'update', new Error('ledger failed'));
        await expect(publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text: 'retained'})).rejects.toThrow('ledger failed'); failure.mockRestore();
        expect((await db.agentJobs.get(job.id))!.output).toBeUndefined(); expect(await db.agentJobResultChunks.count()).toBe(0);
        expect((await db.agentToolCalls.get(f.call.id))!.status).toBe('running');
        expect(await readAgentJobPage(f.reader, job.id)).toMatchObject({available: false});
    });
    it('preserves typed unknown publication when completion is unreadable and reconciles acknowledged durable completion', async () => {
        const f = await fixture(), {job: initial} = await admitAgentJob(f.context, f.selection);
        let job = await markAgentJobRunning(f.context, initial.id, 1); job = await checkpointAgentJob(f.context, job.id, job.revision, {completed: 1});
        const unknown = new UnknownCommitError('operation', 'workspace');
        const fault = failStoreTableOnce(db, 'agentToolCalls', 'update', unknown);
        await expect(publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text: 'once'})).rejects.toBe(unknown); fault.mockRestore();
        expect((await db.agentJobs.get(job.id))!.output).toBeUndefined();
        // Simulate loss of acknowledgement after the actual production root commits.
        const transaction = db.transaction.bind(db); let lost = false;
        const ack = vi.spyOn(db, 'transaction').mockImplementation(async (mode, scope, callback) => {
            const value = await transaction(mode, scope, callback);
            if (mode === 'rw' && !lost) {lost = true; throw unknown;} return value;
        });
        const result = await publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text: 'once'}); ack.mockRestore();
        expect(result.output!.preview).toBe('once'); expect((await db.agentToolCalls.get(f.call.id))!.status).toBe('completed');
        expect(await db.agentJobResultChunks.count()).toBe(1);
    });
    it('reconciles unknown admission without granting permission to run again', async () => {
        const f = await fixture(), unknown = new UnknownCommitError('admit', 'workspace');
        const transaction = db.transaction.bind(db); let lost = false;
        const ack = vi.spyOn(db, 'transaction').mockImplementation(async (mode, scope, callback) => {
            const value = await transaction(mode, scope, callback);
            if (mode === 'rw' && !lost) {lost = true; throw unknown;} return value;
        });
        const result = await admitAgentJob(f.context, f.selection); ack.mockRestore();
        expect(result.admitted).toBe(false); expect(result.job.status).toBe('accepted'); expect(await db.agentJobs.count()).toBe(1);
    });
    it('retains unknown certainty when a committed publication acknowledgement and reconciliation read both fail', async () => {
        const f = await fixture(), {job: initial} = await admitAgentJob(f.context, f.selection);
        let job = await markAgentJobRunning(f.context, initial.id, 1);
        job = await checkpointAgentJob(f.context, job.id, job.revision, {completed: 1});
        const unknown = new UnknownCommitError('lost-publish', 'workspace');
        const transaction = db.transaction.bind(db); let lost = false;
        const fault = vi.spyOn(db, 'transaction').mockImplementation(async (mode, scope, callback) => {
            if (mode === 'r' && lost) throw new Error('completion unreadable');
            const value = await transaction(mode, scope, callback);
            if (mode === 'rw' && !lost) {lost = true; throw unknown;} return value;
        });
        await expect(publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text: 'committed once'})).rejects.toBe(unknown);
        fault.mockRestore();
        const committed = (await db.agentToolCalls.get(f.call.id))!;
        expect(committed.status).toBe('completed');
        expect(await publishAgentJob(f.context, job.id, 1, {status: 'failed', text: 'replacement'})).toEqual(JSON.parse(committed.result!));
        expect(await db.agentJobResultChunks.count()).toBe(1);
    });
    it('rejects owner drift and cascades thread and project output without late resurrection', async () => {
        for (const parent of ['thread', 'project'] as const) {
            const f = await fixture('web_read', parent === 'project'), {job} = await admitAgentJob(f.context, f.selection);
            await markAgentJobRunning(f.context, job.id, 1);
            if (parent === 'thread') await deleteChatThread(f.thread.id); else await deleteProject(f.project!.id);
            expect(await db.agentJobs.get(job.id)).toBeUndefined();
            await expect(publishAgentJob(f.context, job.id, 2, {status: 'stopped', text: 'late'})).rejects.toThrow();
            expect(await db.agentJobResultChunks.where('jobId').equals(job.id).count()).toBe(0);
        }
        const f = await fixture(), {job} = await admitAgentJob(f.context, f.selection);
        await db.agentToolCalls.update(f.call.id, {arguments: '{"changed":true}'});
        await expect(markAgentJobRunning(f.context, job.id, 1)).rejects.toThrow('原始调用');
    });
    it('keeps stopping until publication and requires real held ownership for conservative zero-dispatch recovery', async () => {
        const media = await fixture('project_media_check', true), {job: initial} = await admitAgentJob(media.context, media.selection);
        const job = await markAgentJobRunning(media.context, initial.id, 1);
        const stopping = await stopAgentJob(media.context, job.id);
        expect(stopping.status).toBe('stopping');
        await expect(publishAgentJob(media.context, job.id, stopping.revision, {status: 'completed', text: ''})).rejects.toThrow('停止');
        await expect(recoverAgentJobs(media.thread.id, {threadId: media.thread.id, assertHeld() {}} as ThreadOwnership)).rejects.toThrow('所有权');
        let expired!: ThreadOwnership;
        await withExecutionOwnership(media.thread.id, async ownership => {expired = ownership; await recoverAgentJobs(media.thread.id, ownership);});
        expect((await db.agentJobs.get(job.id))!.status).toBe('stopped'); expect((await db.agentToolCalls.get(media.call.id))!.status).toBe('completed');
        await expect(recoverAgentJobs(media.thread.id, expired)).rejects.toThrow('所有权');
        const web = await fixture(), admitted = await admitAgentJob(web.context, web.selection);
        await markAgentJobRunning(web.context, admitted.job.id, 1, {serviceMayHaveRun: true});
        await withExecutionOwnership(web.thread.id, ownership => recoverAgentJobs(web.thread.id, ownership));
        expect((await db.agentJobs.get(admitted.job.id))!.status).toBe('unknown'); expect((await db.agentToolCalls.get(web.call.id))!.status).toBe('unknown');
    });
    it('propagates actual read failure instead of turning it into missing output', async () => {
        const f = await completedWeb();
        const fault = interceptStoreTable(db, 'agentJobs', 'get', () => Promise.reject(new Error('read failed')));
        await expect(readAgentJobPage(f.reader, f.job.id)).rejects.toThrow('read failed'); fault.mockRestore();
    });
    it('checks frozen media facts at admission and again inside publication while retaining unexamined coverage', async () => {
        const f = await fixture('project_media_check', true);
        const media = {id: 'video-a', projectId: f.project!.id, filename: 'first.mp4', mimeType: 'video/mp4', blob: new Blob(['video'], {type: 'video/mp4'})};
        await putMedia(media);
        const item = {id: media.id, name: media.filename, mimeType: media.mimeType, size: 5, revision: JSON.stringify([media.filename, media.mimeType, 5])};
        const selection: AgentJobSelection = {kind: 'project_media_check', media: [item]};
        await expect(admitAgentJob(f.context, {kind: 'project_media_check', media: [{...item, revision: 'stale'}]})).rejects.toThrow('受理前');
        const {job: initial} = await admitAgentJob(f.context, selection);
        let job = await markAgentJobRunning(f.context, initial.id, 1);
        job = await checkpointAgentJob(f.context, job.id, job.revision, {completed: 1, observation: {mediaId: media.id, status: 'ready'}});
        await db.media.update(media.id, {filename: 'changed.mp4'});
        const result = await publishAgentJob(f.context, job.id, job.revision, {status: 'completed', text: 'stale ready report'});
        expect(result.output!.preview).toContain('changed'); expect(result.output!.preview).toContain('first.mp4');
        expect(result.output!.preview).toContain('已检查 1/1');
        expect((await db.agentJobs.get(job.id))!.observations[0].status).toBe('changed');
        expect(result.output!.preview).not.toContain('stale ready report');
    });
});
