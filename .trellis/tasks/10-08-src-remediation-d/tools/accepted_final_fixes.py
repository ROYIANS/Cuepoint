"""Validate optional independent final-fix acceptance without rewriting unit evidence."""
from pathlib import Path
import hashlib
import json


def read_final_fixes(task, root, latest_hashes, allowed_units):
    path = task / 'reviews/D-final-fixes-check-snapshot.json'
    if not path.exists():
        return {}
    snapshot = json.loads(path.read_text())
    if not snapshot.get('evidenceHashes') or not snapshot.get('focusedChecks'):
        raise SystemExit('Final-fix acceptance needs actual focused checks and evidence hashes')
    if any(check.get('exitCode') != 0 for check in snapshot['focusedChecks']):
        raise SystemExit('Final-fix focused verification incomplete/failed')
    after = snapshot.get('after', {})
    before = snapshot.get('before', {})
    attribution = snapshot.get('unitAttribution', {})
    if snapshot.get('status') != 'PASS' or not after or set(after) != set(before) or set(after) != set(attribution):
        raise SystemExit('Invalid independent final-fix acceptance')
    runner_prefix = tuple(str((task / folder).relative_to(root)) + '/' for folder in ('reviews', 'research'))
    updates = {}
    for name, digest in after.items():
        product = name.startswith(('src/', 'tests/', 'scripts/')) or (name.startswith(runner_prefix) and name.endswith('.mjs'))
        if not product or '..' in Path(name).parts or attribution[name] not in allowed_units:
            raise SystemExit('Invalid final-fix product attribution: ' + name)
        if latest_hashes.get(name) != before[name]:
            raise SystemExit('Final-fix before differs from latest accepted unit: ' + name)
        current = root / name
        actual = hashlib.sha256(current.read_bytes()).hexdigest() if current.is_file() else None
        if actual != digest:
            raise SystemExit('Final-fix source changed after focused acceptance: ' + name)
        updates[name] = {'unit': attribution[name], 'sha256': digest}
    for name, digest in snapshot.get('evidenceHashes', {}).items():
        current = root / name
        actual = hashlib.sha256(current.read_bytes()).hexdigest() if current.is_file() else None
        if actual != digest:
            raise SystemExit('Final-fix evidence changed: ' + name)
    return updates
