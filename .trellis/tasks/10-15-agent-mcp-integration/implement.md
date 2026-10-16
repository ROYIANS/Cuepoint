# E10 staged implementation and validation plan

Status: final plan approved by the owner with “开始吧” on 2026-10-16; active on
codex/agent-mcp-integration. Each stage ends with scoped checks/review and a
commit before continuing. Product decisions are resolved in [prd.md](./prd.md);
follow [design.md](./design.md). Unchecked steps are pending, not execution claims.

## Stage 0 — review and activate

- [x] Present the final PRD/design/stage summary and obtain the subsequent
  implementation approval required by the project planning gate.
- [x] Validate curated context, load the full relevant package/spec checklists
  (including native/quality tails beyond injection caps), and record approval.
- [x] Activate this child. Use a codex/agent-mcp-integration branch from the actual
  current source checkpoints; do not reset to main and lose E08/E09 work.
- [x] Preserve parent-owned deferred acceptance and E08's pending installed checks.

## Stage 1 — contracts and bounded SDK compatibility spike

Ownership: Agent MCP contracts/strict device catalogue, finite platform port,
test fixture harness and affected native dependency/adapter skeleton. Shared
quality/discovery entries move with their actual source owners.

- [x] Add typed connection/configuration revisions, safe catalogue projections,
  original operation receipts and strict ProductStore CAS/readback. Model native
  vault candidate publication/unknown reconciliation separately from store commit.
- [x] Define frozen manifest/run snapshots, exact namespaces, deterministic
  subgroup composition and current-generation authority. Bound discovery,
  schema compilation, arguments, framing and result payloads before allocation.
- [x] Pin rmcp =3.5.1 client-only features and actual target keyring providers
  from research; verify dependency/toolchain resolution without reinstalling
  unrelated JS dependencies or building the app installer.
- [x] Build real stdio and Streamable HTTP fixture connections for verified
  discover/initialize lifecycles. Prove expired-session repost is disabled,
  missing replies invoke an effect only once, and pre-parse IO caps terminate
  oversized stdio/JSON/SSE/OAuth messages.
- [x] Prove the vault revision/chunk adapter's ordering, limits, failure/readback,
  refresh serialization and owned cleanup through its deterministic port. Exercise
  actual available-host secure storage separately where feasible, never label
  mocks as Keychain/Windows proof.
- [x] Establish process-group/Job Object ownership seams and stop a real available-
  host fixture child/ordinary descendant. Keep unexecuted OS behavior pending.
- [x] If an SDK seam cannot meet the reviewed bounds, correct the adapter/design
  within this scope before proceeding; return for review only if the product
  transport/auth/platform commitments would change.
- [x] Run necessary source/native checks and independent review; fix and commit.

Outcome: executable proof of critical SDK defaults and bounded adapters, typed
contracts and strict configuration owner. No management UI claims real connection
until the host is installed.

Stage 1 source evidence: [reviewed results](./research/stage-1-results.md).

## Stage 2 — native desktop connection, OAuth and cleanup

Ownership: Rust mcp service/modules, exact normal/acceptance IPC registration,
native port installation and vault/OAuth owner. Do not widen media authority.

- [x] Complete actual native stdio and HTTP discovery/call/resource methods with
  trusted-window/store-session/generation checks and original invocation status.
- [x] Connect only explicit configured executables/argument vectors; no shell,
  download/install or automatically restored process. Scrub environment, capture
  bounded stderr and drain real owned process trees on disconnect/teardown.
- [x] Add no-auth/manual headers and native SDK CredentialStore adapter with
  macOS Keychain and Windows Local persistence; handle chunked large credentials,
  unavailable vault, partial rotation and removal without plaintext fallback.
- [x] Add short-lived loopback PKCE callback and system-browser login. Test exact
  state/issuer/resource/configuration identity, duplicate/error/stale callback,
  timeout/cancel and missing registration. Cover preregistered public clients and
  advertised DCR; use CIMD only with an actual supported metadata fixture.
