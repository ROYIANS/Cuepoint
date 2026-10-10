# Independent workspace-foundation check

Date: 2026-10-10. Reviewer: `workspace_foundation_check`. Status: accepted within the workspace-foundation child boundary. All three initial behavior findings are repaired and independently verified. The coordinator retains final generated-route formatting cleanup and task lifecycle ownership.

## Scope and method

Read the child PRD, design, execution plan and curated check manifest, together with frontend state-management, asset-output, quality and type-safety contracts. Reviewed the entire new workspace/hash modules, importer integration, production-revision refactor, binary fixture, all three workspace tests and the immutable original-source comparator. Followed the real `putMedia` owner, importer callers and audio-arrangement history producer paths. No product UI, provider, native filesystem or real-user migration was exercised.

The initial source manifest and raw observation values are retained in [pre-fix-observations.json](./independent-probes/pre-fix-observations.json). The original observation program is frozen in [pre-fix-review-probe.test.ts](./independent-probes/pre-fix-review-probe.test.ts); its assertions deliberately confirm the observed failures rather than declare acceptance. It has been removed from the permanent test suite to avoid tests that require defective behavior.

## Confirmed findings, repaired and independently verified

### F1 — Blocking and allocation regression at the integrated video importer

- Location: `src/lib/workspace.ts`, original `copyIntoManagedWorkspace` full-file `arrayBuffer`, copied Blob and synchronous `sha256Bytes`; `src/lib/sha256.ts` allocated a second full padded byte buffer.
- Trigger: the actual `uploadMediaFile` importing 32 MiB and 128 MiB video Files. The comparison calls the original direct-Blob `putMedia` boundary under the same fake-IndexedDB runtime.
- Observation: 32 MiB managed import took 459.8 ms with a 460.9 ms event-loop gap; 128 MiB took 1,842.9 ms with a 1,844.0 ms gap. Original direct-Blob calls took 1.48 ms and 0.42 ms. The 128 MiB managed operation's sampled process RSS rose from approximately 539 MB to 942 MB.
- Mechanism and impact: synchronous full-file hashing prevents timers, input and cancellation from running until the hash finishes; copied byte working buffers add allocations proportional to file size. The current importer has no size cap and is already integrated into normal image/video selection, so a note about a future native adapter does not close this regression.
- Approved bounded remedy: keep synchronous revision hashing, add incremental bounded byte hashing for imported media, chunk source reads/copies, yield to the macrotask queue and check cancellation before committing. Retain source independence, read failures, no-ready-row semantics and ordinary HTTP compatibility.
- Limits: the measured gaps are actual JavaScript blocking on local Node v24.11.0, not a native browser paint benchmark. Fake IndexedDB excludes browser disk cost. RSS is a before/after observation, not exclusive or peak memory.
- Repair verified: 256 KiB source slices, independent per-chunk Blob parts, incremental `Sha256` compression state, real macrotask opportunities and cancellation checks. Synchronous `sha256Bytes` remains available for small revision tokens. Current importer retains ordinary-HTTP support, source-read failure identity, incomplete-read rejection, transaction owner and ready-row discipline.

### F2 — Authored identities alias on case-insensitive filesystems

- Location: `src/lib/workspace.ts`, original `pathComponent` kept ASCII letters unchanged through `encodeURIComponent`.
- Trigger: project/media identities `Project` / `Media` versus `project` / `media` produce different relative strings with identical lowercase forms.
- Mechanism and impact: the module and its test explicitly accept authored/legacy identities, so its cross-platform contract cannot rely on `createId` currently generating lowercase UUID strings. Such paths alias on common Windows and macOS filesystem configurations.
- Approved remedy: lossless UTF-8 lowercase-hex components, preserving stable identity separation and owner/path validation. Reject unpaired UTF-16 surrogates before TextEncoder, since replacement would otherwise alias them with valid U+FFFD identities. Native platform length and symlink containment remain separate adapter requirements.
- Repair verified: case-folded locations differ for the original Project/Media pair. Formal tests cover the full valid-ID Cartesian set, Unicode spelling/normalization, separators, reserved characters, malformed surrogates, uppercase/noncanonical encoded paths and both POSIX/Windows supplied roots.

### F3 — Audio-arrangement history references silently omitted

- Location: `tests/helpers/workspaceBinaryFixture.ts`, selected transaction tables/projections omitted `audioArrangementProposals`.
- Trigger: an arrangement row referencing missing choices, nested selection-take media, item/clip/before and receipt take identities returned zero references and zero issues.
- Evidence: `src/domain/audioArrangement.ts` defines those historical snapshots, and `src/db/audioArrangement.ts` actually saves/applies them. They are durable IndexedDB records, rather than hypothetical extension fields.
- Impact: the fixture's claim to enumerate current known media/reference/history owners was incomplete. In particular, an embedded historical `selections[].take.mediaId` must not disappear merely because its live take row has gone.
- Approved remedy: selected-field projections for all explicit arrangement take/media references, preserving historical embedded identities and reporting missing/foreign media and live references without transporting raw execution owners, claims or approval envelopes. Validate using actual preview/save/apply producers and focused malformed disposable fixtures.
- Repair verified: the original missing-reference observation now returns 11 references, with the embedded take identity resolved independently of the live take table and all 10 missing live/media references explicit. Added formal tests execute actual preview/save/apply producers, preserve historical snapshots after live take deletion, report foreign embedded/project/media/receipt owners and force unreadable Blob observations without mutating records.

## Repaired import measurements

