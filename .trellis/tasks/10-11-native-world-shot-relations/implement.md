# Complete product reuse and native Agent: execution plan

Status: implementation approved on 2026-10-11 after the final PRD/design/plan review. Execute IndexedDB-first complete functionality with Agent priority; no push/main merge is authorized.

Progress checkpoint (2026-10-11): approved product implementation and actual macOS acceptance are recorded through packaged evidence106 and browser14–18. Final independent evidence/provenance review and concrete commit-plan approval remain in progress. See [`research/acceptance-progress.md`](research/acceptance-progress.md) for source checks, actual representatives and explicitly conditional/deferred cases. Checked items establish the reviewed scope and finite representatives; they do not certify all95 tools were separately executed or every platform/provider outcome.

The latest root suite is213 files /3632 passed /one skipped, with root/desktop type, lint and quality gates passing. Quality retains13 reviewed allowances and568 visible warnings. Native61/vendor18 checks and the three post-vision product builds retain their own provenance; dedicated Tavily test-only gates/build/actual104 are separate. Later desktop package script metadata changes are covered by the dedicated test-lane freeze; historical product build receipts are not rewritten.

Actual evidence includes retained microphone recording (user audition/retention confirmed, actual duration8.945 seconds rather than an exact3-second claim), genuine chat/reference-image/speech/music, byte-verified system exports/cancel/existing-target handling, print-to-PDF A4 landscape3pages, clipboard/external browser, denial with original-value readback, source-backed AI wrap-up draft, automatic compaction with originals retained, request memoryV4 and latest normal profile105–106. Live Tavily remains conditional because no real account is configured;104 proves its shared adapter/native HTTP with a loopback fixture. Windows/Linux and physical-printer outcomes are deferred. Private recording and archives containing it remain excluded from git. The prior disabled Save AX observation is retained as an automation limitation resolved by actual successful save, not a product defect.

## Pre-start gate

- [x] Read converged `prd.md`, `design.md`, runtime/parity inventory and selected native-service research.
- [x] Verify no unresolved product/scope decision remains. The current target is **all existing implemented functionality**, with Agent verified first; it is not the superseded world-only candidate or chat-only completion.
- [x] Curate `implement.jsonl` and `check.jsonl` with real spec/research entries; validate them.
- [x] The larger `state-management.md` and `audio-music.md` specs exceed automatic injection limits. Relevant workers/checker read their owning sections directly before editing/reviewing those commands; do not rely on a silently truncated injection. All agents resolve earlier SQLite-only product ownership rules through this explicitly approved task design, not by ignoring native security/adapter contracts.
- [x] Present goal, scope, exclusions, acceptance, chosen ownership and remaining platform/evidence risks. Stop for subsequent implementation approval.
- [x] After approval, run `task.py start` and create a dedicated local feature branch from the current accepted source. No push/main merge is part of implementation approval.

## Batch 1 — Complete product owner and route reuse

**Outcome:** the actual root product opens in Tauri with one fresh IndexedDB owner and all existing feature routes.

- [x] Add the explicit runtime-versus-storage boundary before database construction. Browser keeps its existing database identity; normal desktop selects a fresh stable IndexedDB namespace. Test-only SQLite lane is explicit rather than inferred from Tauri detection.
- [x] Derive stable separate normal/isolated WebKit store identities from declared app/profile identity; preserve non-private persistence. Verify normal and acceptance namespaces cannot observe one another.
- [x] Move the storage-coupled gates listed in `research/runtime-gates-and-parity.md` to owner/capabilities: repository/live query, route/home/allowlist/import, gallery/project kinds/actions/IP, workspace operations, full material library and media indexes.
- [x] Retain actual Tauri detection, trusted entry navigation, hash routing and system-service selection. Normal full-product startup does not call SQLite ensure/state, mirror records, mutate a prior store or expose two project libraries.
- [x] Keep shared UI styling and all existing domain commands; no replacement native pages/tools/Agent loop.
- [x] Verify actual packaged shared Agent home, project/video/world, materials/IP, audio/music, memory/produce/print navigation and full close/reopen for text plus Blob data.

