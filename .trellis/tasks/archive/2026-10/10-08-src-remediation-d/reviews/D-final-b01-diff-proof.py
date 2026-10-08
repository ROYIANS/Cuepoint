from pathlib import Path
import hashlib, json, re, subprocess

ROOT = Path(__file__).resolve().parents[4]
REVIEWS = Path(__file__).resolve().parent
SCRIPT = ROOT / 'scripts/b01-browser-regression.mjs'
NODE = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

before = (REVIEWS / 'D-final-b01-before.txt').read_text()
after = SCRIPT.read_text()
entry = json.loads((REVIEWS / 'D-final-b01-entry.json').read_text())
d02 = json.loads((REVIEWS / 'D02-check-snapshot.json').read_text())
assert d02['status'] == 'PASS'
assert sha(REVIEWS / 'D-final-b01-before.txt') == entry['before'] == d02['after']['scripts/b01-browser-regression.mjs']
assert sha(SCRIPT) == entry['after']
old_server = next(line for line in before.splitlines(True) if line.startswith('const server = await createServer('))
new_server = old_server.replace('createServer({configFile:', 'createServer({cacheDir: cacheDirectory, optimizeDeps: {entries: [fileURLToPath(new URL("../tests/fixtures/b01/index.html", import.meta.url))]}, configFile:')
changes = [
    ('import {writeFile, mkdtemp} from "node:fs/promises";', 'import {writeFile, mkdtemp, rm} from "node:fs/promises";'),
    (old_server, 'const cacheDirectory = await mkdtemp(join(tmpdir(), "b01-vite-cache-"));\n' + new_server),
    ('    const errors = [];\n', '    const errors = [];\n    const documentRequests = [];\n    page.on("request", request => {\n        if (request.resourceType() === "document" && request.frame() === page.mainFrame()) documentRequests.push(request.url());\n    });\n'),
    ('            await run(); assert.equal(errors.length, 0, errors.join("\\n"));\n', '            await run(); assert.equal(errors.length, 0, errors.join("\\n"));\n            assert.equal(documentRequests.length, 1, `Unexpected full-document navigation: ${documentRequests.join(" -> ")}`);\n'),
    ('    await server.close();\n', '    await server.close();\n    await rm(cacheDirectory, {recursive: true, force: true});\n'),
]
reconstructed = after
for old, new in reversed(changes):
    assert reconstructed.count(new) == 1
    reconstructed = reconstructed.replace(new, old, 1)
assert reconstructed == before, 'Unexpected change outside the five allowed additive harness regions'
body_start = '    const click = text =>'
body_end = '    console.log(`B01 browser regressions:'
assert before[before.index(body_start):before.index(body_end)] == after[after.index(body_start):after.index(body_end)]
assert re.findall(r'^.*(?:Timeout|timeout).*$' , before, re.M) == re.findall(r'^.*(?:Timeout|timeout).*$' , after, re.M)
assert after.index('page.on("request"') < after.index('await page.goto(url)')
assert after.index('await run(); assert.equal(errors.length') < after.index('assert.equal(documentRequests.length, 1') < after.index('passed++;')
assert after.index('await browser?.close();') < after.index('await server.close();') < after.index('await rm(cacheDirectory')
assert 'const documentRequests = [];' in after and after.count('await page.goto(') == 1
assert before.count('assert.') + 1 == after.count('assert.')
fixture = ROOT / 'tests/fixtures/b01/index.html'
assert 'src="/tests/fixtures/b01/harness.tsx"' in fixture.read_text()
assert (ROOT / 'tests/fixtures/b01/harness.tsx').is_file()
node_code = '''import {createRequire} from "node:module";
import {resolve} from "node:path";
import {realpathSync} from "node:fs";
const require = createRequire(realpathSync(resolve("node_modules/vite/package.json")));
const {glob} = require("tinyglobby");
const fixture = resolve("tests/fixtures/b01/index.html");
const entries = await glob([fixture], {absolute: true, cwd: process.cwd(), ignore: ["**/dist/**", "**/node_modules/**"]});
if (entries.length !== 1 || entries[0] !== fixture) throw new Error(JSON.stringify(entries));
console.log(JSON.stringify({vite: require("./package.json").version, tinyglobby: require.resolve("tinyglobby"), entries}));'''
glob_result = subprocess.run([NODE, '--input-type=module', '-e', node_code], cwd=ROOT, text=True, capture_output=True)
assert glob_result.returncode == 0, glob_result.stderr
syntax = subprocess.run([NODE, '--check', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True)
assert syntax.returncode == 0, syntax.stderr
results = json.loads((REVIEWS / 'D-final-b01-cold-results.json').read_text())
assert len(results) == 2
cold = []
for result in results:
    assert result['exitCode'] == 0 and result['command'] == [NODE, 'scripts/b01-browser-regression.mjs']
    log = ROOT / result['log']
    text = log.read_text()
    assert len(re.findall(r'^PASS ', text, re.M)) == 19
    assert text.rstrip().endswith('B01 browser regressions: 19 passed')
    cache = Path(re.search(r'(/[^\s]+/b01-vite-cache-[^/]+)', text).group(1))
    assert not cache.exists()
    cold.append({'name': result['name'], 'exitCode': result['exitCode'], 'passed': 19, 'cacheDirectory': str(cache), 'cacheRemovedAtReview': True, 'log': result['log']})
assert cold[0]['cacheDirectory'] != cold[1]['cacheDirectory']
proof = {'status': 'PASS', 'exitCode': 0, 'scope': ['scripts/b01-browser-regression.mjs'], 'before': entry['before'], 'after': entry['after'], 'latestAcceptedOwner': 'D02', 'exactAcceptedD02AfterMatchesBefore': True, 'inverseFiveHarnessChangesRestoresBeforeByteForByte': True, 'entireBusinessControlBodyByteEqual': True, 'allExistingAssertionsAndTimeoutsRetained': True, 'additionalAssertions': 1, 'documentAssertionAppliesToEveryExistingScenarioViaSharedTestWrapper': True, 'listenerInstalledBeforeOnlyGoto': True, 'documentCountNeverReset': True, 'mainFrameDocumentFilter': True, 'noBootstrapRetryOrReloadSuppressionOrTimeoutIncrease': True, 'syntaxCheckExitCode': syntax.returncode, 'installedGlobCheckExitCode': glob_result.returncode, 'installedGlobProof': json.loads(glob_result.stdout), 'coldRuns': cold}
(REVIEWS / 'D-final-b01-diff-proof.json').write_text(json.dumps(proof, indent=2) + '\n')
print(json.dumps(proof, indent=2))
