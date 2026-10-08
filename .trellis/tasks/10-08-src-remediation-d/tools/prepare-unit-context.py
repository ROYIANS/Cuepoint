"""Activate a prepared D context only for the ledger's current sequential unit."""
from pathlib import Path
import json
import sys

root = Path.cwd()
task = Path(__file__).resolve().parents[1]
unit = sys.argv[1]
units = tuple(f'D{n:02}' for n in range(1, 9))
if unit not in units:
    raise SystemExit('Unsupported unit: ' + unit)
ledger = json.loads((root / '.trellis/tasks/09-30-src-quality-remediation/remediation-ledger.json').read_text())
if ledger['currentUnit'] != unit:
    raise SystemExit('Not current ledger unit: ' + str(ledger['currentUnit']))
entries = [json.loads(line) for line in (task / 'research' / f'{unit}-context.jsonl').read_text().splitlines() if line.strip()]
for entry in entries:
    if not (root / entry['file']).is_file():
        raise SystemExit('Missing context file: ' + entry['file'])
for previous in units[:units.index(unit)]:
    snapshot = task / 'reviews' / f'{previous}-check-snapshot.json'
    report = task / 'reviews' / f'{previous}-check.md'
    if not snapshot.is_file() or not report.is_file() or json.loads(snapshot.read_text()).get('status') != 'PASS':
        raise SystemExit('Missing accepted predecessor: ' + previous)
    entries.append({'file': str(report.relative_to(root)),
                    'reason': 'Accepted ' + previous + ' concrete ownership/behavior; reread current overlapping source before editing'})
seen = set()
unique = []
for entry in entries:
    if entry['file'] not in seen:
        unique.append(entry)
        seen.add(entry['file'])
text = ''.join(json.dumps(entry, ensure_ascii=False) + '\n' for entry in unique)
for action in ('implement', 'check'):
    (task / (action + '.jsonl')).write_text(text)
print(json.dumps({'currentUnit': unit, 'contextEntries': len(unique)}, ensure_ascii=False))