**Meaningful regressions:** existing browser route/page/repository/media cases; explicit desktop-IDB versus SQLite-test selection; unexpected SQLite IPC throws; desktop namespace and profile isolation; correct hash URL/reload and no browser database read.

## Batch 2 — Native runtime services and Agent end to end

**Outcome:** the real shared Agent, all its existing permissions/tools and runtime requests work in the normal packaged product.

- [x] Implement official HTTP plugin 2.8.2 and the centralized wrapper/precise origin grants from `design.md` and `research/native-runtime-services.md`; pin package/Cargo lockfiles and compile against the current Tauri toolchain. No custom generic HTTP engine. Keep provider protocol/parser logic shared and test-injected `fetchImpl` intact. Verify manual five-hop redirect policy, no ambient cookies, upload buffering limits/concurrency and actual abort/disconnect, including pending reads.
- [x] Cover default fetch paths and direct CDN/download paths; keep local PDF/worker/bundled-resource requests in WebView. Support JSON/bytes/Blob/FormData, custom configured endpoints and generated result hosts, status/headers/streaming, timeout/abort/redirect policy and current response limits.
- [x] Reproduce the HTTP 2.8.2 stalled-read cancellation risk before acceptance. If present, apply only the scoped cancellation-aware upstream dependency patch allowed by `design.md`, preserve tag/license/diff provenance, and verify real disconnect/cleanup. A rejected JS read alone does not pass this gate.
- [x] Add deterministic loopback fixtures for models/probes, Chat Completions/Responses, reasoning/body SSE, partial/error/slow/aborted streams, multipart uploads, generation submit/poll/download, audio/music outputs and Tavily responses. Fixtures must run through actual native HTTP transport when packaged; mocking `fetchImpl` alone does not verify it.
- [x] Verify actual Web Locks for Agent/audio batches/task wrap-ups. If absent, supply one centralized implementation through existing lock interfaces, with correct cancellation/release/exclusivity; do not weaken the owner checks.
- [x] Verify existing connector configuration, models, conversation/smart/task modes, attachments/context/compaction, Stop/retry/resume, approval/denial, plans/budgets, finishing/final review and complete raw history across reopen.
- [x] Verify business write plus tool completion remains an existing nested Dexie transaction, including cancel/ledger/result-size failure rollback and completed-call replay. Do not call separate SQLite product writes.
- [x] Enumerate actual registered tool names and map every name to evidence. Exercise representative end-to-end flows for every family and use existing behavioral cases for individual contracts; no permanently hidden/dead tool is accepted as full parity.
- [x] In the fresh isolated app, use user-configured connections for minimal real supplier validation: selected chat model, one small image/media/reference flow, minimal speech/music where supported, and search if configured. Do not extract old browser keys or automatically resend provider requests on refresh/reopen. Preserve genuine supplier outcomes separately from fixtures.

**Ownership:** the transport worker owns native HTTP/runtime service modules and corresponding dependency/capability updates; the product-owner worker owns Batch 1 and shared fetch selection/integration call sites. Coordinate exact requestBoundary/direct-download changes so only one worker edits each file. Main session owns acceptance fixtures, build/evidence and integration review. All workers are told they share the codebase and must not revert others.

## Batch 3 — Files, system behavior and complete feature acceptance

**Outcome:** all existing product families pass the reviewed parity map, including their actual native system interactions.

