# Research: E10 SDK and OAuth design

- Query: Choose maintained MCP/OAuth SDKs and credential/process ownership for desktop macOS/Windows stdio and Streamable HTTP; opportunistic Web remote support without a proxy.
- Scope: mixed; existing source seams and primary upstream documentation/published source.
- Date: 2026-10-16

## Findings

### Recommendation and evidence status

Use the existing Rust/Tauri host with the official **`rmcp = "=3.5.1"`** client. Keep protocol, OAuth, native credentials and owned stdio processes behind a narrow native MCP service. Reuse the shared Studio Agent loop and product policy/result owners. A Node sidecar is unnecessary for these transports and would add a shipped Node runtime, IPC and another process/lifecycle/credential owner. An external stdio server may itself require user-installed Node/Python; that does not require Cuepoint to ship a Node host.

For opportunistic Web remote access use the official **`@modelcontextprotocol/client` `2.3.1`** behind the same product port. Keep browser tokens in session memory, require endpoint/discovery/token CORS and an allowed browser redirect, and expose unsupported states without holding up desktop. Do not import its Node-only `./stdio` entry in Studio's browser graph. Do not adopt Cordis or another Agent loop.

These are source-backed design recommendations, **not executed integration, compilation or installed-platform proof**. No dependency installation, build, actual server, login or credential-store operation was performed during this research.

### Inspected product files and patterns

| File | Relevant observation |
| --- | --- |
| `apps/desktop/src-tauri/Cargo.toml:1` | Edition 2024/MSRV 1.99; exact dependency pins; no current rmcp, direct OAuth or credential-vault dependency. Existing reqwest 0.13.5 is present transitively in Cargo.lock. |
| `apps/desktop/src-tauri/src/desktop.rs:1830` | Closed normal/acceptance command registration; add bounded MCP commands under the real trusted main-window owner, not arbitrary renderer command execution. |
| `apps/desktop/src-tauri/src/runtime_services.rs:275` | Trusted external-system-browser opener; useful for authorization URL opening, not callback receiving or secret storage. |
| `apps/desktop/src-tauri/src/desktop_media_process.rs:1` | Existing fixed decoder promises direct-child cleanup on Windows and owned process groups on Unix; it is not a generic process-tree supervisor for arbitrary MCP servers. |
| `apps/desktop/src-tauri/src/desktop_media_process.rs:90` | Explicit Unix private process group; model for ownership, not permission to reuse media-specific executable/argv authority. |
| `packages/studio/src/platform/runtime/runtimeFetch.ts:33` | Current native fetch lifecycle/policy is purpose-bound. SDK network calls require a reviewed MCP-specific owner, bounds and revocation, rather than an unscoped bypass. |
| `packages/agent-core/src/tools.ts:3` | Existing immutable binding/registration identities remain the public tool-policy boundary. SDK handles cannot replace frozen approval identity. |

Related specs: `.trellis/spec/desktop/runtime/index.md`, `.trellis/spec/frontend/native-product-runtime.md`, `.trellis/spec/frontend/desktop-media-import.md`, `.trellis/spec/frontend/monorepo-boundaries.md`, `.trellis/spec/agent-core/library/capabilities.md`, `.trellis/spec/frontend/agent-tools.md`. Read the task PRD and existing scope/OAuth investigations; research-role isolation intentionally excludes implement/check manifests.

### Published SDK selection and protocol compatibility

