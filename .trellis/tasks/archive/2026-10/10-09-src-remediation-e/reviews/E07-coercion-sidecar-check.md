# E07 Slice A coercion sidecar check — completed

**COMPLETED · PASS_FOR_SLICE_A. No confirmed regression or blocking finding in the assigned six paths. This is not whole E07/QG01 PASS.** The reviewer changed only the authorized sidecar files. No product fix was needed.

All six actual current hashes first matched the completed worker’s frozen after snapshots and still match at completion. The four original files match the frozen before copies and E07-entry hashes. The complete 991-file original copy matches the implementation’s recorded original manifest; E07-entry’s 773 hashes are a matching subset, with 218 additional copied config/public/vendor dependency-closure files. No Git/HEAD baseline substitution.

All 19 check.jsonl contexts plus PRD/design/implementation plan were loaded. All 171 artifacts in the supplied implementation and contract-research hash inventories remain exact, including failed attempts and producer snapshots. Exact source/report/producer/evidence/current hashes and commands are in the companion JSON and sidecar receipts.

## Independent verification

| Check | Result | Scope / evidence |
| --- | --- | --- |
| Focused real production contracts | 374 passed / 11 files | Includes all 220 new durable cases; `E07-coercion-sidecar/focused.json` |
| Extra adversarial probes | 4 passed | Real ZIP/writer/upgrade paths; `counterexamples.test.ts` and `counterexamples.json` |
| Actual frozen original compatibility | 38 passed / 182 deliberately skipped | Same test producer on original 991-file copy; `old-compat.json` |
| Scoped TypeScript | Exit 0 | Five source modules + durable test + sidecar probes; transitive compiler closure; `typecheck.json` |
| Scoped actual ESLint | 0 errors / 3 warnings | Five source owners; `eslint.json` |
| Research artifact integrity | 171 matching / 0 mismatches | `research-integrity.json` |

Every independent command used the explicit machine pnpm with machine Node on PATH and recorded zero input drift. Source mirror used a temporary sidecar directory and current installed dependencies via symlink; it was removed after execution. No installation was performed.

## Contract findings

- **Actual guarded conversion:** All 80 fresh errors matched to raw frozen diagnostics and current expressions/guards. Codec uses field-list assertions with scalar predicate; local helper executes String only after finite scalar guard/filter. No unguarded String(unknown) wrapper or new debt allowance.

- **Modern identity vs legacy graph:** Original nonempty string episode/beat FKs and primitive collision checks run before normalization. Primitive IDs can remain unreferenced without becoming modern FK targets. Missing/null IDs synthesize; explicit empty/compound known IDs reject. Missing/empty episode arrays ignore old episodeId and synthesize one scope; false/0 optional beat/scene remain absent.

- **Typed original-owner migration:** Unknown historical records, unchanged original nonempty string owner, atomic invalid-owner rejection and generated owner attachment inside no-episodes branch. No version addition. Rollback proved after earlier valid project migrations.

- **Scalar/null/whitespace compatibility:** Exact authored strings/empty/whitespace and number/boolean spelling retain per-field nullish fallback. Member null -> literal null differs from prose null -> empty/default. Cover trims only the existence probe and remaps the untrimmed key. 38 selected source characterizations independently pass on actual frozen original and within current 374.

- **Compound recovery and script evidence:** Known compound package fields reject with location before persistence; local reads recover prose/default and drop compound references. Canonical scalar current media stays authoritative; unusable current may recover scalar legacy. Recovered compound beat IDs avoid canonical/nullish/recovered collisions. Malformed excerpt/offset/stale script drops association without dropping beat/content.

- **Raw source revision and CAS:** Episode/beat writer normalized baselines still merge unrelated changes and reject competing same-field changes. Raw targetRevision stays distinct from rendered recovery. World-setting owner compares raw baseline, so malformed worldview displayed empty cannot overwrite raw object; conflict is retained and tested. This bounded review does not authorize writer changes.

- **Unknown extension/future profile/media/style:** Structured extras/provenance/future generation defaults remain preserved; independent restores allocate distinct media IDs and retain exact media bytes plus current/reference/video roles. Undefined style inherits; explicit null or missing explicit style stays null. Export narrowing retains actual aggregate/singleton APIs and internal bodies.

The diagnostic matrix matches **all 80 entry errors**, including 66 no-base-to-string sites, to exact original expressions and actual current guards. The field-list assertions dominate the codec String calls; the local helper’s finite scalar branch/filter prevents compound values from reaching String. Its default recovery is a deliberate contract, not an unchecked wrapper. Remaining parseShot complexity21 and memory validation complexity26/cognitive21 have real optional/default/relationship and aggregate ownership/version/cycle obligations. No new debt entry or suppression was added or authorized here.

