// Read-only compiler overlay: verify each proposed intermediate source tree without staging.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require(path.resolve('node_modules/typescript'));
const root = process.cwd();
const task = path.resolve(__dirname, '..');
const groupsPath = path.join(task, 'commit-groups.json');
const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));
const revision = cp.execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const basePaths = cp.execFileSync('git', ['ls-tree', '-r', '--name-only', revision, '--', 'src'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
const baseTestPaths = cp.execFileSync('git', ['ls-tree', '-r', '--name-only', revision, '--', 'tests'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
const sourceDirty = new Set([
  ...cp.execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'src'], {encoding: 'utf8'}).trim().split('\n'),
  ...cp.execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src'], {encoding: 'utf8'}).trim().split('\n'),
].filter(Boolean));
const testDirty = new Set([
  ...cp.execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'tests'], {encoding: 'utf8'}).trim().split('\n'),
  ...cp.execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'tests'], {encoding: 'utf8'}).trim().split('\n'),
].filter(Boolean));
const baseline = new Map();
for (const name of new Set([...sourceDirty, ...testDirty])) {
  baseline.set(name, basePaths.includes(name) || baseTestPaths.includes(name) ? cp.execFileSync('git', ['show', revision + ':' + name], {encoding: 'utf8'}) : undefined);
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const assigned = new Set();
const reports = [];
const configPath = path.join(root, 'tsconfig.app.json');
const raw = ts.readConfigFile(configPath, ts.sys.readFile);
if (raw.error) throw new Error('Cannot read actual application TS config');
const config = ts.parseJsonConfigFileContent(raw.config, ts.sys, root);
if (config.errors.length) throw new Error('Invalid actual application TS config');
const toRelative = name => path.relative(root, path.resolve(name)).split(path.sep).join('/');
for (let index = 0; index < groups.length; index++) {
  for (const name of groups[index].files) {
    if (assigned.has(name)) throw new Error('Overlapping group path: ' + name);
    assigned.add(name);
  }
  const overlay = new Map([...baseline].filter(([name]) => !assigned.has(name)));
  const host = ts.createCompilerHost(config.options);
  const read = host.readFile.bind(host);
  const exists = host.fileExists.bind(host);
  host.readFile = name => overlay.has(toRelative(name)) ? overlay.get(toRelative(name)) : read(name);
  host.fileExists = name => overlay.has(toRelative(name)) ? overlay.get(toRelative(name)) !== undefined : exists(name);
  host.getSourceFile = (name, languageVersion, onError) => {
    const content = host.readFile(name);
    if (content === undefined) { if (onError) onError('Missing compiler-overlay input: ' + name); return undefined; }
    return ts.createSourceFile(name, content, languageVersion);
  };
  const roots = new Set([...basePaths, ...config.fileNames.map(toRelative)]);
  const rootNames = [...roots].filter(name => /\.(?:ts|tsx)$/.test(name) && host.fileExists(path.join(root, name))).map(name => path.join(root, name));
  const program = ts.createProgram(rootNames, {...config.options, incremental: false, noEmit: true}, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({file: d.file ? toRelative(d.file.fileName) : null, line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n')}));
  const testRoots = new Set([...baseTestPaths, ...testDirty]);
  const unresolvedTestImports = [];
  for (const name of testRoots) {
    // Immutable comparator modules can intentionally mock untouched model-bank owners.
    // Their runtime closure/provenance is separately accepted by the fixture proof.
    if (name.startsWith('tests/fixtures/sourceSnapshots/') || !/\.(?:ts|tsx)$/.test(name) || !host.fileExists(path.join(root, name))) continue;
    const imports = ts.preProcessFile(host.readFile(path.join(root, name)), true, true).importedFiles;
    for (const imported of imports) {
      if (!imported.fileName.startsWith('.') && !imported.fileName.startsWith('@/')) continue;
      if (/\.(?:css|svg|png|jpg|webp)$/.test(imported.fileName)) {
        const asset = imported.fileName.startsWith('@/') ? path.join(root, 'src', imported.fileName.slice(2)) : path.resolve(root, path.dirname(name), imported.fileName);
        if (!host.fileExists(asset)) unresolvedTestImports.push({file: name, module: imported.fileName});
        continue;
      }
      const resolved = ts.resolveModuleName(imported.fileName, path.join(root, name), {...config.options, resolveJsonModule: true}, host);
      if (!resolved.resolvedModule) unresolvedTestImports.push({file: name, module: imported.fileName});
    }
  }
  const sourceHashes = Object.fromEntries(rootNames.map(name => [toRelative(name), sha(host.readFile(name))]));
  const programInputMismatches = rootNames.filter(name => program.getSourceFile(name)?.text !== host.readFile(name)).map(toRelative);
  const result = {group: index + 1, message: groups[index].message, assignedPaths: assigned.size, sourceCount: rootNames.length, sourceHashes, diagnostics, unresolvedTestImports, programInputMismatches};
  reports.push(result);
  console.log(JSON.stringify({group: result.group, message: result.message, sourceCount: result.sourceCount, diagnostics: diagnostics.length, unresolvedTestImports: unresolvedTestImports.length, programInputMismatches: programInputMismatches.length}));
  if (diagnostics.length || unresolvedTestImports.length || programInputMismatches.length) break;
}
const omitted = [...sourceDirty].filter(name => !assigned.has(name));
const report = {status: reports.length === groups.length && reports.every(r => r.diagnostics.length === 0 && r.unresolvedTestImports.length === 0 && r.programInputMismatches.length === 0) && omitted.length === 0 ? 'PASS' : 'FAIL', compilerVersion: ts.version, baseRevision: revision, groupsSha256: sha(fs.readFileSync(groupsPath)), methodology: 'Actual TypeScript application compiler host overlay, current assigned files and exact HEAD bytes/absence for not-yet-assigned changes; read-only, no stage/commit. Static test imports checked; immutable snapshot runtime closure has separate accepted mock-aware proof. Does not replace final behavioral gates or prove each historical/native runner executable.', omitted, groups: reports};
fs.writeFileSync(path.join(task, 'reviews/commit-boundaries.json'), JSON.stringify(report, null, 2) + '\n');
if (report.status !== 'PASS') process.exitCode = 1;
