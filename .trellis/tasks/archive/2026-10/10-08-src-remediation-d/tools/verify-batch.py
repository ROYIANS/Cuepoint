"""Run the batch integration gate; preserve pre-build generated formatting if tokens match."""
from pathlib import Path
import subprocess, json, time, hashlib, tempfile, sys, os

from accepted_final_fixes import read_final_fixes

root = Path.cwd()
out = Path(__file__).resolve().parents[1] / 'reviews' / 'integration'
out.mkdir(parents=True, exist_ok=True)
task = Path(__file__).resolve().parents[1]
latest = {}
for unit in (f'D{number:02}' for number in range(1, 9)):
    review_path = task / 'reviews' / (unit + '-check-snapshot.json')
    if not review_path.is_file():
        raise SystemExit('Whole gate requires all eight accepted unit reviews: ' + unit)
    review = json.loads(review_path.read_text())
    if review.get('status') != 'PASS':
        raise SystemExit('Unaccepted unit: ' + unit)
    latest.update(review['after'])
latest.update({name:value['sha256'] for name,value in read_final_fixes(task,root,latest,tuple(f'D{number:02}' for number in range(1,9))).items()})
for name, expected in latest.items():
    path = root / name
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    if actual != expected:
        raise SystemExit('Source changed since unit acceptance: ' + name)
pnpm = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
node = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
native_plan_path = Path(__file__).resolve().parents[1] / 'reviews/native-gate-plan.json'
extra_native = json.loads(native_plan_path.read_text())
reserved_names = {'typecheck', 'tests', 'b01-browser', 'b07-browser', 'c01-browser', 'c02-browser', 'models', 'build'}
if any(row['name'] in reserved_names for row in extra_native) or len({row['name'] for row in extra_native}) != len(extra_native):
    raise SystemExit('Duplicate native gate name')
environment = dict(os.environ)
for name, value in environment.items():
    if value and ('_BASELINE_' in name or name.endswith('_BASELINE_ROOT')):
        raise SystemExit('Actual-source gate cannot use baseline override: ' + name)
for prefix in ('B01', 'B07', 'C01', 'C02', 'D08'):
    environment.setdefault(prefix + '_PLAYWRIGHT_PATH', '/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')
    environment.setdefault(prefix + '_CHROMIUM_PATH', '/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell')
environment['PATH'] = str(Path(node).parent) + os.pathsep + environment.get('PATH', '')
(out / 'environment.json').write_text(json.dumps({
    'node': node, 'pnpm': pnpm,
    'browserPaths': {name: environment[name] for name in environment
                     if name in {prefix + suffix for prefix in ('B01', 'B07', 'C01', 'C02', 'D08')
                                 for suffix in ('_PLAYWRIGHT_PATH', '_CHROMIUM_PATH')}},
    'baselineOverrides': False,
}, indent=2) + '\n')
for row in extra_native:
    path = root / row['path']
    if not path.is_file() or not row['path'].endswith('.mjs') or '..' in Path(row['path']).parts or row['path'] not in latest:
        raise SystemExit('Invalid native gate runner: ' + row['path'])
    for key, value in row.get('environment', {}).items():
        output_path = Path(value) if isinstance(value, str) else None
        if not key.endswith(('_REPORT_PATH', '_OUTPUT_PATH')) or '_BASELINE_' in key or output_path is None or output_path.is_absolute() or '..' in output_path.parts or not str(output_path).startswith(str(out.relative_to(root)) + '/'):
            raise SystemExit('Invalid integration report output override: ' + key)
