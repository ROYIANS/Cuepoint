# D final durable-fixture focused check — PASS

**Focused PASS** for the authorized test-fixture portability correction and Gallery trailing-newline correction. This does not accept D08, close findings, or establish whole-D acceptance. Main may integrate the exact hashes below into `D-final-fixes-check-snapshot.json` before its ordered final gates.

## Concrete failure and correction

The D05 schema/parser and EX01 memory comparators, D06 capability comparator, and D07 wire comparator imported original implementations from the active task directory. Task archival moves that directory and breaks those imports. The D05 tool catalog test also wrote a verification artifact into the active task, despite already asserting the live catalog. Four comparator files now import durable `tests/fixtures/sourceSnapshots/{d05,d06,d07}/src` copies. The catalog test only loses its `writeFileSync` call and unused import; all live assertions remain.

Before editing, each of the five test hashes matched its latest accepted D05/D06/D07 `after` map. Gallery matched accepted D03. `D-final-fixture-entry.json` records those hashes, accepted snapshot hashes and null before values for the new copied modules; the final snapshot records null before values for all 64 new fixture/provenance files.

The copy contains 61 exact original files: D05 44, D06 3, D07 14 (562,215 bytes), plus one README per group with the original hash manifest. AST discovery follows actual import/export declarations, import types, and literal dynamic imports/require, preserving hierarchy and checking all 133 traversed relative edges. No snapshot JSON is required by the executed closure. Existing `@/` imports keep the existing policy of resolving current source. Original files were copied, never moved or modified.

D07 retains its two existing `vi.mock` factories, now targeting the durable module IDs. Both factories still import the real current `modelMetadata`/`visionCapability` modules, proven byte-identical to their originals. Their exact original fixture files exist for mock resolution; historical outgoing dependencies at these existing mocked boundaries are not executed. The current module graph retains its real model-bank JSON inputs, included in the isolated copied source; `vendor/lobehub/manifest.json` is also copied. No parser mocks, canned comparator outputs, or new mocks were introduced.

An exact authorized-transformation check compares every test against its captured before bytes. It permits only the path substitutions and removal of the single catalog write/import. It independently counts identical `expect(...)` calls before/after and confirms no `.trellis` references in the five corrected tests. All 61 original/copy hash pairs and protected historical runtime-catalog/accepted snapshot hashes remain equal.

## Before / after attribution

| Path | Unit | Accepted before SHA-256 | Corrected after SHA-256 |
| --- | --- | --- | --- |
| `src/components/studio/ProjectGalleryPage.tsx` | D03 | `d7ad89db117469718b22d17f3538a87c6833fa1b978bc7b4cfc4a92964e42248` | `f3fd110028e6219c298e7ee8bda70f840906effaeb8b1986921784b2120c0c94` |
| `tests/d05SchemaEquivalence.test.ts` | D05 | `2546159f90c80d5a4bf1e0cf56dafa622206fcee7444862b5d3ed23eb2c93ffb` | `336648b590a172fbaad0fe1ebb3f5f8cc6b209c5c1a47a4173f7964dea3d6567` |
| `tests/d06Capabilities.test.ts` | D06 | `8f7f7372be0298c1795428e89d949bcca26235db60e446e1d4325b0f2c18c74f` | `6a80ad83d97a24df1481b91c3aa64d18defb5c68eaab327a6167e8ef5f6c54ac` |
| `tests/d07RequestWire.test.ts` | D07 | `ae006a78ba25b7bfd21050cbc659b75fab244c66f464d97eec6d5316d4ef9e06` | `e88a7a3dd865c44598907608060b0bb8bebb9267c75ed38089660aa749b3ae34` |
| `tests/memoryRetrieval.test.ts` | D05 | `3c3e5b316b205d71710458fbd605f95cc4731ead37954ef61e110c7eea52f456` | `a4e59a39bf6314718603a30b8ae5609e68fc8898f78abda8f69680ac4ad98060` |
| `tests/d05ToolCatalog.test.ts` | D05 | `f09ccfb5112cf6875fddd12dc6f64a4efd52f2d6df4bad39974a51d11d44d1fd` | `cee9063c182c80906a0d03f16a637f0869b7145180274b443e008c69857f0d7b` |

