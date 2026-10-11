# Independent full-scope review

Reviewer: `shared_full_check` (Trellis check), 2026-10-11. No commits, archival or pushes performed.

## Review boundary

Reviewed the PRD, design, implementation plan, task research and frontend/desktop coding contracts. The code review follows the actual shared route → layout → page → repository → product parser/native action → Rust worker/SQLite path. Browser command owners remain the existing Dexie modules. The new repository, parser, route history, shared page consumers, lower-level shot/story controls, capability gates, acceptance bridge and Rust core contracts were examined together.

The reviewer owns the tests and findings below. The backend owner runs aggregate Rust gates. The main session owns root/frontend/app builds, icon artifact checks and real browser/macOS package smoke. Mocked consumer tests are supplementary boundary evidence and are not presented as actual packaged application evidence.

## Findings fixed

1. **Initialization race:** simultaneous native reads could use generation 0 while another request opened the workspace. The native request queue, opening singleflight and read barrier serialize the accepted generation transition. An asynchronous real-adapter test delays opening, races reads and verifies recovery after a failed open.
2. **Read identity/error handling:** native queries now bind results to dependency identities, reject stale completions and keep errors per reader. Shared pages display retry, retain drafts and do not reuse rows from another owner.
3. **Native browser-owner escape:** a native audio/music project home could mount browser-only workspace modules. It now renders the explicit capability state; shared consumer tests cover both kinds. Route layouts and media utilities were also checked for early native guards before Dexie callbacks.
4. **Incomplete or misleading mutation helpers:** obsolete native helpers that ignored field baselines or expected obsolete reorder results were removed. Native project creation and multi-shot creation each use one atomic command.
5. **Metadata and order parity:** native metadata uses typed partial updates; derived aspect width/height baselines use the prior preset. Native zero-based shot order maps to the canonical one-based product order, including insertion boundaries.
6. **Lost explicit clears:** present optional keys with `undefined` became omitted IPC fields, while serde nested options previously collapsed null and missing. The renderer sends explicit null for clearable fields; Rust distinguishes absent/no-change from null/clear. Actual serialized wire and actual serde tests cover shot, beat, archive and bulk clears.
7. **Baseline comparison:** unknown, duplicate and unpatched baseline fields reject as validation errors. Same requested values converge; same-field conflicts retain drafts; unrelated fields survive. Rust compares numeric values by type/value rather than JavaScript versus Rust textual formatting. Nullable scalar baselines correctly handle null/string transitions.
8. **Atomic multi-add validation:** a missing beat could previously be committed by `AddShots`. Prospective-state validation now rejects missing/cross-owner/out-of-range input before writes. Multi-add and bulk failures leave all prior rows unchanged.
9. **Script range integrity:** the native boundary accepted a partial UTF-16 surrogate range and stale excerpts. Direct invalid ranges now reject, and changing a script atomically clears stale associations while preserving scene text. Fresh schema 4 exposes only canonical `scriptRange`; old `scriptStart`/`scriptEnd` wire aliases reject.
10. **Committed duplicate/undo results:** copy-scene and copy-shot pages formerly rebuilt inverses from snapshots. They now capture backend-issued receipts and committed IDs. Distinct receipts survive reopen and preserve unrelated later edits. Browser fallbacks retain established browser behavior.
11. **Project deletion with imported assets:** native deletion no longer gets stuck behind imported records. One SQLite transaction removes logical references, assets, project and children. Managed file bytes remain in the workspace; gallery confirmation explicitly explains that disk space is not reclaimed. The real-worker test verifies logical cascade, retained bytes and reopen.
12. **Shared timestamps:** Rust decimal epoch strings were incompatible with shared date formatting and lexical recent sorting. Generated timestamps now use ISO UTC. Core child edits and inverse operations touch the project timestamp; inverse comparisons ignore automatic timestamp differences and preserve later project metadata.
13. **Packaged navigation:** normal path navigation changed the document URL and violated the existing packaged-entry caller ACL. Native routing uses TanStack hash history, preserving the trusted entry pathname and empty document query. Browser routing retains browser history. Actual history push/recreation tests cover `/` and `/index.html`; the ACL was not widened.
14. **Acceptance parser drift:** the acceptance bridge conflict schema accidentally required two schema-variable keys. Those fields were removed. An actual bridge request test accepts the shared conflict shape and rejects invalid results before advancing generation.
15. **Mutation false success:** recognized but wrong outcome kinds and canceled writes could previously be accepted. The product adapter validates each action's result kind before advancing generation. Known native rejection codes become safe localized errors without forwarding arbitrary native debug paths.
16. **Nested settings overwrite race:** concurrent partial settings/filter updates could read the same old object and overwrite unrelated changes. Repository owner queues now serialize the entire read/merge/write operation, including recovery after failure. Actual asynchronous repository tests cover both settings and episode filters.
17. **Delete result contract:** the product action guard must match `deleteProject` to the actual Rust state outcome, not an undo receipt. The final gate below includes this corrected mapping and its regression test.
18. **Prospective row order:** editing a nonfinal row temporarily moved that record to the end of a validation vector, causing valid updates to reject. Backend validation now sorts by the declared order before checking continuity; duplicates and gaps still reject. Real multi-row edit, scene insertion, settings, large shot-number label and reopen regressions pass.
19. **Managed library route reachability (resumption review):** the new Studio capability allowlist also blocked the existing native `/assets` route. The list now admits that route so its managed-file adapter remains reachable. Three actual Studio layout consumer cases cover native assets, unsupported native world entities and browser assets. See `final-resumption-review.md` for the current-source gates.

