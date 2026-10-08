from pathlib import Path
import datetime, hashlib, json, subprocess
root = Path.cwd()
task = Path('.trellis/tasks/10-08-src-remediation-d')
entry_path = task / 'tools/d05/entry.json'
entry = json.loads(entry_path.read_text())
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
inputs = {str(path): digest(path) for base in ['src', 'tests', 'scripts'] for path in Path(base).rglob('*') if path.is_file()}
for name in ['tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json', 'vitest.config.ts', 'package.json', 'pnpm-lock.yaml']:
    inputs[name] = digest(Path(name))
owned = [path for path in (task / 'tools/d05').rglob('*') if path.is_file()]
owned += [path for path in (task / 'reviews').glob('D05-*') if path.is_file() and path.name not in ['D05-product-freeze.json', 'D05-spec-draft.md', 'D05-implement-snapshot.json']]
inputs.update({str(path): digest(path) for path in owned})
changes = {}
for path in sorted(set(inputs) | {path for path in entry['before'] if path.startswith(('src/', 'tests/', 'scripts/'))}):
    before, after = entry['before'].get(path), inputs.get(path)
    if before != after and path.startswith(('src/', 'tests/', 'scripts/')):
        changes[path] = {'before': before, 'after': after}
for path in (task / 'tools/d05/before').rglob('*'):
    if path.is_file():
        original = str(path.relative_to(task / 'tools/d05/before'))
        assert digest(path) == entry['before'][original], original
out = {'status': 'PRODUCTFROZEN', 'capturedAt': datetime.datetime.now().astimezone().isoformat(), 'baselineProductRevision': 'f062d694e61da6bcb574f7fb548803b9e54197eb', 'entryHead': entry['head'], 'entrySnapshot': str(entry_path), 'entrySnapshotSha256': digest(entry_path), 'currentStatus': subprocess.check_output(['git', 'status', '--short'], text=True), 'changes': changes, 'frozenInputs': inputs, 'ownedEvidence': {str(path): {'before': entry['before'].get(str(path)), 'after': digest(path)} for path in owned}, 'selfHashPolicy': 'This freeze file is excluded from its own inputs; the implementation snapshot records its exact hash.'}
out_path = task / 'reviews/D05-product-freeze.json'
out_path.write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({'freeze': str(out_path), 'sha256': digest(out_path), 'changedSourceTestScriptPaths': len(changes), 'frozenInputs': len(inputs), 'ownedEvidence': len(owned)}, indent=2))
