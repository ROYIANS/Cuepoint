// Reuses the accepted D02 native D01 preparation/nested-write runner; adds actual D05 tool approval/receipt rollback.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {resolve} from 'node:path';
const {chromium} = await import(process.env.C01_PLAYWRIGHT_PATH ?? 'playwright');
const server = await createServer({configFile: false, resolve: {alias: {'@': resolve('src')}}, server: {host: '127.0.0.1', port: 0}});
let browser;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.C01_CHROMIUM_PATH ? {executablePath: process.env.C01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage();
    let externalRequests = 0;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {if (new URL(route.request().url()).hostname !== '127.0.0.1') {externalRequests++; return route.abort();} return route.continue();});
    await page.goto(server.resolvedUrls.local[0] + 'tests/fixtures/c01/');
    const result = await page.evaluate(async () => {
        const {db} = await import('/src/db/database.ts');
        const fixture = await import('/tests/fixtures/d01/harness.ts');
        const {applyAgentGeneration} = await import('/src/lib/agent/generationRuntime.ts');
        const {applyBatchSelections, readGenerationBatch} = await import('/src/db/agentGenerationBatches.ts');
        const {startModelStep, saveToolRound, transitionToolCall, AtomicToolRollbackError} = await import('/src/db/agentTools.ts');
        const {readGenerationTarget} = await import('/src/db/agentGenerationTarget.ts');
        const {updateGenerationJob} = await import('/src/db/agentGeneration.ts');
        const {targetRevision} = await import('/src/lib/productionRevision.ts');
        const {putMedia} = await import('/src/db/media.ts');
        const check = (value, message) => {if (!value) throw new Error(message);};
        const single = await fixture.runSingleBoundary();
        let job = (await db.agentGenerationJobs.toArray()).find(j => j.callId && !j.batchId);
        const target = {...job.target, slot: 'lastFrame'};
        const current = await readGenerationTarget(target);
        await updateGenerationJob(job.id, {status: 'downloaded'});
        await db.agentGenerationJobs.update(job.id, {target, baseRevision: current.revision});
        const step = await startModelStep(job.runId, 32);
        await saveToolRound(job.runId, '', [{id: 'check-native-rollback', type: 'function', function: {name: 'apply_generation', arguments: JSON.stringify({jobId: job.id})}}], [{title: 'checker local apply', effect: 'write', highRisk: false, atomic: true}]);
        const call = (await db.agentToolCalls.where('runId').equals(job.runId).toArray()).find(c => c.providerCallId === 'check-native-rollback');
        await transitionToolCall(job.runId, call.id, ['pending'], 'running');
        const beforeSingle = {shot: targetRevision(await db.shots.get(job.target.entityId)), job: targetRevision(await db.agentGenerationJobs.get(job.id)), call: targetRevision(await db.agentToolCalls.get(call.id))};
        const originalLedgerUpdate = db.agentToolCalls.update;
        let singleReachedCommit = false, singleFailed = false;
        db.agentToolCalls.update = async function (key, patch) {
            if (key === call.id && patch.status === 'completed') {
                check((await readGenerationTarget(target)).slot.result?.mediaId === job.result.mediaId, 'single fault did not follow actual nested slot write');
                check((await db.agentGenerationJobs.get(job.id)).status === 'applied', 'single fault did not follow actual job write');
                singleReachedCommit = true;
                throw new Error('checker forced ledger failure');
            }
            return originalLedgerUpdate.call(this, key, patch);
        };
        try {await applyAgentGeneration(job.id, {runId: job.runId, threadId: job.threadId, callId: call.id, signal: new AbortController().signal});}
        catch (e) {check(e instanceof AtomicToolRollbackError && e.message === 'checker forced ledger failure', 'unexpected single fault'); singleFailed = true;}
        finally {db.agentToolCalls.update = originalLedgerUpdate;}
        check(singleReachedCommit && singleFailed, 'single rollback fault was not exercised');
        check(beforeSingle.shot === targetRevision(await db.shots.get(job.target.entityId)) && beforeSingle.job === targetRevision(await db.agentGenerationJobs.get(job.id)) && beforeSingle.call === targetRevision(await db.agentToolCalls.get(call.id)), 'single business/job/ledger rollback incomplete');
        await db.agentToolCalls.update(call.id, {status: 'failed', result: JSON.stringify({error: 'expected checker rollback'})});
        const batch = await fixture.runBatchBoundary();
        const queued = (await db.agentGenerationBatches.toArray()).find(b => b.title === 'local batch');
        const state = await readGenerationBatch(queued.id, queued.threadId);
        check(state.batch.applications.length === 1 && state.jobs[0].status === 'applied', 'successful batch lost history/job commit');
        const prepCall = await db.agentToolCalls.get(state.batch.sourceCallId);
        check(prepCall.status === 'completed' && JSON.parse(prepCall.result).batchId === queued.id, 'batch preparation ledger not committed');
        job = state.jobs[0];
        // Seed a replacement locally; normal generation commands intentionally do not
        // redownload an already applied job. This fixture does not invoke a provider.
        await putMedia({id: job.id + '-checker-replacement', projectId: job.projectId, filename: 'replacement.png', mimeType: 'image/png', blob: new Blob(['local checker replacement'], {type: 'image/png'}), createdAt: job.createdAt});
        await db.agentGenerationJobs.update(job.id, {status: 'downloaded', result: {kind: 'image', mediaId: job.id + '-checker-replacement'}});
        const beforeBatch = {shot: targetRevision(await db.shots.get(job.target.entityId)), job: targetRevision(await db.agentGenerationJobs.get(job.id)), batch: targetRevision(await db.agentGenerationBatches.get(queued.id))};
        const originalBatchPut = db.agentGenerationBatches.put;
        let batchReachedCommit = false;
        db.agentGenerationBatches.put = async function (value, ...rest) {
            if (value.id === queued.id && value.applications.length === 2) {
                check((await readGenerationTarget(job.target)).slot.result?.mediaId === job.id + '-checker-replacement', 'batch fault did not follow nested slot write');
                check((await db.agentGenerationJobs.get(job.id)).status === 'applied', 'batch fault did not follow job write');
                batchReachedCommit = true;
                throw new Error('checker forced application history failure');
            }
            return originalBatchPut.call(this, value, ...rest);
        };
        let outcomes;
        try {outcomes = await applyBatchSelections(queued.id, queued.threadId);}
        finally {db.agentGenerationBatches.put = originalBatchPut;}
        check(batchReachedCommit && outcomes.length === 1 && !outcomes[0].applied && outcomes[0].error === 'checker forced application history failure', 'batch rollback fault was not reported: ' + JSON.stringify({batchReachedCommit, outcomes}));
        check(beforeBatch.shot === targetRevision(await db.shots.get(job.target.entityId)) && beforeBatch.job === targetRevision(await db.agentGenerationJobs.get(job.id)) && beforeBatch.batch === targetRevision(await db.agentGenerationBatches.get(queued.id)), 'batch business/job/history rollback incomplete');
        const guard = await fixture.runTaskGuardBoundary();
        return {single, batch, guard, singleForcedRollback: {reachedNestedSlotAndJobWrites: singleReachedCommit, businessJobLedgerUnchanged: true}, batchForcedRollback: {successfulLedgerAndHistoryProven: true, reachedNestedSlotAndJobWrites: batchReachedCommit, businessJobHistoryUnchanged: true}};
    });
    const typed = await page.evaluate(async () => {
        const {db} = await import('/src/db/database.ts');
        const {createProject} = await import('/src/db/projects.ts');
        const {addCharacter} = await import('/src/db/assets.ts');
        const {createChatThread} = await import('/src/db/chat.ts');
        const {beginAgentRun} = await import('/src/db/agentRuns.ts');
        const {updateGeneralAgentConfig} = await import('/src/db/agentSettings.ts');
        const {resolveAgentToolApproval} = await import('/src/db/agentTools.ts');
        const {executeChatRun, resumeChatRun} = await import('/src/lib/agent/runChat.ts');
        const {BUILTIN_TOOLS} = await import('/src/lib/agent/tools.ts');
        const {targetRevision} = await import('/src/lib/productionRevision.ts');
        const Dexie = db.constructor;
        const check = (value, message) => {if (!value) throw new Error(message);};
        await db.delete(); await db.open();
        await updateGeneralAgentConfig({permissionMode: 'ask'});
        const project = await createProject('D05 native protocol');
        const character = await addCharacter(project.id);
        const thread = await createChatThread({projectId: project.id});
        const connector = {id: 'd05-native', definitionId: 'openai-compatible', baseUrl: 'https://fixture.test/v1', apiKey: 'local-fixture', updatedAt: 'now'};
        const args = {ownerId: project.id, id: character.id, patch: {bio: 'native schema-bound write'}};
        const tool = BUILTIN_TOOLS.find(tool => tool.name === 'character_update');
        check(tool && BUILTIN_TOOLS.length === 89, 'native registry is incomplete');
        check(tool.parseArguments(args).patch.bio === args.patch.bio, 'native parser lost schema output');
        let modelRequests = 0;
        async function start() {
            const original = await beginAgentRun({threadId: thread.id, connector, model: 'fixture', content: 'update character'});
            const toolLoading = {version: 1, groups: [], foundationToolNames: ['character_update'], foundationInstructions: '', loadedGroupIds: [], loadedToolNames: []};
            const run = {...original, enabledToolNames: ['character_update'], toolLoading, offeredTools: [{step: 1, names: ['character_update']}]};
            await db.agentRuns.put(run);
            await executeChatRun(run, connector.apiKey, new AbortController(), async () => {
                modelRequests++;
                return Response.json({choices: [{message: {content: '', tool_calls: [{id: 'native-call', type: 'function', function: {name: tool.name, arguments: JSON.stringify(args)}}]}, finish_reason: 'tool_calls'}]});
            });
            const call = (await db.agentToolCalls.where('runId').equals(run.id).toArray())[0];
            check(call?.status === 'awaiting_approval' && call.preview?.revision && call.atomic, 'native write did not retain approval/preview/atomic metadata');
            check((await db.characters.get(character.id)).bio !== args.patch.bio, 'native preparation wrote business state');
            await resolveAgentToolApproval(run.id, call.id, 'approve');
            return {run, call};
        }
        const before = targetRevision(await db.characters.get(character.id));
        const faulted = await start();
        const update = db.agentToolCalls.update;
        let reachedWriteAndReceipt = false;
        db.agentToolCalls.update = async function (id, patch) {
            if (id === faulted.call.id && patch.status === 'completed') {
                check(Dexie.currentTransaction, 'native ledger hook did not run in the write transaction');
                check((await db.characters.get(character.id)).bio === args.patch.bio, 'fault did not follow the actual character write');
                const result = JSON.parse(patch.result);
                check(result.writeReceipt.entries.some(entry => entry.id === character.id && entry.operation === 'updated'), 'fault did not follow receipt construction');
                reachedWriteAndReceipt = true;
                throw new Error('D05 native late ledger fault');
            }
            return update.call(this, id, patch);
        };
        try {
            await resumeChatRun(faulted.run.id, connector.apiKey, new AbortController(), async () => {modelRequests++; return Response.json({choices: [{message: {content: 'known rollback'}, finish_reason: 'stop'}]});});
        } finally {db.agentToolCalls.update = update;}
        check(reachedWriteAndReceipt, 'native late fault was not reached');
        check(targetRevision(await db.characters.get(character.id)) === before, 'native character/ledger transaction did not roll back');
        const failed = await db.agentToolCalls.get(faulted.call.id);
        check(failed.status === 'failed' && failed.decision === 'approve' && failed.error.includes('D05 native late ledger fault'), 'native rollback was misclassified');
        check(!JSON.parse(failed.result).writeReceipt, 'native failed call retained a successful receipt');
        const successful = await start();
        await resumeChatRun(successful.run.id, connector.apiKey, new AbortController(), async () => {modelRequests++; return Response.json({choices: [{message: {content: 'saved'}, finish_reason: 'stop'}]});});
        const saved = await db.agentToolCalls.get(successful.call.id);
        check(saved.status === 'completed' && saved.decision === 'approve', 'native approved call did not complete');
        check((await db.characters.get(character.id)).bio === args.patch.bio && JSON.parse(saved.result).writeReceipt.entries.some(entry => entry.id === character.id), 'native saved write lost its receipt');
        check(modelRequests === 4, 'native loop added an unexpected model request');
        return {registered: BUILTIN_TOOLS.length, reachedWriteAndReceipt, nativeLateLedgerRollback: true, approvedSuccessWithReceipt: true, modelRequests};
    });
    assert.equal(typed.registered, 89); assert.equal(typed.reachedWriteAndReceipt, true); assert.equal(typed.nativeLateLedgerRollback, true); assert.equal(typed.approvedSuccessWithReceipt, true); assert.equal(typed.modelRequests, 4);
    assert.equal(externalRequests, 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({...result, typed, externalRequests, pageErrors: errors, nativeIndexedDB: true, limitation: 'Local synthetic media; no paid provider, image/video decode or product UI claim'}));
} finally {await browser?.close(); await server.close();}
