# Partial checkpoint/provider implementation evidence

Date: 2026-10-10. This child adds a pure protocol boundary and disposable transport/device fixtures only. It implements no production table codec, database migration, native filesystem access, live service, provider authentication, plugin marketplace, UI or paid execution.

## Exact supported format and authority

The sole format is `cuepoint.protocol-fixture.v1`, schema version 1. Every manifest declares `coverage.kind: partial` and the exact included fixture variants `project` and `media`. These variants are disposable projections, not the production `projects`/`media` table shapes. A single fixture project is required; Studio, shared/global media and nested material/history codecs are unsupported. Project records carry only kind, stable ID and authored title. Media records carry only kind, stable ID, owner project ID, optional authored title, canonical workspace reference and required binary ID. Binary entries carry only logical binary/media/owner IDs, canonical workspace reference, MIME, positive safe byte size and lowercase SHA-256.

`checkpoint.ts` validates all accepted object keys and variants, rejects browser-local workspace identity, unsupported schema/format/coverage and malformed/duplicate identities, derives every owned path with the accepted `mediaWorkspaceRef`, and closes the entire fixture record/binary graph under its single owner. Authored title text remains content; keyword-like text is not redacted. There is no generic raw-record or opaque JSON export facility and no promise to scrub secrets typed by users into allowed content or binary files.

Revision identity hashes the canonical manifest content, excluding its own revision ID. Exact code-unit ordering sorts semantically unordered parent, record, binary and coverage lists. Unicode normalization/collation does not merge identities. Duplicate parents and immediate self-parenting reject; no full ancestry graph proof is claimed. Initial head publication requires `expectedHead: null` and zero parents. A noninitial candidate includes its frozen expected head in its parents.

## Immutable preparation and delivery

Preparation snapshots all metadata and mutable sources before yielding. Blob sources are immutable; mutable ArrayBuffer/Uint8Array sources receive owned copies. Complete reads and SHA-256 updates use at most 256 KiB per turn, with real macrotask opportunities between chunks and between binaries. The incremental digest is reused; no complete media buffer is synchronously rehashed afterward. Public writable byte views are copies of the private snapshot. Records, entries, nested references and arrays are frozen. Publication accepts only protocol-created preparation certified by a private WeakSet, so structural forged/incomplete/duplicate sets are not evidence of verification.

The complete snapshot still consumes content-sized storage and copies. Allocation, buffer snapshotting and returned complete byte copies are separate from bounded hashing. This foundation does not prove constant memory, disk materialization, media decoding, native performance or OS containment. A caller supplies a real portable workspace ID; the child does not persist that identity.

Delivery binds the manifest to the requested workspace and revision, downloads every required object and verifies its full size/hash before calling the trusted application port. Publication acknowledgement and application receipt have distinct kinds. Only the application owner checks and commits its ledger and records/files together; successful verification alone never means applied. Receipt identity and boolean outcome are checked before reporting application evidence.

## Trusted provider boundary

`syncProvider.ts` exposes explicit trusted factory registration and capability/lifecycle contracts. No module or native code loader exists. This is an internal interface, not a sandbox for arbitrary third-party JavaScript. Device-local credentials are represented by opaque handle metadata; there is no credential vault or real authentication implementation here. Publication/delivery/listing, conditional-head support, cancellation, progress and media limits are enforced by orchestration. Closed sessions cannot proceed. Closing/listing does not delete local content.

Objects are addressed by `sha256:<digest>`, scoped by workspace, while logical media/binary IDs remain in manifests. Required immutable objects and manifest are staged before head CAS, including candidates whose expected head is already stale. Failed CAS retains both candidate manifests and content versions. Remote staging does not mean the head advanced. Actual CAS result shape/head identity is checked; a result with truthy nonboolean `updated` cannot produce acknowledgement.

Operation inputs (`expectedHead`, signal and progress callback) are captured before asynchronous work. Progress callbacks are followed by actual pre-CAS lifecycle/cancellation checks. Provider failure or cancellation leaves the caller's prepared object reusable. Once an atomic CAS commits, its actual result wins over later cancellation. A transport exception can leave remote commit state uncertain; the child does not claim an exception proves no remote change.

The disposable application fixture stages maps, checks cancellation after asynchronous preparation and before its synchronous atomic state/ledger commit, and reports committed receipts even if cancellation arrives afterward. Tests use two independent POSIX/Windows-shaped local roots and independent maps/ledgers; retaining one fixture state across a new application-port instance proves logical restart/repeated delivery only. It is not SQLite/filesystem atomicity or native crash recovery.

## Required production codec gates

All 49 durable production tables remain outside this fixture codec. Before actual full-workspace sync, reviewed portable field projection, reference/binary closure, version compatibility and supported application ownership are still required for:

