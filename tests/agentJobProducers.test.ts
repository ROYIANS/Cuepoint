import {afterEach, describe, expect, it, vi} from 'vitest';
import {db} from '@/platform/product/store';
import {beginAgentRun} from '@/features/agent/commands/agentRuns';
import {resolveAgentToolApproval} from '@/features/agent/commands/agentTools';
import {createChatThread} from '@/features/agent/commands/chat';
import {deleteChatThread} from '@/features/agent/commands/lifecycle';
import {createProject, createAudioMusicProject} from '@/features/projects/commands/projects';
import {deleteProject} from '@/features/projects/commands/lifecycle';
import {executeChatRun, resumeChatRun} from '@/features/agent/runtime/runChat';
import {withExecutionOwnership, type ThreadLockManager} from '@/features/agent/runtime/runOwnership';
import {updateGeneralAgentConfig} from '@/features/agent/commands/agentSettings';
import {saveSearchConnection} from '@/features/settings/commands/searchConnections';
import {validateToolCall} from '@/features/agent/runtime/tools';
import type {AgentRun} from '@/features/agent/models/agent';
import type {AgentJobResult} from '@/features/agent/models/agentJob';
import {readAgentJobPage, AgentJobAdmissionError} from '@/features/agent/commands/agentJobs';
import type {AgentJobReader} from '@/features/agent/models/agentJob';
import * as jobCommands from '@/features/agent/commands/agentJobs';
import type {ConnectorConfig} from '@/features/settings/models/connector';
import {preloadFixtureGroups} from './helpers/toolDispatch';
import {interceptStoreTable} from './helpers/storeFaults';
import {UnknownCommitError} from '@/platform/storage/errors';
import * as binary from '@/platform/storage/binary';
import {registerBinaryReference} from '@/platform/storage/codec';
import {createNativeBinaryServices, type BinaryAction} from '@/platform/storage/nativeBinary';
import type {NativeSession} from '@/platform/storage/protocol';

