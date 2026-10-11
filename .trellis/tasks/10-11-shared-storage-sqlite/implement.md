# Shared storage / SQLite execution plan

Status: reviewed and authorized for autonomous implementation. The user explicitly granted full responsibility/automatic approval after creation/research. Final concrete scope and artifacts were displayed for review before activation; see `research/planning-signoff.md`. Routine execution/check/commit gates remain required, with concrete reviewable results covered by this authorization.

## Phase 0 — reviewed handoff and source baseline

- [x] Review this final plan against the complete PRD and research; resolve any product-scope change before execution. See planning signoff and independent review.
- [x] After user approval, run `task.py start` and load relevant Trellis layer contracts. Active branch: `codex/shared-storage-sqlite` from accepted full-product HEAD.
- [x] Freeze committed source/table/query baseline and validate manifests. `research/source-baseline.json` records1009 committed scoped paths; route/tool baseline comes from the accepted full-product child and will be regenerated before acceptance.
- [x] Dispatch `trellis-implement` workers with disjoint ownership and explicit `Active task:` context: shared_store_contract, native_store_engine, native_binary_sessions. Shared API/protocol ownership is coordinated before consumer adaptation.

## Phase 1 — shared contracts and browser equivalence

- [x] Define current table/key/index/scope registry covering all 49 tables, including immutable `versionId` keys and compound/optional unique indexes.
- [x] Introduce typed store/table/query operations, explicit `StoreTx`, storage error taxonomy, committed change notifications and binary metadata/loader contracts. Keep Domain independent of DB/UI.
- [x] Implement collision-safe local row encoding preserving own `undefined`, explicit clear vs omitted patch, supported nested values and binary placeholders. Verify revision/receipt hashes are unchanged across decode/reopen.
- [x] Implement browser adapter using Dexie only inside the adapter. Preserve current command behavior and native/browser namespace isolation. Do not add legacy versions/readers; existing browser history code may remain isolated adapter internals only where this task has not replaced it.
- [x] Start shared adapter conformance fixtures for every inventoried query/mutation operation, key ordering, unique/compound keys, absent values, nested scope joining and read-your-writes.

**Exit:** the shared contract/browser adapter conformance fixtures pass. Full browser equivalence is checked after all existing owners and hooks are adapted in Phases 4–5. No normal native ownership switch yet; internal adapter gates are not feature subsets delivered to users.

## Phase 2 — full native store and unit of work

- [x] Reuse Rust worker, process lock, ready marker, containment/inode validation, format error and recovery infrastructure. Define a fresh full-product format/root with all local tables, explicit indexed projections and scope classification.
- [x] Add closed begin/read/commit/abort IPC envelopes bound to operation identity, workspace/session generation and trusted packaged caller. Durable status lookup uses the current session plus the original persistent workspace/operation identity after reopen; it cannot revive an old handle. Bind each receipt to the canonical mutation/binary-claim fingerprint and reject changed-payload ID reuse. No raw SQL, renderer path, arbitrary table/index or plugin database capability.
- [x] Implement short-read guards, point absence and predicate phantom detection; transaction-local row overlay and nested scope behavior remain in the shared adapter owner.
- [x] Bound query pages to a consistent tracked epoch and stream/prepare large row mutation batches in bounded IPC chunks. Seal the prepared batch and commit its capability/fingerprint once; project package imports remain atomic without new row caps or splitting the final transaction.
- [x] Commit all staged row changes, binary claims, local revisions/change sequence and operation receipt in one native SQLite transaction; duplicate operation/status requests return the original confirmed outcome without applying a second mutation.
- [x] Test crash/unknown acknowledgement, conflict, abort, context expiry, undeclared tables, malformed DTOs, uniqueness failures and worker close/reopen. No writer lock spans renderer waits or supplier IO.
- [x] Prove startup rejects older prototype formats explicitly without deleting them. Avoid full integrity scans on each query/chunk/heartbeat; measure real indexed history and Agent workloads.

**Exit:** the same conformance fixtures execute against the actual Rust bridge, including cross-table atomicity and reboot durability. Native fake replies are not sufficient.

## Phase 3 — managed binaries and consumer closure

