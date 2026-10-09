import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const mapping={
'src/lib/agent/generationRuntime.ts':['generationTargetHref'],
'src/lib/agent/contextPlanner.ts':['SUMMARY_PREFIX'],
'src/lib/agent/wrapupSchema.ts':['wrapupContentSchema'],
'src/lib/agent/referenceContext.ts':['parseReferenceAttachments'],
'src/lib/assetLibrary.ts':['WORLD_TABS'],
'src/lib/audio/schedule.ts':['clipEnvelope','ScheduleChapter','ScheduleTrack','ScheduleTake','ScheduleClip'],
'src/lib/audio/recorder.ts':['RECORDING_MIME_TYPES'],
'src/db/audioGeneration.ts':['validateAudioGenerationJob'],
'src/db/music.ts':['validateMusicDraft','validateMusicWork'],
'src/components/slots/GenerationSlotCard.tsx':['GenerationSlotTile'],
'src/components/memory/MemoryEditor.tsx':['EMPTY_MEMORY'],
'src/lib/agent/businessSchemas.ts':['imageDefaults','videoDefaults'],
'src/lib/agent/materialImageInput.ts':['materialBlobDigest'],
'src/lib/memory/schema.ts':['memoryCategorySchema','memorySourceSchema'],
'src/lib/memory/retrieval.ts':['MEMORY_PREFIX','buildMemoryQuery'],
'src/lib/ai/modelBank/index.ts':['MODEL_BANK_REVISION','ModelBankValue','ModelBankModel'],
'src/lib/audioGeneration/input.ts':['audioGenerationInputSchema'],
'src/domain/agent.ts':['AgentToolGroupSnapshot'],
'src/domain/agentGeneration.ts':['AgentGenerationInput'],
'src/lib/agent/runWriteOutcomes.ts':['RunWriteOutcome'],
'src/domain/references.ts':['ReferenceStatus','ReferenceCoverage'],
'src/domain/audioGeneration.ts':['AudioTaskVerifiedStatus'],
'src/domain/projectMemory.ts':['MemoryStatus','MemoryEvidence'],
'src/lib/ai/requestBoundary.ts':['JsonReadPolicy'],
'src/lib/productionContext.ts':['ProductionMediaMetadata'],
'src/domain/generationPreferences.ts':['GenerationSelectionParameters','GenerationPreferenceParameters'],
'src/domain/imageDiscovery.ts':['ImageSourceKind'],
'src/domain/search.ts':['WebSearchResult','WebReadResult'],
'src/domain/agentTaskWrapup.ts':['WrapupItem'],
'src/lib/audioGeneration/outputEvidence.ts':['AudioOutputEvidenceItem'],
};
const root='.trellis/tasks/10-09-src-remediation-e/research/e07-internal-export-narrowing';await mkdir(root,{recursive:true});
const rows=[];const sha=s=>createHash('sha256').update(s).digest('hex');
for(const[file,names]of Object.entries(mapping)){
 const previousCopy=root+'/'+file;const text=await readFile(existsSync(previousCopy)?previousCopy:file,'utf8');let result=text;
 for(const name of names){
  const re=new RegExp(`export (const|function|async function|interface|type) ${name}\\b`);
  if(!re.test(result))throw Error('Missing exactexport '+file+' '+name);
  // The reviewed Knip full/test report supplies absent external consumers;
  // preserve implementation and every internal use, narrow only the public surface.
  result=result.replace(re,'$1 '+name);
 }
 const jsx=file.endsWith('.tsx');const opts={fileName:file,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,verbatimModuleSyntax:true}};
 const beforeJS=ts.transpileModule(text,opts).outputText,afterJS=ts.transpileModule(result,opts).outputText;
 const dir=root+'/'+file.slice(0,file.lastIndexOf('/'));await mkdir(dir,{recursive:true});if(!existsSync(root+'/'+file))await writeFile(root+'/'+file,text);await writeFile(file,result);
 rows.push({path:file,names,beforeSHA256:sha(text),afterSHA256:sha(result),beforeCopy:root+'/'+file,mechanism:'Narrow only externallyunused public modifier; internal implementation unchanged. Currentfull/production actualconsumer analysis and canonical contract interpretation required, TypeScriptunusedlocal finalcheck rejects stranded implementation.',emittedJSChangedDueToExportSurface:beforeJS!==afterJS});
}
await writeFile(root+'/receipt.json',JSON.stringify({purpose:'Coordinator-reviewed explicit internal export list from fresh fulltest unused closure; not auto-delete or blanket exceptions',rows},null,2)+'\n');console.log('Narrowed',rows.reduce((n,r)=>n+r.names.length,0),'exports in',rows.length,'files, all bodies preserved');
