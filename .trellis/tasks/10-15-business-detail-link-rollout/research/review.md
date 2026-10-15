# E16 independent review

Status: **FREEZE — ready for the parent to commit the accepted finite slice.**

Reviewed on 2026-10-15 by the dispatched `trellis-check` agent. No nested agents, Git mutation, build, installation, broad wrapper/suite, native execution or paid/live service was used. The entire `.trellis/tasks/10-15-agent-resource-capabilities/` tree belongs to future E06 planning and is excluded.

## Findings (fixed)

### 1. An old return API could hang after actual provider teardown

- Files: `packages/studio/src/app/details/BusinessDetails.tsx:96`, `tests/businessDetails.test.ts:147`.
- Issue: `open` rejected work after provider teardown, but `returnToOrigin` still searched the retained accepted-slot ref. An external holder of that API and its old origin token could create a new return attempt and publish into an unmounted provider. Teardown cleanup had already run, so the new Promise never settled.
- Reproduction: extended the existing actual provider-unmount test to invoke the retained return API. Before the fix, its settlement spy had zero calls where one `stale` settlement was required.
- Fix: apply the same `alive` ownership check at the return entry point and resolve `stale`. No new API or state machine was introduced. The regression also proves no origin callback fires after teardown.
- Evidence after fix: actual facade/unavailable/host/batch suites, **5 files / 34 tests passed**, zero React act warnings. This batch includes the real StrictMode, deferred admission, actual teardown and batch-origin cases.

### 2. A regular draft-controller method was misclassified as a Hook

- File: `packages/studio/src/features/library/ui/AssetTextField.tsx:30`.
- Issue: the new callback invoked the destructured ordinary method named `useLatest`. Scoped ESLint rejected that invocation under `react-hooks/rules-of-hooks` (one error). It is a draft-controller action, not a Hook.
- Fix: alias the returned method locally as `resetToLatest` and use that name in the callback and dependency array. The shared controller API, quarantine order and discard behavior remain identical. No suppression or quality-policy change was added.
- Evidence after fix: real asset panel/query suites, **2 files / 19 tests passed**; final direct Studio types passed; scoped ESLint over all 17 production files passed with zero errors.

## Findings (not fixed)

No known unresolved behavioral defect remains within the accepted E16 scope.

Scoped ESLint exposes **12 non-blocking warnings**: 11 complexity/cognitive-complexity/nested-ternary warnings in `AgentGenerationBatches.tsx`, and one complexity warning in `AssetDetailContent.tsx`. They remain visible. Splitting these owners is a separate design/refactoring decision; this review did not add suppressions, baseline debt or policy allowances. The concrete handoff branches, typed query switch, retained commands and their failure paths were reviewed and covered by the focused evidence below.

Project/episode workspaces, collection links, material, IP, memory, task/thread workflow and audio/music project destinations retain the explicitly documented coverage boundary. They are follow-up scope, not claims of completed detail rollout.

## Full changed-scope review

Reviewed all **17 production TS/TSX files**, **12 changed/new test files**, **2 quality/discovery files**, and **4 changed canonical/index specs**. The task check context, PRD/design/implementation plan, composition contract and all three worker notes were read. The E01 reading guide's large component/state/quality specs were read in bounded chunks, including the quality guide's omitted tail. Review and final digests are recorded in `review-scope.json` and the identical tracked `review-scope.md` mirror.

- **Application facade and host:** finite canonical/hash parsing; exact typed target agreement; primary/modifier/download/caller-cancel anchor behavior; separate retained shot/asset families; serialized request IDs; connected committed-frame admission; refusal/busy/stale outcomes; guarded origin return after removal; replacement retirement; incoming lazy failure retaining the outgoing owner; StrictMode setup replay versus actual teardown. The existing ShotDetails facade delegates into the same owner. Both feature adapters freeze a guarded candidate and identify refused incoming requests correctly.
- **Library read/write flow:** exact project/Studio owner discriminator and actual project existence; selector-captured envelope and independent returned-row validation; old observation retirement; four kinds in both ownership modes; local loading/missing/read failure; matching dirty/pending snapshot retained as read-only; existing field and slot commands, CAS baselines and original-target pending writes. Route and panel bodies share the extracted fields. Inline fields aggregate into route protection while existing slot dialogs keep their own guard. Typed unknown text commit is quarantined before React publication and across manual/background flush, unmount and retained-controller resume, until explicit discard of that intent.
- **Batch handoff:** both actual target anchors parse href and verify typed facts before interception. Only the modal presentation unmounts; controller revision/edits, inclusion, expanded row/group, pending command/receipt and route blocker remain owned by the same BatchSurface. Opening waits for Radix unmount autofocus release and a microtask after its scope-stack callback, without a product delay. Guarded return removes the exact detail before restoring the source token's review/bookmark. A replacement or forced obsolete callback cannot reopen an old review. Controlled inputs remount and recover valid focus/caret/scroll, rather than claiming their DOM node survives modal unmount. Inspection does not invoke save, confirmation, start, apply, navigation or provider actions.
- **Quiet interaction and existing owners:** no new normal-operation toast/status line or model-preparation narration was added. Detail loading and actionable field failures stay in the relevant detail surface. Agent execution/send/query/reading owners were not changed by this slice; the retained facade and existing portal composition stay mounted across detail presentations.
- **Ownership and permanent discovery:** all seven new source modules are registered and present in the actual architecture graph. Library public entries are the exact target type/href and panel exports. The four session types and four actual Agent-to-app facade symbols, including `DetailReturnOrigin`, are individually allowlisted. The final graph records 13 actual import edges to these new public boundaries. Native business discovery contains `businessDetails`, `e16AssetDetailPanel`, `e16AssetDetailQueries`, and `e16BatchDetailHandoff` exactly once each, with existing files and no duplicate business entry. This is permanent discovery only; no native execution is claimed.

