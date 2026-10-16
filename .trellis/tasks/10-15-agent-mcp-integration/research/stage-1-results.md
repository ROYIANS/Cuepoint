# E10 Stage 1 source and adapter results

Status: independently reviewed on 2026-10-16. This checkpoint completes contracts
and the bounded SDK spike, not production IPC, OAuth login, Agent execution or UI.
Stage 2 follows under the existing stage-commit authorization.

## Delivered boundaries

Studio owns a strict device-local MCP catalogue with ProductStore CAS and original
operation receipts, opaque private revision references, bounded manifest/schema
normalization, deterministic groups and frozen run snapshots. The finite host
port keeps raw private configuration and invocation authority out of saved runs.
Native adapters pin rmcp 3.5.1, bound protocol reads before deserialization, disable
expired-session repost and own process groups / Job Object seams and chunked
credential revisions. SDK OAuth reactive request replay is explicitly prohibited
for effect-bearing dispatch; token acquisition belongs before the original call.

Host raw catalogue revisions and Studio normalized digests are separate identities.
Missing catalogue data is the legitimate initial empty state; corrupt or failed
reads reject instead of silently becoming empty. Credential write/store commit
uncertainty remains quarantined until original-operation reconciliation.

## Independent review corrections

- Credential reference equality compares kind, ownerId and revisionId. JSON
  property order cannot make an active reference eligible for collection. A
  regression exercises confirmed rollback with reordered identity fields.
- Process stop retains one managed drain task across timeout and caller
  cancellation. The dependency caches parent exit before descendant drainage;
  re-creating its wait could otherwise acknowledge completion too early. A
  controllable regression covers timeout, cancellation and repeated stop.

These contracts are preserved in the [MCP code spec](../../../spec/frontend/agent-mcp.md).

## Executed necessary checks

- Studio: 2 suites / 17 tests through vitest.mcp-source.config.ts; finite noEmit
  profile passed; scoped source ESLint passed with 0 errors / 0 warnings.
- Native: cargo test --locked --features desktop --lib mcp: 14 passed, 1 ignored,
  105 filtered. Scoped rustfmt and tracked whitespace checks passed. Final staged
  whitespace validation is performed immediately before the checkpoint.
- Real fixtures exercised stdio and HTTP discovery / initialize for negotiated
  2026-07-28 and compatible 2025-11-25 lifecycles; missing reply, expired session
  and 401 left the effect counter at one. Pre-parse stdout, JSON, SSE and OAuth
  metadata limits, actual TCP deadline and available-host child / ordinary
  descendant drainage ran. Vault fault and refresh serialization fixtures ran.
- Studio ownership registration covered 650 files without missing, duplicate or
  path issues. This is the affected ownership check, not the whole formal gate.
- Explicit agent-package dependency regeneration and freshness/export assertions
  passed after the JS lock change; the running /agent Vite entry returned 200.
  This is dependency preparation, not a whole-app or browser UI acceptance claim.
- Task manifests validate at 23 entries each. Existing large-spec injection
  warnings were handled by reading the relevant full native/quality tails.

## Evidence limits and deferred gates

The actual Keychain roundtrip remains an explicit opt-in ignored test because it
can prompt for system authorization. Windows vault / Job Object execution has not
run on Windows. The existing vendored HTTP plugin emits two unused-variable
warnings; this delivery neither modifies nor suppresses them. Production host
installation, actual OAuth callback and Agent / management UI belong to subsequent
stages. Whole formal quality / regression, emitted and packed consumers, application
builds, packaging and installed macOS + Windows acceptance remain with the parent
epic. No result here discharges E08 or E09's separate pending acceptance.
