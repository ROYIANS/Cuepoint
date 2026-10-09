import {readFile,writeFile,mkdir,cp,readdir,symlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ESLint} from 'eslint';
const root=process.cwd(),task=path.join(root,'.trellis/tasks/10-09-src-remediation-e');
const out=path.join(task,'research/e07-complete-selected-baseline');await mkdir(out);const baseline=path.join(out,'project');await mkdir(baseline);
const entry=JSON.parse(await readFile(path.join(task,'research/E07-entry.json'),'utf8'));const hash=b=>createHash('sha256').update(b).digest('hex');
const inputs={};for(const [file,copy] of Object.entries(entry.beforeCopies)){const source=path.join(root,copy.copy);const bytes=await readFile(source);if(hash(bytes)!==copy.sha256)throw Error('Original input changed '+file);const target=path.join(baseline,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);inputs[file]=hash(bytes);}
const config=await readFile(path.join(root,'eslint.config.mjs'));await writeFile(path.join(baseline,'eslint.config.mjs'),config);inputs['eslint.config.mjs']=hash(config);
await mkdir(path.join(baseline,'node_modules'));
for(const e of await readdir(path.join(root,'node_modules'),{withFileTypes:true})){if(e.name==='@radix-ui')continue;await symlink(path.join(root,'node_modules',e.name),path.join(baseline,'node_modules',e.name));}
await mkdir(path.join(baseline,'node_modules/@radix-ui'));
for(const e of await readdir(path.join(root,'node_modules/@radix-ui'),{withFileTypes:true})){if(e.name==='react-separator')throw Error('Unexpected installed retired dependency');await symlink(path.join(root,'node_modules/@radix-ui',e.name),path.join(baseline,'node_modules/@radix-ui',e.name));}
const retired=path.join(task,'research/e07-retired-dependency-before/@radix-ui/react-separator');await cp(retired,path.join(baseline,'node_modules/@radix-ui/react-separator'),{recursive:true,dereference:true});
const dependencyInputs={};async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name),f=path.join(prefix,e.name);if(e.isDirectory())await walk(p,f);else if(e.isFile())dependencyInputs[f]=hash(await readFile(p));}}await walk(retired);
await writeFile(path.join(out,'inputs.json'),JSON.stringify({baselineMeaning:'Exact accepted E07 entry complete before copies; current selected strict rule config; shared unchanged installed dependencies plus separately preserved actual removed separator package. Historical incomplete audit cache untouched.',inputs,retiredSeparator:dependencyInputs},null,2)+'\n');
const lint=new ESLint({cwd:baseline,overrideConfigFile:path.join(baseline,'eslint.config.mjs'),allowInlineConfig:false});const results=await lint.lintFiles(['src/**/*.{ts,tsx}']);await writeFile(path.join(out,'eslint.json'),JSON.stringify(results,null,2)+'\n');
const rules={};for(const f of results)for(const m of f.messages){const k=`${m.severity}:${m.ruleId}`;rules[k]=(rules[k]??0)+1;}
const changed=[];for(const [f,h]of Object.entries(inputs))if(hash(await readFile(path.join(baseline,f)))!==h)changed.push(f);
const summary={files:results.length,errors:results.reduce((n,r)=>n+r.errorCount,0),warnings:results.reduce((n,r)=>n+r.warningCount,0),rules,changedInputs:changed,baselineCompilerImports:'Includes original vendor/lobehub/manifest.json and preserved removed separator; no unresolved manifest diagnostics credited as source repair',selectedConfigSHA256:inputs['eslint.config.mjs'],status:changed.length?'FAIL':'BASELINE_CAPTURED_NOT_PASS'};await writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(summary);
