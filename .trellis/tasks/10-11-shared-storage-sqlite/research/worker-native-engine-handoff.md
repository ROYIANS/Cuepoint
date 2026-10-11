# Native store / shared UI worker handoff

Historical checkpoint: the media-specific source and acceptance discussion in this document are superseded by `worker-media-stream-handoff.md` and `worker-media-stream-checks.json`. The old first-256-KiB/206 and persistent-descriptor behavior has been repaired; retain this document for its original storage/UI/source identity and earlier test evidence.

Captured 2026-10-12. The worker's implementation is ready for the orchestrator's frozen full gates. These targeted checks ran while the shared workspace remained mutable; this document does not announce task completion or normal-owner activation.

## Implemented ownership

- `desktop/tauri/src-tauri/src/full_product_store/{mod,protocol,query,registry,tests}.rs`: fresh full-product SQLite owner, complete 49-table registry, registered key/index projections, UTF-16-preserving identity/order, point/table revisions, bounded consistent queries, sealed atomic mutations, binary claims, durable operation receipts and truthful uncertain outcomes.
- `desktop/tauri/src-tauri/src/bin/product_store_probe.rs` and `tests/full_product_process.rs`: permanent actual-process transport and crash/reopen/receipt tests. Worker/lifecycle/desktop/lib wiring reuses the existing checked workspace boundary.
- `desktop/tauri/src-tauri/src/product_media.rs`: opaque current-session playback leases with containment/file-identity checks, bounded range reads and release/reopen revocation. The actual WebKit continuation/seek gate remains pending below.
- Shared UI/routes, `src/lib/storage/hooks.ts`, `src/lib/videoWorkspaceRepository.tsx`, `src/main.tsx`, runtime/profile and isolated SQLite packaging wiring: explicit transaction-bound reactive reads, unchanged shared product UI, truthful loading/missing/errors, startup initialization before routes and no fallback catalog. Normal product still uses the accepted IndexedDB owner pending complete isolated acceptance.
- `src/components/music/switchMusicVariant.ts`: actual music drafts and project variant associations commit together, without reading old localStorage.
- Owned UI/E04/native-command tests and actual-browser E04 library runner: preserve actual queries, earlier mutations, late faults, rollback and immutable comparison fixtures.
- Latest follow-up: `tests/sharedRegisteredToolSuccess.test.ts` adds the ten requested actual registered success paths; `desktop.rs` isolates post-commit event delivery from confirmed commit/status replies; removed the extra EOF blank line in `src/lib/nativeWorkspace.ts`.

No DB/Agent recipe implementation was duplicated or modified for the ten new success tests. Binary-peer component/module ownership and shared-core ownership remain intact. No commits, pushes, provider payments, secrets/profile copies or historical database reads were performed by this worker.

## Final protocol additions

`NativeQuery.limit?: number` is a nonnegative JavaScript-safe integer. Query continuation binds the original limit and counts emitted rows across byte-bounded pages; zero still installs the same epoch guard. Registered-selector `count` returns `{count}` using SQL aggregate without row payloads, forbids an incoming cursor and respects the optional limit. Readwrite overlays retain shared merge semantics; JavaScript filters still legitimately require scanning.

Oversized read identities use `requestStart(...TransactionHandle, purpose: 'get' | 'query' | 'count') -> {transferId}`, `requestChunk(...handle, transferId, offset, payload) -> {nextOffset}`, then `requestFinish(...handle, transferId) ->` the original closed reply. Each chunk checks the current session/generation/context/guards/TTL and exact byte offset; finish consumes the capability before parsing only `{table, keys: WireText[]}` or `{query: NativeQuery}`. No renderer SQL/path or nested command is accepted and no identity-length limit is added.

The actual worker validates complete incoming request JSON envelopes at 262144 bytes. String preparation/transfer uses at most 32768 raw UTF-8 bytes, so JSON escaping cannot inflate actual envelopes beyond that limit. `readTransfer`/`readChangeTransfer` accept the existing declared request length range but return no more than 32768 raw text bytes each; binary raw byte ranges keep their separate 256 KiB limit.

Permanent Rust regressions include `oversized_read_request_is_closed_bound_consumed_and_lossless`, `indexed_limit_and_aggregate_count_preserve_total_order_bytes_and_phantom_guard` and `encoded_metadata_envelopes_are_bounded_even_for_control_heavy_chunks`.

## Verification and evidence

The latest raw logs, exact exits, log hashes, probe hash, captured source hashes, all ten per-owner tool execution instrumentation and failed first fixture assertion attempt are in `worker-engine-followup-checks.json`. Earlier owned suite evidence and actual Chromium capture path are retained in `worker-engine-checks.json`.

- New registered-tool success suite: IndexedDB 10/10, actual Rust SQLite 10/10. It uses real parse/prepare/execute, real approval pause/resolve/resume, actual business and byte loaders and real completed ledger values. Only disposable provider HTTP replies and audio decode metadata are fixtures.
- E04 current stable browser source: 152/152. The prior transient 18 failures occurred during concurrent temporary outer Dexie.waitFor experimentation, then passed after that change was removed; assertions/timeouts were not weakened.
- Latest pinned Rust all-target tests with `desktop,product-sqlite,test-hooks`: 100/100; actual process fixtures included.
- Latest pinned full-feature Clippy with `--all-targets -- -D warnings`: exit 0. The pinned vendored HTTP plugin retains the two existing unused callback-variable warnings; no project warning or dependency modification.
- Post-commit notification boundary test: confirmed commit and repeated status results stay exact despite event delivery failure, and aborted outcomes emit no success event. The event contains only `changeSequence`; no renderer event subscribers exist currently. The shared native driver still delivers its actual own-commit change notification.
- New test ESLint and `git diff --check`: exit 0.
- Earlier scoped evidence: nine UI groups 199/199; UI/native commands plus duration/Tavily 40/40; truthful capability/page checks 43/43; complementary command/storage tests 119/119; actual Chromium E04 library 16/16. Root owns complete frozen reruns.

The shared-contract worker has been notified to include `tests/sharedRegisteredToolSuccess.test.ts` in the permanent SQLite lane. Root reported its full browser wave 4 now passes 222 files / 3830 tests and every 95 registered recipe has a fulfilled actual execution; that is root evidence, not a separate worker rerun.

## Remaining acceptance boundary

At this historical checkpoint the Mac was locked and the opaque range handler still returned a bounded 206 segment for a large no-Range request. That known response defect is now repaired by the later app-owned streaming implementation, with actual complete 90 MiB raw GET tests; see the newer handoff. Actual packaged WK playback/seek, full fresh-product system flows and relaunch acceptance still require the root's system gate. Raw HTTP byte equality does not establish WK decoding/playback.

Keep normal owner activation gated until actual complete isolated acceptance passes. Root owns frozen frontend/native quality, the final packaged source/executable/receipt identities and actual system acceptance after unlock. Windows/Linux actual-host checks remain explicitly unverified.
