import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileDigest} from './release-artifacts.mjs';

export async function releaseSourceFiles(root) {
    // Filter only the already-excluded root metadata trees in Git. Stream the
    // remaining NUL-framed list so source growth cannot hit execFileSync's
    // default output buffer. Keep UTF8 decoding and JS sorting unchanged.
    const child=spawn('git',['ls-files','-z','--','.',':(top,glob,exclude).trellis/**',':(top,glob,exclude).agents/**',':(top,glob,exclude).codex/**'],{cwd:root,stdio:['ignore','pipe','pipe'],shell:false});
    const files=[];
    let pending='',stderr='',failure;
    await new Promise((accept,reject)=> {
        const failed=error=>{failure ??= error;child.kill();};
        child.once('error',failed);
        child.stdout.once('error',failed);child.stderr.once('error',failed);
        child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
        child.stdout.on('data',chunk=> {
            const paths=(pending+chunk).split('\0');pending=paths.pop();
            for (const path of paths) if (path) files.push(path);
        });
        // Drain diagnostics without letting an error dump grow without bound.
        child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4096);});
        child.once('close',(code,signal)=> {
            if (failure) reject(failure);
            else if (code !== 0 || signal) reject(new Error(`Git tracked source enumeration failed (exit=${code}; signal=${signal ?? 'none'})${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
            else if (pending) reject(new Error('Git tracked source enumeration ended with an incomplete path'));
            else accept();
        });
    });
    return files.sort();
}

export async function releaseSourceHashes(root) {
    const files=await releaseSourceFiles(root);
    return Object.fromEntries(await Promise.all(files.map(async path=>[path,(await fileDigest(resolve(root,path))).sha256])));
}
