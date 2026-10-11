# Research: Native runtime services for the full Web product in Tauri

- Query: After the user selected full existing Web features backed by internal IndexedDB first, identify the minimum native HTTP/streaming, execution-lock and file-save services without requiring mirrored SQLite projects.
- Scope: repository/code evidence plus a later explicitly requested verification against official Tauri docs/tagged source; no implementation, dependency installation, build/test execution or real provider calls.
- Date: 2026-10-11
- Status: planning. User selected option A: reuse the existing Web product and internal WebKit IndexedDB now; central SQLite ownership is a later stage.

## Findings

### Final concrete HTTP choice after official-source verification

**Select official `tauri-plugin-http = "=2.8.2"` and `@tauri-apps/plugin-http: "2.8.2"` behind one product runtime-fetch wrapper. Do not implement a new generic HTTP client/session engine for this option-A stage.** The tagged JS package requires `@tauri-apps/api ^2.12.0`, which includes the repository’s pinned 2.12.2. Existing CLI 2.12.1/dialog 2.8.1 need no upgrade merely for this choice. Rust still needs dependency resolution/compilation verification; compatibility here is source-level, not a passed build. [Tagged package metadata](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/package.json), [tagged Cargo manifest](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/Cargo.toml).

The official plugin executes requests outside WebView CORS and uses URL permissions. It does not require widening normal browser `connect-src` for its native requests. Keep the existing packaged caller/navigation boundary and grant plugin commands to the main packaged window only. [Official HTTP setup/security](https://v2.tauri.app/plugin/http-client/), [official JS API](https://v2.tauri.app/reference/javascript/http/).

**Verified behavior and wrapper obligations:** tagged JS constructs a browser `Request`, serializes its body, returns a Response with a pull ReadableStream, and wires AbortSignal/body cancel. This supports FormData encoding and shared parsers. Upload bodies are fully buffered and converted to number arrays; they are not chunk-streamed. Abort errors need normalization to the caller’s signal reason. Plugin mutates its passed extended init; provide a fresh init/Headers. Preserve existing upload limits and bound concurrent uploads; do not promise the hypothetical chunk-upload design below is already provided. [Tagged JS implementation, lines 143–326](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/guest-js/index.ts#L143).

**Redirect/cookie/origin details:** RequestInit.redirect is not the native policy field. Set `maxRedirections: 0` and explicitly reject 3xx for `redirect: error`; implement follow manually with a finite per-hop scope check and cross-origin auth stripping. Set `scopeRedirects: true` as defense in depth. Disable plugin default cookie feature; pin Rust with `default-features = false`, enabling only `rustls-tls`, `http2`, `charset`, `system-proxy` as needed. Do not enable unsafe-headers, tracing or dangerous-settings. Plugin normally adds packaged Origin; supplier rejection still requires actual acceptance. [Tagged commands, redirect/client/cancel paths](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/src/commands.rs#L168), [tagged features](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/Cargo.toml#L48).

**Dynamic endpoints/CDNs:** use a small trusted native `authorizeHttpOrigin` command to validate exact HTTP(S) origin and add a main-window-scoped HTTP capability at runtime; no static vendor list or blanket `https://*` prerequisite. The installed Tauri 2.12.2 source exposes `Manager::add_capability` (`.tools/cargo/registry/src/.../tauri-2.12.2/src/lib.rs:841`, default-enabled `dynamic-acl` at line 49). Build scoped permissions with typed serialization/escaped exact origin components, never interpolate authored glob patterns. Wrapper registers selected current connector/search origins, and separately registers validated supplier-result origins for no-auth GET. IPv6/custom ports/localhost must be tested. Local fixtures use explicitly configured loopback grants, not a production global loopback wildcard.

Runtime capabilities are **additive** (`tauri-2.12.2/src/ipc/authority.rs:186`); no public removal API was found. Thus current configuration/download-policy checks remain in the shared wrapper on every request; removed configuration stops ordinary product requests immediately, but previously granted native ACL origins last until process restart. Document that real limitation; do not claim hard native revocation. Bound/deduplicate grants per session and reset with restart. These grants authorize origins, never credential forwarding; CDN calls omit auth/cookies. The new grant command and wrapper are small runtime glue, not a SQLite/credential mirror.

**Timeouts/cleanup:** official API provides connectTimeout, not idle/total timeout. The product wrapper owns a composed AbortController, total/idle timers and listener cleanup while exposing the same Response/body to shared parsers. It rejects excessive bytes at shared reader limits and cancels body on overflow. Plugin chunks are upstream HTTP chunks, not a guaranteed 256 KiB native IPC maximum. Test Stop during headers, between chunks and while a body read is stalled, verifying server disconnect/resource release; source alone does not prove prompt disconnect for an already pending read. If that gate fails, report/fix the service before claiming native transport acceptance. [Official client options](https://v2.tauri.app/reference/javascript/http/), [tagged read/cancel implementation](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/src/commands.rs#L438).

The earlier custom `httpStart/httpRead` design below is retained as **superseded alternative analysis**, not implementation scope. Selected implementation reuses the official plugin for HTTP; only origin registration, runtime wrapper/policy and the independent chunked native Save-file service are custom. Existing keys stay in product IndexedDB. No dependency was installed and no provider was contacted during this verification.

Independent plan review subsequently identified a specific upstream risk: `fetch_read_body` retains an Arc while awaiting a body chunk, but `fetch_cancel_body` closes the resource-table entry without itself canceling that pending read. Source suggests JS abort can settle before the network body is released. The design permits a narrowly scoped provenance-preserving cancellation-aware plugin patch if the actual stalled-body gate reproduces it; it does not permit hiding the failure or replacing shared protocol/plugin infrastructure with a new HTTP engine. This remains a required implementation/packaged check, not a passing research result. [Tagged body read/cancel code](https://github.com/tauri-apps/plugins-workspace/blob/http-v2.8.2/plugins/http/src/commands.rs#L438).

### Current source boundaries

| Source anchor | Finding |
| --- | --- |
| `desktop/tauri/src-tauri/tauri.conf.json:14` | Normal CSP permits only self/IPC connections; all remote AI/search/CDN browser requests are currently blocked by `connect-src`. |
| `desktop/tauri/src-tauri/src/desktop.rs:323` | Native caller trust is restricted to main window, `tauri://localhost`, no port/query/userinfo, entry path empty, `/` or `/index.html`. Preserve this boundary. |
| `desktop/tauri/src-tauri/capabilities/main.json:6` | Only workspace request/cancel and WebView print are granted. New runtime commands require explicit generated ACL/capability entries. |
| `desktop/tauri/src-tauri/build.rs:11` | Normal/acceptance command permissions are generated from explicit profile command lists. Update both deliberately when adding runtime services. |
| `src/lib/ai/requestBoundary.ts:12` | One fetch invocation owner; optional `fetchImpl`, signal, credentials and redirect policy. Existing provider adapters share it. |
| `src/lib/ai/chatStream.ts:357`, `:387` | Chat protocol supports injected fetch, consumes standard Response + ReadableStream and retains shared bounded parsing. Its default local `fetchImpl = ... ?? fetch` can bypass a new boundary fallback if left unchanged. |
| `src/lib/ai/responsesStream.ts:235` | Responses protocol uses the same boundary and shared parser/result shapes. |
| `src/lib/ai/connectors.ts:105`, `:134` | Connector list/test helpers have eager `fetchImpl = fetch` defaults; these need runtime transport resolution, not only a change in requestOnce. |
| `src/lib/agent/runChat.ts:219` | Agent runtime threads optional fetch through compaction/model/final-review; approval/tool state logic need not be rewritten for native HTTP. |
| `src/lib/ai/tavily.ts:42` | Search owns its 30-second AbortController timeout, sends bearer auth and explicitly says uncertain submission is not automatically retried. |
| `src/lib/ai/apimart.ts:251` | Reference-image upload is **FormData with Blob**, up to 20 MB. A JSON-string-only native request bridge would break this feature. |
| `src/lib/agent/generationRuntime.ts:407` | Public signed CDN media download calls `(options.fetchImpl ?? fetch)` directly, with credentials omitted and redirects rejected; it bypasses requestOnce. |
| `src/lib/ai/apimartAudio.ts:263` | Audio result download also uses requestOnce, bounded Blob decoding and no credential/cookie forwarding. |
| `src/lib/resource/limits.ts:2` | Existing limits: audio 32 MiB, media download 256 MiB, JSON 4 MiB, HTTP diagnostics 64 KiB; speech envelope has its own derived bound. |
| `src/lib/agent/runOwnership.ts:12` | Agent execution requires `navigator.locks`; missing Web Locks currently throws a browser/HTTPS error. Thread locking, recovery and interrupted execution semantics must be verified in packaged WebKit. |
| `desktop/tauri/ui/acceptanceStream.ts:10` | Prior fixture proves WebView fetch/SSE only against its controlled loopback server. |
| `desktop/tauri/scripts/sse-server.mjs:12` | Fixture server requires `Origin: tauri://localhost` and explicitly returns matching CORS headers. That is **not evidence that real suppliers accept the packaged Origin**. |
| `desktop/tauri/src-tauri/src/desktop.rs:1142` | `SaveGenerated` validates SQLite worker/project existence before its export branch. It cannot serve IndexedDB-owned project export without a mirrored owner. |
| `desktop/tauri/src-tauri/src/desktop.rs:1069` | Existing read sessions require SQLite assets/worker/generation, prebuffer bytes, and cap chunks at 256 KiB. They are not a generic streaming HTTP/file-transfer service. |
| `desktop/tauri/src-tauri/src/desktop.rs:554` | `publish_bytes` provides staged, fsynced, hard-link no-overwrite publication into native-dialog-selected destinations. Its no-overwrite helper is reusable without copying SQLite project ownership. |
| `src/lib/projectPackage.ts:344`, `src/lib/episodeDelivery.ts:192` | Product ZIP/general Blob and CSV exports currently use browser anchor downloads, not the native Save dialog. |
| `src/lib/audio/exportMix.ts:10` | Audio export rendering and IndexedDB persistence precede download; retain shared product behavior and change only the external byte-save boundary. |

### Minimum service decision

Keep IndexedDB as the sole product data owner during option A, including current local connector configuration/keys. Do not open SQLite to create matching project rows for networking/export, and do not introduce a credential migration/OS keychain prerequisite now. The existing isolated SQLite prototype can remain developer/reference tooling, but product runtime detection must stop treating “Tauri present” as “select SQLite video repository/native empty media.”

Native services should be separate from `workspace_request`, its worker, its generation and its single-action queue:

1. A bounded cancellable HTTP transport returning standard renderer Response/ReadableStream semantics.
2. A worker-independent Save-file transfer for renderer-produced bytes.
3. A thread-lock adapter only if actual packaged Web Locks are unavailable or fail ownership tests.

Keep router hash history, trusted main document, printing, icon and shared UI unchanged. Native HTTP is a system service, not a replacement AI SDK or Agent implementation.

### WebView fetch versus a native transport

| Choice | Scope / evidence | Limitation |
| --- | --- | --- |
| WebView fetch with expanded CSP | Smallest code change; retains native fetch and shared parsers. Prior fixture confirms controlled server CORS works. | Dynamic configured origins require CSP policy, and supplier CORS acceptance of `tauri://localhost` cannot be assumed. Opening `connect-src https:` removes one blocker, not CORS. Upload/download, provider redirects and cookies still differ. |
| Central native HTTP adapter | Avoids browser CORS enforcement while preserving shared protocol/parsing/Agent code through `fetchImpl` seam. One implementation serves model list/test, Chat, Responses, search, audio/media requests. | Requires a typed transport contract, body encoding, streamed response delivery, cancellation, timeouts, origin policy and resource cleanup. Must prove incremental delivery and stop behavior in actual app. |

Recommend the centralized native adapter as the reliable product service candidate. Do not add broad browser fetch/CSP bypasses as fallback after native errors; requests must be attempted once with one selected transport. Keep normal CSP narrow for network traffic routed through Rust. Local packaged PDF/font/worker requests still use WebView fetch/self assets; do not hijack every global fetch.

Current Cargo.lock already contains transitive **reqwest 0.13.5** (`Cargo.lock:2545`) and Tokio, but Cargo.toml does not declare reqwest as a direct dependency. The selected official plugin 2.8.2 uses its declared reqwest 0.12 line and may add a second reqwest version; review/pin the resulting lock rather than forcing the plugin onto the unrelated existing transitive version. No package was added here.

### Original custom transport alternative — superseded by official plugin selection above

Add a dedicated runtime HTTP command family that uses the existing packaged caller validator, a request UUID and a main-window-owned lifecycle epoch. It must not require workspace ensure/project/SQLite generation. A closed request describes GET/POST, validated URL, explicit headers, supported body encoding, response class and bounded deadline. Reject unknown fields/methods/encodings, embedded URL username/password, non-HTTP schemes, fragments and malformed headers. Authorization belongs in a header, never in URL/query/log/error dumps. Signed CDN URLs may inherently contain supplier query signatures; keep them opaque and unlogged, and never append connector keys to them.

Use a selected-origin policy, not arbitrary global HTTP access:

- Register the exact origins of user-configured connector Base URLs and configured search provider at service initialization/config change. Match scheme/host/effective port; permit HTTP only for explicitly configured local/custom endpoints.
- Provider response CDN/media origins are not necessarily API origins. A separate no-auth result-download capability must validate an HTTP(S) supplier URL, prohibit userinfo and connector Authorization/cookies, and apply media byte limits. Do not attach connector headers to arbitrary returned origins.
- Default automatic redirects off. Honor existing `redirect: "error"` exactly. Existing Chat/OpenAI helpers request `follow`; either implement a bounded validated chain with explicit cross-origin authorization stripping and method rules or surface unsupported redirects, with that behavior documented/tested. Never silently forward bearer secrets to a redirected origin.
- No ambient cookie jar; remote API calls use explicit application credentials. `credentials: same-origin` from shared helpers must not accidentally import WebKit/local cookies into native requests.
- Log only safe operation IDs, method/status/timings/byte counts; avoid headers, body, full signed URL and vendor diagnostics containing keys. Existing shared parsers still redact supplier errors before UI display.

Expose one selected `getRuntimeFetch()`/transport resolver; preserve explicit test `fetchImpl` precedence. Replace eager provider defaults (`chatStream.ts:357`, `openaiCompatible.ts:142`, `connectors.ts:105`) and direct download fallback (`generationRuntime.ts:407`) so the native default is selected consistently. Keep `requestOnce`, shared Chat/Responses/SSE/error/Blob parsers and provider validation intact. No global fetch monkeypatch.

Request bodies must support the actual current JSON text and APIMart multipart FormData/file path. Typed multipart parts should carry bounded field name/text or filename/MIME/blob-transfer identity; Rust constructs multipart boundaries, rather than forwarding an invented Content-Type. A reusable chunk upload session can serve multipart Blob parts and Save-file bytes. Read original Blob bytes in bounded chunks; do not spread 20–256 MiB arrays into a single JSON IPC envelope. Reject unsupported RequestInit bodies explicitly instead of dropping them.

For responses, the simplest bounded contract is:

- `httpStart` resolves once status and approved response headers are available, creating an opaque window-owned session.
- Renderer creates a standard `Response(new ReadableStream(...), {status,statusText,headers})` or a narrowly documented compatible Response, so existing `getReader/json/blob` consumers work. Account for bodyless status codes rather than manufacturing an invalid Response.
- `httpRead(session, maxBytes<=256KiB)` returns ordered raw bytes or closed chunk/eof state; native reads only as requested, providing backpressure without unbounded channel queueing. If push channels are used instead, add sequence/ack/window bounds; Tauri Channel delivery alone is not backpressure. The installed Tauri source supports raw channel bytes (`.tools/cargo/registry/src/.../tauri-2.12.2/src/ipc/channel.rs:178`), but no runtime transport currently uses them.
- AbortSignal and stream `cancel()` close the same native request/session immediately, including pending header/read work. Cancellation must bypass long serialized queues. Window close/reload cancels all owned sessions and discards late chunks. Cancel is idempotent and removes timers/listeners/resources.
- Bound concurrent sessions, request/body/chunk/header sizes, connect/header/idle/total duration and total transfer. Reuse current response limits by purpose, allowing audio speech envelope and 256 MiB media downloads while keeping bounded JS parser limits. Pick concrete timeouts in design, then test slow valid streams; a single small generic response cap would break existing media workflows.
- No automatic retry. On timeout/stop after paid submission, return uncertainty semantics; stopping local waiting does not prove refund or cancellation at the supplier. Preserve existing job IDs/unknown outcome/recovery behavior.

### Execution ownership and Web Locks

Option A reuses `executeAtomicTool` and Dexie transactions unchanged, so the business-write/tool-ledger atomicity established by `tests/agentToolTransactions.test.ts` remains one browser-engine transaction inside the packaged product. HTTP stays outside these local transactions.

Verify actual `navigator.locks` behavior on `tauri://localhost`, not only existence on a mock navigator: lock contention on the same thread must fail `ifAvailable`, other threads remain independent, stop/reload releases, and recovery acquires the same lock before interrupting abandoned runs/batches (`runOwnership.ts:22`, `:32`). If unavailable, use the existing injected `ThreadLockManager` interface with a native main-window/process scoped registry and opaque lease IDs, release in `finally`/window-close. Avoid a new scheduler or a second Agent owner. Single-window assumptions must be enforced; an in-renderer boolean does not coordinate multiple WebViews/reloads.

### Worker-independent Save-file service

Do not change `SaveGenerated` to silently invent SQLite owners or send `projectId: studio`. Build a separate native byte export service:

1. `saveBegin` takes only display filename, MIME, declared non-negative safe-integer byte size and optional checksum, then opens the native Save dialog. Zero-length output follows the existing shared helper's contract. Destination paths never come from renderer. Return `canceled` distinctly without any product database write.
2. A successful choice creates a fresh native-owned temporary stage in the destination directory and returns opaque transfer ID + chunk bound. Do not expose the absolute path as a portable product field.
3. `saveChunk` accepts ordered offset + bounded bytes, rejects gaps/repeats/excess and checks cancellation. Hash while writing; limit active transfers and total size according to supported export types.
4. `saveFinish` verifies exact declared size/hash, fsyncs file, atomically publishes with existing no-overwrite hard-link policy (`publish_bytes`), fsyncs directory and removes stage. Return `{byteLength, contentHash}`. Renderer compares original Blob bytes/hash. An existing destination—including an empty file—must remain untouched.
5. `saveCancel`/window close/timeout removes stage. Once publication succeeds, report success even if abort races afterward; late cancellation must not misreport a published file as canceled. Directory sync/publication failure must report a precise uncertain/published outcome if necessary, not promise rollback of an existing published destination.

Current `publish_bytes` is a sound small-buffer no-overwrite oracle and tests at `desktop.rs:1446` cover existing files. A streaming save helper can reuse its publication primitive, not its all-bytes-in-memory signature. Existing acceptance `native.save` caps 32 MiB and spreads a full byte array (`ui/bridge.ts:223`); that fixture helper is not sufficient for whole project ZIPs or large exports. The shared product has no global ZIP output cap today; choose/document a generous supported export cap or bounded streaming contract rather than silently impose the prototype’s 32 MiB limit.

Route existing `downloadBlob` (`projectPackage.ts:344`) and CSV helper (`episodeDelivery.ts:192`) through one asynchronous runtime save helper. Browser keeps anchor download; packaged runtime awaits native result and surfaces cancel/error/success appropriately. Audit all listed call sites in ProjectGallery, WorkspaceChrome, ProducePage, audio/music exports/timeline; changing a void helper to a Promise without awaiting/catching produces unhandled errors or premature success. CSV must preserve UTF-8 BOM, ZIP begins PK, WAV remains RIFF/WAVE, and arbitrary user-exported image/video/audio bytes keep their original format/MIME. Unlike prototype `GeneratedFormat`, this service need not relabel every export as one of four formats.

No ordinary input-file picker service is necessary merely to retain current IndexedDB Blob imports: Web file inputs inside packaged WebKit may already provide independent Blobs. Verify those actual UI flows. Material preview sources already become blob URLs; normal CSP allows blob/data media/images. Remote preview URLs, if any, need a declared fetch-to-Blob policy rather than broad external image/media CSP.

### Validation commands already supported

Run only after implementation is approved; none were run in this research. All pnpm commands use the explicit machine binary. Existing scripts/tool wrapper support:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test -- tests/chatStream.test.ts tests/responsesStream.test.ts tests/d07RequestBoundary.test.ts tests/d07RequestWire.test.ts tests/aihubmix.test.ts tests/apimart.test.ts tests/apimartAudio.test.ts tests/agentToolTransactions.test.ts tests/agentToolsReview.test.ts tests/agentBatchPreparationRecovery.test.ts tests/projectPackage.test.ts tests/episodeDelivery.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
node desktop/tauri/scripts/tools.mjs cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
node desktop/tauri/scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --features acceptance,test-hooks
node desktop/tauri/scripts/tools.mjs cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --features acceptance,test-hooks -- -D warnings
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri test:packaged
```

`test:packaged` currently builds the historical acceptance fixture and controlled CORS-enabled loopback server, not the normal full-product UI or proposed native transport. Retain it as compatibility evidence; it does not replace actual normal-product acceptance. The command wrapper pins Rust 1.99.0 and package-local Cargo roots (`scripts/tools.mjs:7`).

### Required actual packaged acceptance

Use the normal root product frontend/Rust runtime with fresh isolated app identifier and WebKit data store; no private/incognito mode. Do not seed or mirror SQLite projects. Record product source/bundle hashes, real app screenshots/AX, local server request counts/disconnect timestamps and final durable IndexedDB state after close/reopen.

- Configure an isolated local fixture connector through product UI. Serve Chat + Responses streams with split UTF-8/CRLF/tool fragments, actual spaced deltas, non-SSE JSON, error/oversize/stall, abort before headers/during body and wrong origin/redirect cases. Native transport fixtures must include a response **without CORS headers**, because the old CORS server cannot prove the reason for native transport. Adapt its Origin check explicitly; a Rust client has no inherent browser Origin header.
- Exercise real Agent UI: new conversation, model stream, one local business tool with preview/approval, committed result/history, task/memory read where in approved scope, Stop, reload interrupted history and saved completed replay. Confirm local domain write and ledger are atomic, and no automatic provider redispatch after reload.
- Verify Web Locks contention/release/recovery or the injected native lease implementation against two execution attempts.
- Exercise model discovery/test, search fixture, JSON request, multipart reference-image upload and unauthenticated signed-URL binary download, including same-name distinct bytes, bounded abort/timeout and no credential leak to CDN/redirect/error logs.
- Actual Save dialogs: CSV/ZIP/WAV or product-selected export, cancel, already-existing empty/nonempty destination, successful hash/length match, mid-transfer cancel, close/reopen cleanup and export larger than the old 32 MiB prototype limit. Export must work with IndexedDB-only project and no SQLite worker/project.
- Reopen actual app and verify project/assets/chat/tool history from WebKit IndexedDB, shared image/video/audio Blob preview, PDF/import/print where affected. Native video/media gate tests must now prove option-A owner selection consistently; retaining old `isNativeWorkspaceRuntime()` checks in media hooks would hide imported blobs.

Real supplier requests remain a separate acceptance step after the user configures connections and the current task’s concrete call scope is approved. No real paid model/media/search call is needed to establish the transport contract, and none was made during research. Keys can remain device-local in the temporary product IndexedDB as selected; do not add credential migration as a prerequisite for this stage.

### Related specs / local references

- `.trellis/spec/frontend/native-workspace.md`: trusted packaged document, fresh isolated acceptance, file integrity/no-overwrite and cleanup semantics. Its product SQLite route ownership describes the previous stage and must be updated explicitly for option A rather than silently bypassed.
- `.trellis/spec/frontend/video-workspace.md`: one shared UI and one active owner; no accidental fallback/mirror.
- `.trellis/spec/frontend/agent-batch-generation.md`, `agent-write-evidence.md`: no automatic paid replay; local atomic write/evidence; interrupted/unknown outcomes.
- `desktop/tauri/scripts/packaged-regression.mjs:1`, `sse-server.mjs:1`, `ui/acceptanceStream.ts:1`: existing bounded packaged/stream evidence conventions.
- External documentation: official Tauri HTTP docs and tagged `http-v2.8.2` source were fetched only after the main session explicitly requested API/dependency verification. Links and limitations appear in the concrete-choice section. No provider/service request, credential access or dependency installation occurred.

## Caveats / Not Found

- Supplier CORS behavior, current provider availability and live credentials were not queried. Existing fixture evidence cannot answer them.
- HTTP choice is pinned above. Final `design.md` resolves a 30-second connect bound while preserving caller deadlines, Save chunks up to 262,144 bytes, two active transfers and a two-minute post-dialog inactivity timeout, with no new whole-ZIP/32 MiB cap. Packaged abort/resource evidence remains an implementation gate. Runtime origin permissions are additive, and official plugin uploads buffer complete bodies; neither limit should be hidden.
- No native generic HTTP/session/file-transfer service exists in the current product; examples above are proposed bounded contracts, not completed functionality.
- Full existing Web feature reuse still requires auditing runtime checks that currently select native SQLite/empty media/capability gates. Merely enabling Agent routes and CSP will not deliver whole-product parity.
- OS keychain/credential migration and centralized SQLite ownership are future stages, not prerequisites or implicit additions to the user-selected option A.
