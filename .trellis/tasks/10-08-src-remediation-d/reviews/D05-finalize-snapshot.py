"""Finalize exact writer attribution after report completion; never edit product inputs."""
from pathlib import Path
import datetime, hashlib, json, subprocess
root = Path.cwd()
task = Path('.trellis/tasks/10-08-src-remediation-d')
entry_path = task / 'tools/d05/entry.json'
entry = json.loads(entry_path.read_text())
tested_path = task / 'reviews/D05-product-freeze-tested.json'
tested = json.loads(tested_path.read_text())
freeze_path = task / 'reviews/D05-product-freeze.json'
snapshot_path = task / 'reviews/D05-implement-snapshot.json'
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
def record(path):
    name = str(path)
    return {'before': entry['before'].get(name), 'after': digest(path)}
# Product, all original gate runners/fixtures and configurations are immutable.
verification = {name: value for name, value in tested['frozenInputs'].items() if name.startswith(('src/', 'tests/', 'scripts/')) or name in ['tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json', 'vitest.config.ts', 'package.json', 'pnpm-lock.yaml']}
verification.update({str(task / 'reviews' / name): digest(task / 'reviews' / name) for name in ['D05-native.mjs', 'D05-compiler-negatives.mjs', 'D05-run-gate.py', 'D05-freeze.py']})
for name, value in verification.items():
    if digest(Path(name)) != value:
        raise RuntimeError(f'Tested product/config/runner changed: {name}')
for name, value in tested['changes'].items():
    if digest(Path(name)) != value['after']:
        raise RuntimeError(f'Product changed after final tested freeze: {name}')
# Coordinator-owned scans/drafts are dependencies, never attributed to writer.
coordinator = [path for path in (task / 'reviews').glob('D05-*') if path.name.startswith(('D05-static-first-', 'D05-static-summary', 'D05-static-results', 'D05-static.log', 'D05-ast.log'))]
coordinator += [path for path in (task / 'research').glob('D05-current-ast-*')]
writer_reviews = [path for path in (task / 'reviews').glob('D05-*') if path.is_file() and path not in coordinator and path not in [freeze_path, snapshot_path] and path.name != 'D05-spec-draft.md']
writer = [path for path in (task / 'tools/d05').rglob('*') if path.is_file()] + writer_reviews + [task / 'research/D05-implementation.md']
writer = sorted(set(writer))
for path in (task / 'tools/d05/before').rglob('*'):
    if path.is_file():
        original = str(path.relative_to(task / 'tools/d05/before'))
        if digest(path) != entry['before'][original]:
            raise RuntimeError(f'Original source copy modified: {original}')
# The finalizer itself is a frozen evidence-producing helper; reports/maps are
# finalized evidence and are not retroactively declared prior test inputs.
verification[str(Path(__file__).relative_to(root))] = digest(Path(__file__))
evidence = {str(path): digest(path) for path in writer}
scan_inputs = {str(path): digest(path) for path in coordinator}
freeze = {
    'status': 'PRODUCTFROZEN', 'capturedAt': datetime.datetime.now().astimezone().isoformat(),
    'phase': 'final evidence finalized after immutable tested product checkpoint',
    'entryHead': entry['head'], 'baselineProductRevision': tested['baselineProductRevision'],
    'entrySnapshot': str(entry_path), 'entrySnapshotSha256': digest(entry_path),
    'testedCheckpoint': {'path': str(tested_path), 'sha256': digest(tested_path), 'capturedAt': tested['capturedAt']},
    'changes': tested['changes'], 'frozenInputs': verification,
    'finalizedWriterEvidence': evidence, 'coordinatorEvidenceDependencies': scan_inputs,
    'ownershipNote': 'frozenInputs are actual source/tests/config/runners; finalized evidence was completed after gate execution. Coordinator scans remain explicitly attributed dependencies. No recursive self-hash.',
}
freeze_path.write_text(json.dumps(freeze, indent=2) + '\n')
writer.append(freeze_path)
changes = tested['changes']
before = {name: values['before'] for name, values in changes.items()}
after = {name: values['after'] for name, values in changes.items()}
for path in writer:
    item = record(path)
    before[str(path)] = item['before']
    after[str(path)] = item['after']
static_path = task / 'reviews/D05-static-summary.json'
static = json.loads(static_path.read_text())
if static['addedNoncomplexity']:
    raise RuntimeError('Coordinator final static contains new noncomplexity diagnostics')
for name, value in static['hashes'].items():
    if digest(Path(name)) != value["after"]:
        raise RuntimeError(f'Coordinator static source changed: {name}')
ast_path = task / 'research/D05-current-ast-summary.json'
ast = json.loads(ast_path.read_text())
if ast['parseErrors'] or ast['staticValueCycles']:
    raise RuntimeError('Coordinator final source graph failed')
gates = json.loads((task / 'reviews/D05-gates.json').read_text())
for gate in gates:
    if digest(Path(gate['log'])) != gate['logSha256']:
        raise RuntimeError(f'Gate log modified: {gate["name"]}')
