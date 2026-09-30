"""Check every changed B source/test/fixture has matching latest-unit review evidence."""
from pathlib import Path
import hashlib, json, subprocess

root = Path.cwd()
task = Path(__file__).resolve().parents[1]
reviewed = {}
units = []
for unit in ('B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07'):
    path = task / 'reviews' / f'{unit}-check-snapshot.json'
    if not path.exists():
        path = task / 'reviews' / f'{unit}-check-coverage.json'
    if not path.exists():
        continue
    snapshot = json.loads(path.read_text())
    mapping = snapshot.get('after', snapshot.get('sha256', {}))
    if not mapping:
        mapping = {item['path']: item['sha256'] for item in snapshot.get('files', [])}
    for name, digest in mapping.items():
        if isinstance(digest, str):
            reviewed[name] = {'unit': unit, 'sha256': digest}
    units.append(unit)

final_path = task / 'reviews' / 'B-final-check-snapshot.json'
if final_path.exists():
    final_snapshot = json.loads(final_path.read_text())
    for name, update in final_snapshot.get('unitUpdates', {}).items():
        if update['unit'] not in units or name not in reviewed:
            raise SystemExit('Final attribution lacks original unit review: ' + name)
        reviewed[name] = {'unit': update['unit'], 'sha256': update['sha256'],
                          'authority': 'B-final-check attributed update'}

tracked = subprocess.check_output(['git', 'diff', '--name-only', '-z'], text=True).split('\0')
new = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '-z'], text=True).split('\0')
files = sorted({name for name in tracked + new if name and (
    name.startswith(('src/', 'tests/')) or name in ('scripts/b01-browser-regression.mjs', 'scripts/b07-browser-regression.mjs'))})
coverage = []
for name in files:
    path = root / name
    digest = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    evidence = reviewed.get(name)
    coverage.append({'path': name, 'sha256': digest, 'review': evidence,
                     'matches': bool(evidence and evidence['sha256'] == digest)})
result = {'completedReviewUnits': units, 'files': coverage,
          'missingOrChanged': [row['path'] for row in coverage if not row['matches']]}
out = task / 'reviews' / 'integration' / 'review-file-coverage.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'reviewUnits': units, 'changedFiles': len(files),
                  'missingOrChanged': result['missingOrChanged']}, ensure_ascii=False, indent=2))
raise SystemExit(1 if result['missingOrChanged'] else 0)
