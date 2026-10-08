import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';

const review = '.trellis/tasks/10-08-src-remediation-d/reviews';
const tests = ['tests/d05SchemaEquivalence.test.ts', 'tests/d06Capabilities.test.ts', 'tests/d07RequestWire.test.ts', 'tests/memoryRetrieval.test.ts', 'tests/d05ToolCatalog.test.ts'];
const gallery = 'src/components/studio/ProjectGalleryPage.tsx';
const root = '.trellis/tasks/10-08-src-remediation-d';
const groups = {
  d05: {original: `${root}/tools/d05/before/src`, entries: ['lib/agent/tools.ts', 'lib/agent/generationProfiles.ts', 'lib/memory/retrieval.ts']},
  d06: {original: `${root}/tools/d06/before/src`, entries: ['lib/agent/generationProfiles.ts', 'domain/output.ts']},
  d07: {original: `${root}/research/D07-evidence/before/src`, entries: ['apimart', 'apimartAudio', 'aihubmix', 'mimoSpeech', 'openaiCompatible', 'chatStream', 'responsesStream', 'tavily'].map(name => `lib/ai/${name}.ts`)},
};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = file => fs.existsSync(file) ? sha(fs.readFileSync(file)) : null;
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const unit = file => file === gallery ? 'D03' : file.includes('/d06') ? 'D06' : file.includes('/d07') ? 'D07' : 'D05';
function imports(file) {
  if (!/\.[cm]?[jt]sx?$/.test(file)) return [];
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0, file);
  const result = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) result.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) result.push(node.arguments[0].text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) result.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(result)];
}
function resolve(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'].map(ext => base + ext), ...['.ts', '.tsx', '.js', '.json'].map(ext => path.join(base, 'index' + ext))];
  const found = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  assert.ok(found, `Missing relative dependency ${from}: ${specifier}`);
  return found;
}
const manifest = [], edges = [], externals = [], sharedMockBoundaries = [];
for (const [group, config] of Object.entries(groups)) {
  const seen = new Set();
  const queue = config.entries.map(entry => path.resolve(config.original, entry));
  while (queue.length) {
    const original = queue.shift();
    if (seen.has(original)) continue;
    seen.add(original);
    assert.ok(original.startsWith(path.resolve(config.original) + path.sep));
    const relative = path.relative(path.resolve(config.original), original);
    const destination = `tests/fixtures/sourceSnapshots/${group}/src/${relative}`;
    assert.equal(hash(destination), null, `Fixture must be NEW: ${destination}`);
    manifest.push({unit: group.toUpperCase(), original: path.relative(process.cwd(), original), destination, sha256: hash(original), bytes: fs.statSync(original).size});
    if (group === 'd07' && ['lib/ai/modelMetadata.ts', 'lib/ai/visionCapability.ts'].includes(relative)) {
      const actualCurrent = `src/${relative}`;
      assert.equal(hash(original), hash(actualCurrent), 'Shared D07 dependency must stay byte-identical');
      sharedMockBoundaries.push({original: path.relative(process.cwd(), original), destination, actualCurrent, sha256: hash(original), outgoingSnapshotImportsNotExecuted: imports(original), policy: 'existing-vi.mock-factory-imports-current-unmodified-module'});
      continue;
    }
    for (const specifier of imports(original)) {
      if (specifier.startsWith('.')) {
        const dependency = resolve(original, specifier);
        edges.push({group, from: relative, specifier, to: path.relative(path.resolve(config.original), dependency)});
        queue.push(dependency);
      } else externals.push({group, from: relative, specifier, policy: specifier.startsWith('@/') ? 'existing-current-src-alias' : 'existing-package'});
    }
  }
}
const scoped = [...tests, gallery];
const before = Object.fromEntries([...scoped.map(file => [file, hash(file)]), ...manifest.map(row => [row.destination, null])]);
const accepted = {};
for (const file of scoped) {
  const owner = unit(file), snapshotPath = `${review}/${owner}-check-snapshot.json`;
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.equal(snapshot.after[file], before[file], `Accepted ${owner} before mismatch: ${file}`);
  accepted[file] = {unit: owner, acceptedAfter: snapshot.after[file], snapshot: snapshotPath, snapshotSha256: hash(snapshotPath), equal: true};
}
const protectedPaths = [`${root}/tools/d05/runtime-catalog.json`, ...Object.keys(groups).map(group => `${review}/${group.toUpperCase()}-check-snapshot.json`), `${review}/D03-check-snapshot.json`];
const entry = {status: 'CAPTURED_BEFORE', capturedAt: new Date().toISOString(), typescript: ts.version, before, accepted, unitAttribution: Object.fromEntries([...scoped.map(file => [file, unit(file)]), ...manifest.map(row => [row.destination, row.unit])]), originalManifest: manifest, relativeEdges: edges, externalImports: externals, sharedMockBoundaries, protectedHistoricalHashes: Object.fromEntries(protectedPaths.map(file => [file, hash(file)]))};
assert.equal(ts.version, '5.9.3');
assert.equal(hash(`${review}/D-final-fixture-entry.json`), null, 'Do not overwrite entry capture');
write(`${review}/D-final-fixture-entry.json`, entry);
for (const file of scoped) {
  const copy = `${review}/D-final-fixture-before/${file}`;
  fs.mkdirSync(path.dirname(copy), {recursive: true});
  fs.copyFileSync(file, copy);
}
console.log(JSON.stringify({capturedBefore: scoped.length, groups: Object.fromEntries(Object.keys(groups).map(group => [group, manifest.filter(row => row.unit.toLowerCase() === group).length])), bytes: manifest.reduce((sum, row) => sum + row.bytes, 0), relativeEdges: edges.length, json: manifest.filter(row => row.destination.endsWith('.json')).map(row => row.destination)}, null, 2));