- [x] Serialize refresh and fence stale callbacks; expiry never replays a sent
  tool. Do not wrap effect POSTs in SDK AuthClient's reactive AuthRequired
  refresh/repost; acquire the token before the one original dispatch.
  Retire dispatch authority before edit/disconnect/remove; record truthful
  not-started/known/unknown outcomes and actual process drainage.
- [x] Run relevant native/transport/port checks and independent review; fix and commit.

Outcome: both desktop transports and authentication run through the real native
port against deterministic servers. Source evidence remains separate from
installed macOS/Windows acceptance.

Stage 2 source evidence: [reviewed results](./research/stage-2-results.md).

## Stage 3 — real Agent offers, approval and retained results

Ownership: MCP tool adapter and existing admission/preview/run/job lifecycle
owners. Avoid concurrent ownership of these shared command/runtime files.

- [x] Add the same pure connected-snapshot composer to admission and new-context
  preview, with no network inside ProductStore transactions. Conversation mode
  and runs without an MCP snapshot acquire no current connection on retry/resume.
- [x] Materialize the per-run exact registry in send/retry/resume; use core's
  immutable registration/current checks. Update Studio request() to use the
  offeredDefinitions passed by core rather than recalculating wire definitions.
- [x] Persist binding explicitly in rounds, claimFingerprint and E07 job/call
  revision. Exercise actual load_tool_groups, 36-tool/two-group limits, helper
  counting, >one-group manifests and never-offered same-round calls.
- [x] Add typed prepared authority, bounded previews and final native generation/
  configuration/arguments/credential checks. Existing ask/assist/full behavior
  remains the permission owner; server annotations do not lower risk.
- [x] Add the finite MCP job selection/source variant to E07 publication, paging,
  clear/recovery and UI switches. Keep remote IO outside store transactions and
  give external effects no automatic replay recovery marker.
- [x] Preserve unknown external call status even when its evidence/report was
  retained. Raise the typed unresolved/pending outcome rather than return a
  success-shaped descriptor into core's completion branch. Extend original
  savedResult/publication reconciliation for unknown evidence explicitly.
- [x] Exercise original-operation readback and late acknowledged completion
  after Stop/disconnect/catalogue replacement. Settle only the surviving original
  invocation/job/call, never a replacement; no blanket postflight stale check
  may discard established evidence, and deleted owners must not resurrect.
- [x] Verify tools and resource handles, no link dereference, bounded text/JSON,
  retained offline readback and actual thread/project authority/deletion.
- [x] Run necessary actual-store/runtime/job/protocol tests and independent review;
  fix, capture durable contracts and commit.

Outcome: real model offers and approvals reach both host transports through the
existing execution/result owners, with truthful certainty and recoverable output.

## Stage 4 — shared management UI and practical Web

Ownership: Agent MCP management/ContextPanel, named Settings connection integration,
historical report UI and optional browser remote adapter/callback. Reuse existing
routes and editors; do not add another app product tree.

- [x] Provide list/detail/save/connect/login/reconnect/disable/disconnect/remove
  with explicit enablement, guarded edits and retained unknown intent. Saving
  alone does not launch a process; pending operations prevent duplicate mutation.
- [x] Keep chat mounted during wide/narrow retained-panel interaction and editor
  replacement. Test actual ReactDOM controls, errors, return/focus and no extra
  preparation/model-check/user-bubble/success status copy.
- [x] Attempt the official browser client 2.3.1 remote-only port after desktop
  integration. Prove browser-only export closure before admitting the dependency;
  import no Node stdio in the browser graph.
- [x] Use session-memory credentials and guarded same-origin callback/popup only
  for compatible endpoint/public-client/CORS/deployment combinations. Provide
  actionable unsupported/reconnect-required states and desktop-only stdio.
  Do not add a proxy/backend or wait on third-party browser compatibility.
- [x] Capture actual final model/context, diagnostics and project export bytes;
  assert private config/headers/env/token/callback data is absent.
- [x] Run necessary UI/browser/source integration checks, full changed-scope
  independent review (all E10 stages), spec update and commit. Carry actual
  installed/whole-app acceptance to the parent; do not call those checks passed.

