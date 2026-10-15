import {build} from 'vite';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const base = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(base, '../..');
const generated = resolve(base, '.acceptance/oracle');
await mkdir(generated, {recursive: true});
await build({configFile: false, root: base, logLevel: 'warn', build: {
    outDir: generated, emptyOutDir: true, minify: false, target: 'es2022',
    lib: {entry: resolve(base, 'scripts/contract-oracle.ts'), formats: ['es'], fileName: () => 'oracle.mjs'},
}});
const oracle = await import(pathToFileURL(resolve(generated, 'oracle.mjs')).href);
const target = resolve(base, 'fixtures/portable-contract-v1.json');
const original = JSON.parse(await readFile(target, 'utf8'));
const mapping = JSON.parse(await readFile(resolve(base, 'fixtures/portable-contract-source-map.json'), 'utf8'));
if (mapping.schema !== 1 || mapping.sources.length !== Object.keys(original.sources).length) throw new Error('Incomplete portable source relocation provenance');
for (const row of mapping.sources) {
    const actual = createHash('sha256').update(await readFile(resolve(repo, row.current))).digest('hex');
    if (original.sources[row.original] !== row.originalSha256 || actual !== row.currentSha256) throw new Error('Portable source relocation identity changed: '+row.current);
}
const output = `${JSON.stringify({...oracle.contractCorpus(), sources: original.sources}, null, 2)}\n`;
if (process.argv[2] === '--write') {
    await mkdir(resolve(base, 'fixtures'), {recursive: true});
    await writeFile(target, output);
} else if (process.argv[2] === '--check') {
    if (await readFile(target, 'utf8') !== output) throw new Error('Immutable TS contract corpus differs from current real helper output/provenance');
} else { throw new Error('Use --write once or --check for immutable corpus verification'); }