- [x] Verify shared file inputs/import cancel, then repair only demonstrated packaged gaps. Internal imports retain real Blob copies/hash equality/source independence, not source paths.
- [x] Introduce common native Blob-save transfer independent of SQLite projects, using bounded transfer/session cleanup and real Save panel choice. Preserve byte identity and safe existing-target/cancel/error outcomes.
- [x] Connect existing package/CSV/audio/music/export callers to the common save boundary and accurately await success/cancel/error. No success toast before bytes commit.
- [x] Route external links to the OS browser while retaining the main WebView navigation restriction; preserve existing text/image paste and copy behavior or adapt a verified gap.
- [x] Verify normal packaged media playback, PDF/DOCX/text workers, audio timeline/mix, user-gesture microphone recording and storyboard print. Update product microphone purpose text; preserve baseline audio capture constraints and final recording chunk handling.
- [x] Complete P1–P10 in `research/runtime-gates-and-parity.md`: all implemented routes and registered tool families, project/global/IP reuse, version adoption, media slots, generation/speech/music recovery and files. Existing `available:false` project types remain outside implemented parity.
- [x] Repair in-scope adapter/package defects and repeat only affected checks until final acceptance passes. Do not mark a skipped/unavailable/blocked item as passed; record any dependency needing user configuration/system access without manufacturing results.
- [x] Update specs for runtime-versus-storage selection, the explicit temporary desktop IndexedDB owner, centralized network/save/lock contracts and later SQLite boundary. Replace stale unconditional “native never uses Dexie” rules only within the newly approved stage; retain SQLite adapter security/no-mirror contracts.

## Validation commands

Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly. Existing `packageManager` metadata does not override the user's local-pnpm instruction. Do not install/change the fixed Rust toolchain for this task.

Root checks (run from repository root; source changes determine focused cases, then one final aggregate):

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --maxWorkers=4
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
```

Focused behavior oracles include `agentToolTransactions`, Agent runs/tools/approval/recovery/context/tasks/final-review, shared video/browser repositories and routes, models/chat/Responses/SSE/provider audio/generation/search, media/material/IP/reference/package/delivery and audio/music suites. Add meaningful new tests for storage selection/isolation/native transport/save lifecycle; do not write tests merely mirroring a helper's implementation.

Desktop checks (from `desktop/tauri`):

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
node scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
node scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --features acceptance,test-hooks
node scripts/tools.mjs cargo clippy --manifest-path src-tauri/Cargo.toml --locked --features acceptance,test-hooks --all-targets -- -D warnings
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build:frontend
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build:app
```

If desktop-feature system modules are not compiled by the historical aggregate, add the exact `desktop` feature/all-target checks and native service tests rather than claiming the aggregate covers them. The isolated **normal product** build uses the same root frontend, backend and selected dependencies with only identifier/profile data isolation changed; the historical `--acceptance` fixture frontend does not substitute for it. Preserve its existing build/test lane rather than silently changing fixture meaning.

Root quality self-tests/model-bank verification need a new run only if affected source/config/data changes justify it or the project's quality gate requires it. Report existing reviewed allowances/warnings accurately; no new blanket allowance.

## Evidence and final review

- [x] Preserve current-source hashes/build receipt, original gate logs, complete feature/tool matrix, actual packaged store isolation/reopen report and screenshots/AX outcomes.
- [x] Demonstrate real isolated browser regression and actual normal packaged product behavior; separate injected/mocked fixtures, native transport fixtures and live-provider evidence.
- [x] Independent Trellis checker reviews source + cross-layer owner/network/file/execution flow, meaningful regressions and evidence truthfulness. Main session does not replace final checker with a summary of worker claims.
- [x] Record remaining cross-platform OS evidence as deferred; no Windows/Linux acceptance claim is made on this macOS host.
- [ ] Before commit, inspect full dirty paths/provenance and submit the concrete grouped commit/archival plan for approval. Preserve raw evidence bytes; authored source/docs must pass whitespace checks.
- [ ] After approved work commits, archive only this completed child and journal the results; parent continues for centralized SQLite replacement and synchronization. No remote push or main merge without explicit instruction.

## Rollback points

Each batch is independently reviewable and buildable. Revert only this feature branch's selector/runtime adapter changes if a batch must be backed out. Never delete old user/developer workspaces, read old keys, rewrite archived evidence or implement an implicit migration. The interim IndexedDB stage is the user's explicit delivery choice; future SQLite replacement begins with fresh development data unless separately requested otherwise.
