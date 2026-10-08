#!/usr/bin/env python3
"""Bounded three-file EOF normalization and independent reproducible proof."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
REVIEW = '.trellis/tasks/10-08-src-remediation-d/reviews'
PREFIX = REVIEW + '/D-final-whitespace-'
EXPECTED = {
    'src/components/shots/ShotRow.tsx': '334bfe329e39a0ddac7deab9f72e0ea14ca9e6ae7b658bed5da211414cdf16e5',
    'src/lib/packages/audioPackageCodec.ts': '6ffb2dec2d936e381b17b00151e96a498938abb732be04442fc8ecb85a2146a9',
    'src/lib/packages/packageError.ts': '7f0bff1911c72887aa98417705bba9ecc62b87d2b21ae5320384001d326c232a',
}
UNITS = {p: 'D08' if p.endswith('ShotRow.tsx') else 'D03' for p in EXPECTED}
PROTECTED = [REVIEW + '/D-final-fixes-check-snapshot.json', REVIEW + '/D-final-fixture-check-snapshot.json']
NODE_PROOF = r'''
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
assert.equal(ts.version, '5.9.3');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function terminals(path, bytes) {
  const text = bytes.toString('utf8');
  assert.ok(Buffer.from(text, 'utf8').equals(bytes), 'Exact UTF-8 round trip');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(source.parseDiagnostics.length, 0, path + ': zero parse diagnostics');
  const tokens = [];
  function walk(node) {
    const children = node.getChildren(source);
    if (!children.length && node.kind <= ts.SyntaxKind.LastToken) tokens.push([node.kind, node.getText(source)]);
    else children.forEach(walk);
  }
  walk(source);
  return tokens;
}
const files = input.map(item => {
  const before = fs.readFileSync(item.beforeCopy), after = fs.readFileSync(item.path);
  assert.equal(sha(before), item.beforeHash);
  assert.ok(after.equals(Buffer.concat([before.subarray(0, before.length - 2), Buffer.from('\n')])), 'Entire bytes differ only by final LF');
  const a = terminals(item.path, before), b = terminals(item.path, after);
  assert.deepEqual(a, b, item.path + ': exact terminal kind/text equality');
  return {path: item.path, typescript: ts.version, scriptKind: item.path.endsWith('.tsx') ? 'TSX' : 'TS',
    beforeParseDiagnostics: 0, afterParseDiagnostics: 0, beforeTokenCount: a.length, afterTokenCount: b.length,
    beforeTokenSha256: sha(JSON.stringify(a)), afterTokenSha256: sha(JSON.stringify(b)),
    exactTerminalKindAndTextEqual: true, terminalSequence: a};
});
console.log(JSON.stringify({status: 'PASS', typescript: ts.version, method: 'Parser getChildren terminal SyntaxKind and exact getText; includes EOF; no typecheck', files}, null, 2));
'''

def digest(data):
    return hashlib.sha256(data).hexdigest()

def filehash(path):
    return digest((ROOT / path).read_bytes())

def save(path, value):
    (ROOT / path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def run(argv, **kwargs):
    return subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, timeout=30, **kwargs)

apply = sys.argv[1:] == ['--apply']
assert apply or not sys.argv[1:], 'Use --apply once or no arguments to verify'
entry_path = PREFIX + 'entry.json'
if apply:
    assert not (ROOT / entry_path).exists(), 'Before evidence already exists; rerun without --apply'
    accepted = {}
    inputs = []
    # Validate all inputs before writing any source file.
    for path, expected in EXPECTED.items():
        data = (ROOT / path).read_bytes()
        assert digest(data) == expected, path + ': accepted latest hash mismatch'
        assert data.endswith(b'\n\n') and not data.endswith(b'\n\n\n'), path
        tracked = run(['git', 'ls-files', '--', path])
        assert tracked.returncode == 0 and tracked.stdout == '' and tracked.stderr == '', path
        owner = UNITS[path]
        accepted_path = REVIEW + '/' + owner + '-check-snapshot.json'
        accepted_doc = json.loads((ROOT / accepted_path).read_text())
        assert accepted_doc['after'][path] == expected, path + ': accepted unit map mismatch'
        accepted[path] = {'unit': owner, 'snapshot': accepted_path, 'snapshotSha256': filehash(accepted_path), 'map': 'after', 'sha256': expected}
        inputs.append({'path': path, 'beforeCopy': PREFIX + 'before/' + path, 'beforeHash': expected})
    protected = {p: filehash(p) for p in PROTECTED}
    for item in inputs:
        dest = ROOT / item['beforeCopy']
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((ROOT / item['path']).read_bytes())
    save(entry_path, {'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'before': EXPECTED,
        'unitAttribution': UNITS, 'acceptedLatest': accepted, 'sourceCopies': inputs, 'protectedHistoricalHashes': protected})
    for item in inputs:
        source = ROOT / item['path']
        data = source.read_bytes()
        assert digest(data) == item['beforeHash'], 'Source changed after capture'
        source.write_bytes(data[:-1])
entry = json.loads((ROOT / entry_path).read_text())
assert entry['before'] == EXPECTED and entry['unitAttribution'] == UNITS
byte_proof = []
for item in entry['sourceCopies']:
    before = (ROOT / item['beforeCopy']).read_bytes()
    after = (ROOT / item['path']).read_bytes()
    assert digest(before) == EXPECTED[item['path']]
    assert before.endswith(b'\n\n') and after == before[:-1]
    assert after.rstrip(b'\n') == before.rstrip(b'\n')
    assert len(after) - len(after.rstrip(b'\n')) == 1
    byte_proof.append({'path': item['path'], 'beforeBytes': len(before), 'afterBytes': len(after), 'removedBytes': 1,
        'removedHex': '0a', 'beforeTrailingLF': 2, 'afterTrailingLF': 1, 'entireBeforeAfterOnlyTrailingNewlineBytes': True,
        'unchangedPrefixSha256': digest(after[:-1])})
semantic = run(['node', '-e', NODE_PROOF], input=json.dumps(entry['sourceCopies']))
(ROOT / (PREFIX + 'token-proof.log')).write_text(semantic.stdout + semantic.stderr)
assert semantic.returncode == 0 and semantic.stderr == '', semantic.stdout + semantic.stderr
proof = json.loads(semantic.stdout)
proof['byteProof'] = byte_proof
save(PREFIX + 'token-proof.json', proof)
whitespace = []
for path in EXPECTED:
    cmd = ['git', 'diff', '--no-index', '--check', '/dev/null', path]
    result = run(cmd)
    assert result.returncode in (0, 1) and result.stdout == '' and result.stderr == '', path + ': ' + result.stdout + result.stderr
    whitespace.append({'path': path, 'command': cmd, 'rawExitCode': result.returncode,
        'exitCode': 0, 'stdout': result.stdout, 'stderr': result.stderr, 'noDiagnostics': True,
        'exitInterpretation': '0/1 without diagnostics succeeds; --no-index 1 denotes file difference'})
save(PREFIX + 'untracked-whitespace.json', {'status': 'PASS', 'exitCode': 0, 'fileChecks': whitespace})
protected_after = {p: filehash(p) for p in PROTECTED}
assert protected_after == entry['protectedHistoricalHashes'], 'Existing fixture/final-fix snapshots changed'
for item in entry['acceptedLatest'].values():
    assert filehash(item['snapshot']) == item['snapshotSha256'], 'Accepted unit snapshot changed'
after = {p: filehash(p) for p in EXPECTED}
checks = [
    {'name': 'Entire byte equality except EOF LF and exact TS5.9.3 parser terminal equality, zero parse diagnostics',
     'command': ['python3', PREFIX + 'proof.py'], 'semanticCommand': ['node', '-e', '<NODE_PROOF embedded verbatim in proof.py>'],
     'exitCode': semantic.returncode, 'log': PREFIX + 'token-proof.log', 'proof': PREFIX + 'token-proof.json'},
    {'name': 'Untracked whitespace for all three source files', 'exitCode': 0,
     'proof': PREFIX + 'untracked-whitespace.json', 'fileChecks': whitespace},
]
report_path = PREFIX + 'check.md'
rows = '\n'.join('| `' + p + '` | ' + UNITS[p] + ' | `' + EXPECTED[p] + '` | `' + after[p] + '` | ' + str(proof['files'][i]['afterTokenCount']) + ' |' for i, p in enumerate(EXPECTED))
report = '''# D final whitespace focused independent self-fix

Status: **PASS**, limited to the three authorized EOF corrections. This does not accept whole D.

Each source matched its latest accepted D08/D03 `after` map and the supplied hash before editing. All three are untracked root product files. Captured before copies are under `D-final-whitespace-before/`. Exactly one final `0a` byte was removed from each file: two final LF bytes became one. Entire byte comparison proves every other byte is unchanged; no literal or style rewrite occurred.

| Source | Latest unit | Before SHA-256 | After SHA-256 | Equal terminal count |
| --- | --- | --- | --- | --- |
''' + rows + '''

TypeScript **5.9.3** parses each before/after pair as TSX/TS with zero parse diagnostics. Parser terminal SyntaxKind and exact text sequences are deeply equal, including EOF. Full terminal sequences, sequence hashes, and byte proofs are in `D-final-whitespace-token-proof.json`.

For each source, `git diff --no-index --check /dev/null <path>` produces no stdout/stderr diagnostics. Raw Git exits are recorded separately from the successful normalized focused check (`exitCode: 0`); `--no-index` may return 1 for file differences. Both semantic-token/byte proof and untracked-whitespace focused checks passed with exitCode 0.

`D-final-whitespace-check-snapshot.json` has identical three-source key sets in `before`, `after`, and `unitAttribution`; ShotRow remains D08 and both package files remain D03. The Python proof helper is a hashed review artifact, with no new `.mjs` product helper. Evidence hashes cover before copies, entry, token proof/log, whitespace results, this report and helper, accepted unit snapshots, and after sources.

Existing 72-path `D-final-fixes-check-snapshot.json` and focused fixture `D-final-fixture-check-snapshot.json` are preserved byte-for-byte and their before/after hashes are recorded. Main owns merging this separate three-path supplement and all full gates/artifact preservation. No tests, full/type/native/build gates, body re-audit, child dispatch, stage, commit, push, spec or ledger changes were performed.

Reproduce the focused proof without editing sources: `python3 .trellis/tasks/10-08-src-remediation-d/reviews/D-final-whitespace-proof.py`.
'''
(ROOT / report_path).write_text(report)
evidence_paths = [PREFIX + 'proof.py', entry_path, PREFIX + 'token-proof.json', PREFIX + 'token-proof.log',
    PREFIX + 'untracked-whitespace.json', report_path] + [i['beforeCopy'] for i in entry['sourceCopies']] + list(EXPECTED)
evidence_paths += sorted({item['snapshot'] for item in entry['acceptedLatest'].values()})
evidence = {p: filehash(p) for p in evidence_paths}
snapshot = {'status': 'PASS', 'role': 'trellis-check', 'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'Only three authorized trailing EOF LF corrections; not whole-D acceptance', 'algorithm': 'SHA-256',
    'before': EXPECTED, 'after': after, 'unitAttribution': UNITS, 'productPaths': list(EXPECTED),
    'acceptedBefore': entry['acceptedLatest'], 'sourceBeforeCopies': entry['sourceCopies'], 'byteProof': byte_proof,
    'terminalTokenProof': PREFIX + 'token-proof.json', 'focusedChecks': checks,
    'protectedHistoricalHashes': entry['protectedHistoricalHashes'], 'protectedHistoricalAfterHashes': protected_after,
    'protectedHistoricalUnchanged': True, 'checkerToolPaths': [],
    'report': report_path, 'evidenceHashes': evidence,
    'limitations': ['Focused EOF-only PASS; whole D and pending final integration remain main-owned',
        'No tests required for exact byte-only EOF normalization', 'No full/type/build/native gate rerun',
        'Snapshot self hash excluded to avoid circularity; no new .mjs helper or extra product classification']}
assert set(snapshot['before']) == set(snapshot['after']) == set(snapshot['unitAttribution']) == set(EXPECTED)
save(PREFIX + 'check-snapshot.json', snapshot)
print(json.dumps({'status': 'PASS', 'scope': snapshot['scope'], 'after': after, 'unitAttribution': UNITS,
    'tokens': {item['path']: item['afterTokenCount'] for item in proof['files']}, 'focusedChecksExitCodes': [c['exitCode'] for c in checks],
    'rawWhitespaceExitCodes': [c['rawExitCode'] for c in whitespace], 'protectedHistoricalUnchanged': True,
    'snapshot': PREFIX + 'check-snapshot.json'}, indent=2))
