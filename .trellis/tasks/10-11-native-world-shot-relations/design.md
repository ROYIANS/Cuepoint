# Complete shared product in Tauri: design

Status: implementation approved on 2026-10-11 together with `prd.md` and `implement.md`; delivery sequence A is the selected architecture for this stage.

## Architecture and ownership

The normal Tauri application continues building the root React/Vite product. It uses the existing Dexie database, product commands, live queries and Blob data for this development stage. Browser mode retains its current database identity. No NativeAgent, parallel tools, native-only feature pages or per-domain Rust business rewrite is introduced.

Separate two facts that the current code conflates:

| Concern | Browser | Normal desktop product in this stage |
| --- | --- | --- |
| Runtime | Browser | Genuine Tauri, trusted packaged main window |
| Router | Browser history | Hash history under the trusted entry document |
| Product persistence | Existing browser IndexedDB | Fresh application-internal IndexedDB |
| Commands/transactions | Existing TypeScript/Dexie | Same TypeScript/Dexie |
| Product media authority | Internal Blob copies | Internal Blob copies |
| Network/file/external-link services | Web implementations | Central native adapters where required |
| Prior SQLite slice | Not selected | Not the normal product owner; preserved for isolated tests/future replacement |

Introduce one explicit product-storage selector rather than reinterpret `isNativeWorkspaceRuntime()`. It is a finite application configuration chosen before database construction, not a user-facing storage toggle or a mutable preference. Browser and normal desktop select IndexedDB in this stage. Existing SQLite adapter tests can select their owner through explicit injected/test configuration; the historical fixture/probe lane remains independent.

The runtime detector continues protecting native IPC and choosing hash history/system adapters. Product components use storage/capabilities to select repositories and controls. The new selector must be initialized before importing/constructing the shared database; test overrides must be explicit, isolated and impossible to leak between owners.

## Data identity and persistence

Use a distinct fresh desktop IndexedDB namespace and a stable per-application/profile WebKit store identity. Keep the browser database name unchanged. Normal product and isolated packaged verification have distinct namespaces **and** distinct WebKit data-store identifiers; a renamed bundle alone is not sufficient because `desktop.rs` currently uses one fixed identifier.

The desktop database opens only its configured namespace. No old IndexedDB, browser database or SQLite import occurs. Normal startup must not call `nativeWorkspace.ensure/state` or expose the old SQLite project catalog. The new normal product does not destroy the existing prototype/developer workspace. Isolated acceptance proves its own namespace, normal-store independence and persistence after full app close/reopen without private WebKit mode.

Media remains app-internal Blob data using the existing managed-copy/hash/import code. This meets source independence for the interim stage; it is not claimed to be the future SQLite/filesystem workspace. All UI and Agent references resolve through the same IndexedDB media records, so they cannot diverge between a SQLite library and a second Agent library.

## Shared UI and business behavior

Move storage-coupled Tauri checks in the inventory to the product-owner selector: studio home/allowlist/imports, project/gallery actions and kinds, workspace route/action gates, material-library switch, video repository/live queries, media/useShotMedia guards. Preserve actual Tauri checks in `productRouterHistory` and the native service bridge. Use the original shared Agent homepage and complete existing route tree.

Do not modify tool schemas, permissions, business numbering/order/cascades, generation batch limits, finished-call replay, raw history or UI styling for parity. Existing `executeAtomicTool` continues nesting business commands inside its IndexedDB transaction; business changes and completed result/receipt remain one commit. No Rust action followed by a separate history save is introduced.

World/studio/IP/material, audio/music, memory/reference and generation functionality is brought back through the same existing owner. Unsupported project kinds that the Web product already marks unavailable remain unavailable; parity adds no new features.

## Network boundary

Keep the shared model/provider protocols and bounded response/SSE parsers. Add a runtime fetch service used by the default path of `requestOnce` and the audited direct provider/CDN download paths. Explicit injected fetch implementations remain supported for tests. Bundled/relative resource fetches remain WebView requests; remote HTTP(S) uses the native adapter in desktop mode. Avoid global fetch monkey-patching.

The native adapter must support actual current request shapes: JSON/text/byte bodies, Blob/FormData reference uploads, configurable connector/search URLs, generated result/CDN downloads, response status/headers/body streaming and abort/timeout. Preserve each caller's credentials/redirect policy and limits; do not attach provider authorization to a returned signed CDN URL. No automatic provider retry or paid-request replay is added.

