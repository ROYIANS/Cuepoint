import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {open, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, relative} from 'node:path';

const base = fileURLToPath(new URL('../', import.meta.url));
async function sourceHashes() {
    const files = {};
    async function visit(directory) {
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            if (entry.name.startsWith('.') || ['node_modules', 'target', 'dist', 'gen'].includes(entry.name)) continue;
            const path = resolve(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error('Authored source contains a symbolic link');
            if (entry.isDirectory()) await visit(path);
            else if (entry.isFile()) files[relative(base, path)] = createHash('sha256').update(await readFile(path)).digest('hex');
        }
    }
    await visit(base);
    return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
const before = await sourceHashes();
const evidence = resolve(base, '.acceptance/native-gates', new Date().toISOString().replaceAll(':', '-'));
await mkdir(evidence, {recursive: true});
const commands = [
    ['fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--all', '--', '--check'],
    ['clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--all-targets', '--', '-D', 'warnings'],
    ['clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--all-targets', '--features', 'test-hooks', '--', '-D', 'warnings'],
    ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--all-targets'],
    ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--features', 'test-hooks'],
    ['build', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--release'],
    ['build', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--release', '--features', 'test-hooks', '--bin', 'workspace_probe'],
];
const results = [];
for (const [index, args] of commands.entries()) {
    const path = resolve(evidence, `${index + 1}-${args[0]}.log`);
    const log = await open(path, 'wx');
    const started = Date.now();
    const result = await new Promise((accept, reject) => {
        const child = spawn(process.execPath, [resolve(base, 'scripts/tools.mjs'), 'cargo', ...args], {cwd: base, stdio: ['ignore', log.fd, log.fd]});
        child.once('error', reject);
        child.once('exit', (code, signal) => accept({code, signal}));
    });
    await log.close();
    results.push({args, ...result, elapsedMs: Date.now() - started, log: relative(base, path)});
    console.log(`${args[0]}: ${result.code ?? result.signal}; log ${path}`);
}
const after = await sourceHashes();
const stable = JSON.stringify(before) === JSON.stringify(after);
await writeFile(resolve(evidence, 'receipt.json'), `${JSON.stringify({before, after, stable, results}, null, 2)}\n`);
if (!stable || results.some(result => result.code !== 0)) process.exitCode = 1;