const connector: ConnectorConfig = {id: 'jobs-model', definitionId: 'openai-compatible', protocol: 'openai-compatible', baseUrl: 'https://model.example.test/v1', apiKey: 'model-key', updatedAt: '2026-10-15'};
const secret = 'tvly-job-secret';
const url = 'https://example.com/retained';
async function readPage(reader: Pick<AgentJobReader, 'threadId' | 'projectId'>, jobId: string, offset = 0, limit = 6000) {
    const job = await db.agentJobs.get(jobId);
    return readAgentJobPage({...reader, original: job ? {runId: job.runId, callId: job.callId} : undefined}, jobId, offset, limit);
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => {resolve = done;});
    return {promise, resolve};
}
async function begin(projectId?: string, protocol: AgentRun['protocol'] = 'chat-completions') {
    await updateGeneralAgentConfig({permissionMode: 'full', enabledSkillIds: ['business-read', 'web-research']});
    const thread = await createChatThread({projectId});
    const run = await preloadFixtureGroups(await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: '检查资料'}), ['business-read', 'web-research']);
    await db.agentRuns.update(run.id, {protocol});
    return (await db.agentRuns.get(run.id))!;
}
function reply(protocol: AgentRun['protocol'], name?: string, args: unknown = {}, id = name) {
    if (protocol === 'responses') return Response.json({status: 'completed', output: name ? [
        ...(name === 'web_read' ? [{type: 'reasoning', id: 'reasoning-job', encrypted_content: 'opaque-job-continuation', summary: []}] : []),
        {type: 'function_call', call_id: id, name, arguments: JSON.stringify(args)}
    ] : [{type: 'message', role: 'assistant', content: [{type: 'output_text', text: '已检查可读取的资料。'}]}]});
    return Response.json({choices: [{message: name ? {content: '', tool_calls: [{id, type: 'function', function: {name, arguments: JSON.stringify(args)}}]} : {content: '已检查可读取的资料。'}, finish_reason: name ? 'tool_calls' : 'stop'}]});
}
function modelFor(run: AgentRun, name: string, args: unknown = {}) {
    let count = 0;
    return vi.fn<typeof fetch>(async () => reply(run.protocol, ++count === 1 ? name : undefined, args));
}
async function addVideo(projectId: string, id: string) {
    await db.media.add({id, projectId, filename: `${id}.mp4`, mimeType: 'video/mp4', blob: new Blob([`bytes-${id}`], {type: 'video/mp4'})});
}
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe('actual retained web producer and bounded shared loop', () => {
    it.each(['chat-completions', 'responses'] as const)('retains >65K extraction through %s and reads pages without another service request', async protocol => {
        await saveSearchConnection({apiKey: secret, enabled: true});
        const run = await begin(undefined, protocol);
        const raw = `来源 ${secret} ${encodeURIComponent(secret)}\n` + '页面🧭\u0000'.repeat(18000);
        const expected = raw.split(secret).join('[已隐藏]').split(encodeURIComponent(secret)).join('[已隐藏]');
        const service = vi.fn<typeof fetch>(async () => Response.json({request_id: 'service-job-1', results: [{url, raw_content: raw}]}));
        vi.stubGlobal('fetch', service);
        const requests: string[] = [];
        const model = vi.fn<typeof fetch>(async (_url, init) => {
            requests.push(String(init?.body));
            if (requests.length === 1) return reply(protocol, 'web_read', {url});
            if (requests.length === 2) {
                const job = (await db.agentJobs.toArray())[0];
                return reply(protocol, 'read_job_result', {jobId: job.id, offset: 0, limit: 6000});
            }
            return reply(protocol);
        });
        await executeChatRun(run, connector.apiKey, new AbortController(), model);
        const calls = await db.agentToolCalls.where('runId').equals(run.id).toArray();
        const original = calls.find(call => call.name === 'web_read')!;
        expect(original.status, original.error).toBe('completed');
        const result = JSON.parse(original.result!) as AgentJobResult;
        expect(result).toMatchObject({kind: 'web_read', status: 'completed', selected: 1, completed: 1, output: {retention: 'retained', length: expected.length}});
        expect(original.result!.length).toBeLessThanOrEqual(16000);
        expect(result.output!.preview.length).toBeLessThanOrEqual(8000);
        expect(requests[1].length).toBeLessThan(65000);
        expect(requests[1]).not.toContain(expected);
        expect(calls.find(call => call.name === 'read_job_result')).toMatchObject({status: 'completed'});
        expect(JSON.parse(calls.find(call => call.name === 'read_job_result')!.result!)).toMatchObject({available: true, untrusted: true});
        expect(service).toHaveBeenCalledTimes(1);
        expect(JSON.stringify([await db.agentJobs.toArray(), await db.agentJobResultChunks.toArray(), calls, requests])).not.toContain(secret);
        if (protocol === 'responses') expect(JSON.stringify((await db.agentRuns.get(run.id))!.responseItems)).toContain('opaque-job-continuation');
        db.close(); await db.open();
        let text = '', offset = 0;
        for (;;) {
            const page = await readPage({threadId: run.threadId}, result.jobId, offset, 6000);
            expect(page.available).toBe(true);
            if (!page.available) throw new Error('Expected published output');
            expect(page.text.length).toBeLessThanOrEqual(6000);
            const last = page.text.charCodeAt(page.text.length - 1);
            expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
            text += page.text;
            if (page.nextOffset === undefined) break;
            expect(page.nextOffset).toBeGreaterThan(offset); offset = page.nextOffset;
        }
        expect(text).toBe(expected);
        expect(service).toHaveBeenCalledTimes(1);
        const foreign = await createChatThread();
        expect(await readPage({threadId: foreign.id}, result.jobId)).toMatchObject({available: false});
    });
    it('does not repeat a web request after retained publication fails with unknown acknowledgement', async () => {
        await saveSearchConnection({apiKey: secret, enabled: true});
        const run = await begin();
        const service = vi.fn<typeof fetch>(async () => Response.json({results: [{url, raw_content: 'accepted extraction'}]}));
        vi.stubGlobal('fetch', service);
        let reached = 0;
        interceptStoreTable(db, 'agentJobResultChunks', 'bulkAdd', async () => {reached++; throw new UnknownCommitError('web-publish', 'workspace');});
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'web_read', {url}));
        expect(reached).toBe(1);
        expect((await db.agentToolCalls.toArray())[0]).toMatchObject({status: 'unknown'});
        expect((await db.agentJobs.toArray())[0]).toMatchObject({serviceMayHaveRun: true});
        await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), modelFor(run, 'web_read', {url}))).rejects.toThrow('不确定');
        expect(service).toHaveBeenCalledTimes(1);
    });
    it('returns actionable known admission refusal before any service request', async () => {
        await saveSearchConnection({apiKey: secret, enabled: true});
        const run = await begin(), service = vi.fn(); vi.stubGlobal('fetch', service);
        let reached = 0;
        interceptStoreTable(db, 'agentJobs', 'add', async () => {reached++; throw new AgentJobAdmissionError('byte_quota');});
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'web_read', {url}));
        expect(reached).toBe(1); expect(service).not.toHaveBeenCalled();
        const call = (await db.agentToolCalls.toArray())[0];
        expect(call.status).toBe('completed');
        expect(JSON.parse(call.result!)).toMatchObject({ok: false, code: 'retention_unavailable', serviceMayHaveRun: false, message: expect.stringContaining('清理不再需要的结果')});
        expect(await db.agentJobs.count()).toBe(0);
    });
    it.each(['disabled', 'changed'] as const)('records known no-dispatch when web_read configuration is %s after approval', async changed => {
        await saveSearchConnection({apiKey: secret, enabled: true});
        const initial = await begin();
        await db.agentRuns.update(initial.id, {permissionMode: 'ask'});
        const run = (await db.agentRuns.get(initial.id))!;
        const service = vi.fn(); vi.stubGlobal('fetch', service);
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'web_read', {url}));
        const call = (await db.agentToolCalls.toArray())[0];
        expect(call.status).toBe('awaiting_approval');
        await saveSearchConnection(changed === 'disabled' ? {enabled: false} : {apiKey: 'replacement-key', enabled: true});
        await resolveAgentToolApproval(run.id, call.id, 'approve');
        await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => reply(run.protocol));
        expect(service).not.toHaveBeenCalled();
        const saved = (await db.agentToolCalls.get(call.id))!;
        expect(saved.status).toBe('completed');
        expect(JSON.parse(saved.result!)).toMatchObject({kind: 'web_read', status: 'failed', serviceMayHaveRun: false});
        expect((await db.agentJobs.toArray())[0].serviceMayHaveRun).toBe(false);
    });
    it('marks a held web wait stopping and retains the cancelled external-outcome truth', async () => {
        await saveSearchConnection({apiKey: secret, enabled: true});
        const run = await begin(), controller = new AbortController(), entered = deferred<void>(), gate = deferred<Response>();
        const service = vi.fn<typeof fetch>(async () => {entered.resolve(); return gate.promise;}); vi.stubGlobal('fetch', service);
        const work = executeChatRun(run, connector.apiKey, controller, modelFor(run, 'web_read', {url}));
        await entered.promise; controller.abort();
        await vi.waitFor(async () => expect((await db.agentJobs.toArray())[0]?.status).toBe('stopping'));
        gate.resolve(Response.json({results: [{url, raw_content: 'late body'}]})); await work;
        const job = (await db.agentJobs.toArray())[0];
        expect(job).toMatchObject({status: 'stopped', serviceMayHaveRun: true});
        expect((await db.agentToolCalls.toArray())[0]).toMatchObject({status: 'completed'});
        expect(service).toHaveBeenCalledTimes(1);
    });
});

