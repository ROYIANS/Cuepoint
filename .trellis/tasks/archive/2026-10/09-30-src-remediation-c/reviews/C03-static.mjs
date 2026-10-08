import { ESLint } from '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/node_modules/eslint/lib/api.js';
import { readFile, writeFile } from 'node:fs/promises';
const reviews = '.trellis/tasks/09-30-src-remediation-c/reviews';
const entry = JSON.parse(await readFile(`${reviews}/C03-entry-snapshot.json`, 'utf8'));
const config = '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/eslint.config.mjs';
const files = ['src/db/repo.ts', 'src/lib/projectPackage.ts'];
const eslint = new ESLint({ overrideConfigFile: config });
const current = await eslint.lintFiles(files);
const before = [];
for (const filePath of files) before.push(...await eslint.lintText(await readFile(`${entry.baselineDirectory}/${filePath}`, 'utf8'), { filePath }));
await writeFile(`${reviews}/C03-static-current.json`, JSON.stringify(current, null, 2));
await writeFile(`${reviews}/C03-static-before.json`, JSON.stringify(before, null, 2));
await writeFile(`${reviews}/C03-eslint.config.mjs`, await readFile(config));
const key = message => `${message.ruleId}:${message.message}`;
const changes = current.map((result, i) => {
  const counts = new Map();
  for (const message of before[i].messages) counts.set(key(message), (counts.get(key(message)) ?? 0) + 1);
  const added = result.messages.filter(message => {
    const count = counts.get(key(message)) ?? 0;
    if (!count) return true;
    counts.set(key(message), count - 1);
    return false;
  });
  return { file: files[i], baselineDiagnostics: before[i].messages.length, currentDiagnostics: result.messages.length, added };
});
await writeFile(`${reviews}/C03-static-summary.json`, JSON.stringify(changes, null, 2));
console.log(JSON.stringify(changes, null, 2));
if (changes.some(change => change.added.length)) process.exitCode = 1;
