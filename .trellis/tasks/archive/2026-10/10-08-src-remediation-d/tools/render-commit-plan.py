"""Render the reviewed whole-D scope into explicit disjoint groups; never stage/commit."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path.cwd()
task = Path(__file__).resolve().parents[1]
units = tuple(f'D{n:02}' for n in range(1, 9))

def digest(name):
    path = root / name
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

latest = {}
for unit in units:
    path = task / 'reviews' / f'{unit}-check-snapshot.json'
    if not path.is_file():
        raise SystemExit('Missing independent unit review: ' + unit)
    snapshot = json.loads(path.read_text())
    if snapshot.get('status') != 'PASS':
        raise SystemExit('Unaccepted unit review: ' + unit)
    for name, value in snapshot['after'].items():
        latest[name] = {'unit': unit, 'sha256': value}

final = json.loads((task / 'reviews/D-final-check-snapshot.json').read_text())
if final.get('status') != 'PASS':
    raise SystemExit('Whole-D independent PASS required')
for name, update in final.get('unitUpdates', {}).items():
    if update['unit'] not in units or final['after'].get(name) != update['sha256']:
        raise SystemExit('Invalid final attribution: ' + name)
    latest[name] = {'unit': update['unit'], 'sha256': update['sha256']}
for name, value in final['after'].items():
    if digest(name) != value or latest.get(name, {}).get('sha256') != value:
        raise SystemExit('Product hash differs from accepted review: ' + name)
for name, value in final.get('evidenceHashes', {}).items():
    if digest(name) != value:
        raise SystemExit('Evidence changed after final review: ' + name)

dirty = set()
for args in (['git', 'diff', 'HEAD', '--name-only', '-z'],
             ['git', 'ls-files', '--others', '--exclude-standard', '-z']):
    dirty.update(name for name in subprocess.check_output(args, text=True).split('\0') if name)
runners_prefix = tuple(str((task / folder).relative_to(root)) + '/' for folder in ('reviews', 'research'))
product = {name for name in dirty if name.startswith(('src/', 'tests/', 'scripts/'))
           or (name.startswith(runners_prefix) and name.endswith('.mjs'))}
if set(final['after']) != product:
    raise SystemExit('Whole-D review scope differs from dirty product/native scope: '
                     + json.dumps(sorted(set(final['after']) ^ product)))

# Coordinator supplies concrete coherent grouping AFTER full review; this script cannot
# guess dependencies between overlapping unit edits or silently stage unknown files.
groups = json.loads((task / 'commit-groups.json').read_text())
dirty.update(str((task / name).relative_to(root))
             for name in ('commit-plan.json', 'commit-plan.md'))
assigned = set()
commits = []
for group in groups:
    files = set(group['files'])
    if assigned & files or files - dirty or not group['message'].strip():
        raise SystemExit('Invalid/overlapping commit group: ' + group['message'])
    assigned.update(files)
    commits.append({'message': group['message'], 'files': sorted(files)})
# Historical/current verification runners are evidence, and land with the explicit
# final record batch. Application source/tests/scripts must be grouped explicitly.
record_runners = {name for name in product if name.startswith(runners_prefix) and name.endswith('.mjs')}
if product - assigned - record_runners:
    raise SystemExit('Reviewed application product omitted from grouping: '
                     + json.dumps(sorted(product - assigned - record_runners)))
remaining = dirty - assigned
allowed = (str(task.relative_to(root)) + '/',
           '.trellis/tasks/09-30-src-quality-remediation/')
unknown = sorted(name for name in remaining if not name.startswith(allowed))
commits.append({'message': 'chore: 记录源码整改D验证与后续关口',
                'files': sorted(remaining - set(unknown))})
plan = {'status': 'awaiting-concrete-user-confirmation',
        'baseRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
        'commits': commits, 'unrecognizedDirtyFiles': unknown,
        'reviewedFiles': {name: latest[name] for name in sorted(product)},
        'finalReview': str((task / 'reviews/D-final-check.md').relative_to(root)),
        'approval': None}
(task / 'commit-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
lines = ['# D concrete commit plan', '',
         'No stage/commit/push by this tool. One human approval is required for this complete plan.', '']
for index, commit in enumerate(commits, 1):
    lines.extend([f'{index}. {commit["message"]}', '', f'{len(commit["files"])} files:', ''])
    lines.extend('- ' + name for name in commit['files'])
    lines.append('')
lines.extend(['Unrecognized dirty files (excluded):', ''])
lines.extend('- ' + name for name in unknown)
(task / 'commit-plan.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({'commits': [{'message': c['message'], 'files': len(c['files'])}
                             for c in commits], 'unknown': unknown}, ensure_ascii=False))
