import {ESLint} from 'eslint';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const files=['src/lib/agent/generationBatchRuntime.ts','src/lib/agent/generationSelection.ts','src/lib/agent/toolErrors.ts','src/lib/ai/aihubmix.ts','src/lib/ai/modelBank/index.ts','src/lib/audio/recorder.ts','src/lib/generationIntent.ts','src/lib/productionRevision.ts','src/lib/reorderIds.ts','src/db/episodes.ts'];
const out='.trellis/tasks/10-09-src-remediation-e/research/e07-local-assertion-fix';await mkdir(out);
const hash=s=>createHash('sha256').update(s).digest('hex');const before=new Map(await Promise.all(files.map(async f=>[f,await readFile(f,'utf8')])));
const lint=new ESLint({fix:m=>m.ruleId==='@typescript-eslint/no-unnecessary-type-assertion'});const rows=await lint.lintFiles(files);
const receipts=[];
for(const row of rows){const f=path.relative(process.cwd(),row.filePath);if(!row.output)continue;const original=before.get(f);const options={compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:true}};const oldJS=ts.transpileModule(original,options).outputText;const newJS=ts.transpileModule(row.output,options).outputText;if(oldJS!==newJS)throw Error('Assertion-onlyfix changed transpiledJS '+f);const target=path.join(out,f);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,original);await writeFile(f,row.output);receipts.push({path:f,beforeSHA256:hash(original),afterSHA256:hash(row.output),beforeCopy:target,transpiledJSIdentical:true,remainingErrors:row.messages.filter(m=>m.severity===2)});}
await writeFile(path.join(out,'receipt.json'),JSON.stringify({purpose:'Only lint-proven redundant type assertions in explicit coordinator-owned paths; each actual projectTS transpiledJS byte-identical before/after, not globalfreeze/buildclaim',files:receipts},null,2)+'\n');console.log(receipts.map(({path,transpiledJSIdentical,remainingErrors})=>({path,transpiledJSIdentical,remainingErrors:remainingErrors.map(m=>m.ruleId)})));