The 220 tests are meaningful behavioral assertions: real ZIPs, actual restored fields and relations, repeat exports/imports, all-table equality on rejection, real Dexie migrations, and writer CAS. They do not mirror only helper implementation. The 374 suite retains cross-episode/collision, asset, audio, future profile, discovery, history and existing text CAS tests. The four sidecar probes add exact blob bytes/current-vs-reference roles across two restores, same beat ID in independent episodes, canonical recovered-ID name collisions through actual patchStoryBeat, nested offset path rejection with seeded blob verification, and invalid-owner rollback after two earlier valid owners had already migrated.

The raw world-setting limitation remains visible: rendered malformed worldview recovers empty, but updateWorldSetting compares raw persisted data and rejects that normalized empty baseline. Source revision hashes also remain raw. The slice does not claim automatic repair or silent overwrite. The original/current test policy change for malformed IDs/prose/evidence is explicit; primitive positive compatibility is independently exercised on both source versions.

Five export narrowings retain bodies/internal users and the db singleton/aggregate normalizers. Actual current source/test/stable-script search found internal occurrences only; the frozen full/test Knip receipt has no owned issues. No whole repository unused PASS is inferred from that command’s global exit1.

## Frozen sources

| Path | Before SHA-256 | Current / review-after SHA-256 |
| --- | --- | --- |
| `src/lib/packages/projectPackageCodec.ts` | `132f14d352120fa732b4ae9b4148e4f5fdde4fd000116be43ded3c21e17402da` | `a0b273442d7a8eb3e204e2ab0b6eca42e42d01494cbfb4781c08e1013489167c` |
| `src/domain/types.ts` | `ec78e60ae3ddcb9c06299954a5c07c59adae535d1dd400821e5ec0aaf37f7204` | `2fd6270b0a2a97ed725148046ef67d2875fee04d7107ef22d8f212cdd9cce78f` |
| `src/domain/slot.ts` | `13dc3767e2114e1793c01a09beeaa6d4d708e06e87b3458bce83cb3bbdc14cd5` | `92f23cbcd33bf46b330e6473378f14bcf1ee8aeb50414abeaf7a4b0171f68c91` |
| `src/db/database.ts` | `9341c96f7adb202f51334250e45188e9964e363b831b0d89eca38018ad1c3982` | `22bcb0693e9b7dc7d559e3a9439566566d9afc125ac7f9c4d32102534f41f37f` |
| `src/domain/legacyScalar.ts` | `new` | `bfe4effb141c407fa2e4618da3c4fedd623a1cf812798cd6fb9eb45dae2c7a8a` |
| `tests/e07CoercionContracts.test.ts` | `new` | `5a691cc4fd08e112119836b1dfe9f88f3cc30b0ab82ec225fa10687b52edaa7b` |

## Supplied report hashes

- `.trellis/tasks/10-09-src-remediation-e/research/E07-coercion-implementation.md`: `cb1ca7f56ebb81d764264d73c5d1512c841a9d481d1b15817831040295590608`
- `.trellis/tasks/10-09-src-remediation-e/research/E07-coercion-implementation.json`: `a4021d14a4ba4faa26f0d517aa24edf208cea329b610a7692601023f745d17aa`
- `.trellis/tasks/10-09-src-remediation-e/research/E07-coercion-contracts.md`: `cefc49c3fb2c986148e769f667b689702a48b4db37da6c359705d077390cf747`
- `.trellis/tasks/10-09-src-remediation-e/research/E07-coercion-contracts.json`: `1880ddc4dcdf30c67a8564b1782bfada7d7d6e7c000720091bbfa23239a31c28`

## Limits and retained failures

- COMPLETED / PASS_FOR_SLICE_A only. No whole E07/QG01 acceptance, task/status/spec/ledger/commit/CI execution claim.
- Actual test runtime Node24.11.0, explicitly authorized machine pnpm10.15.0; no install. Original-source mirror shares current installed dependencies; it is not a clean locked install or Node22 proof.
- IndexedDB upgrade and CAS use fake-indexeddb, not native browser IndexedDB. No full suite, native, build or model commands run.
- Three codec complexity signals remain: parseShot complexity21; parseMemoryPackage complexity26 and cognitive21. Their branch responsibility was reviewed; this sidecar writes no debt allowance and does not settle whole-gate policy.
- Raw world-setting malformed-prose save conflicts by existing writer policy. Normalized display recovery does not repair raw storage or grant CAS eligibility.
- Unused evidence adopts frozen scoped full/test Knip and actual current symbol search; no independent whole production/full unused gate rerun or formal gate self-test execution.

Two sidecar-only evidence-builder matcher failures are retained with their producer versions. Generic function syntax and multiline parameter braces were corrected; current guard anchors were then checked against source. These were not product or test failures. No A source, shared config/package/spec/ledger/status, full suite/native/build/model command, installation or Git operation was performed. Main owns final source integration and whole-E07 acceptance.
