"""Record exact serial gate commands, results and immutable log hashes."""
from pathlib import Path
import datetime, hashlib, json, os, subprocess, sys
root = Path.cwd()
name, *command = sys.argv[1:]
log = root / '.trellis/tasks/10-08-src-remediation-d/tools/d05' / (name + '.log')
start = datetime.datetime.now().astimezone().isoformat()
with log.open('w') as output:
    result = subprocess.run(command, cwd=root, stdout=output, stderr=subprocess.STDOUT)
record = {'name': name, 'command': command, 'cwd': str(root), 'startedAt': start, 'finishedAt': datetime.datetime.now().astimezone().isoformat(), 'exitCode': result.returncode, 'log': str(log.relative_to(root)), 'logSha256': hashlib.sha256(log.read_bytes()).hexdigest(), 'environment': {key: os.environ[key] for key in ['C01_PLAYWRIGHT_PATH', 'C01_CHROMIUM_PATH'] if key in os.environ}}
records = root / '.trellis/tasks/10-08-src-remediation-d/reviews/D05-gates.json'
data = json.loads(records.read_text()) if records.exists() else []
data.append(record)
records.write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps(record, indent=2))
sys.exit(result.returncode)