Every one of the 64 new fixture paths has `before: null`, its exact after SHA-256, and D05/D06/D07 ownership in `D-final-fixture-check-snapshot.json`. The two new `.mjs` preparation/verifier producers are also explicitly included in the same before/after maps with null before and D05 attribution, matching whole-D review-tool scope. The completed snapshot has **72 attributed paths**: one Gallery source, five tests, 64 fixture/provenance files and these two producers. The Python archive/finalization runners remain verification artifacts whose exact hashes are in `evidenceHashes`. Original/copied module hashes are also in each group README and `fixtureOriginalHashManifest`. No D08 product/test path occurs in the correction before/after or attribution maps.

## Gallery whitespace proof

Only one trailing newline byte was removed from `src/components/studio/ProjectGalleryPage.tsx`. TypeScript **5.9.3** parses both captured versions as TSX with zero diagnostics and **3,451 identical terminal token kind/text pairs**. The before/after token hash is `2e4a0c5c63abc4f30a454590e01b76366518003e81819681516f90b40a60737b`. Exact text comparison permits only trailing newline normalization. `git diff --check -- src/components/studio/ProjectGalleryPage.tsx` now exits 0. No Gallery behavior test is needed for this byte-only correction.

## Focused checks and archival simulation

| Check | Result | Exit |
| --- | --- | --- |
| Authorized edits, assertion counts, original bytes, 133 relative edges, protected history, TSX tokens | PASS | 0 |
| Corrected host focused run, 5 files / 53 tests | PASS, 1.456 s | 0 |
| Isolated no-`.trellis` focused run, 5 files / 53 tests | PASS, 1.415 s | 0 |
| Gallery scoped whitespace check | PASS | 0 |

Both Vitest invocations use the same explicit machine command:

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/d05SchemaEquivalence.test.ts tests/d06Capabilities.test.ts tests/d07RequestWire.test.ts tests/memoryRetrieval.test.ts tests/d05ToolCatalog.test.ts --maxWorkers 4
```

The archive runner creates a separate temporary project, copies `src`, the durable fixture tree, the five tests, shared setup/config/package, catalog fixture and vendor manifest, and links only the existing `node_modules`. It copies no `.trellis`, adds no host-source link, and never hides/renames/deletes the accepted active task. The isolated directory has no `.trellis` before or after the subprocess, all copied input hashes stay unchanged, and all 53 real assertions pass. The temporary root is retained for inspection at `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/aifenjing-d-final-fixture-archive-9k1ljo2h`.

`D-final-fixture-archive-result.json` records the exact isolated input hashes used by that subprocess. This is input provenance for the isolated run, not a claim that concurrent host/D08 source is globally frozen or owned here. D08 writer `01a11a66-075d-7181-9d89-7792aa047a62` confirmed no heavy gate was running or queued before the isolated gate, waited for it, and was notified when it finished. The prior host focused gate was already complete when the coordination request arrived.

Both focused subprocesses have a 180-second cap and four workers. The first naive closure discovery failed at absent historical `./modelBank` beneath an existing D07 mock; it was repeated once to preserve the same failure log, then corrected by respecting the existing factory boundary. These two pre-edit setup failures and their exact command/log remain in `preservedFailures`; no failing product test was suppressed or weakened. New-fixture whitespace checks produce no diagnostics; raw `--no-index` exits of 1 merely record that each fixture differs from `/dev/null`.

## Evidence and acceptance limits

Exact commands, exits, before/after maps, per-path ownership, token proof and immutable evidence hashes are recorded in `D-final-fixture-check-snapshot.json`. Main may consume this focused PASS for its spec draft and integration step. Any later edit to an owned test/fixture/Gallery path needs review against these hashes.

No full/type/build/native gate, spec/ledger mutation, staging, commit, push, or child dispatch was performed. Existing unit evidence and `tools/d05/runtime-catalog.json` remain untouched. D08, whole-D static/AST/final gates and full independent acceptance are separate outstanding coordination work.
