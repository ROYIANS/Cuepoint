import {createHash, randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {chmod, copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractMediaArchive} from './media-archives.mjs';

const desktop = fileURLToPath(new URL('../', import.meta.url));
const materials = resolve(desktop, 'media');
export const MEDIA_LOCK = JSON.parse(await readFile(resolve(materials, 'decoder-lock.json'), 'utf8'));
const SOURCE_LOCK = JSON.parse(await readFile(resolve(materials, 'source-lock.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const abort = signal => signal?.throwIfAborted();

export function mediaTarget(platform = process.platform, arch = process.arch) {
    const id = {darwin: {arm64: 'macos-arm64', x64: 'macos-x64'}, win32: {x64: 'windows-x64'}, linux: {x64: 'linux-x64'}}[platform]?.[arch];
    if (!id) throw new Error('Unsupported desktop media target');
    return id;
}
export function mediaRuntimeManifest(target) {
    if (!Object.hasOwn(MEDIA_LOCK.targets, target)) throw new Error('Unsupported media decoder target');
    return {schema: 1, backend: MEDIA_LOCK.backend, version: MEDIA_LOCK.version, release: MEDIA_LOCK.release, target,
        executables: MEDIA_LOCK.targets[target].executables};
}
async function regular(path) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Media resource must be an ordinary single-link file');
    return stat;
}
async function verifyMediaFile(path, expected, signal) {
    const before = await regular(path);
    if (before.size !== expected.bytes) throw new Error('Media resource length mismatch');
    const digest = createHash('sha256');
    const stream = createReadStream(path);
    try {
        for await (const chunk of stream) {abort(signal);digest.update(chunk);}
    } finally {stream.destroy();}
    const after = await regular(path);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        digest.digest('hex') !== expected.sha256) throw new Error('Media resource checksum or identity mismatch');
    abort(signal);
}

// Downloads are finite and only caller-supplied *trusted build tooling* can
// inject fetch. No runtime download, model URL or renderer path reaches this API.
export async function downloadMediaFile(url, path, expected, {fetchImpl = globalThis.fetch, signal} = {}) {
    if (!Number.isSafeInteger(expected.bytes) || expected.bytes < 1 || expected.bytes > 64 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(expected.sha256)) throw new Error('Invalid pinned media asset');
    abort(signal);
    const deadline = AbortSignal.timeout(180_000);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    // VideoLAN rejects Node's default cors fetch metadata; other sources need cross-origin redirects.
    const mode = new URL(url).origin === 'https://code.videolan.org' ? {mode: 'same-origin'} : {};
    const response = await fetchImpl(url, {signal: combined, redirect: 'follow', ...mode});
    if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`Pinned media asset download failed: ${url} (HTTP ${response.status})`);
    }
    const length = response.headers.get('content-length');
    if (length !== null && length !== String(expected.bytes)) {await response.body.cancel();throw new Error('Media download length mismatch');}
    const digest = createHash('sha256');
    let file;
    let bytes = 0;
    try {
        file = await open(path, 'wx', 0o600);
        for await (const chunk of response.body) {
            abort(combined);bytes += chunk.length;
            if (bytes > expected.bytes) throw new Error('Media download exceeded pinned length');
            digest.update(chunk);await file.writeFile(chunk);
        }
        abort(combined);
        if (bytes !== expected.bytes || digest.digest('hex') !== expected.sha256) throw new Error('Media download checksum mismatch');
        await file.sync();
    } finally {
        await file?.close();
        if (!response.body.locked) await response.body.cancel().catch(() => {});
    }
}
export async function ensureSourceArchive(source, root, options = {}) {
    const path = resolve(root, `${source.name}-${source.commit}.tar.gz`);
    const expected = {bytes: source.archiveBytes, sha256: source.archiveSha256};
    let local;
    if (source.archiveFile !== undefined) {
        if (source.archiveFile !== `sources/${source.name}-${source.commit}.tar.gz`) throw new Error('Invalid pinned source archive file');
        local = resolve(materials, source.archiveFile);
        // Retained upstream bytes remain mandatory even when an exact cache entry exists.
        await verifyMediaFile(local, expected, options.signal);
    }
    try {await lstat(path);await verifyMediaFile(path, expected, options.signal);return path;} catch (error) {if (error.code !== 'ENOENT') throw error;}
    const temporary = `${path}.${randomUUID()}.part`;
    try {
        if (local) {
            await copyFile(local, temporary);
            await verifyMediaFile(temporary, expected, options.signal);
        }
        else await downloadMediaFile(source.archiveUrl, temporary, expected, options);
        abort(options.signal);
        try {await rename(temporary, path);} catch (error) {
            if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
        }
        await verifyMediaFile(path, expected, options.signal);return path;
    } finally {await rm(temporary, {force: true});}
}
async function staticMaterials() {
    const files = new Map();
    for (const name of ['THIRD-PARTY-NOTICES.txt', 'SOURCE.md', 'source-lock.json']) files.set(name, resolve(materials, name));
    for (const source of SOURCE_LOCK.sources) for (const license of source.licenses) {
        const path = resolve(materials, 'licenses', license.file), bytes = await readFile(path);
        if (hash(bytes) !== license.sha256) throw new Error('Tracked media license checksum mismatch');
        files.set(`licenses/${license.file}`, path);
    }
    for (const name of await readdir(resolve(materials, 'provenance'))) {
        if (!/^ffmpeg-8\.0\.3-(?:macos-arm64|macos-x64|win-x64)\.configure\.txt$/.test(name)) throw new Error('Unexpected decoder provenance material');
        files.set(`provenance/${name}`, resolve(materials, 'provenance', name));
    }
    return files;
}
async function resourceInventory(manifest) {
    const files = {};
    for (const file of Object.values(manifest.executables)) files[file.file] = {bytes: file.bytes, sha256: file.sha256};
    for (const source of SOURCE_LOCK.sources) files[`sources/${source.name}-${source.commit}.tar.gz`] = {bytes: source.archiveBytes, sha256: source.archiveSha256};
    for (const [name, path] of await staticMaterials()) {const bytes = await readFile(path);files[name] = {bytes: bytes.length, sha256: hash(bytes)};}
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    files['manifest.json'] = {bytes: bytes.length, sha256: hash(bytes)};
    return Object.fromEntries(Object.keys(files).sort().map(name => [name, files[name]]));
}
export async function mediaReleaseIdentity(target) {
    if (target === 'linux-x64') return null;
    const manifest = mediaRuntimeManifest(target), files = await resourceInventory(manifest);
    const inventory = Buffer.from(JSON.stringify(files, null, 2) + '\n');
    return {target, manifest, files: {...files, 'resource-files.json': {bytes: inventory.length, sha256: hash(inventory)}}};
}
export async function verifyBundledMedia(resourceRoot, target) {
    const identity = await mediaReleaseIdentity(target);
    if (identity === null) return null;
    const {['resource-files.json']: inventory, ...files} = identity.files;
    await verifyReady(resolve(resourceRoot, 'media'), identity.manifest, files);
    await verifyMediaFile(resolve(resourceRoot, 'media/resource-files.json'), inventory);
    return identity;
}
async function verifyReady(root, manifest, expectedFiles, signal) {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Invalid media resource directory');
    const inventoryBytes = Buffer.from(JSON.stringify(expectedFiles, null, 2) + '\n');
    await verifyMediaFile(resolve(root, 'resource-files.json'), {bytes: inventoryBytes.length, sha256: hash(inventoryBytes)}, signal);
    const visit = async (directory, prefix = '') => {
        for (const name of await readdir(directory)) {
            const key = `${prefix}${name}`, path = resolve(directory, name), stat = await lstat(path);
            if (stat.isSymbolicLink()) throw new Error('Linked media resource rejected');
            if (stat.isDirectory() && ['sources', 'licenses', 'provenance'].includes(key)) await visit(path, `${key}/`);
            else if (!stat.isFile() || key !== 'resource-files.json' && !Object.hasOwn(expectedFiles, key)) throw new Error('Unexpected media resource');
        }
    };
    await visit(root);
    for (const [name, expected] of Object.entries(expectedFiles)) {
        if (!/^(?:ffmpeg(?:\.exe)?|ffprobe(?:\.exe)?|manifest\.json|resource-files\.json|THIRD-PARTY-NOTICES\.txt|SOURCE\.md|source-lock\.json|(?:sources|licenses|provenance)\/[A-Za-z0-9.-]+)$/.test(name)) throw new Error('Invalid resource inventory path');
        await verifyMediaFile(resolve(root, name), expected, signal);
    }
    const actual = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
    if (JSON.stringify(actual) !== JSON.stringify(manifest)) throw new Error('Wrong media resource target or manifest');
    for (const expected of Object.values(manifest.executables)) await verifyMediaFile(resolve(root, expected.file), expected, signal);
    return expectedFiles;
}

