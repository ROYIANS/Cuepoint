"""Run the batch integration gate; preserve pre-build generated formatting if tokens match."""
from pathlib import Path
import subprocess, json, time, hashlib, tempfile, sys

root = Path.cwd()
out = Path(__file__).resolve().parents[1] / 'reviews' / 'integration'
out.mkdir(parents=True, exist_ok=True)
pnpm = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
node = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
route = root / 'src/routeTree.gen.ts'
route_before = route.read_bytes()
def source_hashes():
    paths = [path for folder in ('src', 'tests')
             for path in (root / folder).rglob('*') if path.is_file()]
    paths += [root / 'scripts' / (unit + '-browser-regression.mjs')
              for unit in ('b01', 'b07', 'c01', 'c02')]
    return {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(paths)}
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
    ('tests', [pnpm, 'test', '--reporter=dot']),
    ('b01-browser', [node, 'scripts/b01-browser-regression.mjs']),
    ('b07-browser', [node, 'scripts/b07-browser-regression.mjs']),
    ('c01-browser', [node, 'scripts/c01-browser-regression.mjs']),
    ('c02-browser', [node, 'scripts/c02-browser-regression.mjs']),
    ('models', [pnpm, 'model-bank:verify']),
    ('build', [pnpm, 'build']),
]
if [row['name'] for row in results] != [name for name, _ in commands[:len(results)]]:
    raise SystemExit('Resume commands are not a valid successful prefix')
for name, command in commands[len(results):]:
    started = time.monotonic()
    with (out / (name + '-stdout.txt')).open('w') as stdout, (out / (name + '-stderr.txt')).open('w') as stderr:
        run = subprocess.run(command, cwd=root, stdout=stdout, stderr=stderr)
    result = {'name': name, 'command': command, 'exit': run.returncode, 'seconds': round(time.monotonic()-started, 2)}
    results.append(result)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    (out / 'commands.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    if run.returncode:
        raise SystemExit(run.returncode)
route_after = route.read_bytes()
generated = {'changed': route_after != route_before, 'beforeSha256': hashlib.sha256(route_before).hexdigest(), 'buildSha256': hashlib.sha256(route_after).hexdigest(), 'formatRestored': False}
if generated['changed']:
    with tempfile.TemporaryDirectory(prefix='c-batch-route-') as temp:
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
check = subprocess.run(['git', 'diff', '--check'], cwd=root, capture_output=True, text=True)
(out / 'diffcheck.txt').write_text(check.stdout + check.stderr)
raise SystemExit(check.returncode)
