import {spawn} from 'node:child_process';
import {open} from 'node:fs/promises';
import {Writable} from 'node:stream';
import {finished} from 'node:stream/promises';

// The release and shared SQLite checks need both live output and byte-for-byte
// evidence. close, unlike exit, waits for the child's stdout/stderr to finish.
export async function runLoggedProcess(command,args,{cwd,env,logPath}) {
    const file=await open(logPath,'wx');
    const output=file.createWriteStream();
    let child,failure;
    const fail=error=> {
        if (failure) return;
        failure=error;
        child?.kill();
        child?.stdout?.resume();child?.stderr?.resume();
    };
    // These finish after the live write callbacks, without ending the parent's
    // stdout/stderr. A late EPIPE must not become an apparent successful check.
    const stdout=new Writable({write(chunk,encoding,callback) {process.stdout.write(chunk,encoding,callback);}});
    const stderr=new Writable({write(chunk,encoding,callback) {process.stderr.write(chunk,encoding,callback);}});
    // Attach before spawning so an evidence write failure cannot be unhandled.
    const writesFinished=Promise.all([output,stdout,stderr].map(stream=>finished(stream,{cleanup:true}).catch(fail)));
    process.stdout.on('error',fail);process.stderr.on('error',fail);
    try {
        child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],shell:false});
        const closed=new Promise(accept=>child.once('close',(code,signal)=>accept({code,signal})));
        child.once('error',fail);
        child.stdout.on('error',fail);child.stderr.on('error',fail);
        child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});
        child.stdout.pipe(stdout);child.stderr.pipe(stderr);
        const result=await closed;
        output.end();stdout.end();stderr.end();await writesFinished;
        if (failure) throw failure;
        return result;
    } finally {
        output.destroy();stdout.destroy();stderr.destroy();await writesFinished;
        process.stdout.removeListener('error',fail);process.stderr.removeListener('error',fail);
    }
}
