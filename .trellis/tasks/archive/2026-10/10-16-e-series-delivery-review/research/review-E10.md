# Review E10 — agent-mcp-integration (45bffe3c, 9d2d2de6, 80513428, bc492b38 = stage 4)

Read-only review on `codex/agent-background-host`. Labels: [code] [test] [claim-only]. I ran no builds or Rust/TS tests. Findings tagged "static" come from reading the code and were not reproduced by execution.

## Verdict

This is the most security-careful delivery of the three, and clearly stronger than the dsh reference on credentials, OAuth and process-tree teardown. The native design is good: exact binding and single-use authority, a "dispatched" flag that turns any later error into `reply_lost` (never `notStarted`), no reactive POST replay, a bounded SDK transport port, a credential vault with no plaintext fallback, and Job Object / process-group teardown that is tested for descendants. The weaknesses are narrower:

1. An OAuth login can be aborted by any stray connection to the loopback listener.
2. A 30 s whole-request reqwest timeout and a 65 s call deadline make long tool calls end as "unknown".
3. There is no native-side consent for starting a user-configured local executable.
4. OAuth-discovered https endpoints are not blocked from private address ranges.

All installed-host, Keychain, Windows vault and Job Object runs are unexecuted (see `task.json` stage 1/2 `deferred`), so AC4, AC5 and AC7 are not fully evidenced on real hosts.

## Acceptance mapping

| AC | Status | Evidence |
| --- | --- | --- |
| AC1 deterministic server; model gets exactly advertised defs; selected call reaches unified approval/result; attributed retained content readable beside chat | **Met** (source, fixtures) | [code] `createMcpTools` builds definitions from the frozen generation only (`mcp/runtime/tools.ts:112-157`); calls go through `admitAgentJob` / `publishAgentJob` (E07 owner) (`:63-78`); results via `bounded_reply` (`service.rs:1508-1516`) and `read_job_result`. [test] `mcpAgentSurface.test.ts`, `mcpAgentExecution.test.ts`, `service_tests.rs::mcp_service_real_http_lifecycles_original_receipts_and_resources`. |
| AC2 held approval/reply cannot retarget to a new generation; old callbacks cannot publish; local teardown records real drainage | **Met** | [code] approval facts carry binding + manifest digest, rechecked at `execute` (`tools.ts:37-47, 58-60`); native authority is single-use and removed on dispatch (`service.rs:1199-1200`), binding re-compared (`:1244-1252`); drain model (`process.rs:106-143`). [test] `service_tests.rs::mcp_service_retirement_cannot_start_old_authority_and_duplicate_op_is_atomic`, `..._pending_connect_retirement_drains_unpublished_process_tree`, `process.rs::mcp_stop_timeout_and_cancellation_keep_the_original_group_drain`, `tests.rs::mcp_real_owned_process_group_drains_child_and_descendant`. |
| AC3 lost reply / session expiry / Stop give truthful unknown, no automatic replay; duplicate Stop/Disconnect does not duplicate | **Met** | [code] `dispatched` flag then any error -> `reply_lost` (`service.rs:1322-1342`); `reinit_on_expired_session(false)`, `NeverRetry` (`transport.rs:~118-123`); 404 + session -> `SessionExpired` with no re-POST (`:~199-201`); `send_cancellable_request` with `notify_cancelled` (`:1290`). [test] `service_tests.rs::mcp_service_effect_lost_expired_401_never_replays`, `..._http_stop_keeps_unknown_and_never_replays`, `tests.rs::mcp_real_http_session_expiration_lost_reply_and_401_never_repost_effect`. |
| AC4 stdio and Streamable HTTP through the same policy; macOS/Windows source vs installed evidence separate | **Partly met** | [test] real stdio (`mcp_service_real_stdio_discovery_invoke_and_drain`) and real HTTP fixtures on the dev host (macOS, [claim-only] for run results). Windows: source compiles under `cfg(windows)` (`process.rs:70-71`, vault `:36-38`) but no execution evidence; `task.json` states this. |
| AC5 OAuth system browser + PKCE, authenticated discovery/calls; wrong/duplicate/cancelled/expired/stale callbacks cannot authenticate a replacement; guarded refresh; native secret failure without leakage | **Met (fixtures) with caveats** | [code] loopback listener, exact path/host/state/count checks, issuer check (`oauth.rs:~456-500`); callback is re-checked against `current()`; refresh serialised by `refresh_guard` (`vault.rs`, `oauth.rs:66-72`). [test] 13 OAuth tests incl. `mcp_oauth_rejected_callback_does_not_consume_legitimate_attempt`, `..._error_callback_cancellation_timeout_and_retirement_never_exchange`, `..._refreshes_are_serialized...`, `..._retired_refresh_cannot_publish_into_a_replacement_owner`. Caveat F1 (listener abort) is untested. PKCE/state generation is in the rmcp SDK and was not inspected here. |
| AC6 Web remote fixtures via shared flow; unsupported combos give actionable feedback; no proxy; no stdio on Web | **Met (fixtures)** | [code] `browserMcpOAuth.ts` (popup, public-client only, state via `crypto.randomUUID`, origin + `event.source` check `:73-77`, single-use verifier `:84`), `browserMcpFetch.ts` (no redirects/cookies, byte-bounded). [test] `mcpBrowserHost.test.ts`, `mcpBrowserLifecycle.test.ts`; [claim-only] "real SDK Chromium 24 cases" in `tooling/mcp-browser-regression.mjs`. |
| AC7 connection UI keeps chat running; guarded edits; no duplicate writes; no extra send-time text | **Partly met** | [test] `mcpManagement.test.tsx`, `tooling/mcp-management-browser.mjs` ("UI12", [claim-only]). Wide/narrow installed layouts unverifiable here. |
| AC8 duplicate names, malformed schemas, excessive pages/tools, oversized output, forged resource links cannot bypass bounds; failed discovery keeps prior generation; credentials/launch details absent from context, exports, diagnostics | **Met** | [code] `discover` (`service.rs:1609-1700`): 16 pages x 128 tools, per-tool 32 KiB, 512 KiB total, duplicate-name and handle-collision rejects; resource targets only by captured `handleId` (`tools.ts:140-148`); `McpError` is a closed code set with no payload (`mod.rs:1-31`); stderr is counted, never retained (`process.rs:85-101`). [test] `mcpManifest.test.ts`, `mcpPrivacy.test.ts`, `mcpCatalogue.test.ts`. |

