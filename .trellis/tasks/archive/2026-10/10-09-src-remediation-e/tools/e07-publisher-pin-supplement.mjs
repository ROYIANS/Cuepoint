import {writeFile} from 'node:fs/promises';
const names=['@eslint/js','eslint','typescript-eslint','eslint-plugin-react-hooks','eslint-plugin-sonarjs','knip'];
const rows=await Promise.all(names.map(async name=>{
 const url='https://registry.npmjs.org/'+encodeURIComponent(name);
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP'+r.status);const d=await r.json();const v=d['dist-tags'].latest;const x=d.versions[v];return {name,version:v,source:url,engines:x.engines,peerDependencies:x.peerDependencies,dependencies:x.dependencies,integrity:x.dist.integrity};}catch(error){return {name,error:String(error)};}
}));
const out='.trellis/tasks/10-09-src-remediation-e/research/E07-publisher-pin-supplement.json';
await writeFile(out,JSON.stringify({observedAt:new Date().toISOString(),purpose:'Read-only publisher pin/dependency preparation including actual @eslint/js; candidates not installed or finalcompatibility proof',rows},null,2)+'\n',{flag:'wx'});
console.log(rows.map(({name,version,engines,error})=>({name,version,engines,error})));
