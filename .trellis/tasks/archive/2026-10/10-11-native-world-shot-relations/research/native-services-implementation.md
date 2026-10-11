# Native runtime services implementation

Date: 2026-10-11. Owner: native_services implementer. This report covers native
service code and focused checks; it does not close the complete-product task or
claim packaged/live-provider/system-dialog acceptance.

## Ownership and initial boundary

The worker owns `desktop/tauri/**`, root package/lock dependency changes,
`src/lib/nativeSystemServices.ts` and its focused regression. Other workers own
shared product storage/routes and native HTTP policy/wrapper/provider call sites.
Main owns download/export callers, external-link events, fixtures and actual
packaged acceptance. No business command, alternate UI, SQLite mirror, actual
provider key/call, commit, push or task archival was performed by this worker.

`native-services-boundary.json` records the initial owned files and base
revision. Existing dirty product/task edits were preserved.

## Product profile and build identity

`runtime_services::profile` derives a stable WKWebView store identifier from the
first 16 bytes of SHA-256 over
`cuepoint-product-profile-v1:<bundle identifier>:<storage>`. Before any frontend
database construction, a native initialization script defines the immutable
frozen `window.__CUEPOINT_PRODUCT_PROFILE__` with exact `{version:1,id,storage}`.
Normal products select IndexedDB; historical `acceptance` explicitly selects
the isolated SQLite/probe frontend. Bundle/profile identifiers are validated
against the same bounded ASCII identifier grammar as the renderer owner.

`build-app.mjs --isolated-product` requires a distinct
`CUEPOINT_PRODUCT_IDENTIFIER=dev.cuepoint.review.<unique>` and builds the same
normal root frontend/backend/CSP/services. Only application identity/name/window
title differ. It records identifier/storage/WK store identity in
`.acceptance/isolated-product-bundle.json` and archives the actual app. Historical
`--acceptance` remains separate and mutually exclusive. Actual store isolation,
fresh sentinels and close/reopen are the main session's packaged checks.

## Official HTTP and exact dynamic scopes

Root exact JS dependencies: `@tauri-apps/api` 2.12.2 and
`@tauri-apps/plugin-http` 2.8.2. Rust pins HTTP 2.8.2 with default features disabled
and only rustls-tls/http2/charset/system-proxy. Configuration enables
scopeRedirects; no blanket remote-origin capability or wider CSP was added.

`authorize_http_origin({origin,allowHttp}) -> {origin}` uses the existing trusted
packaged main-window guard, validates canonical exact HTTP(S) origins (no
userinfo/path/query/fragment/glob input), requires explicit HTTP intent and
registers main-window-local dynamic capabilities. Host/IPv6 pattern components
are escaped; custom ports remain exact. Deduplication limits grants to 128 per
process. Grants remain additive until restart; current configuration/policy must
be checked by the shared wrapper on every request. This is not a hard native
revocation API. Pattern regressions execute the official URLPattern scope
implementation against suffix hosts, ports and IPv6.

The pinned official 2.8.2 source's stalled read defect was reproduced with a real
TCP HTTP server, reqwest response and Tauri ResourceTable. After resource close,
the pending read retained its Arc/connection for at least 300 ms; aborting the
task released the connection. `http-stalled-upstream-reproduction.log` and
`http-upstream-cancel-reproducer.rs` preserve that original mechanism. This is
native source-level evidence, not an unpatched packaged-renderer observation.

The allowed narrow vendor patch replaces only the response body resource/read
path with a mutex/atomic/Notify, avoiding the unsafe mutable alias and selecting
the same reqwest chunk future against close. It preserves public API/protocols,
request handling, redirects and scopes. The patched native test proves pending
read returns RequestCanceled and the server observes disconnect. Original
licenses, crate checksum, VCS/source-file hashes and exact patch are retained in
`http-upstream-provenance.json`, `http-cancellation.patch` and the vendor patch
note. The standalone test first failed because api-iife.js was omitted while
copying the crate; the required upstream generated script was restored exactly
and that original failure remains in `http-stalled-upstream-first-build.log`.

The shared wrapper separately aborts tracked header/body controllers on
pagehide/beforeunload: Tauri resource-table clear does not invoke Resource.close.
Actual packaged Stop/stalled-body/server-disconnect and reload cleanup remain
mandatory main-session acceptance.

## Independent native Save and external opening

Closed native commands: product_save_begin/chunk/finish/cancel. Begin validates
version/UUID/safe-integer length/suggested filename/MIME/optional SHA-256, reserves
at most two transfers and opens a genuine OS Save dialog. Renderer cannot supply
an absolute target. Export stages exclusively in the selected canonical parent,
does not overwrite existing files (including empty files/symlinks), accepts zero
bytes and adds no whole-ZIP/32 MiB cap. Ordered chunks are at most 262144 bytes;
native bytes and SHA-256 are checked incrementally. Idle staged transfers expire
after two minutes, checked every two seconds; waiting native dialogs do not idle
expire. Cancellation, main-window destruction and page-load start release stages.

