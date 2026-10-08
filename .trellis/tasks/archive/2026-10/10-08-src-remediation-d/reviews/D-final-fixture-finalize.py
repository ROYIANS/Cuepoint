from pathlib import Path
import hashlib
import json
import re
from datetime import datetime, timezone

review=Path('.trellis/tasks/10-08-src-remediation-d/reviews')
entry=json.loads((review/'D-final-fixture-entry.json').read_text())
proof=json.loads((review/'D-final-fixture-proof.json').read_text())
focused=json.loads((review/'D-final-fixture-focused-result.json').read_text())
archive=json.loads((review/'D-final-fixture-archive-result.json').read_text())
sha=lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
tests=['tests/d05SchemaEquivalence.test.ts','tests/d06Capabilities.test.ts','tests/d07RequestWire.test.ts','tests/memoryRetrieval.test.ts','tests/d05ToolCatalog.test.ts']
gallery='src/components/studio/ProjectGalleryPage.tsx'
fixture_paths=sorted(str(p) for p in Path('tests/fixtures/sourceSnapshots').rglob('*') if p.is_file())
checker_tools=[str(review/name) for name in ['D-final-fixture-prepare.mjs','D-final-fixture-verify.mjs']]
paths=[gallery,*tests,*fixture_paths,*checker_tools]
before={p:entry['before'].get(p) for p in paths}
after={p:sha(p) for p in paths}
attribution={p:('D03' if p==gallery else 'D06' if '/d06' in p else 'D07' if '/d07' in p else 'D05') for p in paths}
assert len(fixture_paths)==64
assert all(p.startswith(tuple(f'tests/fixtures/sourceSnapshots/{group}/' for group in ['d05','d06','d07'])) for p in fixture_paths)
assert all(before[p] is None for p in fixture_paths)
assert set(paths)==set(before)==set(after)==set(attribution)
assert proof['status']==archive['status']=='PASS' and focused['exitCode']==archive['exitCode']==0
for result in [focused,archive]:
    text=Path(result['log']).read_text()
    assert re.search(r'Test Files\s+5 passed \(5\)',text)
    assert re.search(r'Tests\s+53 passed \(53\)',text)
    result['testFilesPassed']=5
    result['testsPassed']=53
