import {ESLint} from '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/node_modules/eslint/lib/api.js';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
const config = '/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d/eslint.config.mjs';
const files = ['src/domain/music.ts', 'src/db/music.ts', 'src/lib/agent/musicTools.ts', 'src/lib/audioGeneration/input.ts', 'src/lib/ai/apimartAudio.ts', 'src/lib/audioProjectPackage.ts', 'src/components/music/MusicCreation.tsx'];
const reviews = '.trellis/tasks/09-30-src-remediation-c/reviews';
const lint = new ESLint({overrideConfigFile: config});
const current = await lint.lintFiles(files);
const baseline = [];
for (const filePath of files) baseline.push(...await lint.lintText(execFileSync('git', ['show', `HEAD:${filePath}`], {encoding: 'utf8'}), {filePath}));
await writeFile(`${reviews}/C02-check-static-current.json`, JSON.stringify(current, null, 2));
await writeFile(`${reviews}/C02-check-static-baseline.json`, JSON.stringify(baseline, null, 2));
await writeFile(`${reviews}/C02-check-eslint.config.mjs`, await readFile(config));
const key = message => `${message.ruleId}:${message.message}`;
const changes = current.map((result, i) => {
  const previous = new Map();
  for (const message of baseline[i].messages) previous.set(key(message), (previous.get(key(message)) ?? 0) + 1);
  const added = result.messages.filter(message => {
    const count = previous.get(key(message)) ?? 0;
    if (!count) return true;
    previous.set(key(message), count - 1);
    return false;
  });
  return {file: files[i], currentDiagnostics: result.messages.length, baselineDiagnostics: baseline[i].messages.length, added};
});
console.log(JSON.stringify(changes, null, 2));
if (changes.some(change => change.added.length)) process.exitCode = 1;
