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

runtimeFetchFor(purpose?: "configured" | "result-download" | "search-probe" | "model-catalog" | "release-check" | "release-asset"): typeof fetch
type RuntimeHttpScope = {purpose: RuntimeHttpPurpose; probeOrigin?: string; redirected?: boolean}
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

On macOS, WKWebView's stable, nonprivate data-store ID is the first 16 SHA-256 bytes of
`cuepoint-product-profile-v1:<bundle identifier>:<storage>`. Normal and isolated
products require distinct bundle/profile IDs **and** distinct WK store IDs/DB
namespaces. `build-app.mjs --isolated-product` requires
`CUEPOINT_PRODUCT_IDENTIFIER=dev.cuepoint.review.<validated-suffix>` and uses the
same normal root frontend, desktop backend/CSP/services. Its archived app receipt
records identifier/storage/store ID. Historical `--acceptance` remains a separate
SQLite/probe frontend and cannot substitute for normal product evidence.

On Windows/Linux, Rust chooses a private ordinary data directory under
`<app_data_dir>/webview-profiles-v1/<32-hex store ID>` using the same fixed
bundle/storage digest. The renderer cannot supply it. Normal, review and
IndexedDB reference identities remain separate. Do not call the macOS-only WK
store API on those systems or enable private/incognito mode.

`bundled_origin::origin/accepts` is the one packaged-entry boundary:
`http://tauri.localhost` on Windows and `tauri://localhost` on macOS/Linux.
Navigation, trusted main-window IPC, microphone permission and media CORS reuse
it. Require the main label, canonical URL with no port/userinfo/query, and entry
path empty, `/` or `/index.html`; hash routes remain allowed. Do not broaden
trusted document paths to repair renderer routing. Corresponding-host startup
and fixed-profile acceptance remain independent from helper unit tests.

The official `pnpm --dir apps/desktop build:app` entry point defaults normal
packaging to `product-sqlite`. `--sqlite-product` is optional for that normal
lane. An explicit `--isolated-product` without it remains the IndexedDB reference;
adding it selects the complete isolated SQLite product. `--acceptance` rejects
either full-product SQLite or isolated-product flags before creating build output.
Keep Cargo default features and explicit `desktop` reference builds separate:
changing every desktop feature build to SQLite would contradict the deliberately
IndexedDB review lane and its receipt.

```js
const productSqlite = process.argv.includes('--sqlite-product') || (!acceptance && !isolated);
if (productSqlite && acceptance) throw new Error('Full-product SQLite and fixture acceptance are separate build lanes');
```

Normal SQLite uses bundle identifier `dev.cuepoint.prototype.offline` and WK
store `ed4550f181f509d050d0643fe7cb7ae0`, with server-owned
`product-workspace-v1/.local/state.sqlite` and internal `assets/`. This new
identity does not read/copy the previous IndexedDB WK store or schema-4 workspace.

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
`apps/desktop/src-tauri/vendor/tauri-plugin-http/CUEPOINT-PATCH.md`; task evidence
retains `http-cancellation.patch` and `http-upstream-provenance.json`. Update the
patch and hashes together whenever the vendored source changes.

### Models.dev catalog purpose (`model-catalog`)

`runtimeFetchFor("model-catalog")` allows exactly one request shape: `GET https://models.dev/api.json`, HTTPS, fixed host and path, no query, no `Authorization`/`Cookie`/credential headers and no body. Every redirect hop is reauthorized by the same rule. Its response ceiling (`MODEL_CATALOG_MAX_BYTES`, 8 MiB) and its 60 s total deadline are independent constants, not the 4 MiB ordinary-JSON limit. It needs no connector. Only user actions use it: `syncModelCatalog` (persists the chosen subset) and `fetchCatalogIndex` (selection dialog, persists nothing). Rust is unchanged: `https://models.dev` passes `validated_origin`; path and purpose limits live in JS. Packaged-window reachability and CSP for this origin have NOT been verified in a real Tauri window.

