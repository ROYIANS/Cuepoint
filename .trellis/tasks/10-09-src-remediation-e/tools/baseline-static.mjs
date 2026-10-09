import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const cache='/Users/xiaomengdao/.cache/cuepoint-source-quality-tools';
const require=createRequire(`${cache}/package.json`);
const {ESLint}=require('eslint');
const baselineRoot=`${cache}/baseline-e-1ecaf5c`;
const eslint=new ESLint({cwd:baselineRoot,overrideConfigFile:`${baselineRoot}/eslint.config.mjs`});
const rows=await eslint.lintFiles(['src/**/*.{ts,tsx}']);
for(const row of rows)delete row.source;
const rules={};for(const row of rows)for(const m of row.messages){const key=m.ruleId??'parser';rules[key]=(rules[key]??0)+1;}
const summary={purpose:'Entry-only baseline measurement; no post-E gate or debt acceptance claim',baselineRevision:'1ecaf5ceec92e022c2b2b8d662e2a92e8eee36c7',files:rows.length,errors:rows.reduce((n,r)=>n+r.errorCount,0),warnings:rows.reduce((n,r)=>n+r.warningCount,0),rules,versions:Object.fromEntries(['eslint','typescript-eslint','eslint-plugin-react-hooks','eslint-plugin-sonarjs','typescript'].map(n=>[n,require(`${n}/package.json`).version]))};
await writeFile('.trellis/tasks/10-09-src-remediation-e/research/E-entry-static-results.json',JSON.stringify(rows,null,2)+'\n');
await writeFile('.trellis/tasks/10-09-src-remediation-e/research/E-entry-static-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