| Group | Tables requiring reviewed codecs |
| --- | --- |
| Production entities and media | projects, characters, scenes, props, styles, episodes, shots, media |
| Audio/music documents, outputs and retained execution | audioChapters, audioSpeakers, audioSegments, audioTakes, audioTracks, audioClips, audioExports, musicDrafts, musicWorks, audioGenerationJobs, audioGenerationBatches, audioGenerationBatchItems, audioArrangementProposals |
| IP/material library and retention | ipProfiles, projectIpLinks, libraryMaterials, materialVersions, materialUses, materialEvents |
| Research, references and project memory | searchConnections, projectReferences, referenceChunks, projectMemories, projectMemoryVersions |
| Agent content, history and execution | agentTaskWrapups, agentTaskWrapupVersions, agentGenerationBatches, agentGenerationBatchItems, agentGenerationJobs, contextCompactions, agentTasks, agentToolCalls, agents, agentRuns, productionProposals, agentTaskRecords, agentTaskRecordVersions, chatThreads, chatMessages |
| Connector metadata and aliases | connectors, connectorAliases |

Sensitive connector fields need device-local exclusion; opaque result/history/continuation fields require individual semantic review. Any supported imported execution history must remain dormant and cannot import runtime claims, paid authorizations or automatic retries. Native workspace identity/persistence, migration backup/rollback, actual-root containment, authenticated service durability/retention/economics and user-facing handoff/history/restore remain separate parent gates. Existing ZIP formats remap identities and are not used as sync codecs.

## Validation history and source provenance

Initial writing exposed ordinary test/compile problems (canonical syntax/tuple typing, test mutation of a frozen object, a mistaken preparation-vs-delivery truncation assertion and round-trip ordering). These were corrected before the first source freeze. All final formal test code is strictly typechecked; intentional malformed-boundary values are explicitly test fixtures.

The first frozen slice passed 65 focused tests, strict app/test TypeScript, seven protocol/workspace files with 121 tests, and the full suite with 188 files / 3,349 passing tests plus one existing skip. Independent review then disproved three boundaries: mutable expectedHead TOCTOU, progress-triggered closure before CAS, and fixture cancellation during precommit staging. An additional retained-source probe disproved accepting a truthy nonboolean CAS result. These initial results are not final acceptance. The reviewer preserved the first frozen source and raw failing probes under `research/first-freeze-source/`; the original manifest is retained in `initial-implementation-source-manifest.json`.

The corrected implementation snapshots all operation inputs, rechecks actual lifecycle after callbacks immediately before CAS, validates runtime CAS shape/identity, and separates fixture precommit cancellation from postcommit success. Permanent regressions bring focused protocol/provider coverage to 71 tests. The final six-file hashes are frozen in `implementation-source-manifest.json`; product/test source was not edited while the final gates ran. The immutable original production-revision comparator and all accepted workspace/hash/importer helpers remain untouched by this implementer.

The next freeze passed the full suite (3,355 passing / one existing skipped) and build, but serial quality found seven new unsafe/redundant type diagnostics and 18 unused named exports. That failed log is retained as `final-quality.log`. The quality repair removed unused singleton/conflict/map APIs and narrowed unused named types/constants to internal contracts, preserving required shapes through exported owner interfaces and indexed types. Typed Map input is now the only binary-source collection accepted by verification. Unknown arrays/history are narrowed explicitly, and cancellation is thrown after an awaited macrotask. The entry-captured application method remains bound to its owner. No allowance was added. `pre-quality-repair-source-manifest.json` retains the prior hashes; `implementation-source-manifest.json` now records the quality-repaired final freeze.

Final gate results are recorded below. All commands use the explicit local pnpm at `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` and local Node v24.11.0. No dependency installation, server termination, lifecycle/spec changes, commit or push occurred in this implementer run. The coordinator owns final generated-route cleanup and lifecycle/spec/commit work.


## Final quality-repaired gate results

All eight commands exited 0 under the frozen six-file source. Exact argv, exit codes, raw log paths and wall times are recorded in `quality-repaired-final-gates.json`; post-gate hashes match in `post-gate-source-verification.json`.

- Application `lint` and extra strict formal test/helper TypeScript checks: PASS.
- Seven protocol/workspace regression files: 127 tests PASS, including the 71 protocol/provider cases.
- Complete Vitest suite: 188 files PASS; 3,355 tests PASS and one pre-existing skip.
- Production Vite build: PASS. The existing warning for chunks larger than 500 kB remains; no warning-free build claim is made.
- Serial quality: PASS. The existing 13 reviewed lint allowances and 554 visible review warnings remain. Lint, architecture and unused failures are zero; 444 owned graph files, 1,802 static value edges, six literal dynamic edges and zero static cycles. No allowance was added.
- Quality self-test: PASS, all 88 cases.
- Model-bank verification: PASS, 197 files / 85 providers / 1,855 models at revision `ebe586289d55936b738e4dc822dbdd745196b4f3`.
- `git diff --check`: PASS. Source checksum verification: all six frozen files match after gates.

The independent reviewer separately reported 27 adversarial probes, 127 affected regressions and strict TypeScript passing on the quality-repaired source, with unchanged scoped before/after hashes. Their raw evidence and acceptance report remain independently owned. Nothing in these disposable fixtures certifies native persistence, all-table codecs, real hosted service durability or offline user handoff.

Tool versions verified from the required local paths: Node v24.11.0 and pnpm 10.15.0. The local pnpm version has changed from the historical AGENTS comment but matches the current project packageManager. No Codex Runtime pnpm, installation or dependency churn occurred.
