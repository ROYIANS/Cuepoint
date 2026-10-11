import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const exec=promisify(execFile);
const base=fileURLToPath(new URL('../',import.meta.url));
const active=JSON.parse(await readFile(resolve(base,'.acceptance/active-run.json'),'utf8'));
const workload=process.argv[2]??'idle';
if(!['idle','media'].includes(workload))throw new Error('Use idle or media workload matching the observed real app');
const pause=ms=>new Promise(accept=>setTimeout(accept,ms));
async function bytes(path){const metadata=await stat(path);if(metadata.isFile())return metadata.size;let total=0;for(const name of await readdir(path))total+=await bytes(resolve(path,name));return total;}
const bundles=[];
for(const profile of ['normal','acceptance']) {
    const bundle=JSON.parse(await readFile(resolve(base,`.acceptance/${profile}-bundle.json`),'utf8'));
    const archive=resolve(active.root,`${profile}.zip`);
    await exec('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',bundle.app,archive]);
    bundles.push({profile,app:bundle.app,appBytes:await bytes(bundle.app),zipBytes:(await stat(archive)).size});
}
const samples=[];
for(let i=0;i<5;i++){
    const {stdout}=await exec('/bin/ps',['-axo','pid=,ppid=,rss=,etime=,command=']);
    const rows=stdout.trim().split('\n').map(line=>{const match=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);if(!match)throw new Error('Unexpected ps row');return{pid:Number(match[1]),ppid:Number(match[2]),rssKiB:Number(match[3]),elapsed:match[4],command:match[5]};});
    const pids=new Set([active.pid]);let changed=true;while(changed){changed=false;for(const row of rows)if(pids.has(row.ppid)&&!pids.has(row.pid)){pids.add(row.pid);changed=true;}}
    const directTree=rows.filter(row=>pids.has(row.pid));
    const sharedWebKit=rows.filter(row=>/com\.apple\.WebKit\.(WebContent|Networking|GPU)/.test(row.command)&&!pids.has(row.pid));
    samples.push({atMs:Date.now(),directTree,directTreeRssKiB:directTree.reduce((sum,row)=>sum+row.rssKiB,0),unattributedWebKit:sharedWebKit});
    await pause(1000);
}
const os=(await exec('/usr/bin/sw_vers',[])).stdout;
const hardware=(await exec('/usr/sbin/sysctl',['-n','hw.model','hw.memsize','machdep.cpu.brand_string'])).stdout;
let ready=null;try{ready=JSON.parse(await readFile(resolve(active.root,'ready.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(resolve(active.root,`measurement-${workload}.json`),JSON.stringify({version:1,workload,os,hardware,bundles,startup:{method:'Direct first process launch to acceptance native ready command; subsequent launch is warm; cold filesystem caches are not flushed',startedAt:active.startedAt,ready,elapsedMs:ready?ready.atMillis-active.startedAt:null},samples,limits:['RSS includes shared resident pages and is not private memory or allocation high-water mark.','WebKit services may be launchd-owned and shared; unattributed service rows are recorded separately and are not summed as private application memory.','Five one-second samples describe this fixture workload on this host, not production workloads, other systems or a comparison to Electron.']},null,2)+'\n');
console.log(`Measurement ${workload}: ${active.root}/measurement-${workload}.json`);
