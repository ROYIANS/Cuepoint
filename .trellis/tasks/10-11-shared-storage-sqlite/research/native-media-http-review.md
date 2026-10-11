# Native media response and streaming repair

The frozen implementation serves managed audio/video through a read-only media byte service inside the Tauri process. It binds only `127.0.0.1` on a random port and accepts an opaque UUID minted from a current, fully verified managed file. It requires no separately installed service, account, sync server or renderer-provided file path. Normal product storage activation and actual packaged WK playback remain gated.

The previous custom-protocol response was incorrect for a large GET without Range: it described only the first 256 KiB as 206. It also applied Range to HEAD. Correct raw semantics now have actual disk/socket tests: no-Range GET returns 200 with the entire representation, a satisfiable single byte Range returns 206 with the entire selected range, and HEAD ignores Range, returns 200 with the full representation length and sends no body. RFC 9110 restricts Range processing to GET; 206 describes a range response. [Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2), [Partial Content](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7), [Content-Length](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6).

## Why the public custom-protocol API was not used for streaming

The workspace lock selects Tauri 2.12.2, tauri-runtime-wry 2.12.1 and Wry 0.57.0. These pinned sources were read locally; no dependencies or registry files were changed.

| Layer | Pinned implementation | Consequence |
| --- | --- | --- |
| Tauri | `UriSchemeResponder` consumes a `Response<Cow<'static, [u8]>>` through one `FnOnce`; `respond` cannot accept a reader or send successive chunks. | An asynchronous callback is not a streaming response body. [Pinned Tauri source](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/app.rs). |
| Wry public API | `RequestAsyncResponder::respond` accepts the same owned/borrowed byte body. | There is no public streaming handle to retain across chunks. [Wry 0.57.0 API](https://docs.rs/wry/0.57.0/wry/struct.RequestAsyncResponder.html). |
| macOS Wry | The URL-scheme callback creates one `NSData`, calls `didReceiveData`, then finishes the task. | Repeated response calls require changes beneath the public API, including existing task cancellation/identity checks. [Pinned WK handler](https://github.com/tauri-apps/wry/blob/wry-v0.57.0/src/wkwebview/class/url_scheme_handler.rs). |
| Windows Wry | The response path creates a memory-backed COM stream with `SHCreateMemStream(Some(content))`. | The current adapter still owns the complete response bytes. [Pinned WebView2 adapter](https://github.com/tauri-apps/wry/blob/wry-v0.57.0/src/webview2/mod.rs). |
| GTK Wry | The response body is backed by `MemoryInputStream::from_bytes`. | It does not expose a lazy file reader through the current public callback. [Pinned GTK context](https://github.com/tauri-apps/wry/blob/wry-v0.57.0/src/webkitgtk/web_context.rs). |
| Tauri asset protocol | No-Range handling reads to the end into a `Vec`; partial handling is a separate bounded response. | Reusing the asset scheme would not establish bounded complete streaming. [Pinned asset protocol](https://github.com/tauri-apps/tauri/blob/tauri-v2.12.2/crates/tauri/src/protocol/asset.rs). |

Native SDKs have possible lower-level implementations: WK URL scheme tasks accept incremental data, WebView2 can receive an `IStream`, and GTK's URI response accepts a `GInputStream`. Exposing those safely would require an upstream/forked Wry response-body abstraction, platform-specific lifetime/cancellation integration and separate memory measurements. They do not make the pinned public API stream automatically. [Apple WKURLSchemeTask](https://developer.apple.com/documentation/webkit/wkurlschemetask), [Microsoft CreateWebResourceResponse](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment?view=webview2-1.0.3856.49#CreateWebResourceResponse), [GTK URI response](https://webkitgtk.org/reference/webkit2gtk/2.40.1/ctor.URISchemeResponse.new.html).

The root approved the smaller app-owned loopback repair within the managed-media preview scope. This decision changes neither the product storage model nor synchronization architecture.

## Closed interfaces and lifecycle

`product_media_preview` retains the existing closed current-session envelope and `ManagedBinaryRef`. The worker validates the reference and performs the actual initial whole-file SHA verification. It returns `{previewId, url, byteLength, mimeType}`. The URL is `http://127.0.0.1:<actual-port>/<matching-canonical-UUID>`; neither the IPC reply nor HTTP request contains a path. `product_media_release` requires the original session and capability. Navigation, store open and product shutdown revoke current capabilities; shutdown also stops the listener.

The TypeScript validator accepts only the exact canonical URL serialization, IPv4 `127.0.0.1`, an explicit port 1024–65535 and the issued UUID as the complete path. Credentials, query, fragment, host aliases, another UUID or mismatched MIME/length reject the reply and release its capability. Cancellation retains release-once semantics.

An idle preview keeps private metadata rather than an open file. `PlaybackAuthority` can be created only from the initial verified descriptor, which is then dropped. Its private proof retains the original root identity, managed relative location and file identity: device/inode, length and modification time. Each active request opens a file lazily, verifies both the named file and the opened descriptor against that proof and re-resolves containment. Each chunk preserves before/after root, file and session checks. A physical validation error permanently retires that capability; restoring the old directory or inode does not authorize the same URL again. A request does not repeat a full SHA scan.

## HTTP admission and bytes

- Bind is localhost IPv4 only. The actual listener port supplies both URL and exact required Host. A supplied Origin must equal the trusted packaged app origin; `null`, foreign origins and wildcard policies are rejected. Missing Origin is allowed for ordinary media GET/HEAD, with the unguessable capability and exact Host still required. CORS is emitted only for the exact accepted Origin.
- Only GET and HEAD are accepted. Targets must be exactly one canonical UUID; bodies, transfer encoding, credentials/cookies, duplicate headers, path/query tricks and foreign Host/Origin reject. Headers have an 8 KiB bound and an overall parse deadline. Error handling drains only a bounded amount before closing.
- There are at most eight active connections/readers. RAII releases admission on success, invalid input, timeout, client disconnect or changed file/session. Extra active connections receive 503; idle preview cards consume no reader slot or file descriptor.
- A GET writes at most one 256 KiB disk chunk at a time with blocking socket backpressure. Content-Length describes the complete selected response. No full-file response buffer or unbounded chunk queue is created. Temporary Rust chunk vectors can overlap during assignment, so the conservative source allocation bound is two chunks per active writer; kernel and WebView buffering are separate.
- Satisfiable single ranges return exact 206/Content-Range. Unknown range units are ignored and return complete 200. Unsatisfiable or unsupported byte-range forms return 416. If-Range matches only the generated strong content-hash ETag; mismatch returns a complete 200. HEAD ignores every Range value and sends zero body bytes.
- Accepted sockets are explicitly switched to blocking mode before applying read/write timeouts. An initial actual macOS test exposed inherited nonblocking sockets causing EAGAIN/truncated responses; the failed logs are retained rather than treated as acceptance.

The process owns this listener; it is not a provider proxy, user-configurable server or synchronization endpoint. An opaque URL is a local bearer capability, so another local process that learns it can request its bytes while it remains valid. It exposes only the already authorized fixed managed file, and revocation/session/file checks still apply.

## Actual evidence

The final logs, exact exits and captured-after source hashes are in `worker-media-stream-checks.json`. Root's final immutable whole-source gates remain the authority for build input equality across the complete product.

| Evidence | Actual result | Boundary |
| --- | --- | --- |
| Complete raw GET | 94,371,857 bytes, 200, every byte and final hash exact. | Deterministic bytes labelled video/mp4; not a playable media decode test. |
| Raw seeks | Three exact cross-chunk 206 responses, including a 64 MiB offset and the tail. | Does not establish WK seek requests/decoding. |
| HEAD | Four variants, including absent, valid, invalid and unsatisfiable Range; 200/full length/zero body. Missing or revoked files return 410. | Genuine sockets and disk, not mocked HTTP replies. |
| Full scans | Initial real verification recorded 283,115,571 bytes; all subsequent HTTP full/range/HEAD requests added zero whole-hash bytes. | Initial count includes sealing, claim verification and capability creation. The test asserts an initial nonzero baseline. |
| Idle capabilities | 67 capabilities; isolated child process `/dev/fd` count before 6, after 6; active readers zero; all capabilities serve real requests. | Does not claim no metadata memory per capability. |
| Stream interruption | Revoke during a 90 MiB response prevents completion; disconnect releases admission; eight held connections bound admission and closing them releases it. | No dedicated midstream session-generation/root-replacement test was added during the final freeze. |
| Warm identity checks | Same-inode content rewrite, different-inode replacement, moved parent/symlink and root replacement reject without rehash. Restoring original files/directories leaves the capability retired, and outside bytes remain unchanged. | Warm failure is tested before opening the next request; per-chunk validation is additionally source-reviewed. |
| Full Rust gates | All-feature/all-targets 108/108; full-feature Clippy `-D warnings` exit 0. | Two pre-existing vendored HTTP plugin unused-variable warnings remain. |
| Shared fixtures | Native preview unit tests 18/18; E04 8/8 on both owners; mounted media query tests 4/4 on both owners. | Actual SQLite lanes use the Rust probe; final full-source probe rebuild belongs to the root/shared lane. |

## Platform policy and remaining acceptance

The CSP adds only the loopback media source. It does not broaden renderer connect permissions or HTTP plugin authority. Source `Info.plist` preserves the microphone explanation and grants an insecure-HTTP exception solely to `127.0.0.1`, without a port, subdomain or arbitrary-load exception. Apple's current documentation identifies IP loading changes on macOS 14 and permits individual IP entries in exception domains. [Local networking policy](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking), [Exception domains](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsexceptiondomains).

The source plist passes `plutil -lint`; the final rebuilt app must still confirm the merged bundle plist. Actual packaged WK loading, long playback progress, seeking, decoder behavior and memory measurement remain pending while the Mac is locked. Windows/Linux host media and network-policy acceptance remain unverified. No test in this repair independently switches the current session generation or replaces the root during an already-started HTTP response; the existing tests and per-chunk source checks must not be described as that additional experiment. Normal storage owner activation remains gated until isolated product acceptance succeeds.
