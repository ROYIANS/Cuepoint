"""Read-only tracked + all untracked root source/test/script whitespace validation."""
from pathlib import Path
import argparse
import concurrent.futures
import hashlib
import json
import subprocess

root = Path.cwd()
task = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
tracked = subprocess.run(['git', 'diff', '--check'], cwd=root, capture_output=True, text=True)
tracked_text = tracked.stdout + tracked.stderr
names = [name for name in subprocess.check_output(
    ['git', 'ls-files', '--others', '--exclude-standard', '-z'], cwd=root,
    text=True).split('\0') if name.startswith(('src/', 'tests/', 'scripts/'))]

def inspect(name):
    run = subprocess.run(['git', 'diff', '--no-index', '--check', '--', '/dev/null', name],
                         cwd=root, capture_output=True, text=True)
    diagnostics = (run.stdout + run.stderr).strip()
    return {'path': name, 'sha256': hashlib.sha256((root / name).read_bytes()).hexdigest(),
            'exitCode': run.returncode, 'diagnostics': diagnostics,
            'pass': run.returncode in (0, 1) and not diagnostics}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    rows = list(pool.map(inspect, sorted(names)))
passed = tracked.returncode == 0 and not tracked_text.strip() and all(row['pass'] for row in rows)
result = {'status': 'PASS' if passed else 'FAIL',
          'scope': 'All tracked dirty paths plus every untracked root src/tests/scripts file; original task evidence is not production source.',
          'trackedCommand': ['git', 'diff', '--check'], 'trackedExitCode': tracked.returncode,
          'trackedDiagnostics': tracked_text, 'untrackedFiles': rows,
          'note': 'Diff-exists exit 1 is permitted only with no check diagnostic; git check-error exits (e.g.3) fail.'}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
(args.output.parent / 'diffcheck.txt').write_text(tracked_text)
print(json.dumps({'whitespace': result['status'], 'untrackedFiles': len(rows),
                  'untrackedFailures': [row['path'] for row in rows if not row['pass']]}, ensure_ascii=False))
raise SystemExit(0 if passed else 1)
