import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const task = '.trellis/tasks/10-08-src-remediation-d';
const unit = process.argv[2];
if (unit !== 'D-final') throw new Error('Supply D-final artifact label');
const cache = '/Users/xiaomengdao/.cache/cuepoint-source-quality-tools';
const require = createRequire(`${cache}/package.json`);
const {ESLint} = require('eslint');
const config = `${cache}/eslint.config.mjs`;
const eslint = new ESLint({overrideConfigFile:config});
const baselineRoot = `${cache}/baseline-f062d69`;
const baselineESLint = new ESLint({cwd:baselineRoot,overrideConfigFile:`${baselineRoot}/eslint.config.mjs`});
const ref = 'f062d694e61da6bcb574f7fb548803b9e54197eb';
const changed = execFileSync('git',['diff',ref,'--name-only','-z','--','src'],{encoding:'utf8'}).split('\0');
const added = execFileSync('git',['ls-files','--others','--exclude-standard','-z','--','src'],{encoding:'utf8'}).split('\0');
const files = [...new Set([...changed,...added].filter(f=>/\.(ts|tsx)$/.test(f)&&f!=='src/routeTree.gen.ts'))].sort();
const baseline=[],current=[],hashes={};
for (const file of files) {
 let text='';
 try {text=execFileSync('git',['show',`${ref}:${file}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(error){if(error.status!==128)throw error;}
 let final = null;
 try {final=await readFile(file,'utf8');} catch(error) {if(error.code!=='ENOENT')throw error;}
 hashes[file]={before:text?createHash('sha256').update(text).digest('hex'):null,after:final===null?null:createHash('sha256').update(final).digest('hex')};
 const previousRows = text ? await baselineESLint.lintText(text,{filePath:`${baselineRoot}/${file}`}) : [{filePath:`${baselineRoot}/${file}`,messages:[],errorCount:0,warningCount:0,absent:true}];
 for (const row of previousRows) row.filePath = `${process.cwd()}/${file}`;
 baseline.push(...previousRows);
 if(final===null) current.push({filePath:`${process.cwd()}/${file}`,messages:[],errorCount:0,warningCount:0,deleted:true});
 else current.push(...await eslint.lintText(final,{filePath:file}));
}
const signature=m=>JSON.stringify([m.ruleId,m.severity,m.message.replace(/\bline \d+\b/g,'line N')]);
const counts=rows=>{const map=new Map();for(const row of rows)for(const m of row.messages)map.set(signature(m),(map.get(signature(m))??0)+1);return map;};
const previous=counts(baseline),addedDiagnostics=[];
for(const row of current)for(const m of row.messages){const k=signature(m),n=previous.get(k)??0;if(n)previous.set(k,n-1);else addedDiagnostics.push({file:row.filePath,...m});}
const metricRules=new Set(['complexity','sonarjs/cognitive-complexity']);
const summary={unit,baselineRevision:ref,policy:'Baseline/current separate complete-source TypeScript programs, same restored versions/rules; aggregate signatures account for unchanged function relocation; raw per-file diagnostics preserved',versions:Object.fromEntries(['eslint','typescript-eslint','eslint-plugin-react-hooks','eslint-plugin-sonarjs','typescript'].map(n=>[n,require(`${n}/package.json`).version])),files:files.length,hashes,baselineErrors:baseline.reduce((n,r)=>n+r.errorCount,0),baselineWarnings:baseline.reduce((n,r)=>n+r.warningCount,0),currentErrors:current.reduce((n,r)=>n+r.errorCount,0),currentWarnings:current.reduce((n,r)=>n+r.warningCount,0),addedNoncomplexity:addedDiagnostics.filter(m=>!metricRules.has(m.ruleId)),addedComplexity:addedDiagnostics.filter(m=>metricRules.has(m.ruleId)),newFileDiagnostics:current.filter(r=>hashes[r.filePath.replace(process.cwd()+'/','')]?.before===null).flatMap(r=>r.messages.map(m=>({file:r.filePath,...m})))};
for(const row of [...baseline,...current])delete row.source;
await mkdir(`${task}/reviews`,{recursive:true});
await writeFile(`${task}/reviews/${unit}-static-results.json`,JSON.stringify({baseline,current},null,2)+'\n');
await writeFile(`${task}/reviews/${unit}-static-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({unit,files:summary.files,versions:summary.versions,before:[summary.baselineErrors,summary.baselineWarnings],after:[summary.currentErrors,summary.currentWarnings],addedNoncomplexity:summary.addedNoncomplexity,addedComplexity:summary.addedComplexity,newFileDiagnostics:summary.newFileDiagnostics},null,2));
process.exitCode=summary.addedNoncomplexity.length?1:0;