Use the official `tauri-plugin-http = "=2.8.2"` and `@tauri-apps/plugin-http: "2.8.2"`. Tagged primary sources confirm the JS peer requires `@tauri-apps/api ^2.12.0`, compatible with installed 2.12.2 at source level; compilation remains an execution gate. Rust uses `default-features=false` with only `rustls-tls`, `http2`, `charset` and `system-proxy`; no cookie jar, tracing, unsafe-header or dangerous-setting features. `research/native-runtime-services.md` records the official links, tagged implementation behavior and limitations. Do not build the superseded generic Rust HTTP session engine.

The wrapper supplies a fresh init/Headers object, preserves caller signals and normalizes abort to the caller's reason. `redirect:error` becomes `maxRedirections:0` plus explicit 3xx rejection. For `follow`, use a maximum of five manually checked hops, apply Web fetch method/body rules, strip credentials on cross-origin hops, re-authorize each destination and cancel discarded response bodies. Network errors never cause a second fallback request. Existing per-caller abort/timeout/read limits remain authoritative; add a 30-second connect bound, and ensure product-owned abort timers close pending native body reads. Do not impose a shorter generic overall deadline on already valid generation/media flows.

Grant exact connector/search origins and separately validated no-auth supplier-result origins through a small main-window-only trusted origin registration command using Tauri's dynamic capabilities. No broad vendor/static wildcard or remote main-window navigation is required. Match scheme/host/effective port, reject userinfo/non-HTTP schemes, and permit HTTP only for explicitly configured custom/loopback endpoints. Escape origin scope syntax and test IPv6/ports. Recheck current application configuration/download policy for every wrapper call; capabilities are additive until restart, so do not claim immediate hard native revocation. Deduplicate and bound grants per process, with a visible error if exhausted.

Official plugin uploads serialize/buffer the body, including FormData. Preserve current APIMart reference limits (20 MiB) and bound simultaneous large uploads to two; do not copy the superseded custom chunk-upload proposal into this implementation. Streaming responses retain shared parser limits and must prove incremental delivery/cancel/disconnect through the actual packaged transport, including a stalled read. Ordinary remote WebView fetch is insufficient because current CSP blocks it and supplier CORS varies. Preserve restrictive packaged navigation and remote-script policy. This is HTTP implementation glue, not a rewrite of Chat Completions/Responses/APIMart/MiMo/Tavily.

Preimplementation review found an upstream cancellation risk in tagged HTTP 2.8.2: a pending Rust body-chunk read retains its response while resource cancellation closes the table entry. Treat the stalled-read disconnect check as a blocking service gate. A narrowly scoped, reproducible dependency patch to make that read cancellation-aware is allowed if the gate reproduces the issue; preserve tagged provenance/license, the exact patch and upstream-compatible public API. Do not replace the plugin with a bespoke HTTP engine or hide the issue by recording only a promptly rejected JS promise. Prove body resource release/server disconnect and late-event suppression after Stop in the patched normal product.

Authentication stays in the existing app-local product connection configuration during this stage, isolated from browser/acceptance stores. No automatic key import or separate keychain migration is introduced. Request/evidence logs omit credential headers, raw secrets and signed URLs. Future SQLite/portable codecs retain the already decided device-local credential boundary.

## Files, export and external links

Reuse existing file-input/import/parsing code where actual WebKit behavior passes. Fix canceled picker promises centrally, retaining the existing selected file bytes and copy-before-ready semantics.

Provide one native save service for existing generated Blobs, independent of SQLite project ownership, so all common product exports have reliable system Save behavior. UI/domain code still produces existing ZIP/CSV/WAV/music/etc. bytes. Closed `saveBegin`, `saveChunk`, `saveFinish` and `saveCancel` commands use the trusted main window. Begin receives suggested display filename/MIME, a safe-integer declared byte size and optional checksum, opens the OS Save panel on user action, and stages only inside the selected destination directory. The renderer never supplies an absolute destination.