- [x] Inventory and encode media Blob, material file-version Blob and setting-snapshot media Blob owners; map audio/music/generation/history/undo references.
- [x] Implement bounded native prepare/write/read/abort sessions, hashes, durable file intents and verified no-overwrite publication. Avoid copying each output through a whole-file base64/string buffer or inheriting fixture-only limits.
- [x] Join binary claims with domain/evidence rows in the native commit. Prove paid audio/media return bytes and job completion are committed together before optional decoding/placement.
- [x] Adapt shared preview/byte/URL access, audio/vision/document consumers, exports and generation-evidence checks. Lists remain metadata-only; loaders report loading, ready, missing and storage error accurately.
- [x] Cover source deletion after import, missing managed file, nested immutable snapshot source deletion, canceled/partial transfer, file/row commit failure and intent recovery across every interruption point.
- [x] Preserve independent external Save cancellation/published-warning semantics. Retained content stays in the container; deletion does not claim physical erasure or unimplemented GC.

**Exit:** all actual binary owners and consumers use the common seam; real bytes/hashes, missing-file behavior and recovery pass with native storage. No fabricated Blob or silent unavailable-result fallback.

## Phase 4 — complete business and Agent context propagation

- [x] Replace ambient Dexie context with explicit transaction-bound dependencies through all 219 transaction call sites and nested helpers (regenerate counts; these are baseline location signals).
- [x] Adapt all shared mutation/read owners, portable project copy-import/export and dynamic table access. Preserve existing import-as-copy semantics; it is not old-data migration or synchronization.
- [x] Keep current TypeScript validations and receipts, including project/studio scope, episode ordering, adoption/version history, music draft links, audio arrangement conflicts and undo.
- [x] Prove `executeAtomicTool -> preview -> nested business command -> write receipt -> completed tool ledger` shares one root context and sees uncommitted rows. Cover task/version/wrap-up evidence and generation batch item/job commits.
- [x] Preserve exact original Agent local fields and same-device explicit resume state. Preserve approval fingerprints, cancellation, failed-result history, claims/CAS and no paid replay after relaunch or conflict.
- [x] Exercise actual `executeAtomicTool` catch and `runChat` recovery for lost commit reply, commit-status read failure, persisted-completed read failure, settling/not-found operation and reopened-session lookup. Preserve unknown certainty if confirmation is unavailable; a known rollback alone can use the existing atomic-rollback retry classification.
- [x] Replace Dexie-specific failure catches with shared storage errors where classification affects output evidence; do not hide native read faults as invalid placements.
- [x] Regenerate full tool registry coverage (baseline 95 tools / 15 families) and execute every tool's owner/contract case on both adapters; do not substitute a mock completed result for the real command.

**Exit:** every domain and registered tool routes through one shared storage boundary. Direct product Dexie access outside browser adapter/test bootstrap is zero; explicit old reference lanes cannot disable normal SQLite features.

## Phase 5 — reactive reads and normal product activation

- [x] Replace all 96 current `useLiveQuery` sites with shared reactive reads, preserving detail-null/loading behavior and current UI, drafts, workspace chrome and Agent panels.
- [x] Test subscription-before-read/change-sequence reconciliation, commit-only invalidation, failed rollback silence, generation resets, dispose/remount and deletion/missing-resource states.
- [x] Remove normal-product `usesSqliteProductStorage` feature-denial guards/video-only dispatch. Keep the same full routes/components/commands; do not expand a second native UI tree.
- [x] Initialize SQLite before routes in the explicit isolated product profile and display a truthful storage-open failure without fallback. Keep normal startup on the accepted owner until Phase 6 complete acceptance; browser stays IndexedDB with shared commands/UI.
- [x] Verify isolated bundled product identity, hash navigation, startup, reopen and no development-server dependency. Preserve accepted network, system Save, print and dark icon contracts.

**Exit:** the full browser product passes through the shared store, and the complete isolated native product uses SQLite/files as its sole owner. The normal owner switch still waits for Phase 6. A reduced video-only mode does not satisfy either gate.

## Phase 6 — full acceptance and independent check