route = root / 'src/routeTree.gen.ts'
route_before = route.read_bytes()
def source_hashes():
    paths = [path for folder in ('src', 'tests', 'scripts')
             for path in (root / folder).rglob('*') if path.is_file()]
    paths += list((native_plan_path.parent).rglob('*.mjs'))
    paths += list((task / 'research').rglob('*.mjs'))
    paths += [root / row['path'] for row in extra_native]
    paths += [native_plan_path]
    paths += [root / name for name in ('package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'vitest.config.ts')]
    paths += [path for path in (task / 'tools').rglob('*')
              if path.is_file() and path.suffix in ('.py', '.cjs', '.mjs')]
    paths = sorted(set(paths))
    return {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(paths)}
preflight = subprocess.run([sys.executable, str(task / 'tools/check-whitespace.py'), '--output', str(out / 'pre-whitespace.json')], cwd=root)
if preflight.returncode: raise SystemExit(preflight.returncode)
pre_hashes = source_hashes()
results = []
if '--resume' in sys.argv:
    saved = json.loads((out / 'pre-gate-source-hashes.json').read_text())
    if saved != pre_hashes: raise SystemExit('Cannot resume: source/test/script changed')
    previous = json.loads((out / 'commands.json').read_text())
    (out / 'first-attempt-commands.json').write_text(json.dumps(previous, indent=2)+'\n')
    for row in previous:
        if row['exit']: break
        results.append(row)
    for row in previous[len(results):]:
        for suffix in ('stdout', 'stderr'):
            path = out / (row['name'] + '-' + suffix + '.txt')
            if path.exists(): (out / ('first-attempt-' + path.name)).write_bytes(path.read_bytes())
else:
    (out / 'pre-gate-source-hashes.json').write_text(json.dumps(pre_hashes, indent=2) + '\n')
commands = [
    ('typecheck', [pnpm, 'lint']),
    ('tests', [pnpm, 'test', '--reporter=dot', '--maxWorkers', '4']),
    ('b01-browser', [node, 'scripts/b01-browser-regression.mjs']),
    ('b07-browser', [node, 'scripts/b07-browser-regression.mjs']),
    ('c01-browser', [node, 'scripts/c01-browser-regression.mjs']),
    ('c02-browser', [node, 'scripts/c02-browser-regression.mjs']),
]
commands += [(row['name'], [node, row['path']]) for row in extra_native]
commands += [('models',[pnpm,'model-bank:verify']),('build',[pnpm,'build'])]
if [row['name'] for row in results] != [name for name, _ in commands[:len(results)]]:
    raise SystemExit('Resume commands are not a valid successful prefix')
for name, command in commands[len(results):]:
    started = time.monotonic()
    with (out / (name + '-stdout.txt')).open('w') as stdout, (out / (name + '-stderr.txt')).open('w') as stderr:
        command_environment = dict(environment)
        runner = next((row for row in extra_native if row['name'] == name), None)
        if runner is not None:
            command_environment.update(runner.get('environment', {}))
        run = subprocess.run(command, cwd=root, stdout=stdout, stderr=stderr, env=command_environment)
    result = {'name': name, 'command': command, 'exit': run.returncode, 'seconds': round(time.monotonic()-started, 2)}
    if runner is not None and runner.get('environment'):
        result['environment'] = runner['environment']
    results.append(result)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    (out / 'commands.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    if run.returncode:
        raise SystemExit(run.returncode)
route_after = route.read_bytes()
generated = {'changed': route_after != route_before, 'beforeSha256': hashlib.sha256(route_before).hexdigest(), 'buildSha256': hashlib.sha256(route_after).hexdigest(), 'formatRestored': False}
if generated['changed']:
    with tempfile.TemporaryDirectory(prefix='d-batch-route-') as temp:
        old = Path(temp) / 'before.ts'
        old.write_bytes(route_before)
        script = """const fs=require('node:fs'),ts=require('typescript');function tokens(p){const s=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,fs.readFileSync(p,'utf8')),r=[];let t;while((t=s.scan())!==ts.SyntaxKind.EndOfFileToken)r.push([t,s.getTokenText()]);return r;}const a=tokens(process.argv[1]),b=tokens(process.argv[2]);const same=JSON.stringify(a)===JSON.stringify(b);console.log(JSON.stringify({same,beforeTokens:a.length,afterTokens:b.length}));process.exit(same?0:1);"""
        compared = subprocess.run([node, '-e', script, str(old), str(route)], cwd=root, capture_output=True, text=True)
        generated['tokenComparison'] = compared.stdout.strip()
        if compared.returncode == 0:
            route.write_bytes(route_before)
            generated['formatRestored'] = True
        else:
            generated['comparisonError'] = compared.stderr
            (out / 'generated-route.json').write_text(json.dumps(generated, ensure_ascii=False, indent=2) + '\n')
            raise SystemExit('Generated route changed semantically: inspect retained result.')
(out / 'generated-route.json').write_text(json.dumps(generated, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(generated, ensure_ascii=False), flush=True)
post_hashes = source_hashes()
(out / 'post-gate-source-hashes.json').write_text(json.dumps(post_hashes, indent=2) + '\n')
if post_hashes != pre_hashes:
    changed = sorted(path for path in pre_hashes.keys() | post_hashes.keys() if pre_hashes.get(path) != post_hashes.get(path))
    (out / 'source-drift.json').write_text(json.dumps(changed, indent=2) + '\n')
    raise SystemExit('Source changed during gate: review drift and rerun affected checks.')
check = subprocess.run([sys.executable, str(task / 'tools/check-whitespace.py'), '--output', str(out / 'final-whitespace.json')], cwd=root)
raise SystemExit(check.returncode)
