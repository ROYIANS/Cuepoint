import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {cp,lstat,mkdir,open,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {hostname,release} from 'node:os';
import {relative,resolve} from 'node:path';
import {PRODUCT,assetName,getTarget,parseOptions,policyHash,runContext,sha256} from './release-policy.mjs';
import {desktopRoot,nativeTargetDirectory,resolveTools,toolInvocation,TOOL_VERSIONS} from './tool-resolver.mjs';
import {fileDigest,listedFiles} from './release-artifacts.mjs';

const root=resolve(desktopRoot,'../..');
function git(args) {return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();}
async function sourceHashes() {
    const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(path=>path && !path.startsWith('.trellis/') && !path.startsWith('.agents/') && !path.startsWith('.codex/')).sort();
    return Object.fromEntries(await Promise.all(files.map(async path=>[path,(await fileDigest(resolve(root,path))).sha256])));
}
export async function sourceVersion() {
    const [pkg,desktop,config,cargo]=await Promise.all(['package.json','desktop/tauri/package.json','desktop/tauri/src-tauri/tauri.conf.json','desktop/tauri/src-tauri/Cargo.toml'].map(path=>readFile(resolve(root,path),'utf8')));
    const version=JSON.parse(pkg).version;
    const cargoVersion=/^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
    if (!/^\d+\.\d+\.\d+$/.test(version) || [JSON.parse(desktop).version,JSON.parse(config).version,cargoVersion].some(value=>value !== version)) throw new Error('App version declarations disagree');
    const settings=JSON.parse(config);
    if (settings.productName !== PRODUCT.name || settings.identifier !== PRODUCT.identifier || settings.mainBinaryName !== PRODUCT.binary || settings.bundle.macOS.signingIdentity !== '-' || settings.bundle.macOS.minimumSystemVersion !== '14.0') throw new Error('Normal release identity/signing policy changed');
    if (JSON.parse(pkg).packageManager !== `pnpm@${TOOL_VERSIONS.pnpm}` || JSON.parse(desktop).packageManager !== `pnpm@${TOOL_VERSIONS.pnpm}` || JSON.parse(desktop).devDependencies['@tauri-apps/cli'] !== TOOL_VERSIONS.tauri) throw new Error('Tool declarations disagree');
    return version;
}
async function run(command,args,logPath,env,cwd=desktopRoot) {
    const log=await open(logPath,'wx');
    try {
        const code=await new Promise((accept,reject)=> {
            const child=spawn(command,args,{cwd,env,stdio:['ignore',log.fd,log.fd],shell:false});
            child.once('error',reject);child.once('exit',(code,signal)=>accept(signal ? 1 : code ?? 1));
        });
        if (code !== 0) throw new Error(`Build failed (${code}); diagnostics retained at ${logPath}`);
    } finally {await log.close();}
}
async function toolVersion(name,args) {
    const invocation=toolInvocation(name,args);
    return execFileSync(invocation.command,invocation.args,{env:invocation.env,cwd:desktopRoot,encoding:'utf8'}).trim();
}
export function releaseBuildArguments(targetId) {
    const target=getTarget(targetId);
    // Preserve the intermediate signed Mac .app for the payload receipt while
    // delivering only DMG. Disable installer-type binary rewriting: this lane
    // has no updater and verifies the same executable bytes in every format.
    return ['exec','tauri','build','--target',target.triple,'--bundles',target.bundles.join(','),'--features','product-sqlite','--no-binary-patching','--','--locked'];
}
export async function buildRelease(argv=process.argv.slice(2)) {
    const options=parseOptions(argv,['--target','--output']);
    const target=getTarget(options['--target']);
    if (!options['--output']) throw new Error('A fresh --output directory is required');
    if (process.platform !== target.platform || process.arch !== target.arch) throw new Error('Build on the corresponding native host architecture');
    const output=resolve(options['--output']),context={...runContext(),version:await sourceVersion()};
    if (git(['rev-parse','HEAD']) !== context.sourceSha || git(['status','--porcelain','--untracked-files=all'])) throw new Error('Release builds require an exact clean checked source');
    if (context.tag && context.tag !== `desktop-v${context.version}`) throw new Error('Tag/version mismatch');
    if (process.version !== `v${TOOL_VERSIONS.node}` || await toolVersion('pnpm',['--version']) !== TOOL_VERSIONS.pnpm || !(await toolVersion('rustc',['--version'])).startsWith(`rustc ${TOOL_VERSIONS.rust} `) || !(await toolVersion('cargo',['--version'])).startsWith(`cargo ${TOOL_VERSIONS.rust} `) || await toolVersion('pnpm',['exec','tauri','--version']) !== `tauri-cli ${TOOL_VERSIONS.tauri}`) throw new Error('Resolved tool version mismatch');
    const tools=resolveTools();
    await mkdir(output,{recursive:false});await mkdir(resolve(output,'assets'));
    const evidence=resolve(desktopRoot,'.release/builds',`${context.runId}-${context.attempt}-${target.id}`);
    await mkdir(resolve(desktopRoot,'.release/builds'),{recursive:true});await mkdir(evidence,{recursive:false});
    const before=await sourceHashes();
    await run(process.execPath,[resolve(desktopRoot,'scripts/build-frontend.mjs')],resolve(evidence,'frontend.log'),tools.env);
    const frontend=resolve(desktopRoot,'dist/normal');
    const frontendFiles=Object.fromEntries(await Promise.all((await listedFiles(frontend)).map(async path=>[path,sha256(await readFile(resolve(frontend,path)))])));
    if (!frontendFiles['index.html'] || Object.keys(frontendFiles).some(path=>/acceptance|tavilyProbe|fixture/i.test(path))) throw new Error('Normal frontend missing or fixture payload leaked');
    const targetDirectory=nativeTargetDirectory({target:target.triple,profile:'release'}),bundleRoot=resolve(targetDirectory,'bundle');
    // Never pick a previous bundle. Cargo compilation cache is separate from
    // this freshly created bundle directory; no recursive deletion is needed.
    try {await lstat(bundleRoot);throw new Error('Bundle directory already exists; use a fresh target directory for release packaging');} catch(error) {if (error.code !== 'ENOENT') throw error;}
    const invocation=toolInvocation('pnpm',releaseBuildArguments(target.id));
    await run(invocation.command,invocation.args,resolve(evidence,'bundle.log'),{...invocation.env,NO_STRIP:'1'});
    const executable=target.platform === 'darwin' ? resolve(bundleRoot,'macos',`${PRODUCT.name}.app`,'Contents/MacOS',PRODUCT.binary) : resolve(targetDirectory,PRODUCT.binary+(target.platform === 'win32' ? '.exe' : ''));
    const payload=await fileDigest(executable);
    const assets=[];
    for (const format of target.formats) {
        const extension={dmg:'.dmg',exe:'.exe',appimage:'.AppImage',deb:'.deb'}[format];
        const directory=resolve(bundleRoot,{dmg:'dmg',exe:'nsis',appimage:'appimage',deb:'deb'}[format]);
        // AppDir staging includes ordinary library links. Inspect only the
        // freshly emitted regular installer, never recurse staging into assets.
        const matches=(await readdir(directory,{withFileTypes:true})).filter(entry=>entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(extension));
        if (matches.length !== 1) throw new Error(`Expected exactly one fresh ${format} installer`);
        const source=resolve(directory,matches[0].name),name=assetName(target.id,context.version,format),digest=await fileDigest(source);
        await cp(source,resolve(output,'assets',name),{errorOnExist:true,force:false});assets.push({name,format,...digest});
    }
    const after=await sourceHashes();
    if (JSON.stringify(before) !== JSON.stringify(after) || git(['rev-parse','HEAD']) !== context.sourceSha || git(['status','--porcelain','--untracked-files=all'])) throw new Error('Source changed during packaging');
    const receipt={schema:1,state:'building',policyHash:policyHash(),context,target:Object.fromEntries(['id','platform','arch','runner','triple'].map(key=>[key,target[key]])),product:{...PRODUCT,signing:target.signing},tools:{versions:TOOL_VERSIONS,executables:tools.tools,host:{platform:process.platform,arch:process.arch,osRelease:release(),hostname:hostname(),runnerImage:process.env.ImageVersion ?? null}},inputs:{sourceBefore:before,sourceAfter:after},payload:{executableSha256:payload.sha256,frontendFiles,frontendSha256:sha256(JSON.stringify(frontendFiles))},assets,checks:[],evidenceFiles:[]};
    await writeFile(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log(`Built ${target.id}; unverified until native and payload checks seal ${relative(root,output)}`);
    return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildRelease();