The same import loop, byte sizes, original `putMedia` comparison and event-loop observer were repeated. Raw output and repaired source hashes are retained in [post-fix-probe-output.txt](./independent-probes/post-fix-probe-output.txt), [post-fix-observations.json](./independent-probes/post-fix-observations.json) and [post-fix-review-probe.test.ts](./independent-probes/post-fix-review-probe.test.ts). The temporary measurement test was removed from the permanent suite after capture; permanent behavior tests assert actual bounded reads, timer execution before the next chunk, cancellation and byte/hash equivalence without fixed hardware timing thresholds.

| File size | Before managed total | Before longest gap | Repaired managed total | Repaired longest gap |
| --- | ---: | ---: | ---: | ---: |
| 32 MiB | 459.8 ms | 460.9 ms | 582.0 ms | 6.79 ms |
| 128 MiB | 1,842.9 ms | 1,844.0 ms | 2,280.0 ms | 9.85 ms |

The 128 MiB sampled RSS increase fell from about 403 MB to about 134 MB; GC/runtime differences prevent treating this as exclusive allocations or peak memory. Total managed import time increased by roughly 437 ms in this run because the chunked copy yields between chunks. This is an accepted responsiveness/integrity tradeoff, not a throughput improvement claim. Stored source/copy bytes still require content-sized storage; no native or browser rendering performance guarantee is inferred.

## Initial verification and provenance

- Root `lint` / strict application TypeScript passed before repair.
- Independent targeted regression batch passed: 12 files / 198 tests, including all three workspace files, media metadata/picker/patch, production revisions/proposals, asset foundation, project package, audio foundation and audio arrangement. These green tests did not cover the three defects above.
- `cmp` established that `tests/fixtures/workspace/originalProductionRevision.ts` exactly matches `8b8b709e:src/lib/productionRevision.ts`; its SHA-256 is `1ee25abc919f5366adc71a3af1b43fb934d12da78acf2e00364ca4423636827e`. Original canonicalization/target validation bodies and standard hash outputs were reviewed and executed by the compatibility tests.
- The implementation owner's earlier complete suite/build/model/quality evidence is recorded separately in implementation-notes.md. That initial evidence is not used as acceptance after repair; the repaired complete gates below match the final reviewed sources.

## Final verification

- Independent root `lint` / application TypeScript: PASS, exit 0; [independent-final-lint.log](./independent-final-lint.log).
- Independent strict TypeScript 5.9.3 program with the application's actual compiler options plus all five workspace tests, helper and immutable comparator: PASS, exit 0; [independent-final-test-types.log](./independent-final-test-types.log). No test was excluded to obtain a passing result.
- Independent final adjacent regression: 17 files / 376 tests passed, exit 0; [independent-final-targeted.log](./independent-final-targeted.log). Includes the five workspace files plus media metadata/patch/picker, production revisions/proposals, asset foundation, project package, audio foundation/arrangement/Agent/package and E04 retention.
- Reused repaired complete-suite evidence from the implementation owner: 186 files / 3,284 passed / one existing skip. The implementation-notes retain the first corrected suite's deep-array assertion timeout and its exact-content Buffer-equality correction, rather than omitting that failed run.
- Reused repaired production build evidence: PASS. No dependency or model/config change accompanied the repairs; the existing chunk warning remains.
- Repaired formal quality output was independently inspected and matches frozen authored sources: PASS, zero lint/architecture/unused failures, zero static cycles, 13 reviewed lint allowances, seven retained unused contracts and 548 visible review warnings. The gate counts 442 authored graph files, 1,798 static value edges and six literal dynamic edges; these are scope counts, not performance evidence. Raw output: [repair-quality.log](./repair-quality.log).
- Repaired quality self-test: 88 cases passed; [repair-quality-self-test.log](./repair-quality-self-test.log). Repaired model catalogue verification: 197 files / 85 providers / 1,855 models, verified revision `ebe586289d55936b738e4dc822dbdd745196b4f3`; [repair-model-bank.log](./repair-model-bank.log).
- `git diff --check`: PASS. Source/test/spec hashes and per-file review notes are frozen in [independent-final-manifest.json](./independent-final-manifest.json).

The coordinator replaced the oversized context manifest entry with `research/retained-owner-contracts.md`, preserving complete Studio/C03/D02/E04 sections from the original authoritative state-management spec. This avoids future hook truncation; the reviewer read the actual applicable source/spec sections and does not infer complete review merely from an injected hook. The new coordinator-authored `workspace-storage.md` was reviewed against the current code, including nonpersistent browser identity, lexical-only containment, bounded hashing, stage/commit cancellation and fixture limitations.

## Remaining findings and limits

No remaining behavior, type, lint or missing-test finding blocks this child. Durable native files, actual-root/symlink containment, SQLite migration, persistent cross-device workspace identity, checkpoint serialization and providers are outside this child's approved scope; the code and new spec state those boundaries.

`src/routeTree.gen.ts` was token-equivalent to HEAD and restored after the repaired build, according to the implementation owner's recorded proof. An external generator later reapplied formatting. Independent TypeScript lexical token kind/value comparison (excluding optional semicolons) also passed against the current generated file; hashes/token count are retained in [independent-generated-route.json](./independent-generated-route.json). The coordinator traced the generator to the user's WebStorm-owned `npm run dev` process and will preserve that service. Root owns final formatting restoration after the later child source work; this review does not silently revert a shared generated file or stop the user's service. Generated formatting is kept separate from the authored source manifest and must not be bundled as unexplained product work.

## Reviewer boundaries

No product, planning, lifecycle or spec files were changed by this reviewer. All three findings were returned for coordinator-approved bounded repair by the implementation owner, rather than silently changing a public path format or hashing strategy. This reviewer owns the independent observations, report and manifest. No commit or push was performed.
