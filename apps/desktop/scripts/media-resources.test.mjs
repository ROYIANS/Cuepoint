import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync, deflateRawSync, crc32} from 'node:zlib';
import {extractMediaArchive} from './media-archives.mjs';
import {MEDIA_LOCK, downloadMediaFile, mediaReleaseIdentity, mediaRuntimeManifest, mediaTarget, prepareMediaResources} from './media-resources.mjs';
import {releaseBuildArguments} from './build-release.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = {'ffmpeg': {bytes: 3}, 'ffprobe': {bytes: 4}};
function tar(members = [{name: 'ffmpeg', bytes: 'abc'}, {name: 'ffprobe', bytes: 'defg'}]) {
    const blocks = [];
    for (const member of members) {
        const bytes = Buffer.from(member.bytes), header = Buffer.alloc(512);
        header.write(member.name);header.write('0000755\0', 100);header.write('0000000\0', 108);header.write('0000000\0', 116);
        header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124);header.write('00000000000\0', 136);
        header.fill(32, 148, 156);header[156] = member.type ?? 48;header.write('ustar\0', 257);
        const sum = [...header].reduce((total, byte) => total + byte, 0);
        header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
        blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
    }
    return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
function zip(members = [{name: 'ffmpeg', bytes: 'abc'}, {name: 'ffprobe', bytes: 'defg'}]) {
    const locals = [], directories = [];let offset = 0;
    for (const member of members) {
        const bytes = Buffer.from(member.bytes), name = Buffer.from(member.name), compressed = deflateRawSync(bytes);
        const local = Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20, 4);local.writeUInt16LE(8, 8);
        local.writeUInt32LE(crc32(bytes), 14);local.writeUInt32LE(compressed.length, 18);local.writeUInt32LE(bytes.length, 22);local.writeUInt16LE(name.length, 26);
        locals.push(local, name, compressed);
        const directory = Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(0x0314, 4);directory.writeUInt16LE(20, 6);directory.writeUInt16LE(8, 10);
        directory.writeUInt32LE(crc32(bytes), 16);directory.writeUInt32LE(compressed.length, 20);directory.writeUInt32LE(bytes.length, 24);directory.writeUInt16LE(name.length, 28);
        directory.writeUInt32LE(((member.mode ?? 0o100755) << 16) >>> 0, 38);directory.writeUInt32LE(offset, 42);
        directories.push(directory, name);offset += local.length + name.length + compressed.length;
    }
    const central = Buffer.concat(directories), end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(members.length, 8);end.writeUInt16LE(members.length, 10);
    end.writeUInt32LE(central.length, 12);end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, central, end]);
}

