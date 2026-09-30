import {ESLint} from '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/node_modules/eslint/lib/api.js';
import {execFileSync} from 'node:child_process';
import {writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const config = '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/eslint.config.mjs';
const reviews = '.trellis/tasks/09-30-src-remediation-c/reviews';
const files = ['src/db/agentTaskRecords.ts', 'src/db/taskGenerationEvidence.ts', 'src/lib/agent/wrapupEvidence.ts'];
const lint = new ESLint({overrideConfigFile: config});
const current = await lint.lintFiles(files);
const baseline = [];
for (const filePath of files.filter(file => !file.endsWith('taskGenerationEvidence.ts'))) {
  const source = execFileSync('git', ['show', `028e60070c14552025a3493e65f032350fdba8b5:${filePath}`], {encoding: 'utf8'});
  baseline.push(...await lint.lintText(source, {filePath}));
}
const metricLint = new ESLint({overrideConfigFile: config, overrideConfig: {rules: {complexity: ['warn', 0], 'sonarjs/cognitive-complexity': ['warn', 0]}}});
const metrics = await metricLint.lintFiles(['src/db/taskGenerationEvidence.ts']);
await writeFile(`${reviews}/C01-check-static-final.json`, JSON.stringify(current, null, 2));
await writeFile(`${reviews}/C01-check-static-baseline.json`, JSON.stringify(baseline, null, 2));
await writeFile(`${reviews}/C01-check-leaf-complexity.json`, JSON.stringify(metrics, null, 2));
await writeFile(`${reviews}/C01-check-eslint.config.mjs`, await readFile(config));
console.log(JSON.stringify({configSha256: createHash('sha256').update(await readFile(config)).digest('hex'), current: current.map(result => ({file: result.filePath, errors: result.errorCount, warnings: result.warningCount, messages: result.messages})), baseline: baseline.map(result => ({file: result.filePath, errors: result.errorCount, warnings: result.warningCount, messages: result.messages}))}, null, 2));
if (current.find(result => result.filePath.endsWith('taskGenerationEvidence.ts')).messages.length) process.exitCode = 1;