export async function prepareMediaResources(target, options = {}) {
    // Linux packaging keeps its existing target. E08 has no Linux decoder.
    if (target === 'linux-x64') return {root: null, manifest: null, files: {}, config: {}};
    const manifest = mediaRuntimeManifest(target), pinned = MEDIA_LOCK.targets[target];
    const files = await resourceInventory(manifest);
    const cacheRoot = resolve(options.cacheRoot ?? resolve(desktop, '.tools/media'));
    await mkdir(resolve(cacheRoot, MEDIA_LOCK.release), {recursive: true});
    const destination = resolve(cacheRoot, MEDIA_LOCK.release, target);
    try {
        await lstat(destination);
        await verifyReady(destination, manifest, files, options.signal);
        return resourceResult(destination, manifest, files);
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
    const temporary = resolve(cacheRoot, MEDIA_LOCK.release, `.${target}-${randomUUID()}`);
    await mkdir(temporary);
    try {
        const archive = resolve(temporary, 'archive.part');
        await downloadMediaFile(pinned.archive.url, archive, pinned.archive, options);
        const extracted = extractMediaArchive(await readFile(archive), pinned.archive.format, Object.fromEntries(Object.values(manifest.executables).map(file => [file.file, file])));
        await rm(archive);
        for (const [name, bytes] of extracted) {
            const expected = Object.values(manifest.executables).find(file => file.file === name);
            if (hash(bytes) !== expected.sha256) throw new Error('Extracted decoder checksum mismatch');
            await writeFile(resolve(temporary, name), bytes, {flag: 'wx', mode: 0o755});
            if (process.platform !== 'win32') await chmod(resolve(temporary, name), 0o755);
        }
        const sourceRoot = resolve(cacheRoot, 'sources');await mkdir(sourceRoot, {recursive: true});
        await mkdir(resolve(temporary, 'sources'));
        for (const source of SOURCE_LOCK.sources) {
            const path = await ensureSourceArchive(source, sourceRoot, options);
            await copyFile(path, resolve(temporary, 'sources', `${source.name}-${source.commit}.tar.gz`));
        }
        for (const [name, path] of await staticMaterials()) {
            await mkdir(dirname(resolve(temporary, name)), {recursive: true});await copyFile(path, resolve(temporary, name));
        }
        await writeFile(resolve(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
        // The inventory is itself covered by the bundle/installer digest; it
        // cannot recursively contain its own digest. Runtime trusts compiled
        // decoder-lock executable identities, never this build inventory.
        await writeFile(resolve(temporary, 'resource-files.json'), JSON.stringify(files, null, 2) + '\n', {flag: 'wx'});
        await verifyReady(temporary, manifest, files, options.signal);abort(options.signal);
        try {await rename(temporary, destination);} catch (error) {
            if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
            await verifyReady(destination, manifest, files, options.signal);
        }
        return resourceResult(destination, manifest, files);
    } finally {await rm(temporary, {recursive: true, force: true});}
}
function resourceResult(root, manifest, files) {
    return {root, manifest, files, config: {bundle: {resources: Object.fromEntries([...Object.keys(files), 'resource-files.json'].map(name => [resolve(root, name), `media/${name}`]))}}};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length !== 4 || process.argv[2] !== '--target') throw new Error('Use media-resources.mjs --target TARGET');
    const result = await prepareMediaResources(process.argv[3]);
    console.log(result.root ? `Verified ${result.manifest.target} media resources: ${result.root}` : 'Media workflow unavailable on Linux; existing packaging preserved');
}
