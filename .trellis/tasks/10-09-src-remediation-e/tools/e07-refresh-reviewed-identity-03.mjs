import {ESLint} from 'eslint';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describeDiagnostic,identityProducer} from '../../../../scripts/quality/identity.mjs';
import {describeDiagnostic as beforeIdentity} from '../research/e07-gate-named-callback-fix/identity-before-replay.mjs';
const base='.trellis/tasks/10-09-src-remediation-e/research/e07-gate-named-callback-fix';
const previous=JSON.parse(await readFile(base+'/debt-before.json','utf8'));
const lint=new ESLint({allowInlineConfig:false}),rows=[];
for(const r of await lint.lintFiles([...new Set(previous.allowances.map(a=>a.file))])) {
 const file=path.relative(process.cwd(),r.filePath),text=await readFile(r.filePath,'utf8');
 for(const m of r.messages.filter(m=>m.severity===2))rows.push({file,rule:m.ruleId,before:beforeIdentity(file,text,m),after:describeDiagnostic(file,text,m)});
}
if(rows.length!==13||previous.allowances.length!==13)throw Error('Exact reviewed thirteen nodes required');
const evolution=[],allowances=previous.allowances.map(a=>{
 const matches=rows.filter(r=>r.file===a.file&&r.rule===a.rule&&r.before.signature===a.signature);
 if(matches.length!==1)throw Error('Reviewed original node missing/ambiguous '+a.file);
 const {before,after}=matches[0];
 if(!after.signature||before.nodeKind!==after.nodeKind||JSON.stringify(before.nodeTokens)!==JSON.stringify(after.nodeTokens)||a.count!==1)throw Error('Exact node/cardinality changed');
 evolution.push({file:a.file,rule:a.rule,oldSignature:a.signature,newSignature:after.signature,oldOwner:before.semanticOwner,newOwner:after.semanticOwner,exactNodeTokensUnchanged:true,count:a.count,reason:a.reason});
 return {...a,signature:after.signature};
});
const next={...previous,identityProducer:await identityProducer(),allowances};
await writeFile('quality/debt.json',JSON.stringify(next,null,2)+'\n');
await writeFile(base+'/reviewed-identity-evolution.json',JSON.stringify({purpose:'Only exact previously reviewed thirteen file/rule/nodekind/tokens/counts reanchored after named callback producer fix. No added diagnostic/debt.',oldProducer:previous.identityProducer,newProducer:next.identityProducer,evolution},null,2)+'\n');
console.log('Exactly13 original nodes verified; reanchored',evolution.filter(r=>r.oldSignature!==r.newSignature).length);
