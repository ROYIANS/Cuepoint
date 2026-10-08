import ts from 'typescript';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const currentPath='src/routeTree.gen.ts';
const beforePath='.trellis/tasks/10-08-src-remediation-d/tools/d06/before/src/routeTree.gen.ts';
const before=fs.readFileSync(beforePath,'utf8'), built=fs.readFileSync(currentPath,'utf8');
const hash=text=>createHash('sha256').update(text).digest('hex');
function tokens(text) {
 const scan=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text); const result=[];
 for(let token=scan.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scan.scan())result.push([token,scan.getTokenValue()??scan.getTokenText()]);
 return result;
}
const a=tokens(before), b=tokens(built); const same=JSON.stringify(a)===JSON.stringify(b);
const report={compilerVersion:ts.version,path:currentPath,beforePath,beforeSha256:hash(before),buildSha256:hash(built),tokensBefore:a.length,tokensAfter:b.length,sameTokens:same,policy:'Actual TypeScript scanner skips trivia; decoded token values preserve identifiers/literals/punctuation, independent of source formatting. Restore original entry bytes only when token sequences match.',restored:false};
if(!same)throw new Error('Generated route token sequences differ; original not restored');
if(before!==built){fs.writeFileSync('.trellis/tasks/10-08-src-remediation-d/tools/d06/route-tree-built.txt',built);fs.writeFileSync(currentPath,before);report.restored=true;}
report.finalSha256=hash(fs.readFileSync(currentPath,'utf8'));
fs.writeFileSync('.trellis/tasks/10-08-src-remediation-d/reviews/D06-route-tree-proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
