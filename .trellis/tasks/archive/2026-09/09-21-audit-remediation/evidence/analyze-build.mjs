import { build } from 'vite';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'bundle-before.json';
await build({ build: { write: false }, plugins: [{ name: 'audit-bundle-evidence', generateBundle(_, bundle) {
  const chunks = Object.values(bundle).filter(x => x.type === 'chunk').map(x => ({ file: x.fileName, bytes: x.code.length, imports: x.imports, dynamicImports: x.dynamicImports, modules: Object.entries(x.modules).map(([id,m]) => ({id, bytes:m.renderedLength})).sort((a,b)=>b.bytes-a.bytes) }));
  writeFileSync(new URL(out, import.meta.url), JSON.stringify(chunks, null, 2));
}}] });
