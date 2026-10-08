"""Compare changed-source quality signals with the committed B baseline, without adding dependencies."""
from pathlib import Path
from collections import Counter
import json, re, subprocess, time
root = Path.cwd()
task = Path(__file__).resolve().parents[1]
audit = root / '.trellis/tasks/09-30-src-quality-architecture-audit/research/tools'
out = task / 'reviews/integration'
out.mkdir(parents=True, exist_ok=True)
historical = json.loads((audit / 'eslint-run.json').read_text())['command']
node, binary = historical[:2]
config = historical[historical.index('--config') + 1]
if not Path(binary).exists() or not Path(config).exists():
    (out / 'eslint-unavailable.txt').write_text('Historical isolated ESLint runtime is unavailable; no dependency installation performed.\n')
    raise SystemExit('Isolated audit runtime unavailable')
tracked = subprocess.check_output(['git', 'diff', 'HEAD', '--name-only', '-z'], text=True).split('\0')
new = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '-z', 'src'], text=True).split('\0')
files = sorted({p for p in tracked+new if p.startswith('src/') and p.endswith(('.ts', '.tsx')) and p != 'src/routeTree.gen.ts'})
result_path = out / 'eslint-results.json'
command = [node, binary] + files + ['--config', config, '--format', 'json', '--output-file', str(result_path)]
started = time.monotonic()
run = subprocess.run(command, cwd=root, capture_output=True, text=True)
(out / 'eslint-run.json').write_text(json.dumps({'command': command, 'exit': run.returncode, 'seconds': round(time.monotonic()-started, 2), 'stderr': run.stderr}, ensure_ascii=False, indent=2)+'\n')
if not result_path.exists():
    raise SystemExit('ESLint did not produce diagnostics')
rows = json.loads(result_path.read_text())
for row in rows:
    row.pop('source', None)
result_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
baseline = {row['filePath']: row for row in json.loads((audit/'eslint-results.json').read_text())}
a_results = root / '.trellis/tasks/09-30-src-remediation-a/reviews/integration/eslint-results.json'
if a_results.exists():
    baseline.update({row['filePath']: row for row in json.loads(a_results.read_text())})
b_results = root / '.trellis/tasks/09-30-src-remediation-b/reviews/integration/eslint-results.json'
if b_results.exists():
    baseline.update({row['filePath']: row for row in json.loads(b_results.read_text())})
def signatures(row):
    return Counter((m['ruleId'], m['severity'], re.sub(r'\bline \d+\b', 'line N', m['message'])) for m in row['messages'])
summary = []
for row in rows:
    previous = baseline.get(row['filePath'], {'messages': []})
    delta = signatures(row)-signatures(previous)
    reduced = signatures(previous)-signatures(row)
    summary.append({'file': str(Path(row['filePath']).relative_to(root)), 'before': len(previous['messages']), 'after': len(row['messages']), 'increased': [{'rule': k[0], 'severity': k[1], 'message': k[2], 'count': v} for k,v in delta.items()], 'reduced': [{'rule': k[0], 'count': v} for k,v in reduced.items()]})
(out/'eslint-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