## task.json claims verified

- "no proxy/backend; browser stdio unavailable": [code] true (`browserMcp.ts` has only the streamable path; no server component added).
- "no plaintext fallback on vault failure": [code] true. `NativeSecretStore::open` returns `VaultUnavailable` on unsupported OS (`vault.rs:39-42`), and no file store exists in the diff.
- "no automatic replay": [code] true as described above; [test] covered.
- "final integrated 19-suite/232-test check": [claim-only].
- `status: completed` while `deliveryState: source-complete-batch-acceptance-deferred`: consistent with the other deliveries, but the real-host gaps (Keychain authorisation, Windows vault, installed system browser/loopback) are unclosed.

## Findings

### P1

None that bypass the approval/identity/credential model.

### P2

**F1 — Any stray connection can abort an in-flight OAuth login** [code, static]
- The loopback accept loop reads the first request inline. A client that connects and sends nothing hits the 3 s read timeout and returns `Err(Deadline)` (`oauth.rs:~440-445`). A client that connects and closes returns `Err(Protocol)` on `n == 0` (`oauth.rs:448-450`). Oversized headers return `Err(Limit)` (`:451-453`). Any `Err` leaves the `work` future, which sets the attempt to `failed` (`oauth.rs:519`) and drops the listener.
- Consequences: (a) browser speculative preconnects or local port scans can kill a legitimate login; (b) any local process that can reach 127.0.0.1 can deny a login with one empty connection, no state knowledge needed. Wrongly formed but complete requests are handled correctly (400 and `continue`), so the test `mcp_oauth_rejected_callback_does_not_consume_legitimate_attempt` does not cover this path.
- Fix: treat per-connection read errors and EOF as `continue`; keep the overall 300 s timeout as the only terminal; serve each socket in a short-lived task so a slow client cannot block `accept`.

