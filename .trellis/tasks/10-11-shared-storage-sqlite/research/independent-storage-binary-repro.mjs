// Review-only reproducibility artifact. No product files or real profiles are used.
// Run with the authorized local Node from the repository root. Observational
// exit 0 means collection completed; it does not mean the observed bugs passed.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite'))('esbuild');
const source = `
import {createNativeProbe} from './tests/helpers/nativeProductProbe';
import {encodeLocalValue,decodeLocalValue} from './src/lib/storage/codec';
import {rename,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {createBrowserProductStore} from './src/lib/storage/browser';
(async()=>{
 const native=await createNativeProbe();
 try{
  await native.store.media.put({id:'review-real-file',projectId:'review-project',mimeType:'image/png',filename:'real.png',blob:new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'})});
  const ref=(await native.store.media.get('review-real-file')).blob;
  const starts=await Promise.allSettled(Array.from({length:12},async()=>{const lease=await native.binaries.open(ref);try{await lease.readBlob();await lease.verify();return 'ready';}finally{await lease.close();}}));
  console.log(JSON.stringify({test:'dense-native-read-start',requested:12,fulfilled:starts.filter(v=>v.status==='fulfilled').length,rejections:starts.filter(v=>v.status==='rejected').map(v=>v.reason)}));
  const unsubscribe=native.store.subscribe(()=>{throw new Error('review subscriber fault');});
  let nativeError;
  try{await native.store.projects.put({id:'review-notified-commit',name:'actually committed'});}catch(e){nativeError=String(e);}
  unsubscribe();
  console.log(JSON.stringify({test:'native-post-commit-listener',callerError:nativeError,committedRow:await native.store.projects.get('review-notified-commit')}));
  const lease=await native.binaries.open(ref);
  const original=join(native.root,'assets'),moved=join(native.root,'..','outside-assets');
  await rename(original,moved);await symlink(moved,original,'dir');
  try{const blob=await lease.readBlob();await lease.verify();console.log(JSON.stringify({test:'read-lease-parent-symlink-after-open',result:'accepted',bytes:[...new Uint8Array(await blob.arrayBuffer())]}));}
  catch(e){console.log(JSON.stringify({test:'read-lease-parent-symlink-after-open',result:'rejected',error:e}));}
  await lease.close();
 }finally{await native.close();console.log(JSON.stringify({test:'cleanup',result:'disposable-workspace-removed'}));}
 const raw=new Dexie('review-post-commit-'+crypto.randomUUID());raw.version(1).stores({media:'id'});await raw.open();
 try{const browser=createBrowserProductStore(raw);const unsubscribe=browser.subscribe(()=>{throw new Error('review browser subscriber fault');});let error;try{await browser.media.put({id:'review-browser-notified',projectId:'review',blob:new Blob(['bytes']),mimeType:'image/png',filename:'x.png'});}catch(e){error=String(e);}unsubscribe();console.log(JSON.stringify({test:'browser-post-commit-listener',callerError:error,committedRowId:(await browser.media.get('review-browser-notified'))?.id}));}finally{await raw.delete();}
 const name='x'.repeat(180000)+'\\ud800';
 const encoded=await encodeLocalValue({[name]:'value'});
 try{const value=decodeLocalValue(encoded);console.log(JSON.stringify({test:'large-unpaired-object-key',result:'accepted',keys:Object.keys(value).length}));}
 catch(e){console.log(JSON.stringify({test:'large-unpaired-object-key',result:'rejected',error:String(e)}));}
})().catch(e=>{console.error(e);process.exitCode=1});`;
const compiled=await esbuild.build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'independent-storage-review.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':process.cwd()+'/src'}});
new Function('require','module','exports',compiled.outputFiles[0].text)(require,{exports:{}},{});