snapshot={
    'status':'PASS',
    'role':'trellis-check bounded self-fix and focused verification',
    'completedAt':datetime.now(timezone.utc).isoformat(),
    'scope':'Durable comparator fixtures/catalog write removal and Gallery EOF only; not whole-D acceptance',
    'algorithm':'sha256',
    'before':before,
    'after':after,
    'unitAttribution':attribution,
    'productPaths':[gallery],
    'testPaths':tests,
    'fixturePaths':fixture_paths,
    'checkerToolPaths':checker_tools,
    'checkerToolClassification':'New verification-only tools, all explicitly included with null before and D05 attribution; not native product behavior',
    'acceptedBefore':entry['accepted'],
    'fixtureOriginalHashManifest':entry['originalManifest'],
    'exactTestTransformations':proof['testChanges'],
    'fixtureClosure':{
        'originalsCopied':61,
        'byUnit':{'D05':44,'D06':3,'D07':14},
        'copiedOriginalBytes':562215,
        'relativeEdges':entry['relativeEdges'],
        'allRelativeEdgesResolved':True,
        'relativeEdgesVerified':133,
        'externalImports':entry['externalImports'],
        'snapshotJsonRequired':[],
        'sharedMockBoundaries':proof['relativeClosure']['sharedMockBoundaries'],
        'allOriginalBytesPreserved':True,
        'aliasPolicy':'Existing @/ imports resolve current source through unchanged Vitest alias',
        'readmesAdded':3,
    },
    'galleryTokenProof':proof['galleryTokenProof'],
    'focusedChecks':[
        {'name':'Exact authorized diff/original bytes/closure/TS5.9.3 Gallery proof', 'command':['node',str(review/'D-final-fixture-verify.mjs')], 'exitCode':0, 'log':str(review/'D-final-fixture-proof.log')},
        {'name':'Five focused tests on corrected host inputs',**focused},
        {'name':'Same five focused tests in isolated project without .trellis',**{k:v for k,v in archive.items() if k!='sourceInputProof'}},
        {'name':'Gallery whitespace',**proof['galleryWhitespaceCheck']},
    ],
    'archiveInputProof':{
        'artifact':str(review/'D-final-fixture-archive-result.json'),
        'sha256':sha(review/'D-final-fixture-archive-result.json'),
        'kind':archive['sourceInputProof']['kind'],
        'copiedInputFileCount':len(archive['sourceInputProof']['sha256']),
        'hostGlobalFreezeClaimed':False,
        'D08CorrectionAttributionClaimed':False,
        'inputMutationsAfterRun':archive['sourceInputProof']['inputMutationsAfterRun'],
        'noTrellisBefore':True,
        'noTrellisAfter':True,
        'activeTaskNeverHiddenOrRenamed':True,
        'onlyLinkedRoot':'node_modules',
    },
    'protectedHistoricalHashes':entry['protectedHistoricalHashes'],
    'protectedHistoricalUnchanged':True,
    'newFixtureWhitespace':proof['newFixtureWhitespace'],
    'preservedFailures':[
        {'kind':'closure-discovery setup assumption', 'command':['node',str(review/'D-final-fixture-prepare.mjs')], 'exitCode':1, 'occurrences':2, 'log':str(review/'D-final-fixture-prepare-first-attempt.log'), 'reason':'Naive traversal crossed an existing D07 vi.mock boundary into absent historical ./modelBank; first discovery call repeated once to capture the same failure log. No product/test/fixture edits before the corrected capture.', 'correction':'Recognize only the two existing vi.mock factories, prove their actual current modules byte-identical, copy mock target files and stop historical traversal at the unchanged factory boundary.'},
    ],
    'finiteLimits':{'focusedTimeoutSeconds':180,'archiveTimeoutSeconds':180,'maxWorkers':4,'focusedRuns':2,'failedClosureDiscoveryRuns':2,'successfulClosureCaptureRuns':1,'heavyGateRuns':0},
    'coordination':{'D08WriterThreadId':'01a11a66-075d-7181-9d89-7792aa047a62','writerConfirmedNoHeavyGateBeforeArchive':True,'writerWaitedForArchiveCompletion':True,'writerNotifiedAllFocusedGatesComplete':True},
    'limitations':[
        'PASS accepts this focused correction only. D08 and whole-D source/static/full/build/native acceptance remain with their owners.',
        'No global host source freeze claimed; concurrent D08 source bytes copied into archive input evidence are never attributed as this correction.',
        'Original dependency copies retain existing current-source aliases and the two existing D07 actual-module sharing mocks; these are not a hermetic historical application.',
        'No full suite, typecheck, build, native/provider checks, spec/ledger changes, commits, staging or push performed.',
        'Historical runtime-catalog and accepted unit evidence retain their original hashes; test no longer writes the catalog.',
    ],
}
report=review/'D-final-fixture-check.md'
lines=[
'# D final durable-fixture focused check — PASS',
'',
'**Focused PASS** for the authorized test-fixture portability correction and Gallery trailing-newline correction. This does not accept D08, close findings, or establish whole-D acceptance. Main may integrate the exact hashes below into `D-final-fixes-check-snapshot.json` before its ordered final gates.',
'',
'## Concrete failure and correction',
'',
'The D05 schema/parser and EX01 memory comparators, D06 capability comparator, and D07 wire comparator imported original implementations from the active task directory. Task archival moves that directory and breaks those imports. The D05 tool catalog test also wrote a verification artifact into the active task, despite already asserting the live catalog. Four comparator files now import durable `tests/fixtures/sourceSnapshots/{d05,d06,d07}/src` copies. The catalog test only loses its `writeFileSync` call and unused import; all live assertions remain.',
'',
'Before editing, each of the five test hashes matched its latest accepted D05/D06/D07 `after` map. Gallery matched accepted D03. `D-final-fixture-entry.json` records those hashes, accepted snapshot hashes and null before values for the new copied modules; the final snapshot records null before values for all 64 new fixture/provenance files.',
'',
'The copy contains 61 exact original files: D05 44, D06 3, D07 14 (562,215 bytes), plus one README per group with the original hash manifest. AST discovery follows actual import/export declarations, import types, and literal dynamic imports/require, preserving hierarchy and checking all 133 traversed relative edges. No snapshot JSON is required by the executed closure. Existing `@/` imports keep the existing policy of resolving current source. Original files were copied, never moved or modified.',
'',
'D07 retains its two existing `vi.mock` factories, now targeting the durable module IDs. Both factories still import the real current `modelMetadata`/`visionCapability` modules, proven byte-identical to their originals. Their exact original fixture files exist for mock resolution; historical outgoing dependencies at these existing mocked boundaries are not executed. The current module graph retains its real model-bank JSON inputs, included in the isolated copied source; `vendor/lobehub/manifest.json` is also copied. No parser mocks, canned comparator outputs, or new mocks were introduced.',
'',
'An exact authorized-transformation check compares every test against its captured before bytes. It permits only the path substitutions and removal of the single catalog write/import. It independently counts identical `expect(...)` calls before/after and confirms no `.trellis` references in the five corrected tests. All 61 original/copy hash pairs and protected historical runtime-catalog/accepted snapshot hashes remain equal.',
'',
'## Before / after attribution',
'',
'| Path | Unit | Accepted before SHA-256 | Corrected after SHA-256 |',
'| --- | --- | --- | --- |',
]
for p in [gallery,*tests]: lines.append(f'| `{p}` | {attribution[p]} | `{before[p]}` | `{after[p]}` |')
lines.extend([
'',
'Every one of the 64 new fixture paths has `before: null`, its exact after SHA-256, and D05/D06/D07 ownership in `D-final-fixture-check-snapshot.json`. The two new `.mjs` preparation/verifier producers are also explicitly included in the same before/after maps with null before and D05 attribution, matching whole-D review-tool scope. The completed snapshot has **72 attributed paths**: one Gallery source, five tests, 64 fixture/provenance files and these two producers. The Python archive/finalization runners remain verification artifacts whose exact hashes are in `evidenceHashes`. Original/copied module hashes are also in each group README and `fixtureOriginalHashManifest`. No D08 product/test path occurs in the correction before/after or attribution maps.',
'',
'## Gallery whitespace proof',
'',
'Only one trailing newline byte was removed from `src/components/studio/ProjectGalleryPage.tsx`. TypeScript **5.9.3** parses both captured versions as TSX with zero diagnostics and **3,451 identical terminal token kind/text pairs**. The before/after token hash is `'+proof['galleryTokenProof']['beforeTokenSha256']+'`. Exact text comparison permits only trailing newline normalization. `git diff --check -- src/components/studio/ProjectGalleryPage.tsx` now exits 0. No Gallery behavior test is needed for this byte-only correction.',
'',
'## Focused checks and archival simulation',
'',
'| Check | Result | Exit |',
'| --- | --- | --- |',
'| Authorized edits, assertion counts, original bytes, 133 relative edges, protected history, TSX tokens | PASS | 0 |',
'| Corrected host focused run, 5 files / 53 tests | PASS, '+str(focused['elapsedSeconds'])+' s | 0 |',
'| Isolated no-`.trellis` focused run, 5 files / 53 tests | PASS, '+str(archive['elapsedSeconds'])+' s | 0 |',
'| Gallery scoped whitespace check | PASS | 0 |',
'',
'Both Vitest invocations use the same explicit machine command:',
'',
'```text',
' '.join(focused['command']),
'```',
'',
'The archive runner creates a separate temporary project, copies `src`, the durable fixture tree, the five tests, shared setup/config/package, catalog fixture and vendor manifest, and links only the existing `node_modules`. It copies no `.trellis`, adds no host-source link, and never hides/renames/deletes the accepted active task. The isolated directory has no `.trellis` before or after the subprocess, all copied input hashes stay unchanged, and all 53 real assertions pass. The temporary root is retained for inspection at `'+archive['cwd']+'`.',
'',
'`D-final-fixture-archive-result.json` records the exact isolated input hashes used by that subprocess. This is input provenance for the isolated run, not a claim that concurrent host/D08 source is globally frozen or owned here. D08 writer `01a11a66-075d-7181-9d89-7792aa047a62` confirmed no heavy gate was running or queued before the isolated gate, waited for it, and was notified when it finished. The prior host focused gate was already complete when the coordination request arrived.',
'',
'Both focused subprocesses have a 180-second cap and four workers. The first naive closure discovery failed at absent historical `./modelBank` beneath an existing D07 mock; it was repeated once to preserve the same failure log, then corrected by respecting the existing factory boundary. These two pre-edit setup failures and their exact command/log remain in `preservedFailures`; no failing product test was suppressed or weakened. New-fixture whitespace checks produce no diagnostics; raw `--no-index` exits of 1 merely record that each fixture differs from `/dev/null`.',
'',
'## Evidence and acceptance limits',
'',
'Exact commands, exits, before/after maps, per-path ownership, token proof and immutable evidence hashes are recorded in `D-final-fixture-check-snapshot.json`. Main may consume this focused PASS for its spec draft and integration step. Any later edit to an owned test/fixture/Gallery path needs review against these hashes.',
'',
'No full/type/build/native gate, spec/ledger mutation, staging, commit, push, or child dispatch was performed. Existing unit evidence and `tools/d05/runtime-catalog.json` remain untouched. D08, whole-D static/AST/final gates and full independent acceptance are separate outstanding coordination work.',
])
report.write_text('\n'.join(lines)+'\n')
evidence_files=sorted(str(p) for p in review.rglob('D-final-fixture-*') if p.is_file() and p.name!='D-final-fixture-check-snapshot.json')
evidence_files.extend(str(p) for p in (review/'D-final-fixture-before').rglob('*') if p.is_file())
snapshot['evidenceHashes']={p:sha(p) for p in sorted(set(evidence_files))}
(review/'D-final-fixture-check-snapshot.json').write_text(json.dumps(snapshot,indent=2)+'\n')
print(json.dumps({'status':'PASS','ownedPaths':len(paths),'productPaths':1,'tests':5,'copiedModules':61,'fixtureReadmes':3,'checkerTools':2,'report':str(report),'snapshot':str(review/'D-final-fixture-check-snapshot.json'),'snapshotSha256':sha(review/'D-final-fixture-check-snapshot.json')},indent=2))