**F2 — A 30 s total reqwest timeout and a 65 s call deadline turn long tool calls into "unknown"** [code]
- `BoundedHttpClient` builds one client with `.timeout(REQUEST_TIMEOUT)` = 30 s (`transport.rs:59`, `mod.rs:~41`). reqwest's total timeout covers body streaming, so an SSE response to a `tools/call` that runs longer than 30 s is cut. The standalone GET stream is also cut at 30 s, and `NeverRetry` means it is not re-established. The invoke task adds a further 65 s ceiling (`service.rs:1322`). On expiry the reply becomes `reply_lost` with `dispatched == true`, so the user sees "unknown" for slow but successful operations.
- This is truthful (no false success, no replay), but long-running MCP tools (builds, video/AI jobs, searches) are unusable. The PRD does not set a call duration, so this is a design gap rather than a miss. Fix: per-request connect/headers timeout, plus an idle timeout for SSE, with a separate larger per-call deadline (and a user-visible "still running" state).

**F3 — Starting a local stdio server has no native-side consent** [code]
- `mcp_service_request` only checks `trusted(&window)` and the lifecycle gate (`desktop.rs:188-205`). The `PrivatePrepare` and `Connect` actions carry the executable path, args, cwd and environment from the renderer (`protocol.rs:~70-95`), and `OwnedProcess::spawn` only checks that the path is absolute and sizes are bounded (`process.rs:30-52`, `service.rs:1518-1540`). Windows `.cmd` and `.bat` are rejected (`process.rs:~54-59`).
- PRD E10-R4 says the user "explicitly enables starting a configured local server", and that is enforced in the Studio UI and catalogue state. The native side cannot tell a user action from renderer code, so a renderer compromise (XSS in a rendered model/tool output, a malicious dependency) can launch any executable as the user. E08 and E09 at least anchor their effect on a native picker. Mitigation options: a native confirmation dialog on first connect of a changed command/args/env digest; bind `Connect` to a catalogue revision whose "enabled" bit was set through a native-confirmed path.
- Mitigating facts: `env_clear()` plus an explicit env (`process.rs:58`), sizes capped, one connection per server and 8 total (`service.rs:~990`), and the honest "no OS sandbox" statement in the PRD.

**F4 — OAuth-discovered https endpoints are not restricted to public addresses** [code]
- `MetadataHttp::learn` adds `token_endpoint`, `registration_endpoint`, `authorization_endpoint` and issuer well-known URLs from server-supplied JSON to the allow-list (`oauth.rs:184-225`), checked only by `endpoint()` (https, or http loopback when the base resource itself is loopback `:91-108`). The authorization URL is then opened in the system browser (`oauth.rs:~403-412`, `product_open_external` allows any http(s) host `runtime_services.rs:286-309`).
- A malicious or compromised MCP server can therefore point DCR/token POSTs at any https host, including private-range, link-local or internal hostnames, and the browser at any https URL. Request bodies are fixed-shape OAuth messages, responses are bounded (64 KiB) and redirects are disabled (`transport.rs:~56`), so the damage is limited to blind POSTs and phishing-style redirects. Consider requiring that discovered endpoints share the resource's registrable domain or, at least, rejecting private/link-local/loopback IP literals and resolved addresses for non-loopback bases.

**F5 — Windows/macOS real-host paths are unexecuted for the highest-risk native pieces** [claim-only]
- Keychain access control, Windows Credential Manager (`persistence=Local`, `vault.rs:~46-48`), Job Object teardown of descendants, system-browser launch and loopback redirect are explicitly "deferred" in `task.json`. Those are exactly where the cross-platform risk lies. Treat AC4/AC5 as "Met on fixtures, Unverifiable on hosts".

