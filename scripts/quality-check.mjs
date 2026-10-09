#!/usr/bin/env node
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkLint } from './quality/lint.mjs';
import { checkArchitecture } from './quality/architecture.mjs';
import { checkUnused } from './quality/unused.mjs';
import { filesUnder, hash, IDENTITY_VERSION, inside, packageManifest, readOptional } from './quality/shared.mjs';

async function inventory(root) {
  const files = [];
  for (const directory of ['src', 'scripts', 'tests', 'quality', 'vendor']) {
    try { files.push(...await filesUnder(root, directory)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const file of ['package.json', 'pnpm-lock.yaml', 'eslint.config.mjs', 'knip.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'vitest.config.ts', 'index.html']) {
    try { if ((await stat(path.join(root, file))).isFile()) files.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Retention evidence may live outside the ordinary source/config roots.
  // Freeze only the exact referenced paths; do not inventory the whole task tree.
  const unused = await readOptional(path.join(root, 'quality/unused-contracts.json'), { contracts: [] });
  if (Array.isArray(unused?.contracts)) for (const contract of unused.contracts) {
    if (!Array.isArray(contract?.evidence)) continue;
    for (const evidence of contract.evidence) {
      if (!inside(evidence?.file)) throw new Error('unused evidence: invalid relative file');
      files.push(evidence.file);
    }
  }
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async file => [file, hash(await readFile(path.join(root, file)))])));
}
async function runQuality({ root = process.cwd(), only } = {}) {
  root = path.resolve(root);
  if (only && !['lint', 'architecture', 'unused'].includes(only)) throw new Error('Expected --only lint|architecture|unused');
  const before = await inventory(root);
  const require = createRequire(path.join(root, 'package.json'));
  const versions = {};
  for (const name of ['eslint', '@eslint/js', 'typescript', 'typescript-eslint', 'eslint-plugin-react-hooks', 'eslint-plugin-sonarjs', 'knip']) versions[name] = (await packageManifest(require, name)).manifest.version;
  const report = { schemaVersion: 1, identityVersion: IDENTITY_VERSION, root, node: process.version, versions, mode: only ?? 'all', startedAt: new Date().toISOString(), inputs: before, sections: {}, failures: [] };
  for (const [name, check] of [['lint', checkLint], ['architecture', checkArchitecture], ['unused', checkUnused]]) {
    if (only && name !== only) continue;
    try {
      report.sections[name] = await check(root);
      report.failures.push(...report.sections[name].failures.map(failure => ({ section: name, ...failure })));
    } catch (error) {
      report.toolError = error.stack ?? String(error);
      report.toolEvidence = error.toolEvidence;
      report.failures.push({ section: name, kind: 'tool-or-config-error', message: error.message });
      break;
    }
  }
  const after = await inventory(root);
  const changedInputs = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(file => before[file] !== after[file]);
  if (changedInputs.length) report.failures.push({ kind: 'inputs-changed-during-run', files: changedInputs });
  report.finishedAt = new Date().toISOString();
  report.exitCode = report.toolError ? 2 : report.failures.length ? 1 : 0;
  return report;
}
async function save(file, value) {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function main(args = process.argv.slice(2)) {
  let root = process.cwd(), only, reportPath, describePath;
  for (let i = 0; i < args.length; i++) {
    if (!['--root', '--only', '--report', '--describe'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown/incomplete option: ${args[i]}`);
    const value = args[++i];
    if (args[i - 1] === '--root') root = value;
    else if (args[i - 1] === '--only') only = value;
    else if (args[i - 1] === '--report') reportPath = value;
    else describePath = value;
  }
  let report;
  try { report = await runQuality({ root, only }); }
  catch (error) { report = { schemaVersion: 1, exitCode: 2, mode: only ?? 'all', root: path.resolve(root), toolError: error.stack ?? String(error) }; }
  if (reportPath) await save(reportPath, report);
  if (describePath) await save(describePath, report.sections?.lint?.diagnostics ?? []);
  if (report.toolError) console.error(report.toolError);
  else {
    for (const [name, result] of Object.entries(report.sections)) {
      if (name === 'lint') console.log(`lint: ${result.errors} errors, ${result.warnings} review warnings, ${result.allowances.length} reviewed allowances; ${result.failures.length} failures\nwarning rules: ${JSON.stringify(result.warningCounts)}`);
      if (name === 'architecture') console.log(`architecture: ${result.files.length} files, ${result.staticValueEdges} static value edges, ${result.dynamicValueEdges} literal dynamic edges, ${result.cycles.length} static cycles; ${result.failures.length} failures; ${result.computed.length} computed imports/requires outside static proof`);
      if (name === 'unused') console.log(`unused: ${result.candidates.length} full-scope candidates, ${result.contracts.length} reviewed contracts, ${result.productionOnly.length} production-only review signals; ${result.failures.length} failures`);
    }
    for (const failure of report.failures.slice(0, 30)) console.error(JSON.stringify(failure));
    if (report.failures.length > 30) console.error(`${report.failures.length - 30} additional failures; use --report <path> for full detail`);
    console.log(`quality: ${report.exitCode === 0 ? 'PASS' : 'FAIL'} (${report.mode})`);
  }
  return report.exitCode;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.stack ?? error); process.exitCode = 2; });
}
