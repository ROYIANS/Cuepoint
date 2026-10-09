import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compareExact, exactKeys, hash, inside, owned, packageManifest, readOptional, validateReview } from './shared.mjs';

export async function runCommand(command, args, cwd) {
  return await new Promise((resolve, reject) => {
    const process = spawn(command, args, { cwd, env: { ...globalThis.process.env, CI: 'true', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    process.stdout.setEncoding('utf8'); process.stderr.setEncoding('utf8');
    process.stdout.on('data', value => { stdout += value; }); process.stderr.on('data', value => { stderr += value; });
    process.on('error', reject); process.on('close', (exitCode, signal) => resolve({ command, args, exitCode, signal, stdout, stderr }));
  });
}
const issueTypes = new Set(['binaries', 'catalog', 'catalogReferences', 'dependencies', 'devDependencies', 'duplicates', 'enumMembers', 'exports', 'files', 'namespaceMembers', 'optionalPeerDependencies', 'types', 'unlisted', 'unresolved', 'nsExports', 'nsTypes']);
function normalizeKnip(report) {
  if (!report || !Array.isArray(report.issues) || (report.files !== undefined && !Array.isArray(report.files))) throw new Error('Knip: unexpected JSON report schema');
  const candidates = [];
  for (const file of report.files ?? []) {
    if (typeof file !== 'string') throw new Error('Knip: invalid file finding');
    candidates.push({ issue: 'files', file, symbol: '' });
  }
  for (const row of report.issues) {
    if (!inside(row.file)) throw new Error('Knip: invalid issue file');
    for (const [issue, values] of Object.entries(row)) {
      if (issue === 'file') continue;
      if (!issueTypes.has(issue) || !Array.isArray(values)) throw new Error(`Knip: unsupported issue schema ${issue}`);
      for (const value of values) {
        // Duplicate exports carry one array of declarations per duplicate group.
        const symbol = issue === 'files' ? '' : typeof value === 'string' ? value : Array.isArray(value) ? value.map(item => item.name).sort().join('|') : value.name;
        if (typeof symbol !== 'string') throw new Error(`Knip: missing symbol for ${issue}`);
        candidates.push({ issue, file: row.file, symbol, detail: value });
      }
    }
  }
  return candidates;
}
const keyOf = row => JSON.stringify([row.issue, row.file, row.symbol]);
export async function checkUnused(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const { file: manifestPath, manifest } = await packageManifest(require, 'knip');
  const cli = path.resolve(path.dirname(manifestPath), typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.knip);
  async function run(production) {
    const args = [cli, '--config', path.join(root, 'knip.json'), '--reporter', 'json', '--no-progress', '--max-issues', String(Number.MAX_SAFE_INTEGER), ...(production ? ['--production'] : [])];
    const command = await runCommand(process.execPath, args, root);
    // Own exact reviewed findings control issue acceptance. A supported high
    // max-issues ceiling separates reportable findings from config/tool failures,
    // including hints mixed with genuine unused findings. Never mask nonzero exit.
    if (command.signal || command.exitCode !== 0) {
      const error = new Error(`Knip execution failed: ${JSON.stringify(command)}`);
      error.toolEvidence = command;
      throw error;
    }
    let raw;
    try { raw = JSON.parse(command.stdout); } catch { throw new Error(`Knip did not emit complete JSON: ${JSON.stringify(command)}`); }
    try { return { command, raw, candidates: normalizeKnip(raw) }; }
    catch (error) { error.toolEvidence = command; throw error; }
  }
  const production = await run(true);
  const full = await run(false);
  const document = await readOptional(path.join(root, 'quality/unused-contracts.json'), { schemaVersion: 1, contracts: [] });
  exactKeys(document, ['schemaVersion', 'contracts'], 'unused contracts');
  if (document.schemaVersion !== 1 || !Array.isArray(document.contracts)) throw new Error('unused contracts: unsupported schema');
  for (const row of document.contracts) {
    exactKeys(row, ['issue', 'file', 'symbol', 'count', 'reason', 'owner', 'evidence'], 'unused contract');
    validateReview(row, 'unused contract');
    if (!owned(row.file) || !issueTypes.has(row.issue) || typeof row.symbol !== 'string' || !Array.isArray(row.evidence) || !row.evidence.length) throw new Error('unused contract: invalid issue/scope/symbol/evidence');
    if (row.file.startsWith('src/') || row.file.startsWith('scripts/')) {
      if (!row.evidence.some(input => input.file === row.file)) throw new Error('unused contract: evidence must include the finding source file');
    }
    const seen = new Set();
    for (const input of row.evidence) {
      exactKeys(input, ['file', 'sha256'], 'unused evidence');
      if (!inside(input.file) || !/^[a-f0-9]{64}$/.test(input.sha256) || seen.has(input.file)) throw new Error('unused contract: invalid/duplicate evidence');
      seen.add(input.file);
      if (hash(await readFile(path.join(root, input.file))) !== input.sha256) throw new Error(`unused contract: evidence changed ${input.file}`);
    }
  }
  const candidates = full.candidates.filter(row => owned(row.file));
  const fullKeys = new Set(full.candidates.map(keyOf));
  return { production, full, candidates, outsideCandidateScope: full.candidates.filter(row => !owned(row.file)), productionOnly: production.candidates.filter(row => owned(row.file) && !fullKeys.has(keyOf(row))), contracts: document.contracts, failures: compareExact(candidates, document.contracts, keyOf, 'unused contracts') };
}
