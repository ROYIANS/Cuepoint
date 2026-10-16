import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {cp,lstat,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {TARGETS,PRODUCT,WORKFLOW,assetName,getTarget,policyHash,sha256} from './release-policy.mjs';
import {TOOL_VERSIONS} from './tool-resolver.mjs';
import {mediaReleaseIdentity} from './media-resources.mjs';

function closed(value,keys,label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error(`Invalid closed ${label}`);
}
function safePath(root,path) {
    if (typeof path !== 'string' || !path || path.includes('\\') || isAbsolute(path) || path.split('/').some(part=>!part || part === '.' || part === '..') || [...path].some(character=>character.charCodeAt(0) < 32)) throw new Error('Unsafe artifact path');
    const result=resolve(root,path);
    if (!result.startsWith(resolve(root)+sep)) throw new Error('Artifact escapes root');
    return result;
}
export async function regularFile(root,path) {
    const result=safePath(root,path),segments=relative(resolve(root),result).split(sep);
    let current=resolve(root);
    if (!(await lstat(current)).isDirectory() || (await lstat(current)).isSymbolicLink()) throw new Error('Artifact root must be a real directory');
    for (const [index,part] of segments.entries()) {
        current=join(current,part);
        const item=await lstat(current);
        if (item.isSymbolicLink() || (index < segments.length-1 ? !item.isDirectory() : !item.isFile())) throw new Error(`Nonregular artifact: ${path}`);
    }
    return result;
}
export async function fileDigest(path) {
    const value=await lstat(path);
    if (!value.isFile() || value.isSymbolicLink()) throw new Error('Expected regular file');
    const hash=createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return {bytes:value.size,sha256:hash.digest('hex')};
}
export async function listedFiles(root,prefix='') {
    const result=[];
    for (const entry of await readdir(join(root,prefix),{withFileTypes:true})) {
        const path=prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error('Links are forbidden in artifact closure');
        if (entry.isDirectory()) result.push(...await listedFiles(root,path));
        else if (entry.isFile()) result.push(path);
        else throw new Error('Special artifact file rejected');
    }
    return result.sort();
}
function hashMap(value,label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new Error(`Missing ${label}`);
    for (const [path,hash] of Object.entries(value)) {
        safePath('/input',path);
        if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid ${label} hash`);
    }
}
function validateContext(context) {
    closed(context,['repository','workflow','sourceSha','event','mode','tag','runId','attempt','version'],'context');
    if (context.workflow !== WORKFLOW || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repository) || !/^[a-f0-9]{40}$/.test(context.sourceSha) || !/^\d+\.\d+\.\d+$/.test(context.version) || !/^(?:local|\d+)$/.test(context.runId) || !Number.isSafeInteger(context.attempt) || context.attempt < 1) throw new Error('Invalid source/version/run identity');
    if (!['push','workflow_dispatch','local'].includes(context.event) || !['build-only','draft'].includes(context.mode) || (context.mode === 'draft' ? context.tag !== `desktop-v${context.version}` || context.event !== 'push' : context.tag !== null)) throw new Error('Invalid publication mode');
}
async function validateReceipt(receipt,expected) {
    closed(receipt,['schema','state','policyHash','context','target','product','tools','inputs','payload','assets','checks','evidenceFiles'],'receipt');
    if (receipt.schema !== 1 || !['packaged','verified'].includes(receipt.state) || receipt.policyHash !== policyHash()) throw new Error('Incomplete receipt or changed policy');
    const context=receipt.context;
    validateContext(context);
    for (const key of ['repository','workflow','sourceSha','event','mode','tag','runId','version']) if (expected && context[key] !== expected[key]) throw new Error(`Target context mismatch: ${key}`);
    if (expected && context.attempt > expected.attempt) throw new Error('Artifact comes from a future attempt');
    closed(receipt.target,['id','platform','arch','runner','triple'],'target');
    const target=getTarget(receipt.target.id);
    for (const key of Object.keys(receipt.target)) if (receipt.target[key] !== target[key]) throw new Error(`Target identity mismatch: ${key}`);
    closed(receipt.product,[...Object.keys(PRODUCT),'signing'],'product');
    if (JSON.stringify(receipt.product.features) !== JSON.stringify(PRODUCT.features) || receipt.product.signing !== target.signing) throw new Error('Wrong feature or signing lane');
    for (const key of ['name','identifier','binary','profile','storage']) if (receipt.product[key] !== PRODUCT[key]) throw new Error('Wrong normal product identity');
    closed(receipt.tools,['versions','executables','host'],'tools');
    if (JSON.stringify(receipt.tools.versions) !== JSON.stringify(TOOL_VERSIONS)) throw new Error('Unpinned tools');
    if (!receipt.tools.host || receipt.tools.host.platform !== target.platform || receipt.tools.host.arch !== target.arch) throw new Error('Wrong actual host architecture');
    closed(receipt.inputs,['sourceBefore','sourceAfter'],'inputs');
    hashMap(receipt.inputs.sourceBefore,'source');hashMap(receipt.inputs.sourceAfter,'source');
    if (JSON.stringify(receipt.inputs.sourceBefore) !== JSON.stringify(receipt.inputs.sourceAfter)) throw new Error('Source changed during packaging');
    closed(receipt.payload,['executableSha256','frontendFiles','frontendSha256','mediaResources'],'payload');
    hashMap(receipt.payload.frontendFiles,'frontend');
    if (!/^[a-f0-9]{64}$/.test(receipt.payload.executableSha256) || receipt.payload.frontendSha256 !== sha256(JSON.stringify(receipt.payload.frontendFiles))) throw new Error('Invalid payload identity');
    if (JSON.stringify(receipt.payload.mediaResources) !== JSON.stringify(await mediaReleaseIdentity(target.id))) throw new Error('Invalid media resource identity');
    if (!Array.isArray(receipt.assets) || receipt.assets.length !== target.formats.length) throw new Error('Wrong installer count');
    const formats=new Set();
    for (const asset of receipt.assets) {
        closed(asset,['name','format','bytes','sha256'],'installer');
        if (!target.formats.includes(asset.format) || formats.has(asset.format) || asset.name !== assetName(target.id,context.version,asset.format)) throw new Error('Unknown/duplicate installer format or filename');
        formats.add(asset.format);
        if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid installer hash/size');
    }
    if (receipt.state === 'packaged') {
        if (!Array.isArray(receipt.checks) || receipt.checks.length || !Array.isArray(receipt.evidenceFiles) || receipt.evidenceFiles.length) throw new Error('Packaged receipts must have empty checks and evidence');
        return target;
    }
    if (!Array.isArray(receipt.checks) || receipt.checks.length !== target.requiredChecks.length) throw new Error('Missing required target checks');
    const checks=new Set();
    for (const check of receipt.checks) {
        closed(check,['name','status','evidence'],'check');
        if (!target.requiredChecks.includes(check.name) || checks.has(check.name) || check.status !== 'passed') throw new Error('Missing/failed/duplicate/unknown target check');
        safePath('/evidence',check.evidence);checks.add(check.name);
    }
    if (!Array.isArray(receipt.evidenceFiles) || !receipt.evidenceFiles.length) throw new Error('Missing checked evidence files');
    const names=new Set();
    for (const file of receipt.evidenceFiles) {
        closed(file,['path','bytes','sha256'],'evidence file');safePath('/evidence',file.path);
        if (!file.path.startsWith('evidence/') || names.has(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 67108864 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid/oversized evidence');
        names.add(file.path);
    }
    for (const check of receipt.checks) if (!names.has(check.evidence)) throw new Error('Check has no verified evidence');
    return target;
}
export async function verifyTargetDirectory(root,expected) {
    const path=await regularFile(root,'receipt.json');
    if ((await lstat(path)).size > 8388608) throw new Error('Receipt too large');
    const receipt=JSON.parse(await readFile(path,'utf8'));
    await validateReceipt(receipt,expected);
    const required=['receipt.json',...receipt.assets.map(asset=>`assets/${asset.name}`),...receipt.evidenceFiles.map(file=>file.path)].sort();
    if (JSON.stringify(await listedFiles(root)) !== JSON.stringify(required)) throw new Error('Unexpected/missing files in target artifact closure');
    for (const file of [...receipt.assets.map(asset=>({...asset,path:`assets/${asset.name}`})),...receipt.evidenceFiles]) {
        const actual=await fileDigest(await regularFile(root,file.path));
        if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) throw new Error(`Artifact checksum mismatch: ${file.path}`);
    }
    return receipt;
}
function validateSelection(selection,receipt,artifactIds) {
    closed(selection,['id','name','target','attempt','runId'],'artifact selection');
    if (!Number.isSafeInteger(selection.id) || selection.id <= 0 || artifactIds.has(selection.id) || selection.target !== receipt.target.id || selection.runId !== receipt.context.runId || selection.attempt !== receipt.context.attempt || selection.name !== `desktop-${receipt.target.id}-${selection.runId}-${selection.attempt}`) throw new Error('Artifact selection/provenance mismatch');
    artifactIds.add(selection.id);
}
function releaseLimitations(receipts) {
    const coverage=receipts.some(receipt=>receipt.state === 'packaged') ? [
        'Packaging-only delivery: packaged targets have no automated tests, application launch or runtime acceptance; their checks and evidence arrays are empty.',
        'Target and native build-host metadata, source identity and installer hashes are checked. Installed/extracted payload architecture, UI, SQLite persistence, microphone, print, providers, PDF and media codecs are not established by packaging.',
        'The owner performs functional testing before public publication. A complete upload describes the installer file set, not passed software tests.',
        'Linux targets use the Ubuntu 22.04 x64 baseline; AppImage/FUSE desktop launch and other distributions are not established by packaging.',
    ] : [
        'Mac host smoke proves package integrity and bounded process launch, not UI persistence. Intel UI/hardware checks pending.',
        'Windows/Linux TXT UI persistence smoke does not prove microphone, print, provider, PDF or media codecs.',
        'Linux AppImage smoke launches extracted payload; FUSE desktop launch and other distributions pending.',
    ];
    return ['Unsigned Windows; macOS ad-hoc, not notarized.',...coverage,'Windows local NTFS flushes regular-file bytes/metadata and uses no-overwrite publication plus process-termination recovery; parent-directory persistence across sudden OS/power loss is not guaranteed.'];
}
export async function collectArtifacts(targetDirectories,output,expected,artifactSelections) {
    if (targetDirectories.length !== Object.keys(TARGETS).length || !Array.isArray(artifactSelections) || artifactSelections.length !== targetDirectories.length) throw new Error('Require four explicitly selected target artifacts');
    const receipts=[],ids=new Set(),artifactIds=new Set();
    for (const [index,directory] of targetDirectories.entries()) {
        const receipt=await verifyTargetDirectory(directory,expected);
        const selection=artifactSelections[index];
        validateSelection(selection,receipt,artifactIds);
        if (ids.has(receipt.target.id)) throw new Error('Duplicate target');
        ids.add(receipt.target.id);receipts.push({directory,receipt,selection});
    }
    for (const {receipt} of receipts) if (JSON.stringify(receipt.inputs.sourceBefore) !== JSON.stringify(receipts[0].receipt.inputs.sourceBefore)) throw new Error('Targets use different source inputs');
    await mkdir(output,{recursive:false});
    const installers=[];
    for (const {directory,receipt} of receipts.sort((a,b)=>a.receipt.target.id.localeCompare(b.receipt.target.id))) {
        for (const asset of receipt.assets) {
            await cp(await regularFile(directory,`assets/${asset.name}`),join(output,asset.name),{errorOnExist:true,force:false});
            installers.push({...asset,target:receipt.target.id});
        }
    }
    installers.sort((a,b)=>a.name.localeCompare(b.name));
    await writeFile(join(output,'SHA256SUMS'),installers.map(asset=>`${asset.sha256}  ${asset.name}\n`).join(''),{flag:'wx'});
    // Collection retry is metadata-neutral: keeping the original target IDs
    // must reproduce the exact manifest bytes, even on a later collector try.
    const payloadContext={...expected,attempt:Math.max(...receipts.map(({receipt})=>receipt.context.attempt))};
    const manifest={schema:1,context:payloadContext,policyHash:policyHash(),installers,targets:receipts.map(({receipt,selection})=>({receipt,artifact:selection})),limitations:releaseLimitations(receipts.map(({receipt})=>receipt))};
    await writeFile(join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    return manifest;
}

export async function verifyReleaseDirectory(directory) {
    const manifest=JSON.parse(await readFile(await regularFile(directory,'release-manifest.json'),'utf8'));
    closed(manifest,['schema','context','policyHash','installers','targets','limitations'],'release manifest');
    validateContext(manifest.context);
    if (manifest.schema !== 1 || manifest.policyHash !== policyHash() || manifest.targets.length !== 4 || manifest.installers.length !== 5) throw new Error('Incomplete release manifest');
    const targets=new Set(),artifactIds=new Set(),expected=[];
    for (const entry of manifest.targets) {
        closed(entry,['receipt','artifact'],'release target');await validateReceipt(entry.receipt,manifest.context);
        validateSelection(entry.artifact,entry.receipt,artifactIds);
        if (targets.has(entry.receipt.target.id)) throw new Error('Duplicate release target');targets.add(entry.receipt.target.id);
        if (JSON.stringify(entry.receipt.inputs.sourceBefore) !== JSON.stringify(manifest.targets[0].receipt.inputs.sourceBefore)) throw new Error('Targets use different source inputs');
        expected.push(...entry.receipt.assets.map(asset=>({...asset,target:entry.receipt.target.id})));
    }
    expected.sort((a,b)=>a.name.localeCompare(b.name));
    if (JSON.stringify(manifest.limitations) !== JSON.stringify(releaseLimitations(manifest.targets.map(entry=>entry.receipt)))) throw new Error('Release acceptance limitations changed');
    if (JSON.stringify(expected) !== JSON.stringify(manifest.installers)) throw new Error('Release installer set changed');
    const files=[...manifest.installers.map(asset=>asset.name),'SHA256SUMS','release-manifest.json'].sort();
    if (JSON.stringify(await listedFiles(directory)) !== JSON.stringify(files)) throw new Error('Unexpected release file');
    for (const installer of manifest.installers) {
        const actual=await fileDigest(await regularFile(directory,installer.name));
        if (actual.sha256 !== installer.sha256 || actual.bytes !== installer.bytes) throw new Error('Release installer bytes changed');
    }
    const sums=manifest.installers.map(asset=>`${asset.sha256}  ${asset.name}\n`).join('');
    if (await readFile(join(directory,'SHA256SUMS'),'utf8') !== sums) throw new Error('Checksum manifest changed');
    return manifest;
}

export async function copyCheckReports(receiptPath,paths) {
    const root=dirname(receiptPath),receipt=JSON.parse(await readFile(receiptPath,'utf8'));
    if (!['building','packaged'].includes(receipt.state) || !Array.isArray(receipt.checks) || receipt.checks.length || !Array.isArray(receipt.evidenceFiles) || receipt.evidenceFiles.length) throw new Error('Only a fresh building or packaged receipt may be sealed');
    for (const [index,path] of paths.entries()) {
        const source=dirname(resolve(path)),report=JSON.parse(await readFile(path,'utf8'));
        closed(report,['schema','target','sourceSha','checks','evidenceFiles'],'check report');
        if (report.schema !== 1 || report.target !== receipt.target.id || report.sourceSha !== receipt.context.sourceSha) throw new Error('Wrong check report source/target');
        for (const file of report.evidenceFiles) {
            closed(file,['path','bytes','sha256'],'check evidence');
            const actual=await fileDigest(await regularFile(source,file.path));
            if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256 || file.bytes > 67108864) throw new Error('Check evidence changed/oversized');
            const destination=`evidence/${index}/${file.path}`;
            await mkdir(dirname(safePath(root,destination)),{recursive:true});
            await cp(await regularFile(source,file.path),safePath(root,destination),{errorOnExist:true,force:false});
            receipt.evidenceFiles.push({...file,path:destination});
        }
        for (const check of report.checks) receipt.checks.push({...check,evidence:`evidence/${index}/${check.evidence}`});
    }
    receipt.state='verified';await validateReceipt(receipt,receipt.context);
    await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
    await verifyTargetDirectory(root,receipt.context);
    return receipt;
}