raw_commands = []
pnpm = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
focused_files = ['d05ToolCatalog', 'd05SchemaEquivalence', 'd05ToolMetadata', 'agentTools', 'agentToolsReview', 'agentToolTransactions', 'toolLoading', 'toolLoadingMeasurement', 'toolValidationDiagnostics', 'toolValidationSafety', 'agentBusiness', 'agentProjectCreation', 'agentGeneration', 'agentGenerationRecovery', 'agentGenerationReview', 'agentGenerationReviewTransactions', 'agentGenerationBatch', 'agentGenerationBatchSafety', 'agentBatchPreparationRecovery', 'agentGenerationEvidence', 'agentMemoryTools', 'agentReferences', 'imageDiscovery', 'referenceEvidence', 'agentIpTools', 'agentMaterialTools', 'audioMusicAgentTools', 'musicDurationContract', 'audioAgentExecution', 'audioGenerationAgent', 'musicGenerationReview', 'agentTaskOrchestration', 'agentTaskOrchestrationReview', 'audioTaskEvidence', 'agentProjectContext', 'runWriteOutcomes', 'agentTaskWrapup', 'memoryRetrieval', 'agentAuditRemediation']
for path in sorted((task / 'tools/d05').glob('*.log')):
    if any(gate['log'] == str(path) for gate in gates):
        continue
    name = path.stem
    if name.startswith('type-'):
        command = [pnpm, 'lint']
    elif name.startswith('compile-'):
        command = [pnpm, 'exec', 'tsc', '-p', 'tests/typecheck/tsconfig.agent-tools.json', '--noEmit', '--incremental', 'false']
    elif name == 'focused-full-01':
        command = [pnpm, 'exec', 'vitest', 'run'] + [f'tests/{file}.test.ts' for file in focused_files] + ['--maxWorkers', '4']
    elif name.startswith('catalog-'):
        command = [pnpm, 'exec', 'vitest', 'run', 'tests/d05ToolCatalog.test.ts']
    elif name.startswith('focused-'):
        command = [pnpm, 'exec', 'vitest', 'run', 'tests/d05ToolCatalog.test.ts', 'tests/d05SchemaEquivalence.test.ts', 'tests/d05ToolMetadata.test.ts'] + ([] if name == 'focused-01' else ['tests/memoryRetrieval.test.ts'])
    else:
        command = None
    content = path.read_text()
    failed = 'error TS' in content or ' FAIL ' in content or ' failed (' in content
    raw_commands.append({'name': name, 'command': command, 'cwd': str(root), 'log': str(path), 'logSha256': digest(path), 'result': 'failed-preserved' if failed else 'passed', 'timing': 'Original unwrapped command log; no timestamp/exit code invented beyond recorded output.'})
coverage = []
for name in sorted(after):
    role = 'product source' if name.startswith('src/') else 'functional/compile test or fixture' if name.startswith('tests/') else 'hash-verified original pre-first-edit copy' if '/tools/d05/before/' in name else 'writer evidence/runner/helper/report'
    coverage.append({'path': name, 'before': before[name], 'after': after[name], 'role': role, 'status': 'implementation-complete; independent review required'})
# Verify actual unchanged source outside this unit and current accepted overlaps.
unchanged = {name: value for name, value in entry['before'].items() if name.startswith('src/') and name not in changes}
for name, value in unchanged.items():
    if digest(Path(name)) != value:
        raise RuntimeError(f'Unattributed source mutation: {name}')
