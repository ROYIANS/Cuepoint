import {ESLint} from '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/node_modules/eslint/lib/api.js';
import {readFile, writeFile} from 'node:fs/promises';
const root = '.trellis/tasks/09-30-src-remediation-c/reviews';
const entry = JSON.parse(await readFile(`${root}/C06-entry.json`, 'utf8'));
const files = [...Object.keys(entry.files).filter(f => f.startsWith('src/')), 'src/lib/resource/limits.ts', 'src/lib/ai/boundedResponse.ts', 'src/lib/ai/boundedSse.ts'];
const eslint = new ESLint({overrideConfigFile: '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/eslint.config.mjs'});
const current = await eslint.lintFiles(files);
const before = [];
for (const filePath of files) before.push(...await eslint.lintText(filePath in entry.files ? await readFile(`${root}/C06-source-backups/${filePath}`, 'utf8') : '', {filePath}));
const key = message => `${message.ruleId}:${message.message.replace(/\bline \d+\b/g, 'line <location>')}`;
const summary = current.map((result, i) => {
 const counts = new Map();
 for (const msg of before[i].messages) counts.set(key(msg), (counts.get(key(msg)) ?? 0) + 1);
 const added = result.messages.filter(msg => {const n = counts.get(key(msg)) ?? 0; if (!n) return true; counts.set(key(msg), n - 1); return false;});
 return {file: files[i], before: before[i].messages.length, after: result.messages.length, added};
});
await writeFile(`${root}/C06-static-results.json`, JSON.stringify({before, current}, null, 2));
await writeFile(`${root}/C06-static-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
const complexityRules = new Set(['complexity', 'sonarjs/cognitive-complexity']);
const gate = {
 policy: 'No added non-complexity diagnostics, no diagnostics in new helpers; existing adapter complexity changes retained for review',
 addedNonComplexity: summary.flatMap(row => row.added.filter(message => !complexityRules.has(message.ruleId)).map(message => ({file: row.file, ...message}))),
 newHelperDiagnostics: summary.filter(row => !(row.file in entry.files)).flatMap(row => row.added.map(message => ({file: row.file, ...message}))),
 complexityMetrics: current.map((row, index) => ({file: files[index], before: before[index].messages.filter(m => complexityRules.has(m.ruleId)), after: row.messages.filter(m => complexityRules.has(m.ruleId))})),
};
gate.passed = !gate.addedNonComplexity.length && !gate.newHelperDiagnostics.length;
await writeFile(`${root}/C06-static-gate.json`, JSON.stringify(gate, null, 2));
if (!gate.passed) process.exitCode = 1;