const session: NativeSession = {version: 1, session: '33333333-3333-4333-8333-333333333333', workspaceId: '11111111-1111-4111-8111-111111111111', generation: 1};
function nativeAvailabilityFixture(read: (action: Extract<BinaryAction, {type: 'readStart' | 'availability'}>, index: number) => Promise<unknown>) {
    const actions: BinaryAction[] = [];
    const reference = registerBinaryReference({version: 1, workspaceId: session.workspaceId, binaryId: '22222222-2222-4222-8222-222222222222', byteLength: 8, mimeType: 'video/mp4', contentHash: 'a'.repeat(64)});
    const services = createNativeBinaryServices({getSession: async () => session,
        request: async (_session, action) => {
            actions.push(action);
            if (action.type !== 'availability') throw new Error('Only existing availability is permitted');
            return read(action, actions.length);
        }, read: async () => {throw new Error('No media decoding');}});
    // IndexedDB fixture owns browser Blobs. Its injected availability boundary
    // delegates to the actual native TS services/closed transport, with a held
    // reply, rather than fabricating a settled job or claiming real disk IO.
    vi.spyOn(binary, 'binaryAvailability').mockImplementation(async (_content, signal) => {
        expect(signal).toBeUndefined();
        return services.availability(reference, signal);
    });
    return actions;
}

