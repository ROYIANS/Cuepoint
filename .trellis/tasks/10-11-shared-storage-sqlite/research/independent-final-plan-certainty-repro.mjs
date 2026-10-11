// Review-only observational reproduction. Disposable native workspace; no profile.
// Exit 0 means collection/cleanup completed, not that the product assertion passed.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('vite'))('esbuild');
const watched='src/db/agentTools.ts';
const before=createHash('sha256').update(await readFile(watched)).digest('hex');
console.log(JSON.stringify({test:'source-before',path:watched,sha256:before}));
const source=`
import {createNativeProbe} from './tests/helpers/nativeProductProbe';
import {updateRunPlanAndComplete,AtomicToolRollbackError} from './src/db/agentTools';
import {UnknownCommitError} from './src/lib/storage/errors';
(async()=>{
 let inject=false,commits=0;
 const native=await createNativeProbe({intercept:async(_command,args,next)=>{
  const envelope=args.request;
  if(inject&&envelope.type==='status') throw new Error('review durable-status transport failure');
  const reply=await next();
  if(inject&&envelope.type==='commit'){commits++;throw new Error('review commit acknowledgement lost');}
  return reply;
 }});
 try{
  await native.store.transaction('rw',['chatThreads','chatMessages','agentRuns','agentToolCalls'],async tx=>{
   await tx.chatThreads.add({id:'review-thread'});
   await tx.chatMessages.add({id:'review-assistant',threadId:'review-thread',runId:'review-run'});
   await tx.agentRuns.add({id:'review-run',threadId:'review-thread',assistantMessageId:'review-assistant',status:'running'});
   await tx.agentToolCalls.add({id:'review-call',threadId:'review-thread',runId:'review-run',name:'update_run_plan',status:'running'});
  });
  inject=true;let error;
  try{await updateRunPlanAndComplete('review-run','review-call',[{id:'review-step',title:'durably committed plan',status:'pending'}],undefined,native.store);}catch(e){error=e;}
  inject=false;
  console.log(JSON.stringify({test:'plan-unknown-commit-classification',commits,errorClass:error?.constructor?.name,classifiedRollback:error instanceof AtomicToolRollbackError,preservedUnknown:error instanceof UnknownCommitError,causeClass:error?.cause?.constructor?.name}));
  await native.reopen();
  console.log(JSON.stringify({test:'plan-durable-reopen',call:await native.store.agentToolCalls.get('review-call'),plan:(await native.store.agentRuns.get('review-run'))?.plan}));
 }finally{await native.close();console.log(JSON.stringify({test:'cleanup',result:'disposable-workspace-removed'}));}
})().catch(error=>{console.error(error);process.exitCode=1});`;
const compiled=await esbuild.build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'independent-plan-review.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':process.cwd()+'/src'}});
new Function('require','module','exports',compiled.outputFiles[0].text)(require,{exports:{}},{});
process.once('beforeExit',async()=>{
 const after=createHash('sha256').update(await readFile(watched)).digest('hex');
 console.log(JSON.stringify({test:'source-after',path:watched,sha256:after,unchanged:after===before}));
});
