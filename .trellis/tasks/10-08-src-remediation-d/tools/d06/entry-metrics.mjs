import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,cp,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=process.cwd(),task='.trellis/tasks/10-08-src-remediation-d';
const entry=JSON.parse(await readFile(`${task}/tools/d06/entry.json`,'utf8'));
const entryRoot='/Users/xiaomengdao/.cache/cuepoint-source-quality-tools/d06-entry-complete';
await mkdir(entryRoot,{recursive:true});
await cp(`${task}/tools/d06/before/src`,`${entryRoot}/src`,{recursive:true});
await cp(`${task}/tools/d06/before/tsconfig.app.json`,`${entryRoot}/tsconfig.app.json`);
for(const name of ['node_modules','vendor'])try{await symlink(`${root}/${name}`,`${entryRoot}/${name}`,'dir');}catch(error){if(error.code!=='EEXIST')throw error;}
const hashes={};
for(const [path,hash] of Object.entries(entry.hashes))if(path.startsWith('src/')||path==='tsconfig.app.json'){
 const actual=createHash('sha256').update(await readFile(`${entryRoot}/${path}`)).digest('hex');
 if(actual!==hash)throw new Error('Entry program mismatch '+path); hashes[path]=actual;
}
const cache='/Users/xiaomengdao/.cache/cuepoint-source-quality-tools';
const require=createRequire(`${cache}/package.json`);const {ESLint}=require('eslint');
const config=await import(`${cache}/eslint.config.mjs`);
const originalConfig=config.default.map(row=>row.languageOptions?.parserOptions?{...row,languageOptions:{...row.languageOptions,parserOptions:{...row.languageOptions.parserOptions,tsconfigRootDir:entryRoot}}}:row);
const eslint=new ESLint({cwd:entryRoot,overrideConfigFile:true,overrideConfig:originalConfig});
const paths=['src/components/agent/GenerationReview.tsx','src/components/workspace/ProjectSettingsPanel.tsx','src/lib/agent/generationProfiles.ts','src/lib/audioGeneration/runtime.ts','src/lib/generationIntent.ts'];
const original=await eslint.lintFiles(paths);
const main=JSON.parse(await readFile(`${task}/reviews/D06-static-results.json`,'utf8'));
const current=main.current.filter(row=>paths.some(path=>row.filePath===`${root}/${path}`));
const metricRules=new Set(['complexity','sonarjs/cognitive-complexity']);
const metrics=row=>row.messages.filter(message=>metricRules.has(message.ruleId)).map(message=>({line:message.line,rule:message.ruleId,message:message.message}));
const rows=await Promise.all(paths.map(async path=>({path,beforeSha256:entry.hashes[path],afterSha256:createHash('sha256').update(await readFile(path)).digest('hex'),sameBytes:entry.hashes[path]===createHash('sha256').update(await readFile(path)).digest('hex'),entryMetrics:metrics(original.find(row=>row.filePath===`${entryRoot}/${path}`)),currentMetrics:metrics(current.find(row=>row.filePath===`${root}/${path}`))}))); 
for(const row of original)delete row.source;
const report={role:'writer read-only precise entry differential',policy:'Full immutable captured D06 entry src + entry tsconfig, original aliases resolve to original owners. Same restored ESLint/plugins/rules as main current scan. Only program root changes; node_modules/vendor reused read-only. Five bounded files, not another broad gate.',versions:Object.fromEntries(['eslint','typescript-eslint','eslint-plugin-react-hooks','eslint-plugin-sonarjs','typescript'].map(name=>[name,require(`${name}/package.json`).version])),entryProgram:{root:entryRoot,sourceHashes:hashes},configSha256:createHash('sha256').update(await readFile(`${cache}/eslint.config.mjs`)).digest('hex'),rows,originalDiagnostics:original};
await writeFile(`${task}/reviews/D06-entry-metrics.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(rows,null,2));
