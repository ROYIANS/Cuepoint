# Complete shared product: native runtime contract

## 1. Scope / Trigger

Read before changing product storage selection, Tauri packaging, default provider
transport, shared exports/external links or Agent execution in a native WebView.
The complete React product, business commands and Agent loop/tools/approvals
remain shared. Current persistence uses the all-table ProductStore interface;
browser IndexedDB and full native SQLite/files implement the same commands.
Normal packaged SQLite activation requires actual isolated full-product
acceptance. Synchronization remains subsequent work. Do not reconstruct
per-domain native pages, commands or an alternate Agent loop.
Fresh development is the default; no old-data migration/backfill/import reader
or compatibility strategy is authorized without an explicit request.

The retained SQLite schema-4/filesystem adapter is an explicit reference/test
lane governed by native-workspace.md/video-workspace.md. It is not the full
SQLite product, a fallback, or a mirror. Browser behavior/namespace remain
shared source code with a separate data identity. Read
[Shared Product Storage](./shared-product-storage.md) before adapting commands,
explicit transaction contexts, reactive queries or managed binary consumers.

This document records executable source contracts, not acceptance status. Unit
or fixture proof alone never establishes actual packaged/provider/system-dialog
success. Record pending, failed, skipped and actual outcomes separately.
Shared native numeric controls must accept legal stored precision; see
[exact clip editing](./audio-music.md#exact-numeric-clip-editing-2026-10-11).

## 2. Signatures

Owners: `runtimeIdentity.ts`, `productStorage.ts`, `database.ts`,
`videoWorkspaceRepository.tsx`, `runtimeFetch.ts`, `runtimeHttpPolicy.ts`,
`runtimeSave.ts`, `nativeSystemServices.ts`, `runtimeExternalLinks.ts` and native
`runtime_services.rs` / `file_transfer.rs`.

```ts
isTauriRuntime(): boolean
resolveProductStorage(native: boolean, profile: unknown): Readonly<{
  runtime: "browser" | "tauri"; storage: "indexeddb" | "sqlite";
  profileId: string | null; databaseName: string;
}>
getProductStorage(): ReturnType<typeof resolveProductStorage>
usesSqliteProductStorage(): boolean

runtimeFetchFor(purpose?: "configured" | "result-download" | "search-probe"): typeof fetch
connectorProbeFetch(baseUrl: string, fetchImpl?: typeof fetch): typeof fetch
authorizeRuntimeHttp(
  url: URL, method: string, headers: Headers,
  body: BodyInit | null | undefined, scope: RuntimeHttpScope,
): Promise<{origin: string; allowHttp: boolean}>

downloadBlob(blob: Blob, filename: string, signal?: AbortSignal): Promise<"saved" | "canceled">
nativeSaveFilename(filename: string): string
isPublishedSaveError(error: unknown): error is Error & {published: true}
saveNativeBlob(blob: Blob, filename: string, signal?: AbortSignal): Promise<"saved" | "canceled">
printStoryboard(): Promise<void>
nativeOpenExternalUrl(url: string): Promise<void>
installNativeExternalLinks(): void
```

`createRuntimeFetch(services, scope?)` retains an explicit injectable service
boundary for meaningful tests. Normal providers keep their existing protocols,
`requestOnce`, bounded parsers/SSE/readers, and explicit `fetchImpl` precedence.
The runtime wrapper chooses transport; it does not globally replace fetch.

## 3. Contracts: request / response / environment

### Fixed startup identity and one data owner

Rust installs a nonwritable/nonconfigurable frozen
`window.__CUEPOINT_PRODUCT_PROFILE__ = {version:1,id,storage}` before frontend
module/database construction. Keys are closed. ID matches
`[A-Za-z0-9][A-Za-z0-9._-]{0,159}`; storage is indexeddb or sqlite. Genuine Tauri
with missing/invalid profile fails explicitly. Browser ignores any incidental
profile and keeps `aifenjing`. Normal desktop uses
`cuepoint-desktop:<profileId>:v1`, snapshots its owner once, and cannot change
owner through later preferences, globals, URLs or failed writes.

WKWebView's stable, nonprivate data-store ID is the first 16 SHA-256 bytes of
`cuepoint-product-profile-v1:<bundle identifier>:<storage>`. Normal and isolated
products require distinct bundle/profile IDs **and** distinct WK store IDs/DB
namespaces. `build-app.mjs --isolated-product` requires
`CUEPOINT_PRODUCT_IDENTIFIER=dev.cuepoint.review.<validated-suffix>` and uses the
same normal root frontend, desktop backend/CSP/services. Its archived app receipt
records identifier/storage/store ID. Historical `--acceptance` remains a separate
SQLite/probe frontend and cannot substitute for normal product evidence.

The full product exposes the same routes, world/material/media features and
Agent on either adapter; no owner-dependent reduced feature gate belongs in
those pages. Genuine runtime detection remains authoritative for hash history,
trusted IPC and system services. IndexedDB startup never calls the native worker;
full SQLite startup opens its own all-table worker, not schema-4 ensure/state
to fabricate a catalog. Neither owner reads old profiles. Imports keep internal
Blobs or managed files, never external source authority.

One explicit ProductStore transaction commits Agent business writes and original
completed tool result/ledger/receipt atomically. HTTP stays outside that transaction.
Completed tool replay must reuse saved results; reopen never resends paid work.
Lost/malformed native commit acknowledgement requires durable outcome lookup;
an unresolved outcome is not a known rollback and must not authorize replay.
Keep ThreadLockManager/Web Locks and audio/task lock guards. Actual packaged
lock exclusivity/release needs proof; no bypass or unverified native fallback.

### Official HTTP service and exact scope

Pin JS HTTP 2.8.2/API 2.12.2 and Rust HTTP `=2.8.2`, default-features false,
rustls-tls/http2/charset/system-proxy only. No cookie jar, tracing, unsafe-headers
or dangerous-settings. Config sets scopeRedirects true; main navigation/CSP stay
restricted. Official requests bypass WebView CORS, not the application policy.

Trusted IPC is `authorize_http_origin({origin,allowHttp}) -> {origin}`. Canonical
exact HTTP(S) origins only: no userinfo/path/query/fragment/glob input; HTTP needs
explicit current configuration/probe intent. Escaped URLPattern host components
preserve IPv6/ports; local-only main-window grants deduplicate and cap at 128.
Dynamic native ACL grants are additive until restart. The shared policy rechecks
current connection/search settings on **every** request; deletion blocks normal
product calls immediately but is not hard native ACL revocation.

Configured traffic uses current connector/search origins. Draft connector probes
are scoped to that operation; redirect destinations require existing config or
the same probe origin. Result downloads use no-auth GET with no body/credential
headers; HTTP result origins must be explicitly configured, while validated
HTTPS supplier/CDN origins can be independently granted. Never forward provider
auth or signed URL contents into logs. Relative/bundled PDF/font/worker resources
stay WebView fetch; no native-error fallback request occurs.

Supply fresh init/Headers because the official JS plugin mutates init and
buffers uploads. At most two body-bearing native calls buffer concurrently,
shared across configured/probe wrappers; queued cancellation removes waiters.
Blob/byte/FormData payload content is limited to 20 MiB; FormData counts fields
and Blob bytes, not MIME framing overhead. Direct string/URLSearchParams bodies
retain existing domain/vision JSON budgets instead of a new blanket 20 MiB text
cap. Request-object body extraction remains bounded; streaming upload bodies
reject rather than silently losing data. The official plugin is not a chunked
upload engine. Response limits remain shared per-domain reader contracts.

Native connectTimeout is 30000 ms. Existing caller total/idle/Stop signals remain
authoritative; do not introduce a shorter generic generation deadline. Automatic
native redirects are disabled (`maxRedirections:0`). Follow manually for at most
five hops, reauthorize each destination, apply 301/302 POST and 303 method/body
rules, strip sensitive headers cross-origin and cancel discarded bodies.
`redirect:error` rejects supported redirect statuses 301/302/303/307/308;
manual preserves the response. No automatic retry.

Caller abort reason identity survives headers/body. Track controllers through
EOF/error/cancel/header failure, abort pending work on pagehide/beforeunload and
prevent requests after pagehide; canceled beforeunload must not permanently
disable a surviving page. A later pageshow restores eligibility. Suppress late
chunks. Tauri ResourceTable clear alone
does **not** call Resource.close. The official dependency is patched narrowly:
response mutex/atomic/Notify interrupts pending reads and drops the response;
register_response closes resources immediately for JS null-body statuses
101/103/204/205/304 while preserving numeric rid. All other protocol APIs remain
official. Keep vendor licenses, exact patch, crate checksum/source hashes and
regressions; a JS rejected read alone is insufficient disconnect proof.
Provenance is recorded in
`desktop/tauri/src-tauri/vendor/tauri-plugin-http/CUEPOINT-PATCH.md`; task evidence
retains `http-cancellation.patch` and `http-upstream-provenance.json`. Update the
patch and hashes together whenever the vendored source changes.

Official IPC rejection can be a string; sanitize it to an ordinary Error, without
inventing TypeError. Preserve genuine TypeError classification. The existing
connection test permits one chat probe only after unavailable /models 404/405 or
a GET-fetch TypeError. Native string/Error failure remains conservative and does
not trigger that paid probe; abort/body-decode failure also cannot trigger it.

### Native Save and external links

Every command uses the trusted packaged main window. Save commands take a
closed `request` DTO; the external command takes a separately validated `url`:

| Command | Request | Result |
| --- | --- | --- |
| product_save_begin | `{version:1,operationId:UUID,fileName,mimeType,byteLength,contentHash?}` | canceled or ready with UUID session and chunkBytes 262144 |
| product_save_chunk | `{version:1,session:UUID,offset,bytes:number[]}` | verified next byte offset |
| product_save_finish | `{version:1,session:UUID,contentHash:lowercaseSHA256}` | canceled, saved or publishedWithError |
| product_save_cancel | `{version:1,session:UUID}` | boolean indicating a known transfer was found |
| product_open_external | `{url}` | unit success or safe error |

Begin's byteLength is a nonnegative JS safe integer. Suggested filename is
nonempty, at most 240 UTF-8 bytes, without path separators/control characters;
MIME is display metadata limited to 256 UTF-8 bytes without control characters.
Destination comes only from the OS Save panel.
No SQLite worker/project/generation is required. At most two transfers exist;
chunks are ordered, nonempty and at most 262144 bytes. Incremental SHA-256 and
observed/declared length must match. Zero-length files are valid, with no chunks;
there is no new 32 MiB/whole-ZIP cap. Staged transfers expire after two minutes
without progress, checked every two seconds; an open dialog does not idle-expire.
Cancel, window destruction and new page-load start release temporary state.

Stage in the selected canonical directory, fsync bytes, publish by no-overwrite
hard link, fsync directory and clean the stage. Existing empty/nonempty files,
symlinks and a destination created during transfer remain untouched. `saved`
includes byteLength/contentHash. `publishedWithError` includes those fields and
code directorySync/stageCleanup: publication already occurred, so UI must show a
saved-file warning. `isPublishedSaveError` guards Error plus published:true;
never use an ordinary failure toast or auto-retry that outcome. A late abort
cannot turn a published file into canceled. Unknown finish failure remains an
error/uncertain outcome; only prepublication interruption normalizes to canceled.

Every UI call site must classify this error **before** its generic failure handler,
including nested download callbacks inside a shared action wrapper. Catch locally
around `downloadBlob`, show `error.message` as a warning/status, and retain ordinary
error handling for all other errors. Actual examples are AboutPage, MaterialPreview,
AudioTimeline exportMix, AudioExports, shared AudioPlayer and MusicDetails in
MusicWorkspacePage. A completed internal mix remains available when external Save
is canceled or warns; never delete its owned media or repeat rendering/transfer to
repair a post-publication warning.

`downloadBlob` awaits native completion and translates only native suggestions
through `nativeSaveFilename`: well-formed/NFC text, forbidden-character cleanup,
UTF-8-safe 240-byte cap and extension preservation (including tar.gz family).
Browser anchor download receives the original filename unchanged. `saved`
feedback follows confirmed publication; canceled export has no success toast.
Native external HTTP(S) links open in the OS browser through the validated
official opener command; raw file/custom-scheme opening and broader main-window
navigation are not enabled. Reject credentials, control characters, missing host
and URL strings longer than 8192 bytes. Existing keyboard/link semantics remain
shared.

### Native storyboard print

`runtimePrint.ts` retains browser `window.print()`. Tauri uses the fixed
`product_print_storyboard()` command; no renderer paper/path/HTML or silent-print
options are consumed. `runtime_services.rs` checks the trusted packaged main
window. `native_print.rs` dispatches through `with_webview`, rechecks caller/main
thread, and borrows typed WKWebView/NSWindow handles only inside that callback.
The main capability and both normal/acceptance handler/build ACL lists register
the command. An already attached system sheet rejects another print dialog.

On macOS copy `NSPrintInfo::sharedPrintInfo()` rather than mutating app defaults.
Set A4 portrait base size `210*72/25.4` by `297*72/25.4` points, then Landscape,
with all four margins `10*72/25.4` points. Use the documented WKWebView print
operation and modal sheet API with no delegate/context pointer. Await the actual
main-thread callback Result; dispatch failure is not a successful queued command.
`void` success only means dialog initiation, never printed or saved PDF bytes.
User cancellation/no printer causes no printed-success feedback. Other desktop
systems retain their existing print delegate; their A4 behavior needs actual
platform acceptance. Do not fall back to default native print after failure.

Keep shared `styles.css` A4-landscape/10mm, white content, released print overflow
and hidden chrome. The default Tauri/Wry macOS print path does not set native
paper/orientation; CSS presence alone cannot prove the system preview's geometry.

## 4. Validation & Error Matrix

| Trigger | Required result |
| --- | --- |
| Tauri missing/malformed/extra-field profile | Startup error; no browser/SQLite fallback |
| Profile mutates after module construction | Existing fixed owner/namespace remain |
| Complete product query/write on either adapter | Existing shared command with explicit StoreTx; no schema-4 fallback |
| Removed connector / exhausted origin grants | Reject before native request; no fallback/retry |
| Result request carries auth/body or unconfigured HTTP | Reject; no credential forwarding |
| Redirect to unconfigured origin / more than five hops | Cancel discarded body and reject before next send |
| Unsupported/oversized binary upload | Reject; preserve existing JSON-domain budgets |
| Native IPC rejects with string / real TypeError | Sanitized Error / TypeError respectively; preserve conservative probe gate |
| Stop while headers/read stalled / page closes | Abort, release body/connection, suppress late chunks |
| 204/205/304 response | JS body null and native response resource already closed |
| Save canceled or checksum/order invalid | No claimed success/publication; release stage |
| Existing/raced target | Reject without modifying bytes |
| Publication succeeds then directory sync or stage cleanup fails | Every caller shows saved-file warning/status; no generic failure, cancel, rollback or automatic retry |
| Long native filename / browser download | Safe 240-byte suggestion / original browser name |
| Print dispatch/unsupported/missing native handle or open sheet | Safe UI error; no default-print fallback or printed-success claim |
| Print dialog initiated / canceled / no printer | No claim of printed or saved PDF bytes |
| Actual device/system/provider check unavailable | Record pending/skip/failure; no fabricated acceptance |

## 5. Good / Base / Bad Cases

Good: Tauri Agent writes a project through the existing shared tool transaction,
retains original history in the same fixed owner, streams using native transport,
and exports verified internal bytes through independent native Save. Browser
uses the same page/command code in its original namespace.

Base: an isolated full SQLite product uses all shared features with distinct
profile/store identity and the same compiled services. Schema-4 prototype
capability tests remain separate from full-product evidence.

Bad: infer SQLite from Tauri, hide full Agent routes, mirror projects for exports,
copy old keys/data, globally widen fetch/CSP, retry native failures through WebView,
call a rejected JS promise actual disconnect proof, or display success before
native publication. A file already published with a warning is never “canceled”.

Good: a MusicDetails download warns after confirmed publication and retains its
work/media. Base: canceled Save shows no success or failure, and an unpublished
write failure retains the ordinary error. Bad: a nested action catches every error
as “export failed” and encourages saving already-published bytes again.

## 6. Tests Required: assertion points

- productStorage/productStorageQueries: owner fixed before construction, fresh
  profile isolation, full media queries, browser sentinel unread, visible native
  open failure without fallback and no eager IndexedDB construction for SQLite.
- videoWorkspaceRepository/shared page tests: both full adapters use existing
  commands/capabilities; explicit prototype retains separate generation/CAS
  reference tests. Sync remains unavailable until implemented.
- sharedStorageContract/sharedNativeStorageContract plus actual native business,
  binary and acknowledgement regressions in the shared storage contract.
- runtimeFetch/runtimeFetchIntegration/runtimeFetchLifecycle: native/default and
  injected fetch selection, FormData bytes/two-slot shared queue/20 MiB file,
  larger domain-authorized JSON, redirect rules/credential stripping/scopes,
  abort identity/late chunks/cleanup and no retry on string/Error/TypeError.
- Existing model-probe tests retain unavailable GET/TypeError fallback and
  prohibit POST on abort/body error/native string rejection. Agent transaction,
  execution/history/permission/replay and Web Locks regressions remain mandatory.
- Native vendor regression uses actual TCP/reqwest/Tauri ResourceTable for a
  pending read disconnect and repeated 204/205/304 resource absence while an
  unrelated 200 remains readable. 101/103 predicate checks are not live-network
  evidence. Exact URLPattern tests cover IPv6/ports/foreign host boundaries.
- runtimeSave/nativeSystemServices/runtimeExternalLinks: zero and ordered chunks,
  checksum mismatch, prepublication cancellation, late abort/publication winner,
  published warning, unknown finish errors, long Unicode/compound filenames,
  original browser names and OS-link interception.
- audioMusicSaveFeedback: exercise the actual four audio/music UI callbacks with
  directorySync/stageCleanup, unpublished failure and cancel receipts through
  runtimeSave/saveNativeBlob. Require warning/status without generic error, one
  begin/finish without retry/cancel after publication, and unchanged owned records
  and source bytes. About/material UI regressions retain the same classification.
  Mocked final invoke/callback hosts do not prove actual OS dialog/publication.
- runtimePrint: actual shared storyboard callback and host seam retain browser
  print, wait for fixed native dispatch, surface safe failure without fallback,
  and never show printed success. Rust paper-policy tests verify points/A4/10mm
  and usable landscape area; normal and acceptance configurations must compile.
  Separately inspect real white/chrome-free landscape multipage preview and cancel.
  A saved PDF page box near 841.890 by 595.276 points verifies A4 orientation;
  mocks and a portrait/landscape thumbnail alone do not prove paper dimensions.
- Rust file_transfer/runtime_services: actual zero and 33 MiB+ disk bytes/hash,
  chunk/order limits, stage expiry/cancel/dialog capacity, empty/nonempty/raced
  target protection, truthful injected post-publication failure and closed DTOs.
- Actual normal isolated product: profile/WK store/namespace independence and
  reopen of text/managed bytes/original chat/tool history; native no-CORS HTTP/SSE/upload/CDN/Stop
  fixtures; user-configured real suppliers; genuine imports/Save/external browser,
  baseline microphone, media/documents and white A4-landscape print. Record exact
  build/source identities and do not replace actual evidence with the fixture
  WebView, mocks, synthetic Blobs or another platform's result.

Use the explicit approved machine pnpm and fixed Rust toolchain. Preserve raw
logs/source provenance and reviewed warning distinctions; no zero-warning or
all-platform claim follows from a passing unit test.

## 7. Wrong vs Correct

```ts
// Wrong: runtime is treated as a data owner, and export invents a second project.
if (isTauriRuntime()) await nativeWorkspace.ensure();
await nativeWorkspace.createProject(project.name);

// Correct: startup selected exactly one owner; native Save is independent.
if (usesSqliteProductStorage()) {
  // Explicit reference adapter only; retain its closed contracts.
} else {
  // Existing shared IndexedDB business command owner.
}
const result = await downloadBlob(generatedBlob, authoredFilename);
if (result === "saved") showSavedFeedback();
// The caller separately handles isPublishedSaveError as a saved-file warning.
```

Wrong: label an official IPC string rejection TypeError so the connection test
attempts a paid fallback POST. Correct: sanitize its ordinary Error and preserve
only genuine TypeError classification; the shared existing probe gate decides.

```ts
// Wrong: all save errors are presented as unpublished failure.
try { await downloadBlob(blob, filename); }
catch (error) { showFailure(error); }

// Correct: keep the catch at the save call; ordinary mutation errors stay errors.
try {
  const result = await downloadBlob(blob, filename);
  if (result === "saved") showSavedFeedback();
} catch (error) {
  if (isPublishedSaveError(error)) showWarning(error.message);
  else throw error; // Existing outer error owner handles unpublished failures.
}
```
