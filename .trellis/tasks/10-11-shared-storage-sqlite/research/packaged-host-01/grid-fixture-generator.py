"""Root-run disposable grid fixture copier. No application/UI/database access."""
from datetime import datetime
from hashlib import sha256
import json
import os
from pathlib import Path
import struct
import zlib
from zoneinfo import ZoneInfo


REPO = Path('/Users/xiaomengdao/WebstormProjects/aifenjing')
SOURCE = REPO / 'desktop/tauri/fixtures/media/image.png'
TARGET = REPO / 'desktop/tauri/.acceptance/shared-storage-host-01/grid-import'
MANIFEST = REPO / '.trellis/tasks/10-11-shared-storage-sqlite/research/packaged-host-01/grid-fixture-manifest.json'
EXPECTED_SHA = '626815c78eaad46cad849732d1598b45b91700ce046c1ee3f4e2444db80aa32a'
NAMES = [f'grid-{i:03}.png' for i in range(1, 66)]


def validate_png(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid synthetic PNG signature'
    offset, chunks, compressed, size = 8, [], bytearray(), None
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        body = data[offset + 8:offset + 8 + length]
        crc = struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + body) & 0xffffffff == crc, 'PNG CRC mismatch'
        chunks.append(kind)
        if kind == b'IHDR':
            assert len(body) == 13, 'Invalid PNG IHDR'
            width, height, depth, color, compression, filters, interlace = struct.unpack('>IIBBBBB', body)
            assert (width, height, depth, color, compression, filters, interlace) == (64, 48, 8, 2, 0, 0, 0)
            size = {'width': width, 'height': height, 'bitDepth': depth, 'colorType': color}
        if kind == b'IDAT':
            compressed.extend(body)
        offset += 12 + length
        if kind == b'IEND':
            assert length == 0 and offset == len(data), 'PNG trailing bytes'
            break
    assert chunks[0] == b'IHDR' and chunks[-1] == b'IEND' and size, 'Incomplete PNG'
    assert len(zlib.decompress(compressed)) == 48 * (64 * 3 + 1), 'PNG scanline size mismatch'
    return size


def main():
    assert SOURCE.is_file() and not SOURCE.is_symlink(), 'Source must be existing known regular synthetic fixture'
    data = SOURCE.read_bytes()
    digest = sha256(data).hexdigest()
    assert len(data) == 177 and digest == EXPECTED_SHA, 'Known synthetic source identity changed'
    png = validate_png(data)
    assert not TARGET.is_symlink(), 'Target directory must not be a symlink'
    assert not MANIFEST.exists(), 'Manifest already exists; refuse replacement'
    TARGET.mkdir(parents=True, exist_ok=True)
    assert not (set(p.name for p in TARGET.iterdir()) - set(NAMES)), 'Target contains unknown files'
    for name in NAMES:
        path = TARGET / name
        if path.exists() or path.is_symlink():
            assert path.is_file() and not path.is_symlink(), 'Refuse nonregular existing target'
            assert path.read_bytes() == data, 'Refuse unknown existing target bytes'
    created, reused, files = [], [], []
    for name in NAMES:
        path = TARGET / name
        if path.exists():
            reused.append(name)
        else:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            created.append(name)
        copied = path.read_bytes()
        assert len(copied) == 177 and sha256(copied).hexdigest() == digest
        files.append({'name': name, 'path': str(path), 'bytes': len(copied), 'sha256': digest})
    assert len(list(TARGET.iterdir())) == 65, 'Unexpected final fixture count'
    receipt = {
        'schemaVersion': 1,
        'at': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
        'kind': '65 disposable synthetic PNG grid inputs',
        'createdCount': len(created), 'reusedMatchingCount': len(reused), 'fileCount': len(files),
        'source': {'path': str(SOURCE), 'bytes': len(data), 'sha256': digest,
                   'provenance': 'desktop/tauri/fixtures/media-provenance.json',
                   'generator': 'desktop/tauri/scripts/generate-fixtures.py', 'png': png},
        'copier': {'path': str(Path(__file__).resolve()), 'sha256': sha256(Path(__file__).read_bytes()).hexdigest()},
        'directory': str(TARGET), 'files': files,
        'limits': ['Files only; not imported into app or database.', 'No UI/media playback/capability/descriptor acceptance established.',
                   'Identical known valid PNG bytes with distinct disposable filenames; no user media read.'],
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST.open('x', encoding='utf8') as output:
        json.dump(receipt, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(json.dumps({'fileCount': 65, 'directory': str(TARGET), 'manifest': str(MANIFEST), 'sha256': digest}))


if __name__ == '__main__':
    main()