describe('actual project media producer and foreground ownership', () => {
    it('checks the exact frozen video selection with real browser availability and preserves project bytes', async () => {
        const project = await createProject('视频素材检查');
        await addVideo(project.id, 'video-a'); await addVideo(project.id, 'video-b');
        await db.media.add({id: 'audio', projectId: project.id, filename: 'voice.wav', mimeType: 'audio/wav', blob: new Blob(['audio'])});
        const before = await db.media.toArray(), run = await begin(project.id);
        const service = vi.fn(); vi.stubGlobal('fetch', service);
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check', {mediaIds: ['video-b']}));
        const job = (await db.agentJobs.toArray())[0];
        expect(job).toMatchObject({status: 'completed', selected: 1, completed: 1, observations: [{mediaId: 'video-b', status: 'ready'}]});
        expect(job.selection.kind === 'project_media_check' && job.selection.media.map(item => item.id)).toEqual(['video-b']);
        const page = await readPage({threadId: run.threadId, projectId: project.id}, job.id);
        expect(page.available && page.text).toContain('未验证哈希');
        expect(await db.media.toArray()).toEqual(before);
        expect(service).not.toHaveBeenCalled();
    });
    it('publishes an honest empty selection without a backend read', async () => {
        const project = await createProject('空项目'), run = await begin(project.id);
        const backend = vi.spyOn(binary, 'binaryAvailability');
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check', {mediaIds: []}));
        expect((await db.agentJobs.toArray())[0]).toMatchObject({status: 'completed', completed: 0, selected: 0});
        expect(backend).not.toHaveBeenCalled();
    });
    it.each(['foreign', 'audio', 'non-video-project'] as const)('refuses %s before admission or byte access', async mode => {
        const project = mode === 'non-video-project' ? await createAudioMusicProject('声音', 'audio') : await createProject('当前项目');
        const other = await createProject('其他项目');
        await db.media.add({id: 'target', projectId: mode === 'foreign' ? other.id : project.id, filename: 'target', mimeType: mode === 'audio' ? 'audio/wav' : 'video/mp4', blob: new Blob(['unchanged'])});
        const run = await begin(project.id), backend = vi.spyOn(binary, 'binaryAvailability');
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check', {mediaIds: ['target']}));
        expect((await db.agentToolCalls.toArray())[0].status).toBe('failed');
        expect(await db.agentJobs.count()).toBe(0); expect(backend).not.toHaveBeenCalled();
    });
    it('rejects duplicate and oversized explicit selections before execution', () => {
        expect(() => validateToolCall('project_media_check', JSON.stringify({mediaIds: ['a', 'a']}), ['project_media_check'])).toThrow();
        expect(() => validateToolCall('project_media_check', JSON.stringify({mediaIds: Array.from({length: 65}, (_, i) => `id-${i}`)}), ['project_media_check'])).toThrow();
        expect(() => validateToolCall('read_job_result', JSON.stringify({jobId: 'a', limit: 6001}), ['read_job_result'])).toThrow();
    });
    it('keeps stopping and the actual execution lock until the held native read drains, then starts no next item', async () => {
        const project = await createProject('停止检查'); await addVideo(project.id, 'first'); await addVideo(project.id, 'second');
        const run = await begin(project.id), controller = new AbortController(), entered = deferred<void>(), gate = deferred<unknown>();
        const actions = nativeAvailabilityFixture(async () => {entered.resolve(); return gate.promise;});
        let held = false;
        const manager: ThreadLockManager = {request: async (_name, _options, callback) => {held = true; try {return await callback({held: true});} finally {held = false;}}};
        const work = withExecutionOwnership(run.threadId, ownership => executeChatRun(run, connector.apiKey, controller, modelFor(run, 'project_media_check'), undefined, db, ownership), manager);
        await entered.promise; controller.abort();
        await vi.waitFor(async () => expect((await db.agentJobs.toArray())[0]?.status).toBe('stopping'));
        expect(held).toBe(true);
        expect((await db.agentToolCalls.toArray())[0].status).toBe('running');
        expect(actions).toHaveLength(1);
        gate.resolve({type: 'availability', state: 'ready'}); await work;
        const job = (await db.agentJobs.toArray())[0];
        expect(job).toMatchObject({status: 'stopped', completed: 1, selected: 2, observations: [{status: 'ready'}]});
        expect((await db.agentToolCalls.toArray())[0].status).toBe('completed');
        expect(held).toBe(false); expect(actions).toHaveLength(1);
        const page = await readPage({threadId: run.threadId, projectId: project.id}, job.id);
        expect(page.available && page.text).toContain('未检查');
        db.close(); await db.open();
        await resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => reply(run.protocol));
        expect(actions).toHaveLength(1);
    });
    it('separates native missing, corrupt and reader errors in actual committed findings', async () => {
        const project = await createProject('不可用素材');
        for (const id of ['a', 'b', 'c']) await addVideo(project.id, id);
        const run = await begin(project.id);
        const actions = nativeAvailabilityFixture(async (_action, index) => {
            if (index === 3) throw new Error('reader unavailable');
            return {type: 'availability', state: index === 1 ? 'missing' : 'corrupt'};
        });
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check'));
        expect((await db.agentJobs.toArray())[0]).toMatchObject({status: 'completed', completed: 3, observations: [{status: 'missing'}, {status: 'corrupt'}, {status: 'read_error'}]});
        expect(actions).toHaveLength(3);
    });
    it('turns deletion during the held read into changed and never reads a later deleted target', async () => {
        const project = await createProject('变更检查'); await addVideo(project.id, 'first'); await addVideo(project.id, 'second');
        const run = await begin(project.id), entered = deferred<void>(), gate = deferred<unknown>();
        const actions = nativeAvailabilityFixture(async () => {entered.resolve(); return gate.promise;});
        const work = executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check'));
        await entered.promise; await db.media.bulkDelete(['first', 'second']);
        gate.resolve({type: 'availability', state: 'ready'}); await work;
        expect((await db.agentJobs.toArray())[0]).toMatchObject({status: 'completed', completed: 2, observations: [{status: 'changed'}, {status: 'changed'}]});
        expect(actions).toHaveLength(1);
    });
    it.each(['thread', 'project', 'scope'] as const)('cannot publish or schedule next after held-read %s loss', async loss => {
        const project = await createProject('归属检查'); await addVideo(project.id, 'first'); await addVideo(project.id, 'second');
        const run = await begin(project.id), entered = deferred<void>(), gate = deferred<unknown>();
        const actions = nativeAvailabilityFixture(async () => {entered.resolve(); return gate.promise;});
        const work = executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check'));
        await entered.promise;
        if (loss === 'thread') await deleteChatThread(run.threadId);
        else if (loss === 'project') await deleteProject(project.id);
        else await db.chatThreads.update(run.threadId, {projectId: (await createProject('新的归属')).id});
        gate.resolve({type: 'availability', state: 'ready'}); await work;
        expect(actions).toHaveLength(1);
        if (loss !== 'scope') expect(await db.agentJobs.count()).toBe(0);
        expect(await db.agentJobResultChunks.count()).toBe(0);
    });
    it('keeps committed completion when Stop and an exception arrive after publication', async () => {
        const project = await createProject('完成胜出'); await addVideo(project.id, 'first');
        const run = await begin(project.id), controller = new AbortController();
        const publish = jobCommands.publishAgentJob;
        let saved: AgentJobResult | undefined;
        vi.spyOn(jobCommands, 'publishAgentJob').mockImplementation(async (...args) => {saved = await publish(...args); controller.abort(); throw new Error('late callback');});
        await executeChatRun(run, connector.apiKey, controller, modelFor(run, 'project_media_check'));
        expect((await db.agentJobs.toArray())[0].status).toBe('completed');
        const call = (await db.agentToolCalls.toArray())[0];
        expect(call.status).toBe('completed'); expect(JSON.parse(call.result!)).toEqual(saved);
    });
    it('blocks automatic replay after an uncertain media publication without another backend read', async () => {
        const project = await createProject('未知保存'); await addVideo(project.id, 'first');
        const run = await begin(project.id);
        const actions = nativeAvailabilityFixture(async () => ({type: 'availability', state: 'ready'}));
        let reached = 0;
        interceptStoreTable(db, 'agentJobResultChunks', 'bulkAdd', async () => {reached++; throw new UnknownCommitError('media-publish', 'workspace');});
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check'));
        expect(reached).toBe(1); expect((await db.agentToolCalls.toArray())[0].status).toBe('unknown');
        expect((await db.agentJobs.toArray())[0].output).toBeUndefined();
        await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => reply(run.protocol))).rejects.toThrow('不确定');
        expect(actions).toHaveLength(1);
    });
    it('does not start a media backend when admission acknowledgement remains unknown', async () => {
        const project = await createProject('未知受理'); await addVideo(project.id, 'first');
        const run = await begin(project.id), backend = vi.spyOn(binary, 'binaryAvailability');
        let reached = 0;
        interceptStoreTable(db, 'agentJobs', 'add', async () => {reached++; throw new UnknownCommitError('media-admission', 'workspace');});
        await executeChatRun(run, connector.apiKey, new AbortController(), modelFor(run, 'project_media_check'));
        expect(reached).toBe(1); expect(backend).not.toHaveBeenCalled();
        expect((await db.agentToolCalls.toArray())[0].status).toBe('unknown');
        await expect(resumeChatRun(run.id, connector.apiKey, new AbortController(), async () => reply(run.protocol))).rejects.toThrow('不确定');
    });
});
