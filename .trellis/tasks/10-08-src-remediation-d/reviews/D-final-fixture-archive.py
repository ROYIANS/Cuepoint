from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import tempfile
import time

host = Path.cwd()
review = host / '.trellis/tasks/10-08-src-remediation-d/reviews'
isolated = Path(tempfile.mkdtemp(prefix='aifenjing-d-final-fixture-archive-'))
tests = ['tests/d05SchemaEquivalence.test.ts', 'tests/d06Capabilities.test.ts', 'tests/d07RequestWire.test.ts', 'tests/memoryRetrieval.test.ts', 'tests/d05ToolCatalog.test.ts']
copy_files = ['package.json', 'vitest.config.ts', 'tests/setup.ts', 'tests/fixtures/d05/catalog.json', 'vendor/lobehub/manifest.json', *tests]
copy_trees = ['src', 'tests/fixtures/sourceSnapshots']
for relative in copy_trees:
    shutil.copytree(host / relative, isolated / relative)
for relative in copy_files:
    destination = isolated / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(host / relative, destination)
(isolated / 'node_modules').symlink_to(host / 'node_modules', target_is_directory=True)
assert not (isolated / '.trellis').exists()
assert sorted(str(p.relative_to(isolated)) for p in isolated.iterdir() if p.is_symlink()) == ['node_modules']

def hashfile(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

# This is the exact isolated subprocess input, not a freeze claim about the concurrent host writer.
inputs = {str(file.relative_to(isolated)): hashfile(file) for relative in copy_trees for file in sorted((isolated / relative).rglob('*')) if file.is_file()}
inputs.update({relative: hashfile(isolated / relative) for relative in copy_files})
command = ['/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm', 'test', *tests, '--maxWorkers', '4']
started = time.time()
log = review / 'D-final-fixture-archive-focused.log'
exit_code = None
timed_out = False
with log.open('w') as output:
    try:
        result = subprocess.run(command, cwd=isolated, stdout=output, stderr=subprocess.STDOUT, timeout=180)
        exit_code = result.returncode
    except subprocess.TimeoutExpired:
        timed_out = True
no_trellis_after = not (isolated / '.trellis').exists()
input_mutations = [relative for relative, expected in inputs.items() if not (isolated / relative).is_file() or hashfile(isolated / relative) != expected]
proof = {
    'status': 'PASS' if exit_code == 0 and no_trellis_after and not input_mutations else 'FAIL',
    'command': command,
    'cwd': str(isolated),
    'exitCode': exit_code,
    'timeoutSeconds': 180,
    'timedOut': timed_out,
    'elapsedSeconds': round(time.time() - started, 3),
    'noTrellisBefore': True,
    'noTrellisAfter': no_trellis_after,
    'activeTaskNeverHiddenOrRenamed': True,
    'onlyLinkedRoot': 'node_modules',
    'nodeModulesTarget': str(host / 'node_modules'),
    'copiedRoots': copy_trees,
    'copiedFiles': copy_files,
    'sourceInputProof': {
        'kind': 'isolated-copy-bytes-used-by-subprocess',
        'hostGlobalFreezeClaimed': False,
        'D08CorrectionAttributionClaimed': False,
        'sha256': inputs,
        'inputMutationsAfterRun': input_mutations,
    },
    'log': str(log.relative_to(host)),
    'logSha256': hashfile(log),
    'preserveFailedTemporaryRoot': True,
    'cleanupSuccessfulTemporaryRoot': False,
}
(review / 'D-final-fixture-archive-result.json').write_text(json.dumps(proof, indent=2) + '\n')
print(json.dumps({key: value for key, value in proof.items() if key != 'sourceInputProof'}, indent=2))
print(log.read_text()[-2500:])
raise SystemExit(0 if proof['status'] == 'PASS' else 1)
