import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const output = '.trellis/tasks/10-09-src-remediation-e/research/e07-rule-primary-preparation';
await mkdir(output, { recursive: true });
const urls = {
 'only-throw-error': 'https://typescript-eslint.io/rules/only-throw-error/',
 'type-or-value-specifier': 'https://typescript-eslint.io/packages/type-utils/type-or-value-specifier/',
 'knip-project-files': 'https://knip.dev/guides/configuring-project-files',
 'knip-production': 'https://knip.dev/features/production-mode',
 'eslint-support': 'https://eslint.org/version-support/',
};
const receipts = await Promise.all(Object.entries(urls).map(async ([name, url]) => {
 try {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = Buffer.from(await response.arrayBuffer());
  const path = `${output}/${name}.html`;
  await writeFile(path, body, { flag: 'wx' });
  return { name, url, status: response.status, path, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') };
 } catch (error) { return { name, url, error: String(error) }; }
}));
await writeFile(`${output}/receipts.json`, JSON.stringify({ observedAt: new Date().toISOString(), purpose: 'Primary publisher source preparation, not E07 pin/implementation/compatibility acceptance', receipts }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipts, null, 2));
