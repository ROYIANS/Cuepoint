// Review-only observational harness; temporary real SQLite workspaces only.
// Never calls a provider. Any unexpected fetch is rejected and counted.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('vite'))('esbuild');
const watched=['src/db/agentGenerationBatches.ts','src/lib/agent/generationRuntime.ts','src/lib/agent/businessTools.ts','src/lib/agent/libraryToolHelpers.ts','src/lib/agent/audioGenerationTools.ts'];
const identity=async()=>Object.fromEntries(await Promise.all(watched.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const before=await identity();console.log(JSON.stringify({test:'source-before',identity:before}));
const source=`
import {createNativeProbe} from './tests/helpers/nativeProductProbe';
import {AtomicToolRollbackError} from './src/db/agentTools';
import {UnknownCommitError} from './src/lib/storage/errors';
import {createProject,createAudioMusicProject} from './src/db/projects';
import {addShot} from './src/db/shots';
import {prepareGenerationBatch} from './src/db/agentGenerationBatches';
import {submitAgentGeneration} from './src/lib/agent/generationRuntime';
import {BUSINESS_TOOLS} from './src/lib/agent/businessTools';
import {IP_TOOLS} from './src/lib/agent/ipTools';
import {AUDIO_GENERATION_TOOLS} from './src/lib/agent/audioGenerationTools';
import {registerPendingDraft} from './src/lib/debouncedDraft';
(async()=>{
 let network=0;globalThis.fetch=async()=>{network++;throw new Error('review forbids network');};
 for(const scenario of ['batch','claim','business-flush','library-flush','audio-prepare']){
  let inject=false,commits=0;
  const native=await createNativeProbe({intercept:async(_command,args,next)=>{
   const envelope=args.request;
   if(inject&&envelope.type==='status') throw new Error('review status IPC unavailable');
   const result=await next();
   if(inject&&envelope.type==='commit'){commits++;throw new Error('review actual COMMIT succeeded but ACK lost');}
   return result;
  }});
  let unregister=()=>{};
  try{
   const project=scenario==='audio-prepare'?await createAudioMusicProject('review audio','audio',undefined,native.store):await createProject('review project',undefined,undefined,undefined,native.store);
   const connector={id:'review-provider',definitionId:'apimart',baseUrl:'https://provider.invalid/v1',apiKey:'review-fixture-only',updatedAt:'review'};
   await native.store.connectors.put(connector);
   const name=scenario==='batch'?'prepare_generation_batch':scenario==='claim'?'submit_generation':scenario==='business-flush'?'project_update':scenario==='library-flush'?'project_bind_ip':'audio_generate_speech';
   await native.store.transaction('rw',['chatThreads','chatMessages','agentRuns','agentToolCalls'],async tx=>{
    await tx.chatThreads.add({id:'thread',projectId:project.id});
    await tx.chatMessages.add({id:'assistant',threadId:'thread',runId:'run'});
    await tx.agentRuns.add({id:'run',projectId:project.id,threadId:'thread',assistantMessageId:'assistant',status:'running'});
    await tx.agentToolCalls.add({id:'call',threadId:'thread',runId:'run',name,status:'running',decision:'approve',requiresConfirmation:true});
   });
   const context={projectId:project.id,runId:'run',threadId:'thread',callId:'call',signal:new AbortController().signal,store:native.store};
   let operation;
   if(scenario==='batch'||scenario==='claim'){
    const episode=await native.store.episodes.where('projectId').equals(project.id).first();
    const shot=await addShot(project.id,episode.id,undefined,native.store);
    const args={connectorId:connector.id,model:'gpt-image-2',prompt:'review',parameters:{},inputs:[],target:{kind:'shot',projectId:project.id,episodeId:episode.id,entityId:shot.id,slot:'firstFrame'}};
    operation=scenario==='batch'?()=>prepareGenerationBatch('review batch',[args],context,native.store):()=>submitAgentGeneration(args,context,{},native.store);
   }else if(scenario==='audio-prepare'){
    const tool=AUDIO_GENERATION_TOOLS.find(row=>row.name===name);
    const args=tool.parseArguments({projectId:project.id,connectorId:connector.id,text:'review',voice:'alloy',speed:1});
    context.preview=await tool.prepare(args,context);
    operation=()=>tool.execute(args,context);
   }else{
    unregister=registerPendingDraft(project.id,()=>native.store.projects.update(project.id,{name:'review draft actually saved'}));
    const tool=(scenario==='business-flush'?BUSINESS_TOOLS:IP_TOOLS).find(row=>row.name===name);
    const args=tool.parseArguments(scenario==='business-flush'?{id:project.id,patch:{name:'tool write should never run'}}:{projectId:project.id,ipId:null});
    operation=()=>tool.execute(args,context);
   }
   inject=true;let error;
   try{await operation();}catch(value){error=value;}
   inject=false;
   console.log(JSON.stringify({test:'wrapper-unknown-commit',scenario,commits,classifiedRollback:error instanceof AtomicToolRollbackError,preservedUnknown:error instanceof UnknownCommitError,errorClass:error?.constructor?.name,causeClass:error?.cause?.constructor?.name,network}));
   unregister();unregister=()=>{};
   // Unregister queues a final draft flush; it settles before driver reopening.
   await native.store.projects.get(project.id);
   await new Promise(resolve=>setTimeout(resolve,10));
   await native.reopen();
   console.log(JSON.stringify({test:'durable-reopen',scenario,projectName:(await native.store.projects.get(project.id))?.name,callStatus:(await native.store.agentToolCalls.get('call'))?.status,batches:await native.store.agentGenerationBatches.count(),items:await native.store.agentGenerationBatchItems.count(),generationJobs:(await native.store.agentGenerationJobs.toArray()).map(job=>({status:job.status,providerTaskId:job.providerTaskId})),audioJobs:(await native.store.audioGenerationJobs.toArray()).map(job=>({status:job.status,intentId:job.intentId})),network}));
  }finally{inject=false;unregister();await native.close();console.log(JSON.stringify({test:'cleanup',scenario,result:'disposable-workspace-removed'}));}
 }
})().catch(error=>{console.error(error);process.exitCode=1});`;
const compiled=await esbuild.build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'independent-wrappers-review.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':process.cwd()+'/src'}});
new Function('require','module','exports',compiled.outputFiles[0].text)(require,{exports:{}},{});
process.once('beforeExit',async()=>{const after=await identity();console.log(JSON.stringify({test:'source-after',identity:after,unchanged:JSON.stringify(after)===JSON.stringify(before)}));});