- [x] Build an R/AC evidence matrix covering every table/domain/query/tool family/binary owner, with exact fixture, adapter, command, source hash and outcome.
- [x] Run existing full browser suite plus shared real-native owner/adapter regressions; complete actual Rust integrity/recovery/security tests. Historical migration-only fixtures are not a new acceptance requirement; retain or deliberately relocate isolated reference tests without weakening current-contract tests.
- [x] Actual packaged macOS fresh profile: project + global IP/materials + video + audio + music + references/memory + settings/connections + Agent/task/history flows, reactive edits and relaunch. Verify all 49 table families via real persistence evidence, not just gallery smoke.
- [x] Actual packaged Agent: deterministic isolated supplier endpoint for approval/write/reject/Stop/failed call/full results/resume guards; label it as fixture-provider evidence. A real selected chat-model smoke may be performed after a locally configured fresh acceptance connection is available, without reading/moving previous profile keys or silently replaying paid media. Preserve the prior genuine provider evidence as baseline, not a claim that it proves this new build.
- [x] Packaged managed bytes: import, source removal, missing copy, generated/recorded/retained output, export byte equality and restart. Existing microphone/print behavior needs focused regression if affected; actual human/system rechecks may remain a clearly reported gate until user returns.
- [x] Record representative large-file/history behavior and detect unbounded metadata hydration or repeated full DB scans. Do not announce a benchmark target or cross-platform pass without evidence.
- [x] Dispatch independent `trellis-check` on final full scope, fix defects and rerun only affected checks plus required final gates. Update owning specs after verified behavior changes.
- [x] After complete isolated acceptance, activate the normal full-product SQLite profile, rebuild the actual normal app and perform focused owner/startup/reopen/full-route regression. A failure keeps activation incomplete; never fallback into another catalog.

**Exit:** all PRD acceptance criteria pass with honest host/fixture limitations. If a functional domain is absent or native transaction/storage behavior is only mocked, the child is incomplete.