- [Published rmcp 3.5.1](https://docs.rs/crate/rmcp/3.5.1) was released 2026-10-05; MSRV 1.88 is below this project's declared 1.99. Official [release-tag Cargo](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/crates/rmcp/Cargo.toml) supports `client`, `transport-child-process`, `transport-streamable-http-client-reqwest`, `auth` and `reqwest` (rustls). Start `default-features = false`: the default includes server/macros, which are unnecessary for the production client. Add only a separately scoped test-server feature/dependency for deterministic fixtures. Pin the resulting lockfile; this is not a lockfile already changed or compiled.
- The published `.crate` was downloaded **into memory only** and its `Cargo.toml.orig`, `auth.rs`, `child_process.rs` and `streamable_http_client.rs` compared byte-for-byte with tag `rmcp-v3.5.1`: all matched. API claims below use that release, not unverified main. Its OAuth guide still contains an obsolete `version = "0.1"` snippet; do not copy that version.
- [Release README lifecycle modes](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/README.md#client-lifecycle-modes) distinguishes current `server/discover` from legacy `initialize`. `serve()` alone still uses legacy startup. Explicit `serve_with_lifecycle(ClientLifecycleMode::Auto { preferred_versions: [2026-07-28], legacy_version: Some(2025-11-25) })` is the candidate, to be fixture-tested. The SDK also knows older revisions; do not claim all revisions tested. Cover 2026-07-28 and 2025-11-25 initially, with a 2025-06-18 fixture if needed for actual targets. Legacy standalone HTTP+SSE transport is not the requested Streamable HTTP surface and is not automatically added.
- [Current transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) moves version/client capabilities into per-request metadata; HTTP cancellation closes the request stream while stdio uses cancellation notification. Earlier sessions differ. Keep SDK version negotiation intact instead of hardcoding old initialize/notification semantics. Advertising sampling, elicitation, roots, prompts or long-running tasks is not required merely because the SDK implements them; only advertise supported product capabilities.
- [Published TypeScript package](https://registry.npmjs.org/@modelcontextprotocol/client/2.3.1) confirms version 2.3.1, Node engine >=20 and browser-specific shims. It is the current split package, unlike old v1 `@modelcontextprotocol/sdk/client/...` examples. Browser bundler export closure and current-protocol behavior still need a small source/bundle fixture; no browser parity is inferred from package metadata.

### Critical defaults to override or prove

[rmcp release Streamable HTTP config](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/crates/rmcp/src/transport/streamable_http_client.rs#L2035) defaults `reinit_on_expired_session` to true: an HTTP 404/SessionExpired can trigger a new handshake and one retry of each affected ordinary POST. **Set `.reinit_on_expired_session(false)`** so a replaced session never silently repeats a business effect. GET event-resume is separate from reissuing a tool call; bound its policy and lifetime. Retire product generation on a lost session, retain unknown outcomes, and require a fresh admission for future calls. OAuth refresh must happen before a fresh dispatch; refresh or login cannot authorize replay of an outstanding effect.

[Release async I/O transport](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/crates/rmcp/src/transport/async_rw.rs#L63) creates an unbounded growing line buffer by default; its codec's default max length is also unlimited. A final UI projection cap is insufficient. First-stage spike must prove a bounded pre-parse stdio reader/SDK adapter, plus bounded HTTP JSON responses, SSE events, OAuth metadata and diagnostics. Use the SDK's message model/framing rather than writing another protocol engine. `max_sse_event_size` exists but does not establish every response-body limit. Do not log raw SDK error bodies, URLs with secrets or inherited stderr.

### Native OAuth flow and registration

The release [OAuth guide](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/docs/OAUTH_SUPPORT.md) supports S256 PKCE, resource indicators, protected-resource/AS metadata, pre-registered client IDs, Client ID Metadata Documents (CIMD), legacy dynamic registration and refresh. Inject the approved HTTP client for **both** discovery/token requests and authorized MCP traffic; a configured transport client alone does not configure OAuth discovery. Enforce finite deadlines, body/redirect limits and approved metadata/issuer/resource identity throughout.

[Current MCP registration/security rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) require a suitable registration mechanism; universal OAuth login is not guaranteed. Prefer pre-registered public client metadata where provided; support CIMD when an approved HTTPS client metadata document is actually hosted; fall back to DCR only when advertised. Do not invent a public CIMD URL or add a backend deployment. A server offering neither compatible pre-registration, usable CIMD nor DCR returns actionable unsupported registration. Never distribute a supposedly confidential static desktop client secret as proof of client identity.

[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html#section-7.3) supports opening the system browser and a short-lived loopback receiver. Candidate: bind an available numeric loopback address/port before authorization, use a fixed callback path, retain the exact redirect URI in the attempt, and close on success/cancel/timeout. No media-service token/listener reuse. Registration must permit the selected loopback redirect; test both OS firewall/browser behavior later.

[Release auth API](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/crates/rmcp/src/transport/auth.rs#L292) offers `AuthorizationManager::set_credential_store`, `set_state_store`, `initialize_from_store`, `CredentialStore::acquire_refresh_guard` and issuer-aware callback handling. Capture native session/profile, server/configuration revision, connection generation and attempt ID. Validate state, PKCE, callback host/path/port and exact recorded issuer, including error callbacks, **before** token exchange; use `handle_callback_with_issuer`/`handle_callback_url`, not the older code/state-only helper. Retired attempts and refresh callbacks cannot write credentials for replacement configurations. Serialize credential operations and token rotation. A rejected refresh differs from transient network failure; neither implies the remote effect rolled back. The SDK default store is memory-only and does not provide OS persistence.

### Native credential owner

Use a native vault adapter behind the SDK `CredentialStore`, shared with manual Token/header/env-secret references. Product configuration retains opaque references and public client metadata; secrets stay outside project data/exports, Agent context and routine diagnostics. Windows/macOS native records must include profile/server/configuration identity so isolated review apps cannot reuse normal credentials.

Current [keyring 4.2.0 documentation](https://docs.rs/keyring/4.2.0/keyring/) recommends explicit `keyring-core` and target stores when an application needs control over its vault. Old `keyring 3.x` `apple-native`/`windows-native` feature recipes do not describe this API. Candidate exact published dependencies verified through crates.io: **keyring-core 1.0.1**, **apple-native-keyring-store 1.0.2** (`keychain`, target macOS), **windows-native-keyring-store 1.1.0** (target Windows, unnecessary search disabled). Core main already says 1.1.0 but registry stable is 1.0.1: do not pin unpublished main. These candidates have not been compiled here.

- [Apple provider](https://docs.rs/apple-native-keyring-store/1.0.2/apple_native_keyring_store/) distinguishes classic Keychain (`keychain`) from protected data storage (`protected`, sandbox/provisioning constraints). Existing unsandboxed desktop should start with the explicit classic Keychain store; actual signing/access prompts remain installed acceptance.
- [Windows provider](https://docs.rs/windows-native-keyring-store/1.1.0/windows_native_keyring_store/) defaults to Enterprise persistence; select **Local**, use collision-resistant fixed target naming and serialize access to the same credential. Provider docs explicitly warn that concurrent thread access does not reliably preserve call order.
- [Microsoft CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw) documents a **2,560-byte** credential blob cap. Do not serialize the complete OAuth response or arbitrary header bundle into one vault entry. First-stage design must choose and test a bounded large-secret envelope: OS-vault root key + authenticated encrypted app-private blob, or immutable native vault chunks + bounded manifest committed last. Prefer one reviewed adapter and fail closed if the vault is locked/unavailable; no plaintext DB/file fallback. Include crash/rotation/delete recovery. This choice is a technical spike item, not a reason to ask the owner to select an encryption implementation.

### Stdio process lifetime

[Released TokioChildProcess](https://github.com/modelcontextprotocol/rust-sdk/blob/rmcp-v3.5.1/crates/rmcp/src/transport/child_process.rs#L33) accepts `process_wrap::tokio::CommandWrap`; default graceful shutdown closes streams, waits up to three seconds and kills/waits. Drop starts asynchronous cleanup. It does **not** automatically create a process group or Windows Job Object, and dropping while the runtime exits is not a completed cleanup receipt. stderr inherits by default; capture, drain and redact it with a hard bound.

[process-wrap 10.0.1](https://docs.rs/crate/process-wrap/10.0.1) (the published 10.x compatible dependency) provides explicit Tokio ProcessGroup on Unix and JobObject on Windows. Use owned wrapping before spawn and reject partial failure; prove root + ordinary spawned descendants terminate/reap. SDK wrapper availability is not installed cross-platform proof or a malicious-process sandbox. Detached processes can escape ordinary groups; keep environment filtering, process-tree ownership and actual filesystem/network confinement separate. Windows `.cmd` wrappers require deliberate argv/executable handling; do not silently invoke a shell or execute model-supplied commands. Native launch configuration comes from explicit user configuration and exact approved revision.

### Bounded first-stage spike / remaining risks

1. Resolve exact client-only dependencies against the existing MSRV/lock/Tauri Tokio runtime; compile only the affected native library/test slice. Prove both SDK lifecycle modes against deterministic local fixtures and browser bundler closure, without a full installer build.
2. Force SessionExpired, missing replies, SSE disconnect and token expiry; assert one remote effect dispatch, no automatic replay and truthful unknown outcome. Verify `.reinit_on_expired_session(false)` on the actual dependency.
3. Demonstrate pre-parse stdio/JSON/SSE/OAuth limits and deadline cancellation without unbounded allocation; stop a real owned test child plus ordinary descendant. Actual Windows Job Object installed behavior remains deferred evidence.
4. Select/test the native large-secret adapter, refresh serialization, revocation and stale-write fencing. Keychain/Windows permissions and real signed identity remain explicit installed acceptance, not mock proof.
5. Deterministic OAuth service: pre-registration + DCR, CIMD only with an actual approved metadata fixture; issuer mismatch/error, wrong/stale callback, cancel, refresh rotation, absent registration and locked vault. Web adds a same-origin callback/session-memory fixture and one explicit CORS failure. No third-party account or paid server is required.

## Caveats / Not Found

- Existing code supplies neither a general MCP transport nor OAuth callback/vault. No second daemon or E11 background lifetime is selected.
- Published source/API inspection establishes candidate seams only. Nothing here claims compiler success, a real server login, arbitrary-server compatibility, packaged OS credential prompts or process-tree security.
- Web service compatibility depends independently on MCP endpoint, metadata/token endpoints and redirect/CORS behavior. Session-memory credentials are an intentional opportunistic limitation; desktop completion does not wait for unsupported browser endpoints.
- No product code, manifests, lockfiles, tasks/spec metadata or Git state was modified by this research. Only this authored research file is written.