test('finite decoder archive readers accept only complete root ordinary members', () => {
    for (const [format, archive] of [['tar.gz', tar()], ['zip', zip()]]) {
        const files = extractMediaArchive(archive, format, expected);
        assert.deepEqual([...files].map(([name, bytes]) => [name, bytes.toString()]), [['ffmpeg', 'abc'], ['ffprobe', 'defg']]);
    }
});
for (const [name, members] of [
    ['traversal', [{name: '../ffmpeg', bytes: 'abc'}, {name: 'ffprobe', bytes: 'defg'}]],
    ['absolute', [{name: '/ffmpeg', bytes: 'abc'}, {name: 'ffprobe', bytes: 'defg'}]],
    ['duplicate', [{name: 'ffmpeg', bytes: 'abc'}, {name: 'ffmpeg', bytes: 'abc'}]],
    ['missing', [{name: 'ffmpeg', bytes: 'abc'}]],
    ['unexpected', [{name: 'ffmpeg', bytes: 'abc'}, {name: 'ffprobe', bytes: 'defg'}, {name: 'extra', bytes: 'x'}]],
    ['oversize', [{name: 'ffmpeg', bytes: 'abcd'}, {name: 'ffprobe', bytes: 'defg'}]],
]) test(`archive readers reject ${name} without extraction`, () => {
    for (const [format, archive] of [['tar.gz', tar(members)], ['zip', zip(members)]]) assert.throws(() => extractMediaArchive(archive, format, expected));
});
test('archives reject links, directories, corrupted checksums and truncated trailing metadata', () => {
    for (const type of [49, 50, 53, 120]) assert.throws(() => extractMediaArchive(tar([{name: 'ffmpeg', bytes: 'abc', type}, {name: 'ffprobe', bytes: 'defg'}]), 'tar.gz', expected));
    for (const mode of [0o120755, 0o040755]) assert.throws(() => extractMediaArchive(zip([{name: 'ffmpeg', bytes: 'abc', mode}, {name: 'ffprobe', bytes: 'defg'}]), 'zip', expected));
    const broken = zip();broken[31 + 'ffmpeg'.length] ^= 0xff;
    assert.throws(() => extractMediaArchive(broken, 'zip', expected));
    assert.throws(() => extractMediaArchive(zip().subarray(0, -1), 'zip', expected));
    assert.throws(() => extractMediaArchive(tar().subarray(0, -3), 'tar.gz', expected));
});
test('target manifest pins all three measured tools and leaves Linux packaging without a decoder', async () => {
    assert.equal(mediaTarget('darwin', 'arm64'), 'macos-arm64');assert.equal(mediaTarget('darwin', 'x64'), 'macos-x64');assert.equal(mediaTarget('win32', 'x64'), 'windows-x64');
    assert.throws(() => mediaTarget('win32', 'arm64'));assert.throws(() => mediaRuntimeManifest('linux-x64'));
    for (const id of ['macos-arm64', 'macos-x64', 'windows-x64']) {
        const manifest = mediaRuntimeManifest(id);
        assert.equal(manifest.target, id);assert.equal(manifest.version, '8.0.3');
        assert.deepEqual(Object.keys(manifest.executables), ['ffmpeg', 'ffprobe']);
        assert.ok(Object.values(manifest.executables).every(file => /^[a-f0-9]{64}$/.test(file.sha256) && file.bytes > 30_000_000 && file.bytes < 50_000_000));
        const args = releaseBuildArguments(id, '/fixture/media-config.json');
        assert.deepEqual(args.slice(-4), ['--config', '/fixture/media-config.json', '--', '--locked']);
    }
    assert.deepEqual(await prepareMediaResources('linux-x64', {fetchImpl: () => assert.fail('Linux must not download a decoder')}), {root: null, manifest: null, files: {}, config: {}});
});
test('release identities close over measured decoders, notices and all corresponding source archives', async () => {
    for (const target of ['macos-arm64', 'macos-x64', 'windows-x64']) {
        const identity = await mediaReleaseIdentity(target);
        assert.equal(identity.target, target);assert.equal(identity.manifest.target, target);
        for (const file of Object.values(identity.manifest.executables)) assert.deepEqual(identity.files[file.file], {bytes: file.bytes, sha256: file.sha256});
        assert.equal(Object.keys(identity.files).filter(file => file.startsWith('sources/')).length, 9);
        for (const name of ['SOURCE.md', 'THIRD-PARTY-NOTICES.txt', 'source-lock.json', 'resource-files.json', 'manifest.json']) assert.ok(identity.files[name]);
    }
    assert.equal(await mediaReleaseIdentity('linux-x64'), null);
});
test('streamed downloads reject wrong digest, length, overflow and interruption', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cuepoint-media-download-'));
    try {
        const expected = {bytes: 3, sha256: digest('abc')};
        const response = bytes => async () => new globalThis.Response(bytes, {status: 200});
        const good = join(root, 'good');await downloadMediaFile('https://fixture.invalid/pinned', good, expected, {fetchImpl: response('abc')});
        assert.equal(await readFile(good, 'utf8'), 'abc');
        await assert.rejects(downloadMediaFile('https://fixture.invalid/pinned', join(root, 'bad'), expected, {fetchImpl: response('abd')}), /checksum/);
        await assert.rejects(downloadMediaFile('https://fixture.invalid/pinned', join(root, 'short'), expected, {fetchImpl: response('ab')}), /checksum/);
        await assert.rejects(downloadMediaFile('https://fixture.invalid/pinned', join(root, 'long'), expected, {fetchImpl: response('abcd')}), /exceeded/);
        await assert.rejects(downloadMediaFile('https://fixture.invalid/pinned', join(root, 'header'), expected, {fetchImpl: async () => new globalThis.Response('abc', {headers: {'content-length': '4'}})}), /length/);
        const controller = new AbortController();let reached = false;
        const body = new globalThis.ReadableStream({pull(stream) {reached = true;stream.enqueue(Buffer.from('a'));controller.abort(new Error('fixture interruption'));}});
        await assert.rejects(downloadMediaFile('https://fixture.invalid/pinned', join(root, 'aborted'), expected, {signal: controller.signal, fetchImpl: async () => new globalThis.Response(body)}), /fixture interruption/);
        assert.equal(reached, true);assert.equal(await readFile(good, 'utf8'), 'abc');
    } finally {await rm(root, {recursive: true, force: true});}
});
test('failed preparation cleans only its temporary directory and never replaces existing resources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cuepoint-media-preparation-'));
    try {
        let fetches = 0;const fetchImpl = async () => {fetches++;return new globalThis.Response('wrong archive');};
        await assert.rejects(prepareMediaResources('macos-arm64', {cacheRoot: root, fetchImpl}), /checksum/);
        assert.equal(fetches, 1);assert.deepEqual(await readdir(join(root, MEDIA_LOCK.release)), []);
        const ready = join(root, MEDIA_LOCK.release, 'macos-arm64');await mkdir(ready);await writeFile(join(ready, 'owner-sentinel'), 'preserve');
        await assert.rejects(prepareMediaResources('macos-arm64', {cacheRoot: root, fetchImpl}));
        assert.equal(await readFile(join(ready, 'owner-sentinel'), 'utf8'), 'preserve');
        const controller = new AbortController();controller.abort(new Error('fixture interruption'));
        await assert.rejects(prepareMediaResources('windows-x64', {cacheRoot: root, fetchImpl, signal: controller.signal}), /fixture interruption/);
        assert.equal(await readFile(join(ready, 'owner-sentinel'), 'utf8'), 'preserve');
        await assert.rejects(prepareMediaResources('wrong-target', {cacheRoot: root, fetchImpl}), /target/);
        assert.equal(await readFile(join(ready, 'owner-sentinel'), 'utf8'), 'preserve');
    } finally {await rm(root, {recursive: true, force: true});}
});