negative = json.loads((task / 'reviews/D05-compiler-negatives.json').read_text())
report_path = task / 'research/D05-implementation.md'
snapshot = {
    'status': 'PASS', 'role': 'trellis-implement', 'acceptanceBoundary': 'Implementation-only; independent current-hash whole-unit review and main closure remain mandatory.',
    'unit': 'D05', 'findings': ['AR-05'], 'ancillary': ['EX01'], 'findingCountChanged': False,
    'capturedAt': datetime.datetime.now().astimezone().isoformat(), 'algorithm': 'sha256',
    'baselineRevision': tested['baselineProductRevision'], 'entryHEAD': entry['head'], 'currentHEAD': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'entrySnapshot': {'path': str(entry_path), 'sha256': digest(entry_path), 'paths': len(entry['before'])},
    'productPaths': sorted(name for name in changes if name.startswith('src/')),
    'testFixturePaths': sorted(name for name in changes if name.startswith('tests/')),
    'scopePaths': sorted(after), 'scopeCount': len(after), 'before': before, 'after': after,
    'deletedPaths': [name for name, value in after.items() if value is None],
    'perFileCoverage': coverage, 'writerOwnedEvidence': sorted(str(path) for path in writer),
    'originalCopyCount': sum('/tools/d05/before/' in str(path) for path in writer),
    'productFreeze': {'path': str(freeze_path), 'sha256': digest(freeze_path), 'frozenInputs': verification},
    'testedCheckpoint': freeze['testedCheckpoint'], 'finalizedWriterEvidence': {str(path): digest(path) for path in writer},
    'coordinatorEvidenceDependencies': scan_inputs,
    'sourceFreeze': {name: value for name, value in verification.items() if name.startswith('src/')},
    'sourceUnchangedOutsideD05': unchanged,
    'priorUnitOverlaps': json.loads((task / 'reviews/D05-prior-overlaps-final.json').read_text()),
    'runtimeVersions': json.loads((task / 'reviews/D05-runtime-versions.json').read_text()),
    'runtimeCatalog': {'path': str(task / 'tools/d05/runtime-catalog.json'), 'sha256': digest(task / 'tools/d05/runtime-catalog.json'), **json.loads((task / 'tools/d05/runtime-catalog.json').read_text())},
    'schemaProof': {'orderedByteFixture': 'tests/fixtures/d05/catalog.json', 'fixtureSha256': digest(Path('tests/fixtures/d05/catalog.json')), 'runtimeTests': ['tests/d05ToolCatalog.test.ts', 'tests/d05SchemaEquivalence.test.ts'], 'registered': 89, 'families': 13, 'relation': 'All typed families; one registry argument erasure; parse own definition raw unknown before callbacks.'},
    'compilerProof': {'path': str(task / 'reviews/D05-compiler-negatives.json'), 'sha256': digest(task / 'reviews/D05-compiler-negatives.json'), 'compilerVersion': negative['compilerVersion'], 'expected': len(negative['expectedLines']), 'rejected': len(negative['actual']), 'missing': negative['missing'], 'unrelated': negative['unrelated']},
    'consumerMap': {'path': str(task / 'reviews/D05-consumer-map.json'), 'sha256': digest(task / 'reviews/D05-consumer-map.json')},
    'movementMap': {'path': str(task / 'reviews/D05-movement-map.json'), 'sha256': digest(task / 'reviews/D05-movement-map.json')},
    'commandLog': gates + raw_commands,
    'gateResults': {'affectedFocusFirst': '39 files / 647 tests PASS', 'fullFirstFreeze': '153 files / 2465 tests PASS; not rerun after same-rejection explicit switch cases', 'fixFocusCurrent': '7 files / 110 tests PASS', 'appTypesCurrent': 'PASS', 'dedicatedCompilerCurrent': 'PASS', 'compilerNegative': '16/16 actual rejections, missing/unrelated empty', 'nativeFirstFreeze': 'Native IDB preparation/approvals/receipts/nested-write rollback/history/control passed; zero external requests/page errors'},
    'gateApplicability': json.loads((task / 'reviews/D05-gate-applicability.json').read_text()),
    'static': {'attribution': 'Coordinator final same-version static', 'path': str(static_path), 'sha256': digest(static_path), 'files': static['files'], 'baselineErrors': static['baselineErrors'], 'baselineWarnings': static['baselineWarnings'], 'currentErrors': static['currentErrors'], 'currentWarnings': static['currentWarnings'], 'addedNoncomplexity': static['addedNoncomplexity'], 'versions': static['versions'], 'hashes': static['hashes'], 'metricLimits': {'musicGenerationReview.inspect': 'actual entry=C; cyclomatic38→39 from explicit prepare availability guard', 'runChat.executePendingTools': 'actual entry=C; cyclomatic59→51, cognitive81→81', 'businessTools.slotExecute': 'four explicit unsupported cases add four branches; final cyclomatic22 is guard accounting, no change to rejection/effect'}},
    'ast': {'attribution': 'Coordinator final global AST', 'path': str(ast_path), 'sha256': digest(ast_path), **ast},
    'preservedFailures': [item for item in raw_commands if item['result'] == 'failed-preserved'],
    'report': {'path': str(report_path), 'sha256': digest(report_path)},
    'notClosed': ['independent D05/EX01 acceptance', 'coordinator spec/ledger/status', 'D06-D08', 'whole-D integration/build/model-bank', 'E/QG01'],
    'limitations': ['Native local synthetic fixtures and controlled model Responses; no paid provider, full product UI, decode/audio-quality/all-browser claim.', 'First full/native passes retain original freeze applicability; corrected same-rejection cases have current dedicated type/focus proof.', '121 current static errors / 222 warnings are inherited cumulative debt; no clean-lint or all-metrics-improved claim.', 'Source whitelist preserves original entry spread; entry extension fields are not removed.', 'One registry existential argument erasure and object/tuple schema-construction assertions are documented; callbacks do not recover Args with raw/domain casts.'],
    'snapshotSelf': {'path': str(snapshot_path), 'policy': 'This snapshot is excluded from recursive after/self hashes; user-facing final records its external hash.'},
}
snapshot_path.write_text(json.dumps(snapshot, indent=2) + '\n')
print(json.dumps({'status': snapshot['status'], 'snapshot': str(snapshot_path), 'snapshotSha256': digest(snapshot_path), 'reportSha256': digest(report_path), 'productFreezeSha256': digest(freeze_path), 'sourcePaths': len(snapshot['productPaths']), 'testFixturePaths': len(snapshot['testFixturePaths']), 'scopeCount': len(after), 'originalCopies': snapshot['originalCopyCount'], 'verificationInputs': len(verification), 'writerEvidence': len(writer), 'coordinatorDependencies': len(scan_inputs)}, indent=2))