Official IPC rejection can be a string; sanitize it to an ordinary Error, without
inventing TypeError. Preserve genuine TypeError classification. The existing
connection test permits one chat probe only after unavailable /models 404/405 or
a GET-fetch TypeError. Native string/Error failure remains conservative and does
not trigger that paid probe; abort/body-decode failure also cannot trigger it.

### Native Save and external links

Desktop settings uses the `release-check` and `release-asset` purposes without expanding CSP or adding native commands. The former accepts only the fixed anonymous GitHub release-list GET; the latter accepts this repository's download prefix and, only on transport-followed redirects, the two exact GitHub asset CDN origins. `redirected` is transport-owned hop provenance (`hop > 0`), never inferred from an authored CDN URL. See [Settings and desktop updates](./settings-update.md) for limits, digest validation, cancellation and browser fallback.

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

Stage in the selected canonical directory, flush ordinary-file bytes, publish by
no-overwrite hard link, verify and flush the final same-identity writable file,
perform the explicit platform namespace checkpoint and clean the stage. Unix
returns DirectorySynced; the owner-reviewed Windows test contract returns
ProcessRecoveryOnly after local-NTFS directory authority validation. Windows
does not promise new namespace persistence after sudden OS crash/power loss. Existing empty/nonempty files,
symlinks and a destination created during transfer remain untouched. `saved`
includes byteLength/contentHash. `publishedWithError` includes those fields and
code fileSync/directorySync/stageCleanup: publication already occurred, so UI must show a
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

Keep shared `ui/theme.css` A4-landscape/10mm, white content, released print overflow
and hidden chrome. The default Tauri/Wry macOS print path does not set native
paper/orientation; CSS presence alone cannot prove the system preview's geometry.

## 4. Validation & Error Matrix

| Trigger | Required result |
| --- | --- |
| Tauri missing/malformed/extra-field profile | Startup error; no browser/SQLite fallback |
| Normal official build / explicit normal SQLite flag | Compile product-sqlite; receipt and injected profile declare SQLite |
| Isolated build without / with SQLite flag | Distinct review identity; IndexedDB reference / complete SQLite respectively |
| Fixture acceptance combined with full-product SQLite or isolated flag | Reject before output-directory creation or build execution |
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
| Publication succeeds then final-file flush, namespace checkpoint or stage cleanup fails | Every caller shows saved-file warning/status; no generic failure, cancel, rollback or automatic retry |
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

Good: a standard normal build selects SQLite explicitly through build policy,
then opens its fresh full-product root. Base: a deliberately isolated IndexedDB
build stays a named reference. Bad: silently infer a new owner from the presence
of Tauri or open old profile data to populate an empty normal workspace.

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
- Packaging policy: verify normal no-flags/explicit SQLite, isolated
  IndexedDB/SQLite and both incompatible acceptance combinations. Do not import
  the executable build script merely to inspect flags: import would start builds.
  Build the official normal entry point and independently compare receipt,
  merged plist, executable and derived WK ID. Actual fresh SQLite writes,
  managed preview/Save and original Agent histories must survive a clean reopen
  without a chat/generation POST; model-catalog GET alone is not paid replay.
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
  fileSync/directorySync/stageCleanup, unpublished failure and cancel receipts through
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

// Correct: initialize the fixed shared owner before rendering product routes.
await initializeProductStorage();
// All existing business commands use that ProductStore; Save is independent.
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

## Platform file authority and namespace checkpoints

`paths::NativeStat` reads actual path/opened-file identity rather than deriving
a Windows identity from length or mtime. Unix uses device/inode/link count;
Windows uses stable Win32 no-follow path handles and actual opened handles with
volume/index/link/reparse classification, requiring local fixed NTFS. Reject
reparse points, network volumes and unsupported identity results. Shared database
Boundary, product binary readers/writers/recovery and retained prototype imports
use the same seam. Windows holds ordinary ancestor directory handles without
delete sharing for active boundaries/leases/exports; release them with owner
lifecycle. Unix retains its repeated identity checks. Path-based APIs do not
provide a general hostile-OS-user race defense; retain that finite limit.

