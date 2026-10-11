import {spawn} from 'node:child_process';
import {mkdir,writeFile,cp,open,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const base=fileURLToPath(new URL('../',import.meta.url));
const acceptance=process.argv.includes('--acceptance');
const isolated=process.argv.includes('--isolated-product');
if(acceptance && isolated)throw new Error('Fixture and normal-product isolation are separate build lanes');
const identifier=isolated ? process.env.CUEPOINT_PRODUCT_IDENTIFIER : acceptance?'dev.cuepoint.prototype.acceptance':'dev.cuepoint.prototype.offline';
if(!identifier || !/^dev\.cuepoint\.review\.[a-z0-9][a-z0-9.-]{0,100}$/.test(identifier) && isolated)throw new Error('Isolated product requires a dedicated dev.cuepoint.review.* identifier');
const profile=acceptance?'acceptance':isolated?'isolated-product':'normal';
const appName=acceptance?'Cuepoint Acceptance':isolated?'Cuepoint Product Review':'Cuepoint Prototype';
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
if(isolated) {
    // Same root frontend, desktop feature, CSP and services. Only application/profile identity differs.
    const normal=JSON.parse(await readFile(resolve(base,'src-tauri/tauri.conf.json'),'utf8'));
    const config={productName:appName,identifier,mainBinaryName:'cuepoint-prototype',build:{frontendDist:resolve(base,'dist','normal')},app:{windows:normal.app.windows.map(window=>({...window,title:'小光点 · 完整产品验收'}))}};
    const path=resolve(evidence,'isolated-product-config.json');await writeFile(path,JSON.stringify(config));args.push('--config',path);
}
await run('native-bundle',args);
const app=resolve(base,'.tools/target/release/bundle/macos',`${appName}.app`);
const archived=resolve(evidence,`${appName}.app`);
await cp(app,archived,{recursive:true,errorOnExist:true,force:false});
const storage=acceptance?'sqlite':'indexeddb';
const webkitStoreId=createHash('sha256').update(`cuepoint-product-profile-v1:${identifier}:${storage}`).digest('hex').slice(0,32);
await writeFile(resolve(base,'.acceptance',`${profile}-bundle.json`),JSON.stringify({profile,identifier,storage,webkitStoreId,app:archived,evidence},null,2)+'\n');
console.log(`Actual ${profile} app: ${archived}`);
