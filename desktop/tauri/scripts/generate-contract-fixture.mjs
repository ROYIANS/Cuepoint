import {build} from 'vite';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const base = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(base, '../..');
const generated = resolve(base, '.acceptance/oracle');
await mkdir(generated, {recursive: true});
await build({configFile: false, root: base, logLevel: 'warn', resolve: {alias: {'@': resolve(repo, 'src')}}, build: {
    outDir: generated, emptyOutDir: true, minify: false, target: 'es2022',
    lib: {entry: resolve(base, 'scripts/contract-oracle.ts'), formats: ['es'], fileName: () => 'oracle.mjs'},
}});
const oracle = await import(pathToFileURL(resolve(generated, 'oracle.mjs')).href);
const sources = {};
for (const path of ['src/lib/workspace.ts', 'src/lib/sha256.ts', 'src/domain/types.ts', 'desktop/tauri/scripts/contract-oracle.ts']) {
    sources[path] = createHash('sha256').update(await readFile(resolve(repo, path))).digest('hex');
}
const output = `${JSON.stringify({...oracle.contractCorpus(), sources}, null, 2)}\n`;
const target = resolve(base, 'fixtures/portable-contract-v1.json');
if (process.argv[2] === '--write') {
    await mkdir(resolve(base, 'fixtures'), {recursive: true});
    await writeFile(target, output);
} else if (process.argv[2] === '--check') {
    if (await readFile(target, 'utf8') !== output) throw new Error('Immutable TS contract corpus differs from current real helper output/provenance');
} else { throw new Error('Use --write once or --check for immutable corpus verification'); }
