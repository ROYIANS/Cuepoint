import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {canSettleRun, createCapabilityLoading, modelStepLimitReached, offeredToolNames, selectCapabilityGroups, type AgentRunOutput, type AgentRunStatus, type AgentPermissionMode} from '@cuepoint/agent-core';
import {appendResponseToolResult} from '@cuepoint/agent-providers';
import {RolledBackError, UnknownOutcomeError, type Faults, type Scenario, type TodoRun, type TodoCall, type TodoSummary} from './types.js';

export function encode(value: unknown): string {
    const json = JSON.stringify(value);
    if (json === undefined || json.length > 65_536) throw new Error('Invalid or oversized result');
    return json;
}
function decode<T>(value: unknown): T {
    if (typeof value !== 'string') throw new Error('Missing durable JSON');
    return JSON.parse(value) as T;
}
const groups = [
    {id: 'read', name: 'Read todos', description: 'Read this list', instructions: 'Read only.', toolNames: ['list_todos']},
    {id: 'write', name: 'Change todos', description: 'Create or finish todos', instructions: 'Use approved changes.', toolNames: ['create_todo', 'complete_todo']},
];
const allowed = ['list_todos', 'create_todo', 'complete_todo', 'load_tools', 'external_notice'];

/** A sidecar lifetime lock excludes actual live processes while business commits stay short. */
export class TodoStore {
    readonly ownerId = randomUUID();
    readonly db: DatabaseSync;
    private readonly coordinator: DatabaseSync;
    private held = true;
    private executing = false;
    readonly faults: Faults;
    constructor(readonly file: string, faults: Faults = {}) {
        mkdirSync(dirname(file), {recursive: true});
        this.faults = faults;
        this.coordinator = new DatabaseSync(`${file}.ownership`);
        try {this.coordinator.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE');}
        catch (cause) {this.coordinator.close(); throw new Error('Scope has a live owner', {cause});}
        try {this.db = new DatabaseSync(file);
        this.db.exec(`PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS todo_runs(id TEXT PRIMARY KEY, scope TEXT NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS todo_calls(id TEXT PRIMARY KEY, run_id TEXT NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS todo_outputs(run_id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS todos(id TEXT PRIMARY KEY, scope TEXT NOT NULL, title TEXT NOT NULL, done INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS todo_evidence(call_id TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS todo_intents(call_id TEXT PRIMARY KEY, dispatches INTEGER NOT NULL, status TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS todo_summaries(id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
        } catch (cause) {this.coordinator.exec('ROLLBACK'); this.coordinator.close(); this.held = false; throw cause;}
    }
    assertHeld(): void {if (!this.held) throw new Error('Ownership expired');}
    async withExecution<T>(id: string, operation: () => Promise<T>): Promise<T> {
        this.current(id); if (this.executing) throw new Error('Execution already active'); this.executing = true;
        try {return await operation();} finally {this.executing = false;}
    }
    close(): void {this.assertHeld(); if (this.executing) throw new Error('Execution still active'); this.held = false; this.db.close(); this.coordinator.exec('ROLLBACK'); this.coordinator.close();}
    transaction<T>(operation: () => T): T {
        this.assertHeld(); this.db.exec('BEGIN IMMEDIATE');
        try {const result = operation(); this.assertHeld(); this.db.exec('COMMIT'); return result;}
        catch (cause) {this.db.exec('ROLLBACK'); throw cause;}
    }
    readRun(id: string): TodoRun | undefined {
        const row = this.db.prepare('SELECT data FROM todo_runs WHERE id=?').get(id);
        return row ? decode<TodoRun>(row.data) : undefined;
    }
    current(id: string): TodoRun {
        this.assertHeld(); const run = this.readRun(id);
        if (!run || run.ownerId !== this.ownerId) throw new Error('Stale owner or missing run');
        return run;
    }
    saveRun(run: TodoRun, expectedOwner: string = this.ownerId): void {
        this.assertHeld(); const next = {...run, revision: run.revision + 1};
        const saved = this.db.prepare("UPDATE todo_runs SET data=? WHERE id=? AND json_extract(data,'$.revision')=? AND json_extract(data,'$.ownerId')=?").run(JSON.stringify(next), run.id, run.revision, expectedOwner);
        if (saved.changes !== 1) throw new Error('Stale run revision or owner');
        run.revision = next.revision;
    }
    attach(id: string): TodoRun {
        return this.transaction(() => {const run = this.readRun(id); if (!run) throw new Error('Missing run'); const priorOwner = run.ownerId; run.ownerId = this.ownerId; this.saveRun(run, priorOwner); return run;});
    }
    begin(scope: string, scenario: Scenario, permissionMode: AgentPermissionMode = 'ask', enabled = allowed): TodoRun {
        return this.transaction(() => {
            const active = this.db.prepare('SELECT data FROM todo_runs WHERE scope=?').all(scope).map(row => decode<TodoRun>(row.data)).some(run => ['running', 'waiting_approval', 'interrupted'].includes(run.status));
            if (active) throw new Error('An unfinished run already exists');
            const id = randomUUID();
            const run: TodoRun = {id, threadId: scope, scope, ownerId: this.ownerId, revision: 0, scenario, checkpoint: 0, status: 'running', permissionMode, modelStep: 0, modelStepSegmentStart: 0, enabledToolNames: [...enabled], offeredTools: [], responseItems: [], history: [], requestCount: 0, summaryRequests: 0};
            if (scenario === 'load') run.toolLoading = createCapabilityLoading(groups, enabled, name => name === 'load_tools', 'load_tools', 'read');
            if (scenario === 'summary') run.history = [{id: 'old-user', role: 'user', content: 'old request '.repeat(100)}, {id: 'old-answer', role: 'assistant', content: 'old answer '.repeat(100)}, {id: 'current', role: 'user', content: 'current request'}];
            this.db.prepare('INSERT INTO todo_runs VALUES(?,?,?)').run(id, scope, JSON.stringify(run));
            this.db.prepare('INSERT INTO todo_outputs VALUES(?,?)').run(id, JSON.stringify({content: ''}));
            return run;
        });
    }
    output(id: string): AgentRunOutput {return decode<AgentRunOutput>(this.db.prepare('SELECT data FROM todo_outputs WHERE run_id=?').get(id)?.data);}
    checkpoint(id: string, sequence: number, output: AgentRunOutput): boolean {
        return this.transaction(() => {const run = this.current(id); if (run.status !== 'running' || sequence <= run.checkpoint) return false; run.checkpoint = sequence; this.saveRun(run); this.db.prepare('UPDATE todo_outputs SET data=? WHERE run_id=?').run(encode(output), id); return true;});
    }
    settle(id: string, status: Exclude<AgentRunStatus, 'running' | 'waiting_approval'>, output: AgentRunOutput, error?: string): AgentRunStatus {
        return this.transaction(() => {
            const run = this.current(id); if (!canSettleRun(run.status)) return run.status;
            run.status = status; run.error = error; this.saveRun(run);
            const prior = this.output(id);
            this.db.prepare('UPDATE todo_outputs SET data=? WHERE run_id=?').run(encode(output.content ? output : prior), id);
            return run.status;
        });
    }
    recover(id: string): TodoRun {
        const run = this.attach(id);
        this.markUnknown(id);
        this.transaction(() => {this.current(id); for (const summary of this.summaries(id)) if (summary.status === 'running') this.saveSummary({...summary, status: 'interrupted'});});
        if (run.status === 'running') this.settle(id, 'interrupted', this.output(id), 'Previous process stopped; explicit resume required');
        return this.current(id);
    }
    resume(id: string, grantSegment = false): TodoRun {
        return this.transaction(() => {
            const run = this.current(id);
            if (!['waiting_approval', 'interrupted'].includes(run.status)) throw new Error('Run is not resumable');
            if (this.calls(id).some(call => ['unknown', 'running', 'awaiting_approval'].includes(call.status))) throw new Error('Unresolved tool outcome or approval');
            if (modelStepLimitReached(run) && !grantSegment) throw new Error('Explicit next segment required');
            if (grantSegment) run.modelStepSegmentStart = run.modelStep;
            run.status = 'running'; this.saveRun(run); return run;
        });
    }
    calls(id: string): TodoCall[] {return this.db.prepare('SELECT data FROM todo_calls WHERE run_id=?').all(id).map(row => decode<TodoCall>(row.data)).sort((a, b) => a.step - b.step || a.order - b.order);}
    call(id: string): TodoCall | undefined {const row = this.db.prepare('SELECT data FROM todo_calls WHERE id=?').get(id); return row ? decode<TodoCall>(row.data) : undefined;}
    saveCall(call: TodoCall): void {this.db.prepare('UPDATE todo_calls SET data=? WHERE id=?').run(encode(call), call.id);}
    decide(id: string, callId: string, expected: string, approve: boolean): void {
        this.transaction(() => {const run = this.current(id), call = this.call(callId); if (run.status !== 'waiting_approval' || !call || call.runId !== id || call.status !== 'awaiting_approval' || encode(call) !== expected) throw new Error('Stale approval'); call.decision = approve ? 'approved' : 'rejected'; call.status = call.decision; if (!approve) call.result = encode({rejected: true}); this.saveCall(call);});
    }
    append(id: string): void {
        this.transaction(() => {const run = this.current(id); for (const call of this.calls(id)) {
            if (!['completed', 'failed', 'rejected'].includes(call.status) || call.result === undefined) throw new Error('Unresolved result');
            appendResponseToolResult(run.responseItems, call.id, call.result); call.appended = true; this.saveCall(call);
        } this.saveRun(run);});
    }
    markUnknown(id: string): void {
        this.transaction(() => {this.current(id); for (const call of this.calls(id)) if (call.status === 'running') {call.status = 'unknown'; this.saveCall(call);}});
    }
    list(scope: string): Array<{id: string; title: string; done: boolean}> {
        return this.db.prepare('SELECT id,title,done FROM todos WHERE scope=? ORDER BY id').all(scope).map(row => ({id: String(row.id), title: String(row.title), done: row.done === 1}));
    }
    atomic(id: string, callId: string, signal: AbortSignal, mutate: (run: TodoRun) => unknown): unknown {
        let result: unknown;
        try {result = this.transaction(() => {
            const run = this.current(id), call = this.call(callId);
            if (run.status !== 'running' || !call || call.runId !== id || call.status !== 'running') throw new Error('Stale local commit');
            signal.throwIfAborted(); const value = mutate(run);
            if (this.faults.receipt) throw new Error('Receipt rejected');
            this.db.prepare('INSERT INTO todo_evidence VALUES(?,?)').run(callId, encode({callId, scope: run.scope, changed: true}));
            const output = this.faults.result === 'oversize' ? 'x'.repeat(65_537) : this.faults.result === 'nonserializable' ? 1n : value;
            call.result = encode(output); call.status = 'completed'; this.saveCall(call);
            this.faults.abortBeforeCommit?.(); signal.throwIfAborted(); return value;
        });} catch (cause) {throw new RolledBackError('Local transaction rolled back', {cause});}
        if (this.faults.afterCommit) throw new UnknownOutcomeError('Commit acknowledgement lost');
        return result;
    }
    mutate(id: string, callId: string, signal: AbortSignal, operation: {kind: 'create'; title: string} | {kind: 'complete'; id: string}): unknown {
        return this.atomic(id, callId, signal, run => {
            if (operation.kind === 'create') {const todoId = callId; this.db.prepare('INSERT INTO todos VALUES(?,?,?,0)').run(todoId, run.scope, operation.title); return {id: todoId, title: operation.title, done: false};}
            const changed = this.db.prepare('UPDATE todos SET done=1 WHERE id=? AND scope=?').run(operation.id, run.scope).changes;
            if (!changed) throw new Error('Todo outside this scope or missing'); return {id: operation.id, done: true};
        });
    }
    load(id: string, callId: string, names: string[], signal: AbortSignal): unknown {
        return this.atomic(id, callId, signal, run => {if (!run.toolLoading) throw new Error('No loading catalogue'); run.toolLoading = selectCapabilityGroups(run.toolLoading, names, this.calls(id), run.enabledToolNames); this.saveRun(run); return {loaded: offeredToolNames(run)};});
    }
    external(id: string, callId: string, signal: AbortSignal): never {
        this.transaction(() => {this.current(id); signal.throwIfAborted(); this.db.prepare('INSERT INTO todo_intents VALUES(?,0,?)').run(callId, 'intent');});
        this.transaction(() => {this.current(id); this.db.prepare('UPDATE todo_intents SET dispatches=1,status=? WHERE call_id=?').run('unknown', callId);});
        throw new UnknownOutcomeError('External dispatch acknowledgement unavailable');
    }
    summaries(id: string): TodoSummary[] {return this.db.prepare('SELECT data FROM todo_summaries').all().map(row => decode<TodoSummary>(row.data)).filter(row => row.runId === id);}
    saveSummary(summary: TodoSummary): void {this.current(summary.runId); const saved = this.summaries(summary.runId).find(item => item.id === summary.id); if (saved?.status === 'completed') throw new Error('Summary already completed'); this.db.prepare('INSERT INTO todo_summaries VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(summary.id, JSON.stringify(summary));}
}
