# Frozen native media repair handoff

The known no-Range/HEAD response defects are repaired. The app process now serves managed media over an opaque localhost streaming capability, with complete GET 200, exact single-range 206 and HEAD 200/full representation length/zero body. Idle previews hold no descriptor; warm requests reuse a private once-verified identity proof and retain per-chunk containment/session/file validation. The code is frozen for root's whole-source gates. No commits, activation, provider calls or profile/secret reads were performed.

`worker-media-stream-checks.json` contains the new raw-log names, exit codes, metrics and SHA-256 manifest for 33 current source files. `native-media-http-review.md` records the pinned Tauri/Wry API limitation, approved interface/security boundary, primary sources and exact proof limits. Earlier `worker-engine-checks.json` / `worker-engine-followup-checks.json` remain historical checkpoints; their source identities and test totals were not overwritten.

## Files changed in this follow-up

- `desktop/tauri/src-tauri/src/product_media.rs` and new `product_media/server.rs`: metadata-only revocable leases and a bounded process-owned IPv4 localhost listener. Exact Host/optional exact trusted Origin, closed UUID target, GET/HEAD only, no body/credentials, bounded parsing/drain, eight active readers, RAII admission, blocking timed sockets and complete streamed responses.
- `desktop/tauri/src-tauri/src/product_media/tests.rs`: actual 90 MiB HTTP, cross-chunk seeks, HEAD, 67 idle capabilities with isolated actual descriptor counting, malformed/foreign requests, current-session invalidation, warm permanent retirement/containment, stream revoke/disconnect/admission and conditional ranges.
- `desktop/tauri/src-tauri/src/product_binary.rs` / `product_binary/tests.rs`, only the transferred playback authority seam: private no-FD verified identity proof, cheap checked lazy open, actual hash-scan instrumentation and real file replacement/root/parent checks. Existing staged binary/claim/read contracts remain intact.
- `desktop/tauri/src-tauri/src/desktop.rs`: lifecycle-owned media listener and current worker/session validation; removes the old custom media scheme handler. Existing best-effort postcommit event acknowledgement repair is retained.
- `src/lib/storage/nativeBinary.ts` / `tests/nativeBinaryAccess.test.ts`: narrow exact loopback URL and returned metadata checks with release/cancellation preservation.
- `desktop/tauri/src-tauri/tauri.conf.json` / `Info.plist`: loopback media CSP and single-IP ATS exception. Microphone text remains. No broad connection/plugin capabilities are added.
- `tests/e04LibraryQueries.test.ts`: real shared backend query/scope instrumentation for both owners, preserving exact scoped rows, reduced reads, actual three indexed queries/one transaction and observer precision.
- `tests/productStorageQueries.test.ts`: actual asynchronous mounted-hook completion plus verified byte assertions for SQLite managed binaries and browser Blobs, retaining excluded-media, exact query and cleanup assertions.

## Passed worker checks

| Check | Result | Raw log |
| --- | --- | --- |
| Pinned Rust, all targets, `desktop,product-sqlite,test-hooks` | 108/108 | `engine-media-stream-native-all-targets-frozen.log` |
| Same full-feature Clippy, `--all-targets -- -D warnings` | exit 0 | `engine-media-stream-native-clippy-frozen.log` |
| Native preview validator/cancellation tests | 18/18 | `engine-media-stream-preview-ts.log` |
| E04 indexed scope and observer fixture, IndexedDB | 8/8 | `engine-media-stream-e04-browser.log` |
| Same E04 fixture, actual Rust SQLite | 8/8 | `engine-media-stream-e04-sqlite.log` |
| Mounted media query fixture, IndexedDB | 4/4 | `engine-media-stream-query-browser.log` |
| Same fixture, actual Rust SQLite managed bytes | 4/4 | `engine-media-stream-query-sqlite.log` |
| Source plist syntax / owned whitespace check | exit 0 / exit 0 | `engine-media-stream-plist-lint.log` / `engine-media-stream-diffcheck.log` |

Actual media metrics: full response **94,371,857 bytes**, three seek responses, four HEAD variants, **283,115,571 initial SHA bytes and zero additional whole scans during HTTP requests**. Isolated actual child process minted **67** idle capabilities with **6 descriptors before and 6 after**, and all capabilities served actual requests without the previous 64-preview permanent failure. The nested child is one sub-proof of a Rust unit test and is not counted as an extra test beyond 108.

The failed development logs are retained. The initial nonblocking inherited-socket and unread-error-close failures led to actual transport corrections; the earlier scan counter using a noncanonical root had an invalid zero baseline and is explicitly not the final performance proof. The final counter uses canonical root identity and asserts initial scanned bytes are nonzero. Existing two vendored `tauri-plugin-http` callback-variable warnings are reviewed dependency warnings; project Clippy exits 0 without dependency edits.

## Remaining boundaries

The Mac remains locked, so **actual packaged WK decode/playback progress/seek and RSS are not passed**. The 90 MiB file is deterministic disk bytes with a media MIME, not a playable decoding fixture. Root owns the genuine packaged app test and the merged final `Contents/Info.plist` check. Windows/Linux actual-host media and policy checks are not passed.

No dedicated actual experiment switched session generation or replaced the workspace root midway through an already-started HTTP stream. Actual flow interruption covers revoke and disconnect; actual session failure is checked before a request; actual warm root/parent/file replacement and restoration permanently retire the capability; the implementation additionally validates every chunk before and after reading. These different proofs must remain distinct. Source freeze has been respected rather than adding a new test while root's final immutable lanes run.

The Rust source prevents a full response allocation and repeats no whole-file hash per seek; these facts do not establish total socket/WebView/app RSS. Root's final whole-source identity gates supplement the worker captured-after source manifest. Keep normal product owner activation gated until actual complete isolated acceptance passes.