Outcome: reviewable desktop-first feature, practical browser support or an explicit
bounded limitation, and a documented handoff to epic batch acceptance.

## Necessary validation commands and discovery

Use machine Node/pnpm explicitly. Never run bare/runtime pnpm, an unrelated
workspace reinstall, a root test script which builds all packages, or per-stage
application packaging. Establish/register a finite
vitest.mcp-source.config.ts and tests/typecheck/tsconfig.mcp-source.json during
Stage 1, using existing exact public source-export aliases. Include affected
.test.tsx explicitly: default root discovery currently misses that suffix.

Proposed commands (filenames/module filters must exist and match nonzero tests
when used; these are not claimed execution receipts):

~~~sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config vitest.mcp-source.config.ts <affected-test-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project tests/typecheck/tsconfig.mcp-source.json --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint <affected-source-files>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node apps/desktop/scripts/tools.mjs cargo test --manifest-path /Users/xiaomengdao/WebstormProjects/aifenjing/apps/desktop/src-tauri/Cargo.toml --features desktop mcp -- --nocapture
~~~

Match PATH to the machine Node for subprocesses. Run affected architecture/
public-entry/native-ACL discovery when their owners change. New core exports
consumed by a running app require explicit tooling/build-agent-packages.mjs,
freshness/asserted actual emitted exports and Vite entry smoke; this does not
discharge deferred whole-app/packed-consumer acceptance. Do not change core just
to place product SDK types somewhere reusable.

| AC | Minimum meaningful fixture / actual boundary |
| --- | --- |
| AC1, AC8 | Production admission/preview/runChat with real ProductStore: exact offered definitions/raw mapping, collision/schema/page/size limits, groups and resources; no map-only mock proof. |
| AC2 | Barriers at prepare, approval, final claim and reply: edit/disconnect/reconnect/list/account replacement rejects old dispatch and replacement publication. A verified late original response settles only its original owners; deletion prevents resurrection. Check call and job binding fingerprints. |
| AC3 | Real fixture increments an effect counter then loses reply/returns session expiry. Stop, refresh, reconnect, reload/resume and report publication leave counter at one; retained unknown keeps the original call unknown. |
| AC4 | Real stdio child/descendant and HTTP server through native port; discovery/call/read/cancel/disconnect, bounded output and drain. Report source, compiled target and installed evidence separately. |
| AC5 | Deterministic OAuth registration/login/refresh fixture and injected vault failures: wrong issuer/state/path, cancelled/replaced attempt, duplicate callback, serialized rotation and no secrets/replay. |
| AC6 | Compatible Web remote fixture, explicit CORS/registration/callback failure, session reload, and stdio unsupported; no proxy. Browser limitation remains an explicit handoff, not desktop failure. |
| AC7 | Actual UI pending/unknown/failure/reopen/save guards, duplicate controls, wide/narrow panel with running chat, normal success quiet. |
| AC8 | Secret exclusion on actual outgoing request/context/export/diagnostic bytes; oversized and untrusted resources never trigger arbitrary fetch/filesystem access. |

Before each stage commit: independent scoped review, necessary lint/noEmit/test
receipts, only reviewed paths staged, git diff --cached --check including new
files, and task/spec evidence updated. Standing stage-commit authorization applies;
no remote push. Do not record source inspection as a compiler/server/login pass.

## Epic-end acceptance and rollback

Parent epic retains full formal lint/architecture/unused/model/regression, all
production builds, isolated emitted/declaration/packed consumer, complete native
integration, release resource/installer closure and actual installed macOS and
Windows checks. E08 and archived E09 obligations remain distinct. Actual signed
Keychain prompts, Windows vault/Job Object, system browser/firewall/loopback and
desktop launch paths need target-host evidence; mocks/macOS compilation cannot
discharge them.

Risky owners are runChat/offered schema, admission/preview, tool claim fingerprints,
agentJobs certainty, native trusted handler/service installation, secret rotation
and process lifecycle. Fix the current stage before continuing. Rollback may
disable new capability/port exposure but cannot delete user data, treat uncertain
vault/store mutation as rollback, or repeat an external effect.
