import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const directory=dirname(fileURLToPath(import.meta.url));
const root=resolve(directory,'../../../../..');
const hash=async path=>createHash('sha256').update(await readFile(join(root,path))).digest('hex');
const inputs=['src/lib/storage/native.ts','src/lib/storage/store.ts','src/lib/storage/nativeBridge.ts','tests/sharedNativeAdmission.test.ts','tests/helpers/nativeProductProbe.ts','desktop/tauri/.tools/target/debug/product_store_probe'];
const report={startedAt:new Date().toISOString(),cases:[],before:Object.fromEntries(await Promise.all(inputs.map(async path=>[path,await hash(path)]))),scope:'Independent existing real Rust probe on fresh disposable workspaces only. No application profile, UI, provider or Rust build.'};
const server=await createServer({configFile:false,root,server:{middlewareMode:true},appType:'custom',resolve:{alias:{'@':join(root,'src')}}});
const {createNativeProbe}=await server.ssrLoadModule('/tests/helpers/nativeProductProbe.ts');
const {UnknownCommitError}=await server.ssrLoadModule('/src/lib/storage/errors.ts');
const run=async (name,callback)=> {
    const start=Date.now();
    try {const observations=await callback();report.cases.push({name,status:'passed',elapsedMs:Date.now()-start,observations});}
    catch(error) {report.cases.push({name,status:'failed',elapsedMs:Date.now()-start,error:String(error),stack:error.stack});}
};
try {
    await run('Postcommit subscriber reentrancy queues reads and writes without holding notification delivery',async ()=> {
        const native=await createNativeProbe();let read,write,unsubscribe=()=>{};
        const order=[];let notified=false;
        try {
            unsubscribe=native.store.subscribe(()=> {
                if (notified) return;notified=true;order.push('notify');
                read=native.store.transaction('r',['projects'],async tx=> {order.push('notification-read');return tx.projects.count();});
                write=native.store.transaction('rw',['projects'],async tx=> {order.push('notification-write');await tx.projects.add({id:'second'});});
            });
            await native.store.transaction('rw',['projects'],async tx=> {
                order.push('root');
                await tx.transaction('rw',['projects'],async nested=> {
                    order.push('nested');await nested.projects.add({id:'first'});
                    assert.equal(await nested.projects.count(),1);
                });
            });
            assert.equal(await read,1);await write;
            assert.deepEqual(order,['root','nested','notify','notification-read','notification-write']);
            assert.equal(await native.store.projects.count(),2);
            return {order,rows:2,nestedRootJoined:true};
        }finally {unsubscribe();await native.close();}
    });
    await run('A rejected begin releases admission and does not execute or replay its callback',async ()=> {
        let rejectBegin=true,callbacks=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            if (rejectBegin && args.request.type === 'begin') {rejectBegin=false;throw new Error('independent transport rejection before begin');}
            return next();
        }});
        try {
            const failed=native.store.transaction('rw',['projects'],async ()=> {callbacks++;});
            const following=native.store.projects.add({id:'after-begin-failure'});
            const outcomes=await Promise.allSettled([failed,following]);
            assert.deepEqual(outcomes.map(row=>row.status),['rejected','fulfilled']);
            assert.equal(callbacks,0);assert.equal(await native.store.projects.count(),1);
            return {outcomes:outcomes.map(row=>row.status),callbacks,rows:1};
        }finally {await native.close();}
    });
    await run('A rejected validate releases its reader before the queued writer and later snapshot',async ()=> {
        let rejectValidate=true,callbacks=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const reply=await next();
            if (rejectValidate && args.request.type === 'validate') {rejectValidate=false;throw new Error('independent lost readonly validation acknowledgement');}
            return reply;
        }});
        try {
            const failed=native.store.transaction('r',['projects'],async tx=> {callbacks++;return tx.projects.count();});
            const following=native.store.projects.add({id:'after-validate-failure'});
            const outcomes=await Promise.allSettled([failed,following]);
            assert.deepEqual(outcomes.map(row=>row.status),['rejected','fulfilled']);
            assert.equal(callbacks,1);assert.equal(await native.store.projects.count(),1);
            return {outcomes:outcomes.map(row=>row.status),callbacks,rows:1};
        }finally {await native.close();}
    });
    await run('Unknown committed outcome releases admission without replay or known-rollback classification',async ()=> {
        let loseCommit=true,loseStatus=false,callbacks=0,commits=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            if (loseStatus && args.request.type === 'status') {loseStatus=false;throw new Error('independent unavailable durable status');}
            const reply=await next();
            if (args.request.type === 'commit') {
                commits++;
                if (loseCommit) {loseCommit=false;loseStatus=true;throw new Error('independent lost actual COMMIT acknowledgement');}
            }
            return reply;
        }});
        try {
            const uncertain=native.store.transaction('rw',['projects'],async tx=> {callbacks++;await tx.projects.add({id:'committed-before-lost-ack'});});
            const following=native.store.projects.add({id:'after-unknown'});
            const outcomes=await Promise.allSettled([uncertain,following]);
            assert.deepEqual(outcomes.map(row=>row.status),['rejected','fulfilled']);
            assert.ok(outcomes[0].reason instanceof UnknownCommitError);
            assert.equal(callbacks,1);assert.equal(commits,2);
            assert.equal(await native.store.projects.count(),2);
            await native.reopen();assert.equal(await native.store.projects.count(),2);
            return {outcomes:outcomes.map(row=>row.status),uncertainty:outcomes[0].reason.certainty,callbacks,commits,rowsAfterReopen:2};
        }finally {await native.close();}
    });
} finally {
    await server.close();
    report.after=Object.fromEntries(await Promise.all(inputs.map(async path=>[path,await hash(path)])));
    report.changedInputs=inputs.filter(path=>report.before[path] !== report.after[path]);
    report.finishedAt=new Date().toISOString();
    report.pass=report.cases.every(row=>row.status === 'passed') && report.cases.length === 4 && report.changedInputs.length === 0;
    await writeFile(join(directory,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    process.exitCode=report.pass ? 0 : 1;
}