## Reviewer-added behavioral tests

- `tests/nativeWorkspaceConcurrency.test.ts`: actual adapter asynchronous opening and retry barrier.
- `tests/videoWorkspaceBrowserRepository.test.ts`: actual Dexie owner/order, baseline merge/conflict and delete/restore semantics.
- `tests/sharedVideoPageParity.test.ts`: actual shared component callbacks, committed duplicate inverses and native audio/music capability guards.
- `tests/videoWorkspaceRepository.test.ts`: serialized null clears, bulk unassignment and unarchive wire behavior; the adapter owner adds settings/filter race and response-kind regressions.
- `tests/productRouterHistory.test.ts`: actual TanStack browser/hash history, trusted native entry path and direct reload behavior.
- `tests/nativeAcceptanceBridge.test.ts`: actual acceptance bridge parsing and generation behavior.
- `tests/nativeWorkspaceDeletion.test.ts`: actual product adapter accepts the state returned by the committed Rust project-deletion transaction.
- `desktop/tauri/src-tauri/tests/shared_video_contract.rs`: 10 real-worker tests for serde clears, scalar/numeric/nullable baselines, atomic rejection, receipt persistence and unrelated-field preservation, duplicate results, UTF-16 range normalization, ISO project touch, and logical asset/project deletion with retained bytes.

## Final gates

All gates in this table passed at the action-result mapping checkpoint. The later resumption review repaired native asset route reachability and reran the affected gates; its authoritative current-source results are **196 files, 3400 passed, 1 skipped**, with raw Rust combined-feature logs. See `final-resumption-review.md`. Commands used the local pnpm at `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`. Logs live in `research/full-check-logs/`.

| Gate | Final result | Evidence |
| --- | --- | --- |
| Root `lint` (`tsc -b --pretty false`) | Pass | `full-check-logs/root-lint.log` |
| Root `exec vitest run --maxWorkers=4` | **196 files, 3397 passed, 1 skipped**, 22.46 seconds | `full-check-logs/root-tests-bounded.log` |
| Root `quality` | **PASS (all)**; 0 failures and 0 cycles | `full-check-logs/root-quality.log` |
| Desktop `types` | Pass | `full-check-logs/desktop-types.log` |
| Desktop `lint` | Pass; `--max-warnings 0` | `full-check-logs/desktop-lint.log` |
| Desktop `quality` | Pass | `full-check-logs/desktop-quality.log` |
| Rust combined `acceptance,test-hooks` | **51 passed**, 0 failed / ignored | `rust-implementation-evidence.md` |
| Rust fmt check / Clippy all targets `-D warnings` | Pass | `rust-implementation-evidence.md` |
| Independent real-worker shared-video suite | **10 passed** | Included in Rust aggregate; reviewer also ran it independently |
| `git diff --check` | Pass | Reviewer command exit 0 |

Root quality details: 13 reviewed lint allowances, 564 review warnings, 0 failures; 452 architecture files, 1825 static value edges, 6 literal dynamic edges, 0 static cycles and 0 computed imports outside static proof; 7 full-scope unused candidates matched 7 reviewed contracts, 94 production-only review signals, 0 failures. These pre-existing reviewed allowances are reported as such, not described as zero warnings.

The Rust aggregate is the backend owner's final command execution, checked against its saved evidence: 9 unit + 22 native-workspace + 2 portable-contract + 10 shared-video + 8 storage-review tests. The reviewer independently executed the 10 shared-video real-worker tests and reviewed the matching wire and worker implementations.

The first default-concurrency aggregate Vitest run was performed alongside static quality and app compilation. It spawned 195 isolated workers, took 96.88 seconds and reported 16 existing tests timing out at 5000 ms. It had 187 passing files and 3380 passing tests, with no assertion failure. That failed attempt is retained in `root-tests.log`; it is not counted as a passing gate. The repeat uses bounded worker concurrency without changing test timeout or assertions.

## Unresolved scope and evidence limits

**No unresolved code-review or reviewer-gate blocker remains.** No discovered in-scope product issue is intentionally deferred. Actual package builds and UI/SQLite smoke are reported separately by the main session and remain required task acceptance evidence. This review does not substitute mocked tests for that evidence. World entities, media slots, generation, audio/music and sync remain explicit unavailable native capabilities under the approved scope. Managed bytes retained after logical project deletion are a documented limitation; physical garbage collection is outside this task.
