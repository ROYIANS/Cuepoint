import {build} from 'vite';
import {mkdir, readFile, writeFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=process.cwd();
const output=path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node scripts/e06-build.mjs NEW_OUTPUT_DIRECTORY');
await mkdir(output); // Never overwrite evidence.
const sha=b=>createHash('sha256').update(b).digest('hex');
async function files(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await files(p));else result.push(p);}return result;}
const inputs=[...(await files('src')),...(await files('public')),...(await files('scripts')),...(await files('tests')), 'index.html','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json', 'vendor/lobehub/manifest.json'];
async function fingerprints(paths){return Object.fromEntries(await Promise.all(paths.sort().map(async p=>{const b=await readFile(p);return [p,{sha256:sha(b),bytes:b.length}];})));}
const originalRoute=await readFile('src/routeTree.gen.ts');
const before=await fingerprints(inputs);
await writeFile(path.join(output,'routeTree-before.ts'),originalRoute);
await writeFile(path.join(output,'inputs-before.json'),JSON.stringify(before,null,2));
let graph;
const loadedInputs={};
try {
 await build({root,cacheDir:path.join(output,'cache'),build:{outDir:path.join(output,'dist'),emptyOutDir:false,manifest:true},plugins:[{
 name:'e06-observe-output',enforce:'pre',async load(id){const physical=id.split('?')[0];if(path.isAbsolute(physical)&&!physical.includes('\0')){try{const b=await readFile(physical);loadedInputs[path.relative(root,physical)]={sha256:sha(b),bytes:b.length};}catch{/* Virtual/plugin input has no physical body. */}}return null;},generateBundle(_options,bundle){
  graph={chunks:Object.values(bundle).filter(x=>x.type==='chunk').map(c=>({fileName:c.fileName,imports:c.imports,dynamicImports:c.dynamicImports,isEntry:c.isEntry,facadeModuleId:c.facadeModuleId,modules:c.modules})), modules:[...this.getModuleIds()].map(id=>{const m=this.getModuleInfo(id);return {id,importedIds:m.importedIds,dynamicallyImportedIds:m.dynamicallyImportedIds,importers:m.importers,dynamicImporters:m.dynamicImporters};})};
 }
 }]});
 await writeFile(path.join(output,'graph.json'),JSON.stringify(graph,null,2));
 const modulePaths=[...new Set(graph.modules.map(x=>x.id.split('?')[0]).filter(p=>path.isAbsolute(p)&&!p.includes('\0')))];
 const moduleInputs={};for(const p of modulePaths){try{const b=await readFile(p);moduleInputs[path.relative(root,p)]={sha256:sha(b),bytes:b.length};}catch{ /* Virtual and plugin-derived module IDs have no physical bytes. */ }}
 await writeFile(path.join(output,'module-inputs.json'),JSON.stringify(moduleInputs,null,2));
 await writeFile(path.join(output,'module-inputs-on-load.json'),JSON.stringify(loadedInputs,null,2));
 const changedModules=Object.keys(loadedInputs).filter(p=>moduleInputs[p]&&moduleInputs[p].sha256!==loadedInputs[p].sha256);
 if(changedModules.length)throw new Error('Physical module changed during build: '+changedModules.join(','));
 const assets={};for(const p of await files(path.join(output,'dist'))){const b=await readFile(p);assets[path.relative(path.join(output,'dist'),p)]={bytes:b.length,gzipBytes:gzipSync(b).length,sha256:sha(b)};}
 await writeFile(path.join(output,'assets.json'),JSON.stringify(assets,null,2));
 const after=await fingerprints(inputs);
 await writeFile(path.join(output,'inputs-after.json'),JSON.stringify(after,null,2));
 await writeFile(path.join(output,'routeTree-built.ts'),await readFile('src/routeTree.gen.ts'));
 const changed=inputs.filter(p=>JSON.stringify(before[p])!==JSON.stringify(after[p]));
 if(changed.some(p=>p!=='src/routeTree.gen.ts'))throw new Error('Non-generated build input changed: '+changed.join(','));
 await writeFile('src/routeTree.gen.ts',originalRoute);
 await writeFile(path.join(output,'inputs-restored.json'),JSON.stringify(await fingerprints(inputs),null,2));
 await writeFile(path.join(output,'result.json'),JSON.stringify({status:'PASS',node:process.version,assets:Object.keys(assets).length,modules:graph.modules.length,sourceInputs:inputs.length},null,2));
 console.log({status:'PASS',output,modules:graph.modules.length});
} catch(e){await writeFile('src/routeTree.gen.ts',originalRoute);await writeFile(path.join(output,'failure.txt'),e.stack);throw e;}