## Verification

All pnpm commands used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; architecture used the sibling explicit `node` executable.

| Check | Final result | Evidence |
| --- | --- | --- |
| Direct Studio type check | PASS, exit 0 | `exec tsc --project packages/studio/tsconfig.json --noEmit --pretty false`; `/tmp/e16-review-types.log` |
| Scoped ESLint, all 17 changed production files | PASS, exit 0; 0 errors / 12 warnings | `/tmp/e16-review-eslint.log` |
| Facade fix integration | PASS, 5 files / 34 tests; 0 act warnings | `businessDetails`, `businessDetailUnavailable`, `contextPanelDom`, `contextPanelCoordinator`, `e16BatchDetailHandoff`; `/tmp/e16-review-facade-tests.log` |
| Ordinary-method alias fix integration | PASS, 2 files / 19 tests | `e16AssetDetailPanel`, `e16AssetDetailQueries`; `/tmp/e16-review-asset-tests.log` |
| Final architecture only | PASS, exit 0 | `/tmp/cuepoint-e16-architecture.json`, `/tmp/e16-review-architecture.log` |
| Native discovery / ownership static checks | PASS | Valid JSON, seven registered graph modules, exact actual public consumers, four unique existing native business additions |
| Whitespace | PASS | `git diff --check` |

The final architecture report has **652 owned files, 2556 static value edges, 12 literal dynamic value edges, zero cycles, forbidden edges, computed imports/requires and failures**. Every one of the **31 final product/test/quality-config SHA-256 values** matches that report's captured input. Unresolved non-TypeScript asset/virtual imports remain explicitly reported by the architecture tool; this is architecture-only evidence, not a full Knip/quality claim.

An architecture run completed in parallel with the first lint batch, before lint exposed the method-name issue. That pre-fix report passed and is retained as `/tmp/e16-review-architecture-pre-lint-fix.json`. One final architecture regeneration followed the mechanical fix to bind the exact final source inputs. Types/lint and the affected asset suites were also rerun after that change; unrelated suites were not expanded or repeated.

## Reused evidence and boundaries

- Composition worker: 9 suites / 95 tests, followed by an overlapping final 3 suites / 19 tests. Of its 14 explicitly recorded file hashes, 12 still match; the two checker-modified facade/test files were rerun in the 5-suite batch. These run counts overlap and are **not added together**.
- Library worker: the 2 new suites / 19 tests were rerun after the local alias fix. Existing `manualDraftWiring` and `b01QueryIdentity` evidence remains 2 suites / 23 tests, with the same extraction/query envelope and commands.
- Batch worker: final 14-test suite was rerun within the checker facade batch. It exercises actual Radix, feature editors, ProductStore/commands and held save settlement, while router navigation/blocker resolution is an explicit typed fixture seam.
- Parent browser evidence in `browser-asset-layout.md` was reviewed and reused: actual asset detail opening/edit/save, width transition with stable editor DOM and Studio detail activation, isolated Chromium with external requests blocked. No duplicate browser pass was scheduled by the checker.

The first new teardown assertion failed before the guard was added. Its initial cold single-case attempt also emitted React act warnings; the retained API call was then wrapped in `act`, and the complete affected batch passed without them. The initial lint failure and its exact rule are retained above; no failure was converted into a passing result.

jsdom proves the executed DOM/controller/store boundaries, not physical pointer/keyboard defaults, native history/WebView behavior or paint. The existing full Agent transport/reading integration matrix, full build, root wrappers, broad tests, native/package acceptance and paid providers remain at the user's later batch boundary. The canonical contract already requires stale callbacks and real teardown to stay inert; the return-entry guard is a local enforcement of that contract, with no public-interface or module-boundary change.

## Freeze provenance

Final product/test/quality-config scope digest: `8fc1f9f46aeb0587794fc779167ec744fb64b7dadd421d34acdcbd48ac3def23`.

Digest construction: SHA-256 over sorted `path + NUL + file SHA-256 + newline` for the 31 files; specs and task reports are separate snapshot entries and excluded from this combined digest. Final architecture report SHA-256: `f292ad318e973f84b85a28d13e6d1c4955c2b5cf4892bead8da0f05bc5f2832c`.

The JSON is ignored by repository rules. Its exact fenced-JSON mirror is provided as `research/review-scope.md` for normal staging; no force-add was used. Main retains task/spec/ledger/Git ownership. No further source, test or quality/discovery edits are pending from the checker.
