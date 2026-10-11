// Independent observer: synthetic raw causes must not enter durable Agent records.
// Uses real SQLite/probe, one fresh disposable workspace per caught-error branch.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('vite'))('esbuild');
const watched=['src/lib/agent/runChat.ts','src/db/agentRuns.ts'];
const identity=async()=>Object.fromEntries(await Promise.all(watched.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const before=await identity();console.log(JSON.stringify({test:'source-before',identity:before}));
const source=`
import {createNativeProbe} from './tests/helpers/nativeProductProbe';
import {beginAgentRun} from './src/db/agentRuns';
import {createChatThread} from './src/db/chat';
import {saveToolRound} from './src/db/agentTools';
import {updateGeneralAgentConfig} from './src/db/agentSettings';
import {executeChatRun} from './src/lib/agent/runChat';
(async()=>{
 const sensitive='review-credential-payload-marker';
 const raw='review-provider-raw-response-marker';
 for(const scenario of ['execute-cause','lookup-cause','status-save-cause']){
  let armed=false,injected=false,executions=0,providerCalls=0;
  const native=await createNativeProbe({intercept:async(_command,args,next)=>{
   const envelope=args.request;
   if(armed&&!injected&&scenario==='lookup-cause'&&envelope.type==='get'&&envelope.request.table==='agentToolCalls'){
    injected=true;throw new Error(sensitive+' '+raw);
   }
   if(armed&&!injected&&scenario==='status-save-cause'&&envelope.type==='commit'){
    injected=true;throw new Error(sensitive+' '+raw);
   }
   return next();
  }});
  try{
   await updateGeneralAgentConfig({permissionMode:'full'},native.store);
   const thread=await createChatThread({},native.store);
   const connector={id:'review',name:'review',definitionId:'openai-compatible',baseUrl:'https://provider.invalid/v1',apiKey:'fixture-only',updatedAt:'review'};
   const initial=await beginAgentRun({threadId:thread.id,connector,model:'review',content:'review cause privacy'},native.store);
   const name='review_side_effect';
   await native.store.agentRuns.update(initial.id,{enabledToolNames:[name],toolLoading:{version:1,groups:[],foundationToolNames:[name],foundationInstructions:'',loadedGroupIds:[],loadedToolNames:[]},offeredTools:[{step:1,names:[name]}]});
   await saveToolRound(initial.id,'',[{id:'review-call',type:'function',function:{name,arguments:'{}'}}],[{title:'review',effect:'write',atomic:true,highRisk:false}],undefined,undefined,native.store);
   const run=await native.store.agentRuns.get(initial.id);
   const tool={name,title:'review',description:'review',effect:'write',atomic:true,parameters:{type:'object',properties:{},additionalProperties:false},parseArguments:raw=>raw,highRisk:()=>false,execute:async()=>{executions++;armed=true;throw new Error(sensitive+' '+raw);}};
   await executeChatRun(run,sensitive,new AbortController(),async()=>{providerCalls++;throw new Error('provider must not be called');},[tool],native.store);
   armed=false;await native.reopen();
   const records={run:await native.store.agentRuns.get(run.id),calls:await native.store.agentToolCalls.where('runId').equals(run.id).toArray(),messages:await native.store.chatMessages.where('threadId').equals(thread.id).toArray()};
   const serialized=JSON.stringify(records);
   const safe=!serialized.includes(sensitive)&&!serialized.includes(raw);
   console.log(JSON.stringify({test:'durable-cause-privacy',scenario,executions,providerCalls,injected,rawCauseExcluded:safe,runStatus:records.run?.status,runError:records.run?.error,callStatus:records.calls[0]?.status,callError:records.calls[0]?.error}));
   if(!safe||executions!==1||providerCalls!==0) throw new Error('privacy/certainty observation failed');
  }finally{await native.close();console.log(JSON.stringify({test:'cleanup',scenario,result:'disposable-workspace-removed'}));}
 }
})().catch(error=>{console.error(error);process.exitCode=1});`;
const compiled=await esbuild.build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'independent-cause-review.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':process.cwd()+'/src'}});
new Function('require','module','exports',compiled.outputFiles[0].text)(require,{exports:{}},{});
process.once('beforeExit',async()=>{const after=await identity();console.log(JSON.stringify({test:'source-after',identity:after,unchanged:JSON.stringify(after)===JSON.stringify(before)}));});