### P3

- F6: Unix teardown is `SIGKILL` of the group only (`process_wrap` `start_kill`), with no polite shutdown (close stdin, SIGTERM, then kill after a grace period). Servers that persist state on shutdown lose it, and `process.rs:106` does not attempt it. Descendants that call `setsid` leave the group (the known limitation of process groups; the Windows Job Object does not have it).
- F7: `env_clear()` removes `PATH`, `HOME`, `SystemRoot` (`process.rs:58`). Typical `npx`/`uvx`/Node servers need these, and I found no default in the UI/editor (`grep PATH` in `mcp/` and `ui/` found nothing). Users must type them; on Windows missing `SystemRoot` breaks many programs. Safe by default but a usability trap; an explicit "inherit these names" allow-list would be better than silence.
- F8: The vault manifest stores a plain SHA-256 of the payload (`vault.rs` `digest`, `RevisionReceipt.digest`). Inside the same OS vault this is not a weakness, but for low-entropy manual tokens it is a verifier that would be useful to an attacker who can read the manifest but not the chunks (both are in the same keychain with the same ACL, so the benefit is nil in practice).
- F9: Tools are always `effect: 'network', highRisk: true` (`tools.ts:~120`). Every external call needs approval, including read-only tools. Safe, but there is no "trust this tool for this thread" path and server `readOnlyHint` annotations are intentionally ignored. This is a usability cost that the PRD accepts (annotations "cannot grant authority"), not a defect.
- F10: Per-connection `dispatch` is a mutex held through the whole call (`service.rs:1211`), so one slow tool blocks later calls on the same server for up to 65 s. By design (exact original ownership), but it interacts with F2.
- F11: `bounded_reply` rejects results over 1 MiB with `Limit` after the server has already executed (`service.rs:1293-1301, 1508-1516`). The call is then reported as an error although the effect happened; the status mapping goes through `Ok(Err(e))` -> `reply_lost` only if `dispatched` (it is), so it does show as unknown. Confirm UI wording distinguishes "result too large" from "unknown"; I did not find a dedicated code for it.

## Security checklist

| Area | Result |
| --- | --- |
| OAuth PKCE / state | PKCE and state creation delegated to rmcp `AuthorizationSession` (desktop) and `@modelcontextprotocol/client` `startAuthorization` (Web); not independently inspected. State compared exactly, once, by the host listener (`oauth.rs:~496-499`) and again by the SDK. Browser: `crypto.randomUUID` state, verifier consumed before first await (`browserMcpOAuth.ts:84`). |
| Redirect handling | `http://127.0.0.1:<ephemeral>/cuepoint-mcp-oauth`, loopback-only peer, exact Host header check (DNS-rebinding defence), method GET, path/query shape and repeat counts, optional `iss` required when the AS advertises support (`oauth.rs:386-393, 481-491`). Browser: exact origin + `event.source === popup`. No open redirect (the listener never redirects). |
| Mix-up / resource binding | `resource` from PRM must match exactly one captured candidate (`resolved_resource`); principal identity digest over endpoint, resource, issuer, client_id, scopes (`oauth.rs:~290-304`) and re-compared before every call (`service.rs:1228-1231`). Strong. |
| Credential storage | Native keychain/credential manager only; immutable chunked revisions, manifest last, digest readback, exact-revision cleanup; one vault namespace per app/profile/store/server hash (`vault.rs:~108-131`). No plaintext fallback. Same-user processes can read Windows Credential Manager entries by design. |
| Credentials in diagnostics | Closed error enum, no SDK payloads; stderr count only; `Reply::error(...)` takes code strings; Studio privacy test `mcpPrivacy.test.ts`. |
| Process / descendant teardown | Unix `ProcessGroup::leader` and Windows `JobObject` with `KillOnDrop`; drain task is retained and re-awaited, with a test that reproduces process-wrap's cached-parent-exit behaviour (`process.rs:~160-227`). Good. |
| Approval identity | Single-use authority keyed by `authorityId`, bound to binding, target, arguments digest, run, call and thread; stale checks on both sides (`tools.ts:37-47`, `service.rs:1190-1201`). Saved history grants nothing. |
| Late response | Receipts are kept per operation ID; `Err(_)` timeout after dispatch -> `reply_lost`; duplicate operation with different identity -> conflict (`service.rs:1152-1160`). |
| Resource URIs | Never model-supplied; `handleId` enum from the captured catalogue; `handle = hash(server, uri)` with collision check. |
| SSRF / network | Redirects off, size caps, https required (loopback http only); F4 for private ranges. |

