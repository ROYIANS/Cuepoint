"""Read-only receipt for the fresh, synthetic normal acceptance workspace only."""
import datetime, hashlib, json, pathlib, sqlite3, sys
repo = pathlib.Path(__file__).resolve().parents[5]
root = pathlib.Path.home() / 'Library/Application Support/dev.cuepoint.prototype.offline/product-workspace-v1'
con = sqlite3.connect((root / '.local/state.sqlite').as_uri() + '?mode=ro', uri=True)

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def decode(node):
    tag = node[0]
    if tag == 'obj': return {k: decode(v) for k, v in node[1]}
    if tag == 'arr': return [decode(v) for v in node[1]]
    if tag == 'undef': return '<undefined>'
    if tag == 'null': return None
    return node[1]

rows = con.execute('select table_name,row_key,payload,revision from product_records order by table_name,row_key').fetchall()
counts = dict(con.execute('select table_name,count(*) from product_records group by table_name'))
# Connector values are deliberately excluded; only their payload hash participates in unchanged checks.
selected = {}
for table, _, payload, _ in rows:
    if table in ('projects', 'episodes', 'musicDrafts', 'agentToolCalls', 'agentRuns', 'materialUses'):
        selected.setdefault(table, []).append(decode(json.loads(payload)))
binaries = []
for bid, size, mime, digest in con.execute('select binary_id,byte_length,mime_type,content_hash from product_binaries order by binary_id'):
    path = root / 'assets' / ('id-' + bid.encode().hex())
    actual_size = path.stat().st_size
    actual_hash = sha(path)
    binaries.append(dict(binaryId=bid, byteLength=size, mimeType=mime, contentHash=digest,
                         actualBytes=actual_size, actualSha256=actual_hash, matches=actual_size == size and actual_hash == digest))
export = repo / 'desktop/tauri/.acceptance/shared-storage-host-01/exports/normal-sqlite-image.png'
source = repo / 'desktop/tauri/.acceptance/shared-storage-host-01/import/image.png'
fixture = repo / '.trellis/tasks/10-11-shared-storage-sqlite/research/packaged-agent-fixture-01/fixture-events.json'
events = json.loads(fixture.read_text())
receipt = dict(at=datetime.datetime.now().astimezone().isoformat(), workspace=str(root),
    ready=json.loads((root/'workspace.ready.json').read_text()), tableCounts=counts,
    rowPayloadHashes=[dict(table=t,key=k,sha256=hashlib.sha256(v.encode()).hexdigest(),revision=r) for t,k,v,r in rows],
    selectedSyntheticRows=selected, managedBinaries=binaries, allManagedBytesMatch=all(x['matches'] for x in binaries),
    systemSave=dict(path=str(export),bytes=export.stat().st_size,sha256=sha(export),matchesKnownSource=sha(export)==sha(source)),
    fixtureEvents=events, credentialValuesIncluded=False, appDataWritesByCapture=False)
out = pathlib.Path(sys.argv[1])
out.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(output=str(out),rows=len(rows),tables=len(counts),binaries=len(binaries),allManagedBytesMatch=receipt['allManagedBytesMatch'],systemSave=receipt['systemSave']),ensure_ascii=False))