## Validation commands and evidence discipline

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly. Do not run the bundled Codex pnpm or install/rebuild dependencies merely for planning. New conformance/real-bridge commands will be added to permanent scripts during implementation, not left inside archived research.

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test:storage:native --evidence-dir <new-empty-evidence-directory> --suite all
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project tests/typecheck/tsconfig.agent-tools.json --noEmit
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project tests/typecheck/tsconfig.checkpoint.json --noEmit
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri test:native-gates
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app
```

Run pinned Rust fmt/clippy through `desktop/tauri/scripts/tools.mjs` with locked manifest and actual enabled features. Preserve raw exit codes/logs/source/build identities; report reviewed warnings and genuine pending host checks.

The permanent native runner builds the current pinned Rust probe, executes the current shared facade and business suites with SQLite required, records successful/invalid original registered recipes, and rejects missing committed table mappings. Its table ledger additionally excludes the two synthetic primary-key conformance suites when checking business-test mappings. A test's fixture seed is still not, by itself, an owner behavior assertion; identify actual commands and assertions in the table evidence ledger. Its independently hosted binary lane uses its own actual Rust process rather than replacing the installed facade with fake replies. A changed source identity during a run is an integration diagnostic, even when its test cases pass; final acceptance needs the frozen current identity.

## Rollback and completion boundaries

- Contract/browser gate fails: fix the shared API before adapting native consumers; no product-owner switch.
- Native transaction/file gate fails: keep normal product on the accepted previous build while fixing the adapter; no fallback mirror and no old-data migration.
- Full-domain gate fails: keep task in progress and finish missing adapters/consumers, rather than ship a hidden reduced feature set.
- Final completion uses a concrete file-group commit plan and quality gate under Trellis Phase 3.4; the user's autonomous/automatic-approval instruction applies to routine local submission/archive after that reviewable plan. Remote push, main merge, deployment and cloud synchronization stay outside this child.

## Verified media-response repair scope — 2026-10-12

Actual native review confirmed two defects before source freeze: the original custom-protocol response returns only the first bounded chunk for a GET without Range, and64 permanently held playback descriptors prevent later full-grid previews. HEAD also incorrectly applied Range; its narrow repair has real-file regression evidence. These are implementation gaps within the approved managed-byte preview behavior, not optional packaged smoke exclusions.

The pinned Tauri2.12.2/Wry0.57.0 response interface accepts one complete response body rather than a streaming body. Root reviewed and authorized the minimal application-owned loopback media transport under the user's explicit full-responsibility/automatic-approval instruction. Keep `product_media_preview/release` as closed Session+ManagedBinaryRef/opaqueUUID operations. Bind only127.0.0.1 to a random port; no remote deployment/account, arbitrary paths, SQL, credentials, provider proxy or sync capability. Return canonical opaque URLs; require exact Host and validate a supplied Origin against the current trusted packaged origin, without wildcard/null-origin CORS. Ordinary media requests may omit Origin only when the unguessable current capability and all other checks pass.

Separate capability metadata from an actual request descriptor; bounded active readers open lazily, validate session/root/file at each chunk, and release on finish/disconnect/timeout/revocation. Full GET is200 and transfers the complete verified representation with bounded memory; Range is206 with matching content length/range; HEAD ignores Range and returns200/full metadata/zero body. More than64 mounted preview capabilities must not retain64 permanent descriptors or leave later items indefinitely loading. Any CSP change is limited to local media transport.

Owner: native_store_engine, narrow native media/desktop lifecycle/URL validator and actual disk/rawHTTP regressions. Shared business/UI/FIFO/root-owner activation are unchanged. Preserve prior raw logs and add actual >32MiB full-body/range/HEAD/revocation/containment/65-capacity evidence. Actual WK playback/seek remains a separate pending host gate while macOS is locked. Normal owner activation and task completion remain pending until complete packaged acceptance.

## Isolated packaged completion supplement — 2026-10-12

The current repaired isolated bundle1791760048580 uses the same fresh review identifier/WK store. Actual CUA evidence in `research/packaged-host-01/` covers project/world/shot/IP setting snapshots and pinned adoption,70 material-grid items with project-save/return/reopen, real90MiB H264 playback/seek/export after source removal, PDF/DOCX/reference, copied ZIP/memory histories, imported/generated/recorded audio and retained mix, music variants/work parameters, manual task record/wrapup versions, Agent approval/reject/Stop/provider-error/tool-error and complete saved results. The native print panel and its saved PDF contain current SQLite-backed shot text/image on A4 landscape. One short microphone recording was retained locally and replayed after relaunch; actual decoded duration1.885s,48kHz mono (capture UI timer3.4s). Two temporary longer automation attempts were discarded, not retained.

`final-reopen-and-recording.json` verifies320 row payload/revision hashes unchanged across final clean quit/reopen and all80 managed files match their recorded byte lengths/SHA256. Startup issued only an existing model-catalog GET; no chat/generation POST or automatic approval/replay occurred. New grid admission uses32 root reads/FIFO with disposed-observer cancellation; actual108files1903tests native-grid-final passes with95tools/49tables and no missing coverage. Original failed grid and earlier pending receipts remain historical evidence. Independent full-scope sign-off and normal activation/build/host checks still follow; these checked isolated steps do not declare the whole task complete.

## Normal activation and final technical acceptance — 2026-10-12

After isolated independent PASS, the official no-flag normal build was changed to the existing product-sqlite lane; explicit IndexedDB reference and historical fixture lanes remain separate. Source/lane/desktop quality checks pass; the standard normal build1791761629702 exited0 with normal identifier/WK/SQLite identity and narrow existing ATS/microphone policies. Only native-runtime documentation changed after this build; current built product inputs remain identical. Final1122-source scope differs from the original immutable freeze in five reviewed paths.

Actual normal CUA reached all existing route families and saved a film, audio/music projects and music prompt. Five managed fixtures, video decode/play/native-keyboard seek12→15→30→24/resume, fixed image adoption and external Save177B exact-hash passed. One actual fixture Agent project_create was approved once; original args/results/write receipt and real project/first-episode rows persist. Clean Quit/reopen preserved all35 row payload/revision hashes and all5 managed bytes/metadata. Story, music prompt, original Agent history and image pixels/association were observed again. Only one catalog GET occurred; zero chat/generation POST or automatic approval.

`research/normal-host-01/` and `normal-final-source.json` preserve exact normal receipts; independent final check is `normal-final-signoff.md/json`. Product/acceptance gates have no remaining blocker. Concrete local work commits precede child archive and journal under existing automatic approval. Parent storage/sync remains in progress; no push/main merge. Current providers are explicitly synthetic; actual platform acceptance is macOS, with Windows/Linux genuine-host checks and cloud sync outside this child's scope.
