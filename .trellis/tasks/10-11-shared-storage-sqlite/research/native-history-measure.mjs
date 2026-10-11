// Actual disposable Rust/SQLite measurement. No user profile or supplier access.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('vite'))('esbuild');
const source=`
import {createNativeProbe} from './tests/helpers/nativeProductProbe';
import {performance} from 'node:perf_hooks';
(async()=>{
 let phase='seed', reads=[];
 const native=await createNativeProbe({intercept:async(command,args,next)=>{
  const reply=await next();
  if(phase!=='seed' && args.request?.type==='query') reads.push({phase,rows:reply.rows?.length??0,payloadBytes:Buffer.byteLength(JSON.stringify(reply))});
  return reply;
 }});
 try{
  const total=2048,payload='tool-original-body:'.padEnd(4096,'x');
  const rows=Array.from({length:total},(_,i)=>({id:'history-'+String(i).padStart(6,'0'),threadId:'history-owner',role:'tool',createdAt:new Date(1700000000000+i).toISOString(),content:payload,originalToolResult:{text:payload}}));
  const seeded=performance.now();await native.store.chatMessages.bulkPut(rows);
  console.log(JSON.stringify({kind:'seed',rows:total,seedMs:performance.now()-seeded}));
  for(const kind of ['limit20','first','count']){
   phase=kind;reads=[];const start=performance.now(),memoryStart=process.memoryUsage();
   const query=native.store.chatMessages.where('threadId').equals('history-owner').reverse();
   const value=kind==='limit20'?await query.limit(20).toArray():kind==='first'?await query.first():await query.count();
   const memoryEnd=process.memoryUsage();
   console.log(JSON.stringify({kind,resultCount:Array.isArray(value)?value.length:typeof value==='number'?value:value?1:0,elapsedMs:performance.now()-start,nativePages:reads.length,nativeReturnedRows:reads.reduce((n,v)=>n+v.rows,0),jsonReplyBytes:reads.reduce((n,v)=>n+v.payloadBytes,0),nodeHeapDeltaBytes:memoryEnd.heapUsed-memoryStart.heapUsed,limits:'JSON-line disposable probe; heap delta is not peak/native/WK memory or user latency'}));
  }
 }finally{await native.close();console.log(JSON.stringify({kind:'cleanup',result:'fresh workspace removed'}));}
})().catch(error=>{console.error(error);process.exitCode=1});`;
const compiled=await esbuild.build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'native-history-measure.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':process.cwd()+'/src'}});
new Function('require','module','exports',compiled.outputFiles[0].text)(require,{exports:{}},{});
