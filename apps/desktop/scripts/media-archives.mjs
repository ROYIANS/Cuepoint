import {gunzipSync, inflateRawSync, crc32} from 'node:zlib';

// Release tooling only. Never delegate extraction to a shell or an archive's
// path/mode/link metadata. The reviewed archives contain two flat regular files.
const MAX_EXPANDED = 128 * 1024 * 1024;
const fail = () => {throw new Error('Invalid media decoder archive');};
function text(bytes) {return bytes.toString('utf8').replace(/\0.*$/s, '');}
function octal(bytes) {
    const value = text(bytes).trim();
    if (!/^[0-7]+$/.test(value)) fail();
    return Number.parseInt(value, 8);
}
function member(name, mode, expected, seen) {
    if (!Object.hasOwn(expected, name) || seen.has(name) || (mode & 0o170000) !== 0o100000) fail();
    seen.add(name);
}
function finish(files, expected) {
    if (files.size !== Object.keys(expected).length) fail();
    for (const [name, bytes] of files) if (bytes.length !== expected[name].bytes) fail();
    return files;
}
function untar(archive, expected) {
    const bytes = gunzipSync(archive, {maxOutputLength: MAX_EXPANDED});
    const seen = new Set(), files = new Map();
    let offset = 0;
    while (offset + 512 <= bytes.length) {
        const header = bytes.subarray(offset, offset + 512);
        if (header.every(byte => byte === 0)) {
            if (bytes.length - offset < 1024 || !bytes.subarray(offset).every(byte => byte === 0)) fail();
            return finish(files, expected);
        }
        const name = text(header.subarray(0, 100));
        const type = header[156];
        if (![0, 48].includes(type) || text(header.subarray(157, 257)) || text(header.subarray(345, 500))) fail();
        const checksum = [...header].reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
        if (octal(header.subarray(148, 156)) !== checksum) fail();
        member(name, octal(header.subarray(100, 108)) | 0o100000, expected, seen);
        const size = octal(header.subarray(124, 136));
        if (size !== expected[name].bytes || size > MAX_EXPANDED || offset + 512 + size > bytes.length) fail();
        files.set(name, bytes.subarray(offset + 512, offset + 512 + size));
        const next = offset + 512 + Math.ceil(size / 512) * 512;
        if (!bytes.subarray(offset + 512 + size, next).every(byte => byte === 0)) fail();
        offset = next;
    }
    fail();
}
function unzip(archive, expected) {
    // No ZIP64, data descriptors, encryption, split disks or archive comments.
    const end = archive.length - 22;
    if (end < 0 || archive.readUInt32LE(end) !== 0x06054b50 || archive.readUInt16LE(end + 20) !== 0 ||
        archive.readUInt16LE(end + 4) !== 0 || archive.readUInt16LE(end + 6) !== 0) fail();
    const count = archive.readUInt16LE(end + 10), directory = archive.readUInt32LE(end + 16);
    if (count !== Object.keys(expected).length || archive.readUInt16LE(end + 8) !== count ||
        directory + archive.readUInt32LE(end + 12) !== end) fail();
    const seen = new Set(), files = new Map();
    let offset = directory, localEnd = 0, expanded = 0;
    for (let index = 0; index < count; index++) {
        if (offset + 46 > end || archive.readUInt32LE(offset) !== 0x02014b50) fail();
        const flags = archive.readUInt16LE(offset + 8), method = archive.readUInt16LE(offset + 10);
        const compressed = archive.readUInt32LE(offset + 20), size = archive.readUInt32LE(offset + 24);
        const nameSize = archive.readUInt16LE(offset + 28), extra = archive.readUInt16LE(offset + 30), comment = archive.readUInt16LE(offset + 32);
        const local = archive.readUInt32LE(offset + 42), next = offset + 46 + nameSize + extra + comment;
        if (next > end || flags & ~0x0806 || ![0, 8].includes(method) || archive.readUInt16LE(offset + 34) !== 0) fail();
        const nameBytes = archive.subarray(offset + 46, offset + 46 + nameSize), name = nameBytes.toString('utf8');
        const attributes = archive.readUInt32LE(offset + 38);
        if (archive[offset + 5] !== 3 || (attributes & 0x10) !== 0) fail();
        member(name, attributes >>> 16, expected, seen);
        expanded += size;
        if (size !== expected[name].bytes || expanded > MAX_EXPANDED || local !== localEnd || local + 30 > directory ||
            archive.readUInt32LE(local) !== 0x04034b50 || archive.readUInt16LE(local + 6) !== flags ||
            archive.readUInt16LE(local + 8) !== method || archive.readUInt32LE(local + 14) !== archive.readUInt32LE(offset + 16) ||
            archive.readUInt32LE(local + 18) !== compressed || archive.readUInt32LE(local + 22) !== size ||
            archive.readUInt16LE(local + 26) !== nameSize) fail();
        const data = local + 30 + nameSize + archive.readUInt16LE(local + 28);
        if (data + compressed > directory || !archive.subarray(local + 30, local + 30 + nameSize).equals(nameBytes)) fail();
        const encoded = archive.subarray(data, data + compressed);
        const decoded = method === 8 ? inflateRawSync(encoded, {maxOutputLength: Math.min(MAX_EXPANDED, size + 1)}) : encoded;
        if (decoded.length !== size || crc32(decoded) !== archive.readUInt32LE(offset + 16)) fail();
        files.set(name, decoded);localEnd = data + compressed;offset = next;
    }
    if (offset !== end || localEnd !== directory) fail();
    return finish(files, expected);
}

export function extractMediaArchive(archive, format, expected) {
    if (!Buffer.isBuffer(archive) || !Object.keys(expected).length || Object.keys(expected).length > 2 ||
        Object.keys(expected).some(name => !/^ff(?:mpeg|probe)(?:\.exe)?$/.test(name))) fail();
    if (format === 'tar.gz') return untar(archive, expected);
    if (format === 'zip') return unzip(archive, expected);
    fail();
}