Use ordered chunks of at most 262,144 bytes and opaque transfer IDs, at most two active transfers, incremental SHA-256/byte-count checks, and a two-minute inactivity timeout after the dialog has returned. The timer refreshes on valid progress and does not time out an open OS dialog. No new whole-project 32 MiB/ZIP cap is introduced; total size is the original Blob's safe integer length, storage errors surface normally. Zero-length user exports follow the shared helper's actual contract rather than being rejected by an unrelated prototype format limit. Cancel/abandonment/window close releases temporary state. Reuse the existing no-overwrite staging/publication primitive, fsync file/directory and report success only after verified publication. Distinguish a published-but-finalization-error outcome from rollback; late abort cannot claim a published file was canceled. Never invent a SQLite project for an IndexedDB export.

Route all shared export helpers through this save boundary and propagate completion/cancel/error accurately. Keep external links in the system browser via a native opener rather than widening main-window navigation. Clipboard/paste, PDF worker/local assets, media playback, audio decode/mix, user-triggered recording and actual print are audited in the normal product; add adapters only for demonstrated gaps. Update microphone usage text to its product purpose without changing the baseline `{audio:true}` capture contract.

## Run ownership and recovery

Keep existing Agent, batch-audio and task-wrap-up lock interfaces. Verify actual packaged `navigator.locks` support/exclusivity. If WebKit lacks it, provide a single centralized native lock manager conforming to the existing interface; owner tokens, release on cancellation/close, and pending acquisition semantics must remain correct. Do not bypass the lock or introduce SQLite merely to claim it exists.

History/retry/resume and generation unknown-outcome rules remain the existing command behavior. Closing/reopening restores persisted records, never automatically resends paid work, and completed tool calls replay saved results without applying the mutation again.

## Delivery order

1. Establish explicit runtime/storage identity and isolated normal build; reuse all shared routes and queries.
2. Connect centralized network, then run the shared Agent end to end before broad feature verification.
3. Connect common save/external-link and any demonstrated API gaps; retain shared import/media/document/audio implementation.
4. Verify all product/tool families using the parity map; repair packaging/adapter problems without rewriting their business rules.
5. Update applicable specs with the deliberately temporary IndexedDB stage and later SQLite replacement boundary.

There is one implementation task with multiple ordered batches. It owns complete current-product parity; intermediate Agent acceptance does not close it. No extra task-creation question is needed for ordinary batches in the reviewed scope. Final commit/archive remains subject to the normal concrete reviewed change plan.

## Risks, verification and rollback

| Risk | Required check / mitigation |
| --- | --- |
| Store identity unintentionally shares user/fixture data | Prove distinct DB namespace and WKWebView store identities with isolated sentinels/reopen; never inspect or mutate an old developer store |
| Native transport differs in streams/abort/FormData/redirect | Local deterministic HTTP/SSE/upload/CDN fixtures plus real configured-provider smoke; existing parser and response-boundary regressions |
| Restored routes accidentally invoke old SQLite owner | Tests fail on unexpected workspace ensure/request; actual product writes appear only in fresh IndexedDB |
| UI remains partly capability-limited | Route/action and exact registered-tool inventory with no unexplained omissions |
| WebKit lacks lock/codec/recording/print behavior | Actual normal packaged probes and user-gesture checks; repair or explicitly record unresolved outcome rather than fabricate a pass |
| Save succeeds before native bytes finish | Await committed service result; test cancel/existing-target/failure/chunk integrity and emitted user feedback |
| Network logs expose secrets | Sanitized logs/fixtures, no key-bearing screenshots/dumps; reuse existing error redaction |
| New dependencies change lockfile/toolchain | Pin only selected native services, use existing local toolchain/pnpm; lockfile changes reviewed with exact purpose |

Rollback is by reverting this task's selector/system-adapter changes on its feature branch. Do not delete databases/workspaces or rewrite previous evidence. The later SQLite task starts fresh by default and uses the shared storage/transaction research; preservation of interim development data requires a later explicit request.

## Acceptance evidence

`research/runtime-gates-and-parity.md` is the source map. Execution adds exact route/tool enumeration, source/build receipts, raw quality logs, isolated browser regression results, actual normal packaged screenshots/AX outcomes and store/reopen receipts. Fixtures are labeled as deterministic protocol evidence. Real supplier requests are bounded to the approved acceptance scenario and user-configured app-local connections; do not extract historical browser keys. System dialogs/recording/print need actual outcomes, not simulated Blobs.
