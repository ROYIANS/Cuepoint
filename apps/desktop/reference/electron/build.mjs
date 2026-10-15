import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {rm, mkdir} from 'node:fs/promises';
const dir = fileURLToPath(new URL('.', import.meta.url));

await rm(new URL('dist', import.meta.url), {recursive: true, force: true});
await mkdir(new URL('dist', import.meta.url));
for (const [entry, name, format] of [['src/nativeWorkspace.ts', 'native.mjs', 'es'], ['src/contracts.ts', 'contracts.mjs', 'es'], ['src/main.ts', 'main.mjs', 'es'], ['src/preload.ts', 'preload.cjs', 'cjs']]) {
  await build({configFile: false, root: dir, build: {target: 'node24', outDir: 'dist', emptyOutDir: false, minify: false,
    lib: {entry: `${dir}${entry}`, formats: [format], fileName: () => name},
    rollupOptions: {external: id => id === 'electron' || id.startsWith('node:'), output: {inlineDynamicImports: true}}}});
}
await build({configFile: false, root: `${dir}renderer`, base: './', build: {outDir: `${dir}dist/renderer`, emptyOutDir: true, minify: false}});