`namespace_checkpoint(path) -> Result<NamespaceCheckpoint>` distinguishes Unix
DirectorySynced from Windows ProcessRecoveryOnly. This Windows contract was
explicitly reviewed by the owner for first test packages: ordinary written file
bytes/metadata are flushed, NTFS publication does not overwrite and process-death
intent/SQLite recovery is tested. New directory/file names, unlink operations and
completion-marker names have no sudden OS/power-loss persistence promise. Real
file-flush failures remain errors, never a dummy namespace success.

`flush_published_file(path, identity, byte_length, owned_links)` verifies named
and actual handle identity, size and link count before/after the supported file
flush. Windows needs writable no-follow handles; a read-only File::open handle
cannot fulfill FlushFileBuffers. Preserve intents and ambiguous bytes if flush
fails after link creation. Normal Save returns publishedWithError/fileSync,
which every existing caller shows as a saved-file warning without retry. The
retained schema-4 export transports a typed published error with the same truth,
not a generic retry invitation; it is not a normal-product DTO redesign.

Required regressions: distinct files with equal size/mtime, root/database/writer
replacement, sidecar aliases, junction and ancestor replacement, stage alias or
replacement cleanup refusal, reachable final-file-flush failure, saved warnings
without replay, deterministic stage replacement at the post-publication namespace
checkpoint, and actual process termination/reopen with exact bytes/rows.

Immediately before successful-path stage unlink, revalidate the stage and final
names against the original open descriptor, expected size and owned link count.
Normal Save preserves a `stageCleanup` published warning on mismatch; binary or
manifest publication keeps its intent and foreign stage bytes rather than
manufacturing a sealed claim. Checking only before publication or in Drop is
insufficient because neither protects the explicit success-path unlink.

Unix helper tests do not execute Windows cfg branches; corresponding-host
results are mandatory for that target. Process tests never prove power-loss
survival. Wrong: manufacture a zero inode, ignore a flush error or erase an
unproven stage during cancel. Correct: retain real identity/provenance, keep
published status truthful and refuse ambiguous recovery.

## Workspace registry identity and explicit compatibility

`schema.json` (`packages/studio/src/platform/storage/schema.json`) is bundled into the Rust registry and its SHA-256 is
stored in `product_workspace.registry_hash` when a workspace is created. An installed workspace only
opens while that hash matches the running build or an explicitly supported
historical transition succeeds. A changed current registry is a different
workspace schema. The default [fresh-development policy](../guides/development-change-policy.md)
requires fresh fixtures and does not authorize adding a new migration solely
because a local workspace stores an earlier hash.

- Adding a table requires synchronized current schema JSON/TypeScript,
  table registration, browser fresh-store version/declarations, transaction and
  lifecycle scopes, and intentionally reviewed current registry/hash fixtures.
  A pinned hash is an identity check, not automatic approval for compatibility.
- Preserve the existing explicitly scoped 49-to-50 transition in
  `apps/desktop/src-tauri/src/full_product_store/mod.rs` (`migrate_registry`)
  according to its named source/target registry. Do not silently reinterpret
  its old source constant as permission to migrate into every later registry.
  Any additional transition requires a recorded source version, preservation
  rules, rollback and acceptance scope in the owning task.
- SQL tables in Rust are generic. An explicitly authorized additive transition
  can add a `product_tables` row and the named target hash in one
  `BEGIN IMMEDIATE` transaction; this mechanism does not itself authorize a
  transition to the current registry.
- `tests/storageRegistryHash.test.ts` pins the reviewed current hash. A hash
  change must be reviewed and synchronized with actual owners in the same
  change. Only an explicitly requested compatibility exception requires a new
  previous-hash migration; otherwise incompatible workspaces remain rejected.
- Shipped hashes: `a3405d19…` (desktop-v0.1.0/v0.1.1, 49 tables), `3c897189…` (desktop-v0.1.2, 50 tables).
- Bridge messages keep the Rust error code (`原生存储连接失败（schema）`). Codes outside the known
  storage set are fixed Rust literals, never user data.
