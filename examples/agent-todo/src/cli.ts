import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execute, snapshot} from './host.js';
import {TodoStore, encode} from './store.js';
import type {Scenario} from './types.js';

function send(value: unknown): void {process.stdout.write(`${JSON.stringify(value)}\n`);}
function scenario(value: string | undefined): Scenario {
    if (value && ['todo', 'update', 'pair', 'restart', 'committed', 'stream', 'budget', 'external', 'load', 'summary'].includes(value)) return value as Scenario;
    throw new Error('Unknown scenario');
}
async function main(args = process.argv.slice(2)): Promise<void> {
    const [command, file, id, detail] = args;
    if (!command || !file) throw new Error('Usage: agent-todo begin|open|resume|approve|reject|hold <sqlite-file> [run-id|scenario]');
    const store = new TodoStore(resolve(file));
    const controller = new AbortController();
    const abort = () => controller.abort(new Error('Stopped'));
    process.once('SIGTERM', abort); process.once('SIGINT', abort);
    try {
        if (command === 'hold') {
            send({ready: 'ownership', ownerId: store.ownerId}); process.stdin.resume();
            await new Promise<void>(done => controller.signal.addEventListener('abort', () => done(), {once: true})); return;
        }
        const hold = process.env.TODO_HOLD;
        const options = {hold: hold ? async (kind: 'checkpoint' | 'summary') => {
            if (kind !== hold) return;
            send({ready: kind, runId: run.id, state: snapshot(store, run.id)});
            await new Promise<void>((_done, reject) => {controller.signal.addEventListener('abort', () => reject(new Error('Stopped')), {once: true}); process.stdin.resume();});
        } : undefined};
        const run = command === 'begin' ? store.begin('default', scenario(id), process.env.TODO_PERMISSION === 'full' ? 'full' : 'ask') : store.recover(id ?? '');
        if (command === 'approve' || command === 'reject') {
            const call = store.calls(run.id).find(call => call.id === detail);
            if (!call) throw new Error('Missing call'); store.decide(run.id, call.id, encode(call), command === 'approve');
        } else if (command === 'resume') {
            await execute(store, store.resume(run.id, detail === 'next-segment'), controller, options);
        } else if (command === 'begin') await execute(store, run, controller, options);
        else if (command !== 'open') throw new Error('Unknown command');
        send({ready: 'finished', ...snapshot(store, run.id)});
    } finally {process.off('SIGTERM', abort); process.off('SIGINT', abort); store.close();}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((cause: unknown) => {process.stderr.write(`${cause instanceof Error ? cause.message : 'Todo failed'}\n`); process.exitCode = 1;});