## Test adequacy

Strong fixture suites: real HTTP and stdio servers, lost-reply and 401/404 cases, vault lost-ack reconciliation, descendant drain, OAuth negative callbacks.
Gaps: F1 (empty/closed connection on the listener), a tool call over 30 s, a stdio server that daemonizes via `setsid`, the `iss`-required branch with a missing `iss`, no Windows execution, and no real browser or system-launch test. The OAuth negative tests use a fixture AS that is well behaved, so SSRF-style discovery (F4) is untested.

## Comparison with dsh (read-only)

| Aspect | Ours (E10) | dsh | Assessment |
| --- | --- | --- | --- |
| Stdio launch | Own `OwnedProcess`, `env_clear`, process group / Job Object, retained drain (`process.rs`) | MCP SDK `StdioClientTransport` spawns; env = `scrubbedParentEnv()` plus config env (`packages/mcp/mcp-client/src/transport.ts:15-38`) | **Ours stronger** on teardown and ownership, **weaker** on usability: dsh inherits a scrubbed parent env (credential-shaped names dropped), ours inherits nothing (F7). |
| OAuth | Native PKCE/loopback listener, issuer and resource binding, vault-backed rotation, Web popup flow | No OAuth in `mcp-client` (headers only, `requestInit.headers`) | **Ours has a feature dsh lacks**, and with stronger binding. Ours also carries the F1/F4 risks that dsh avoids by not having the feature. |
| Credential storage | OS keychain/credential manager, immutable chunks, no plaintext | `credentials-local` writes a `0600` file via `writeFileAtomic` with a `chmod 600` hint (`packages/credentials/credentials-local/src/index.ts:143, 703`) | **Ours stronger** (at-rest protection by OS, with a complex chunk protocol to maintain). |
| Transport hardening | Custom bounded `StreamableHttpClient` port: byte caps before parse, no redirects, one-shot POST, no session reinit | SDK `StreamableHTTPClientTransport` defaults | **Ours stronger** against unbounded output and implicit replay; **weaker** on long calls (F2). |
| Approval / replay model | Exact authority, `dispatched` flag, no automatic replay, E07 job/result retention | Tool-level approvals through dsh core; no equivalent per-call authority record observed | Ours is more explicit about unknown outcomes. |
| Surface budget | Frozen per-run generation, 36-tool cap integration | Dynamic per-session tools | Ours deliberately immutable per run (replay-safe) but cannot pick up a reconnect mid-run. |

## Recommended follow-ups

1. F1: make the OAuth listener resilient (skip bad or empty connections, per-connection tasks), and add a test for an empty connection followed by a valid callback.
2. F2: split connect/header timeouts from stream and call deadlines; add a long-running-tool fixture.
3. F3: add native-side confirmation or a native-signed enablement for new or changed stdio commands.
4. F4: restrict discovered OAuth endpoints (public-address or same-registrable-domain), and test a hostile metadata fixture.
5. F7: offer an explicit inherit-list (`PATH`, `HOME`, `SystemRoot`, …) for stdio rather than an empty environment.
6. Run Keychain, Windows vault, Job Object and system-browser acceptance before ticking AC4/AC5/AC7.
