import {spawn} from 'node:child_process';
import {mkdir,writeFile,cp,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const base=fileURLToPath(new URL('../',import.meta.url));
const acceptance=process.argv.includes('--acceptance');
const profile=acceptance?'acceptance':'normal';
const evidence=resolve(base,'.acceptance/builds',`${Date.now()}-${profile}`);
await mkdir(evidence,{recursive:true});
async function run(name,args) {
    const log=await open(resolve(evidence,`${name}.log`),'wx');
    const result=await new Promise((accept,reject)=>{const child=spawn(process.execPath,args,{cwd:base,env:process.env,stdio:['ignore',log.fd,log.fd]});child.once('error',reject);child.once('exit',(code,signal)=>accept({code,signal}));});
    await log.close();console.log(`${name}: ${result.code ?? result.signal}; logs ${evidence}`);
    if(result.code!==0)throw new Error(`${name} failed; raw first diagnostics retained`);
}
await run('frontend',[resolve(base,'scripts/build-frontend.mjs'),...(acceptance?['--acceptance']:[])]);
const args=[resolve(base,'scripts/tools.mjs'),'pnpm','exec','tauri','build','--bundles','app','--features',acceptance?'acceptance':'desktop'];
if(acceptance) {
    const endpoint=process.env.CUEPOINT_STREAM_ENDPOINT;
    if(!endpoint)throw new Error('Reserved loopback endpoint missing');
    // This config is written under the run-specific evidence directory, so a
    // relative ../dist path would resolve outside the package and silently
    // produce a blank WebView. Point Tauri at the already-built acceptance
    // assets explicitly; the assets remain local and are still embedded in the
    // resulting .app.
    const config={productName:'Cuepoint Acceptance',identifier:'dev.cuepoint.prototype.acceptance',mainBinaryName:'cuepoint-prototype',build:{frontendDist:resolve(base,'dist','acceptance')},app:{security:{capabilities:['main',{identifier:'acceptance',windows:['main'],permissions:['allow-acceptance-request']}],csp:`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; worker-src 'self' blob:; font-src 'self' data:; connect-src ipc: http://ipc.localhost 'self' ${new URL(endpoint).origin}; object-src 'none'; frame-src 'none'; base-uri 'none'`}}};
    const path=resolve(evidence,'acceptance-config.json');await writeFile(path,JSON.stringify(config));args.push('--config',path);
}
await run('native-bundle',args);
const app=resolve(base,'.tools/target/release/bundle/macos',acceptance?'Cuepoint Acceptance.app':'Cuepoint Prototype.app');
const archived=resolve(evidence,acceptance?'Cuepoint Acceptance.app':'Cuepoint Prototype.app');
await cp(app,archived,{recursive:true,errorOnExist:true,force:false});
await writeFile(resolve(base,'.acceptance',`${profile}-bundle.json`),JSON.stringify({profile,app:archived,evidence},null,2)+'\n');
console.log(`Actual ${profile} app: ${archived}`);
