import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ts from 'typescript';
import {spawnSync} from 'node:child_process';

const review = '.trellis/tasks/10-08-src-remediation-d/reviews';
const entry = JSON.parse(fs.readFileSync(`${review}/D-final-fixture-entry.json`, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const tests = ['tests/d05SchemaEquivalence.test.ts', 'tests/d06Capabilities.test.ts', 'tests/d07RequestWire.test.ts', 'tests/memoryRetrieval.test.ts', 'tests/d05ToolCatalog.test.ts'];
const gallery = 'src/components/studio/ProjectGalleryPage.tsx';
const replacements = [
  ['../.trellis/tasks/10-08-src-remediation-d/tools/d05/before/src/', './fixtures/sourceSnapshots/d05/src/'],
  ['../.trellis/tasks/10-08-src-remediation-d/tools/d06/before/src/', './fixtures/sourceSnapshots/d06/src/'],
  ['../.trellis/tasks/10-08-src-remediation-d/research/D07-evidence/before/src/', './fixtures/sourceSnapshots/d07/src/'],
];
assert.equal(ts.version, '5.9.3');
const testChanges = [];
for (const test of tests) {
  const beforePath = `${review}/D-final-fixture-before/${test}`;
  assert.equal(hash(beforePath), entry.before[test]);
  const before = fs.readFileSync(beforePath, 'utf8');
  let expected = before;
  for (const [oldRoot, newRoot] of replacements) expected = expected.replaceAll(oldRoot, newRoot);
  if (test.endsWith('d05ToolCatalog.test.ts')) {
    expected = expected.replace('{readFileSync, writeFileSync}', '{readFileSync}');
    const line = "        writeFileSync('.trellis/tasks/10-08-src-remediation-d/tools/d05/runtime-catalog.json', JSON.stringify({counts, names, catalog, missing: [], unreachable: [], duplicates: []}, null, 2) + '\\n');\n";
    assert.equal(expected.split(line).length - 1, 1);
    expected = expected.replace(line, '');
  }
  const current = fs.readFileSync(test, 'utf8');
  assert.equal(current, expected, `Only authorized edit: ${test}`);
  assert.ok(!current.includes('.trellis'));
  const countAssertions = text => {
    const source = ts.createSourceFile(test, text, ts.ScriptTarget.Latest, true);
    let count = 0;
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'expect') count++;
      ts.forEachChild(node, visit);
    }
    visit(source);
    return count;
  };
  const beforeAssertions = countAssertions(before), afterAssertions = countAssertions(current);
  assert.equal(beforeAssertions, afterAssertions);
  testChanges.push({path: test, exactAuthorizedTransformation: true, allAssertionsPreserved: true, beforeExpectCalls: beforeAssertions, afterExpectCalls: afterAssertions, noTaskImportOrWrite: true});
}
const copied = [];
const whitespaceCopies = [];
for (const item of entry.originalManifest) {
  assert.equal(hash(item.original), item.sha256, `Historical original preserved: ${item.original}`);
  assert.equal(hash(item.destination), item.sha256, `Fixture exact bytes: ${item.destination}`);
  copied.push({...item, equalOriginal: true});
  const check = spawnSync('git', ['diff', '--no-index', '--check', '/dev/null', item.destination], {encoding: 'utf8'});
  // --no-index implies the difference exit code; 1 with no output is a new file, not a whitespace warning.
  assert.ok([0, 1].includes(check.status), check.stdout + check.stderr);
  assert.equal(check.stdout + check.stderr, '', item.destination);
  whitespaceCopies.push({path: item.destination, rawExitCode: check.status, diagnosticOutput: check.stdout + check.stderr, noWhitespaceDiagnostics: true});
}
function resolve(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'].map(ext => base + ext), ...['.ts', '.tsx', '.js', '.json'].map(ext => path.join(base, 'index' + ext))];
  const found = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  assert.ok(found, `Missing dependency ${from}: ${specifier}`);
  return found;
}
for (const edge of entry.relativeEdges) {
  const from = `tests/fixtures/sourceSnapshots/${edge.group}/src/${edge.from}`;
  const expected = path.resolve(`tests/fixtures/sourceSnapshots/${edge.group}/src/${edge.to}`);
  assert.equal(resolve(from, edge.specifier), expected);
}
for (const boundary of entry.sharedMockBoundaries) {
  assert.equal(hash(boundary.actualCurrent), boundary.sha256);
  assert.equal(hash(boundary.destination), boundary.sha256);
  assert.ok(fs.readFileSync(tests[2], 'utf8').includes(`vi.mock("./${boundary.destination.slice('tests/'.length).replace(/\.ts$/, '')}", async () => import("@/${boundary.actualCurrent.slice('src/'.length).replace(/\.ts$/, '')}"))`));
}
const protectedHistory = Object.entries(entry.protectedHistoricalHashes).map(([file, acceptedHash]) => {
  assert.equal(hash(file), acceptedHash);
  return {path: file, sha256: acceptedHash, unchanged: true};
});
const beforeGallery = fs.readFileSync(`${review}/D-final-fixture-before/${gallery}`, 'utf8');
const afterGallery = fs.readFileSync(gallery, 'utf8');
assert.equal(afterGallery, beforeGallery.replace(/[\r\n]+$/, '') + '\n');
function terminalTokens(text) {
  const source = ts.createSourceFile(gallery, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0);
  const tokens = [];
  function walk(node) {
    const children = node.getChildren(source);
    if (!children.length && node.kind <= ts.SyntaxKind.LastToken) tokens.push([node.kind, node.getText(source)]);
    else for (const child of children) walk(child);
  }
  walk(source);
  return tokens;
}
const beforeTokens = terminalTokens(beforeGallery), afterTokens = terminalTokens(afterGallery);
assert.deepEqual(afterTokens, beforeTokens);
const galleryTokenProof = {path: gallery, typescript: ts.version, kind: 'TSX-parser-terminal-kind-and-text', beforeTokenCount: beforeTokens.length, afterTokenCount: afterTokens.length, beforeTokenSha256: sha(JSON.stringify(beforeTokens)), afterTokenSha256: sha(JSON.stringify(afterTokens)), semanticTokensEqual: true, exactTrailingNewlinesOnly: true, removedBytes: Buffer.byteLength(beforeGallery) - Buffer.byteLength(afterGallery), parseErrors: 0};
const whitespace = spawnSync('git', ['diff', '--check', '--', gallery], {encoding: 'utf8'});
assert.equal(whitespace.status, 0, whitespace.stdout + whitespace.stderr);
const proof = {status: 'PASS', capturedAt: new Date().toISOString(), typescript: ts.version, testChanges, originalByteProof: copied, relativeClosure: {edgeCount: entry.relativeEdges.length, allResolvedToCopiedHierarchy: true, sharedMockBoundaries: entry.sharedMockBoundaries, requiredSnapshotJsonFiles: copied.filter(item => item.destination.endsWith('.json')).map(item => item.destination)}, protectedHistory, newFixtureWhitespace: {commandTemplate: ['git', 'diff', '--no-index', '--check', '/dev/null', '<new fixture>'], expectedDifferenceExitCode: 1, fileChecks: whitespaceCopies}, galleryTokenProof, galleryWhitespaceCheck: {command: ['git', 'diff', '--check', '--', gallery], exitCode: whitespace.status, output: whitespace.stdout + whitespace.stderr}};
fs.writeFileSync(`${review}/D-final-fixture-proof.json`, JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({status: proof.status, testsExactEdits: testChanges.length, exactByteCopies: copied.length, relativeEdgesVerified: entry.relativeEdges.length, protectedHistoryUnchanged: protectedHistory.length, galleryTokenProof}, null, 2));
