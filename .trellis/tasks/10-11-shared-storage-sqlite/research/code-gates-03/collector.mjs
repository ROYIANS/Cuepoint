import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Task-local evidence collector. Each command retains its exact exit, output and
// relevant source identity; Rust/packaged acceptance remains a separate gate.
const root = process.cwd();
const pnpm = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm';
const wave = process.argv[2];
const mode = process.argv[3] ?? 'all';
if (!/^code-gates-\d+$/.test(wave ?? '')) throw new Error('Provide a new code-gates-N wave name');
if (!['all', 'browser'].includes(mode)) throw new Error('Mode must be all or browser');
const output = resolve(root, '.trellis/tasks/10-11-shared-storage-sqlite/research', wave);
await mkdir(output);
await writeFile(join(output, 'collector.mjs'), await readFile(fileURLToPath(import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function collect(directory, result = []) {
  for (const entry of await readdir(join(root, directory), {withFileTypes: true})) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(name, result);
    else if (entry.isFile()) result.push(name);
  }
  return result;
}
async function identity() {
  const files = (await Promise.all(['src', 'tests', 'scripts', 'quality', '.trellis/spec', 'desktop/tauri/ui', 'desktop/tauri/scripts', 'desktop/tauri/src-tauri/src', 'desktop/tauri/src-tauri/tests', 'desktop/tauri/src-tauri/capabilities', 'desktop/tauri/src-tauri/permissions', 'desktop/tauri/src-tauri/icons', 'desktop/tauri/src-tauri/vendor'].map(directory => collect(directory)))).flat();
  files.push('package.json', 'pnpm-lock.yaml', 'vitest.config.ts', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'eslint.config.js', 'desktop/tauri/package.json', 'desktop/tauri/tsconfig.json', 'desktop/tauri/eslint.config.mjs', 'desktop/tauri/knip.json', 'desktop/tauri/rust-toolchain.toml', 'desktop/tauri/src-tauri/tauri.conf.json', 'desktop/tauri/src-tauri/Info.plist', 'desktop/tauri/src-tauri/entitlements.plist', 'desktop/tauri/src-tauri/Cargo.toml', 'desktop/tauri/src-tauri/Cargo.lock', 'desktop/tauri/src-tauri/build.rs');
  const present = [];
  for (const file of [...new Set(files)].sort()) {
    try { present.push([file, hash(await readFile(join(root, file)))]); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return Object.fromEntries(present);
}
const report = {schemaVersion: 1, mode, startedAt: new Date().toISOString(), collectorSha256: hash(await readFile(fileURLToPath(import.meta.url))), node: process.version, sourceBefore: await identity(), commands: [], limitations: ['These gates do not activate the normal SQLite owner or prove actual packaged macOS / WebKit playback.', 'Source identity includes native sources, vendored dependency, permissions, icons, toolchain and package configuration. Actual Rust and packaged gates are recorded separately.', 'Browser-only retry proves that command only; previously passing gates require matching frozen identities before reuse.']};
async function run(name, args, extraEnv = {}) {
  const before = await identity(), log = join(output, `${name}.log`), stream = createWriteStream(log);
  const record = {name, command: pnpm, args, startedAt: new Date().toISOString(), log: `${name}.log`, sourceBefore: before};
  report.commands.push(record);
  console.log(`START ${name}`);
  record.exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(pnpm, args, {cwd: root, env: {...process.env, CARGO_INCREMENTAL: '0', ...extraEnv}, stdio: ['ignore', 'pipe', 'pipe']});
    child.stdout.pipe(stream, {end: false}); child.stderr.pipe(stream, {end: false});
    child.on('error', reject); child.on('exit', (code, signal) => {record.signal = signal; resolveExit(signal ? 1 : code ?? 1);});
  });
  await new Promise(done => stream.end(done));
  record.finishedAt = new Date().toISOString(); record.sourceAfter = await identity();
  record.changedInputs = [...new Set([...Object.keys(before), ...Object.keys(record.sourceAfter)])].filter(file => before[file] !== record.sourceAfter[file]);
  record.logSha256 = hash(await readFile(log));
  console.log(`END ${name}: exit=${record.exitCode} changedInputs=${record.changedInputs.length}`);
}
if (mode === 'browser') {
  await run('browser', ['test'], {CUEPOINT_TOOL_COVERAGE_DIR: join(output, 'browser-tool-coverage'), CUEPOINT_STORAGE_TEST_OWNER: 'indexeddb'});
} else {
await Promise.all([
  run('browser', ['test'], {CUEPOINT_TOOL_COVERAGE_DIR: join(output, 'browser-tool-coverage'), CUEPOINT_STORAGE_TEST_OWNER: 'indexeddb'}),
  run('quality', ['quality', '--report', join(output, 'quality.json')]),
]);
await Promise.all([
  run('types', ['lint']),
  run('quality-self-test', ['quality:self-test']),
  run('agent-types', ['exec', 'tsc', '--project', 'tests/typecheck/tsconfig.agent-tools.json', '--noEmit']),
  run('checkpoint-types', ['exec', 'tsc', '--project', 'tests/typecheck/tsconfig.checkpoint.json', '--noEmit']),
  run('model-bank', ['model-bank:verify']),
]);
await Promise.all([
  run('frontend-build', ['build']),
  run('desktop-types', ['--dir', 'desktop/tauri', 'types']),
  run('desktop-lint', ['--dir', 'desktop/tauri', 'lint']),
  run('desktop-quality', ['--dir', 'desktop/tauri', 'quality']),
]);
}
report.finishedAt = new Date().toISOString(); report.sourceAfter = await identity();
report.changedInputs = [...new Set([...Object.keys(report.sourceBefore), ...Object.keys(report.sourceAfter)])].filter(file => report.sourceBefore[file] !== report.sourceAfter[file]);
report.pass = report.changedInputs.length === 0 && report.commands.every(command => command.exitCode === 0 && command.changedInputs.length === 0);
await writeFile(join(output, 'acceptance.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({pass: report.pass, commands: report.commands.map(({name, exitCode, changedInputs}) => ({name, exitCode, changedInputs})), output}));
process.exitCode = report.pass ? 0 : 1;
