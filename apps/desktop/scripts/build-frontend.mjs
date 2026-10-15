import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildAgentPackages} from '../../../tooling/build-agent-packages.mjs';

// Node's percentage option takes precedence over the numeric old-space budget.
// Reject that conflict rather than silently changing the caller's NODE_OPTIONS.
if (/(?:^|[\s"])--max[-_]old[-_]space[-_]size[-_]percentage(?=[=\s"]|$)/.test(process.env.NODE_OPTIONS ?? '')) {
    throw new Error('Frontend build requires a fixed 4096 MiB old-space budget; remove the percentage heap option from NODE_OPTIONS');
}

// All normal/acceptance callers enter here. Heavy Vite imports run only in this
// child; the budget does not affect Rust, Vitest or the calling process.
await buildAgentPackages();
const child=spawn(process.execPath,[
    '--max-old-space-size=4096',
    fileURLToPath(new URL('./build-frontend-worker.mjs',import.meta.url)),
    ...process.argv.slice(2),
],{cwd:process.cwd(),env:process.env,stdio:'inherit',shell:false});
const interrupt=()=>child.kill('SIGINT');
const terminate=()=>child.kill('SIGTERM');
process.on('SIGINT',interrupt);
process.on('SIGTERM',terminate);
let result;
try {
    result=await new Promise((accept,reject)=> {
        child.once('error',reject);
        child.once('exit',(code,signal)=>accept({code,signal}));
    });
} finally {
    process.off('SIGINT',interrupt);
    process.off('SIGTERM',terminate);
}
if (result.signal) process.kill(process.pid,result.signal);
else process.exitCode=result.code ?? 1;