Finish verifies declared/observed/final hash and length, fsyncs the file, uses
atomic hard-link publication with no overwrite, and syncs/cleans the parent.
After publication, failures return `publishedWithError` with digest/length and
directorySync/stageCleanup classification. A late abort cannot turn a published
file into a canceled result. This service never opens a StorageWorker or invents
a project for an IndexedDB-owned export.

Renderer `saveNativeBlob(blob,filename,signal?)` reads Blob slices, computes the
existing incremental SHA-256, sends ordered chunks and awaits the truthful
native finish outcome. It returns saved/canceled; published finalization errors
state “文件已保存” with `published:true`. Aborted prepublication pending writes
normalize to canceled; an unknown finalization IPC error is preserved. Cleanup
errors do not replace the original operation result. Root owns the shared UI
callers and success/cancel feedback.

`product_open_external` validates HTTP(S), URL length, no embedded credentials or
control characters and delegates to pinned official tauri-plugin-opener 2.5.4.
Raw opener permissions/automatic JS-click interception are not exposed. The
renderer exports nativeOpenExternalUrl; root owns centralized external-link
click handling. Product microphone usage text now describes user-triggered
project recording into application-local data, retaining capture constraints.

## Verification performed

- `native-services-first-tests.log`: before vendoring, desktop+test-hooks,
  17 unit + 22 native + 2 portable + 10 shared-video + 8 storage = 59 passed.
- `http-stalled-upstream-reproduction.log`: unpatched native defect reproduced.
- `http-pattern-first-tests.log`: official tests plus exact-origin and original
  cancellation mechanism, 17 passed before the patch.
- `http-patched-native-tests.log`: official tests plus patched real-network
  cancellation/exact-origin tests, 17 passed.
- `native-services-final-tests.log`: patched acceptance+test-hooks aggregate,
  same 59 passed. This profile compiles desktop services and historical probe.
- `native-services-clippy.log`: application all-targets acceptance/test-hooks,
  `-D warnings`, exit zero. Two existing official cookie-disabled unused closure
  variables remain dependency warnings; no warning-free vendor claim is made.
- `native-services-fmt.log`: application rustfmt check passed.
- `native-save-renderer-final-tests.log`: 7 passed (chunk order/hash/zero/cancel/
  late abort/publication uncertainty/external URL policy). These mocks prove the
  renderer lifecycle only; Rust tests separately prove disk bytes/no-overwrite.
- `native-package-types.log`, `native-package-lint.log`,
  `native-package-quality.log`: package typecheck, zero-warning package ESLint,
  Knip passed. Root leaf lint has no errors and one visible complexity warning.
- `git diff --check` on tracked owned authored changes passed.

Focused Rust exports include 33 MiB+1 bytes and zero-byte checksum identity,
wrong offset/oversized chunk/hash rejection, cancellation/expiry cleanup,
dialog limits, existing and raced target preservation, and injected directory
sync failure truthfully retaining published bytes. No test requires SQLite.

The machine pnpm path required by AGENTS.md was invoked explicitly. Existing
packageManager delegation reports pnpm 10.15.0, not the Codex Runtime pnpm 11;
lockfileVersion 9 remains. No toolchain upgrade was performed. Cargo lock
comparison adds 95 package/version pairs for HTTP/opener/platform dependencies,
removes zero existing pairs, and retains a second reqwest 0.12 alongside the
existing 0.13. `native-dependency-lock-diff.json` lists the exact additions.

## Remaining evidence / limitations

Main must run actual isolated normal-product build/store/reopen, native transport
fixtures and live configured providers, genuine Save dialog cancel/success/
existing-target outcomes, recording/printing/external browser checks. No key was
extracted. Windows/Linux actual acceptance is deferred on this macOS host.
The official plugin still buffers uploads; the shared wrapper owns bounded upload
concurrency, deadlines, redirect handling and current-origin checks. Historical
SQLite functionality remains preserved but is not the normal product owner.

## Independent review follow-up: null response resources

Independent checker identified a second source-proven official 2.8.2 lifecycle
leak: its JS client uses a null body for 101/103/204/205/304, so no later read or
body cancel releases the resource allocated unconditionally in fetch_send.
After root approval, the private register_response helper immediately closes
exactly those status resources, retaining the numeric rid public reply field
and all other body/status behavior. No Cargo manifests/locks or renderer files
changed for this follow-up. The exact patch/provenance/current hashes were
updated; original evidence logs remain preserved.

`http-null-body-final-tests.log` records **18 passing vendor tests**, including
40 actual local HTTP responses in ten cycles of 200/204/205/304. Each null-body
resource is absent immediately after registration; an unrelated 200 resource
remains present and its bytes readable. Informational 101/103 membership is
checked only at the predicate level because reqwest handles interim responses
separately; no actual 101/103 network proof is claimed. The existing real stalled
read disconnect regression continues to pass. `native-null-body-fmt.log` and
`native-null-body-clippy.log` record the follow-up application format/clippy
checks. The final packaged application must be rebuilt to include this patch.
