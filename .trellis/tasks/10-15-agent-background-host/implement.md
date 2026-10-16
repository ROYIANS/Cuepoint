# E11 implementation plan

State: approved on 2026-10-16 (进入开发吧) and activated. Implement/check/commit the four stages sequentially under standing authorization. Read [prd.md](prd.md), [design.md](design.md) and the curated spec/research manifests first. Product scope is resolved: macOS + Windows, desktop close-to-background, one product window/application instance, concurrent conversations, running/unread sidebar indicators and no execution-stop-on-departure.

## Delivery policy

- After approval, create `codex/agent-background-host` from the current reviewed HEAD, retaining E10 changes. Do not silently start from the older `main` or discard the authored planning files. Activate this existing task and set the parent's active delivery to E11.
- Follow the workflow's selected Codex mode: named Trellis implement/check agents with explicit ownership; main coordinates, updates specs/task evidence and commits. Researchers' documents are evidence, not implementation approval. Workers are not alone in this checkout and must preserve others' edits. Keep overlapping feature/StoreTx changes sequential.
- Finish each stage's scoped implementation, necessary checks, spec updates and changed-scope review; commit locally, then continue under standing owner authorization. No repeated stage permission and no remote push.
- Full regression/formal quality/whole-app builds/emitted or packed-consumer/packaging/installed-OS gates run once at the epic batch end. Do not mark their absence as a passed check or run them anew at each stage.
- Keep fixture screenshots, raw logs, traces, DBs and compiled artifacts outside the repository; retain authored findings and concise evidence in this task.

## Stage 1 — App-owned execution and headless flows

Ownership: `packages/studio/src/features/agent/{models,runtime,commands}` and the narrow app bootstrap composition, with the existing public core/provider contracts unchanged. New module names may follow local conventions; responsibilities are fixed by the design.

- [x] Extract concrete submitted/recovery DTOs and non-React send/retry/approval/uncertain-admission flows from UI; no runtime import of hooks/router/DOM.
- [x] Create one app/document-lifetime service with memoized startup reconciliation, closed admission/shutdown state, exact per-thread reservation before first await, original done/flush, per-invocation feedback and stable snapshots/subscriptions.
- [x] Preserve real Web Lock capabilities, conditional run/call ownership, same-thread admission and single terminal writer. Model preflight/thread creation belong to the retained invocation, not selected route.
- [x] Implement named Stop/retry/decision/read-only check commands with explicit thread/run/call/token identity. Unknown admission and reconnect never dispatch; rejection remains independent of valid API credentials.
- [x] Keep synchronous optimistic publication and bounded foreground paint yielding; hidden/headless execution never waits for DOM acknowledgement. Retain detached actionable failure/attempt state.
- [x] Verify real held compatibility/thread-create/begin boundaries, same-tick duplicate Send, two held A/B model/tool operations, Stop A while B continues, last flush before release, and positive/absent uncertain admission with no extra dispatch.
- [x] Update execution/send-recovery/feedback specs for service ownership and commit the reviewed stage.

Gate: service behavior must be exercised with the actual Studio execution binding/transaction paths, not only an invented scheduler. Preserve the existing foreground UI until Stage 2 connects it. Rollback point: this commit; navigation cancellation has not yet been removed.

## Stage 2 — Detach views, retain drafts and generation

Ownership: Agent UI/adapters, the small feature-owned scoped draft model, existing video/audio Agent generation runtimes and their intentional public lifecycle exports; app bootstrap only as composition. Avoid an unrelated audio workflow rewrite.

- [ ] Connect the real Agent page to the single service; move scoped draft/reference-import ownership to a retained model while preserving whole-draft exact-revision restore.
- [ ] Detach first-thread creation navigation from service completion. Late A receipt/error cannot select A over B or consume/restore B's draft. Unsubscribe cannot abort work.
- [ ] Register existing model/video/audio and narrowly named AI task-wrapup preparation owners with exact requestStop/original done handles without recursive same-thread locking. Remove TaskWrapup's AI-only unmount abort/pending-departure prohibition while preserving real manual editing/saving/conflict guards and existing summary semantics. Preserve current approval/start policy and mutual exclusion.
- [ ] Remove all execution-only leave blocker/modal, thread/new-topic abort and route-unmount Agent batch pauses, including project audio teardown's Agent-owned case. Keep manual draft/conflict/pending-mutation and deletion/clear protections.
- [ ] Reattach uses current snapshots and saved state without a fresh store open, model request, retry, auto approval or duplicate effects. Keep startup recovery local and once per real service session.
- [ ] Exercise actual retained Agent UI through A/B/new/settings/project/Back/Forward during preparation, streaming, approval, task-wrapup preparation and generation. Check independent Stop, drafts/optimistic identity, explicit retry and no route stealing. Summary preparation in A excludes competing same-thread Send while B continues.
- [ ] Extend existing requested-topic/manual editor tests; update superseded execution-departure assertions rather than deleting their unrelated stale-read coverage. Update cross-feature architecture/export ownership policy only for actual new edges.
- [ ] Update reading/business-details/jobs/batch/component specs where E11 intentionally replaces old page-bound execution statements; check and commit.

Gate: at least one real browser UI fixture proves two independent requests alive and view departure without cancellation, plus an actual Agent-owned generation path. Rollback Stage 2 as a whole if integration fails; do not leave the dialog removed while page teardown still aborts.

## Stage 3 — Native one-window background lifetime and Quit

Ownership: `apps/desktop/src-tauri/src/desktop_lifecycle/` with composition in desktop entry files, the narrow Studio platform lifecycle port and app shutdown integration, existing resource owners' exact admission/drain hooks as needed. No new runtime/sidecar or singleton plugin dependency.

- [ ] Add a pre-window/pre-store profile-scoped held File lock and bounded Tokio loopback activation. Test simultaneous contenders, lock-to-listener race, lost activation, stale metadata after crash, lock release and fail-closed setup. Activation accepts only the exact bounded Show/Unminimize/Focus protocol, with eight connection slots, one-second connect/read deadlines, three-second total readiness retry and fixed accepted/closing/not_ready acknowledgements.
- [ ] Install native tray Open/Quit and macOS reopen/menu handling. CloseRequested hides the existing main without destroying/reloading its document or opening storage again. Repeated launch keeps one owner/window even if activation fails.
- [ ] Apply pinned supported macOS background scheduling; avoid explicit Windows suspension and unsupported Chromium flags. Deliver native foreground/visibility truth to the reading port.
- [ ] Implement one idempotent Quit intent and a distinct new-effect action gate (not MCP close_admission/dispose and not a blanket product-write ban). Signal original model/task-wrapup/generation/reference-import/desktop-import owners, preserve MCP Stop/status and ProductStore publication until original done settles, then dispose shared resources and close storage.
- [ ] Match lifecycle ack to trusted main/current session/original quit intent. Add a finite app-owned registration/aggregate Quit request for current manual dirty/pending/conflict guards, including overlays; beforeunload alone is insufficient. Tray/Dock Quit shows the sole main for that existing protection; a responsive human decision can cancel before quiescing and before the five-second grace begins. Bound initial renderer guard-status response to one second so an unresponsive renderer cannot block shutdown forever. Repeated Quit joins the same shutdown; after guard resolution use five seconds cooperative plus at most two seconds total native cleanup, with truthful unknown/interrupted state rather than a fake drain receipt.
- [ ] Cold startup under a new service/session reconciles saved state without any model/tool/effect replay. Reopen of the retained window does not run that startup path.
- [ ] Run necessary affected Rust lifecycle tests and desktop-feature compile. Verify original MCP result publication during shutdown, native import original done, no A Stop disposal of B, and no session reset on hide/reopen.
- [ ] Run the actual available macOS retained-WebView feasibility fixture for **more than six minutes** with A/B progressing across output/checkpoint and a tool/generation boundary while hidden, including an idle interval; reopen the one main and count original requests/effects. Native process existence/heartbeat alone is insufficient. Record absent Windows/installed evidence explicitly for the final batch.
- [ ] If real supported-host behavior fails, stop architecture-dependent delivery and revisit the design; do not invent a Node fallback, claim Windows success from macOS tests or downgrade the confirmed scope.
- [ ] Update native/distribution/jobs/MCP lifetime contracts and commit the reviewed source stage with accurate evidence limits.

Gate: owned two-process native singleton/activation and Quit fixtures plus actual available-host hidden progress. Windows source implementation remains mandatory now; actual Windows/WebView2 and both installed OS acceptances remain pending until performed. Rollback the lifecycle stage coherently if native readiness fails.

## Stage 4 — Sidebar progress, unread and full changed-scope integration

Ownership: feature models/transactional publication and read commands/queries; exact Agent/E07 source writers; TopicSidebar/navigation/MessageList/report UI and CSS; necessary stage-specific fixtures. Preserve Stage 3 native visibility and all current product transaction ownership.

- [ ] Add strict per-thread activity records using existing `deviceSettings`, ordinary publication/read revisions and bounded exact job-report cursors. Hash `JSON.stringify(threadId)` outside live transactions; strict read failures are not all-read.
- [ ] Publish atomically from real output/activity/approval/sole-terminal writers, `publishAgentJob` and direct unknown recovery; expand every real initiating StoreTx scope. Skip internal/identical/progress-only/no-op changes.
- [ ] Stamp the exact rendered public snapshot; add a feature-owned combined requested-thread read envelope subscribed at the transcript-reader boundary, not AgentChatPage/composer/root, so the view cannot acknowledge a revision absent from its body/activity. Original report summaries carry their own accepted job/result revision.
- [ ] Add monotonic observed-revision acknowledgements; ack 41 racing publication 42 leaves 42 unread. Report-tail visibility cannot clear an unseen older report. Delete/clear wins late publication and acknowledgement.
- [ ] Add local painted/visible/focused/following eligibility for ordinary tail content, including native hidden state and narrow detail/composer/overlay isolation; coalesce only previously observed revisions. Exact visible historical reports may clear their own cursor while scrolled up without clearing the tail. A generic “查看报告” button is not a result summary; actual revision-matched summary/body must be presented.
- [ ] Isolate/equality-cache sidebar semantic subscriptions and memoize row/navigation boundaries. Prove token/metrics updates cannot rerender all titles/rows/root. Preserve real browser/native observation.
- [ ] Render trailing hollow spinner plus independent unread dot in every sidebar path. Check long titles, hover/focus/touch actions, narrow widths, reduced motion and accessible sibling controls in actual rendered layout.
- [ ] Run the finite E11 integration set spanning all four stages; verify concurrent A/B, Stop/approval, navigation, reattachment, unread races, native lifecycle DTOs and conservative recovery. Keep existing no-preparation-copy/no-user-side-label behavior.
- [ ] Update executable specs, record passed vs deferred evidence, and perform final all-E11-changed-package review. Commit after the scoped gate passes; archive only the completed delivery under the owner's workflow, carrying unperformed full/installed acceptance to the epic.

Gate: real ProductStore atomicity/races, actual controlled Agent DOM/layout and semantic render-count evidence. Rollback publication/read UI together if necessary; no historical migration/backfill is authorized.

## Necessary commands and fixtures

### Context loading per stage

The manifests deliberately fit the injection budget; they are an entry set, not permission to skip package checklists. Before touching each stage, pull the complete applicable files below from disk, including their final consistency-review sections; do not rely on truncated injection or source lines from an older research pass.

- All stages: Studio index, feature organization, shared product storage, development-change and artifact-retention guidelines; [product boundary research](research/product-execution-boundaries.md). Read the actual affected package Quality Check sections for final changed-scope review.
- Stage 1: `agent-execution.md`, `agent-send-recovery.md`, `agent-execution-feedback.md` under `.trellis/spec/frontend/`, plus `.trellis/spec/agent-core/library/runtime.md` and provider index. Preserve the existing loop/credential/transport contracts.
- Stage 2: frontend `agent-thread-reading.md`, `agent-business-details.md`, `component-guidelines.md`, `agent-task-wrapup.md`, `agent-references.md`, `agent-batch-generation.md`, `agent-jobs-results.md` and `chat-performance.md`.
- Stage 3: desktop runtime index; frontend `native-product-runtime.md`, `desktop-distribution.md`, `agent-mcp.md`; [native research](research/native-background-and-single-instance.md) and the product research's Quit/final-review sections. These large files require complete reads beyond any per-file injection cap.
- Stage 4: frontend reading/performance/interaction/jobs/MCP contracts and [sidebar research](research/sidebar-running-unread.md), including late-report and final consistency review. Read actual source transaction callers before adding a table scope.

Use machine Node/pnpm explicitly. Prepend `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin` to PATH; never use Codex Runtime pnpm. Commands below are planned targeted profiles; create them during implementation following existing source-profile patterns, then name exact suites in the evidence record.

```bash
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run --config vitest.agent-background-source.config.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --noEmit -p tests/typecheck/tsconfig.agent-background-source.json
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint <actual-changed-TypeScript-files>
git diff --check
```

The finite Vitest profile must cover actual service/StoreTx/UI entry points, not compile empty or mocked-only paths. Register the newly affected TSX suites explicitly for eventual aggregate discovery: the shared current profile only discovers `.test.ts`. Run the actual architecture reporter through `checkArchitecture` from `tooling/quality/architecture.mjs`; do not invent unsupported quality CLI flags or broaden to full formal quality here. If source-only core/provider artifacts must be regenerated for the real dev import graph, record that narrow reason without treating it as a whole-app build or isolated emitted-consumer acceptance.

From `apps/desktop`, use the repo native wrapper and an exact lifecycle test filter after those tests exist:

```bash
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/tools.mjs cargo test --manifest-path src-tauri/Cargo.toml --locked --features desktop <exact-lifecycle-test-filter>
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/tools.mjs cargo check --manifest-path src-tauri/Cargo.toml --locked --features desktop
```

The more-than-six-minute native feasibility run is a necessary affected runtime probe, not a release packaging build. Run asynchronously, retain raw artifacts outside the repository, communicate while it runs, and use the actual pinned WKWebView host/native services. Browser Chromium success does not discharge WKWebView/WebView2 acceptance.

## Acceptance mapping and carried final gates

| PRD acceptance | Stage owner / necessary proof |
| --- | --- |
| AC1 / AC7 navigation and manual guards | Stages 1–2 actual held Agent UI, requested-topic and manual-draft cases; Stage 4 combined regression. |
| AC2 restart/no replay | Stages 1/3 actual local reconciliation, known/unknown outcomes and zero dispatch counters. |
| AC3 platforms/lifetime | Stage 3 available native probe; actual installed macOS + Windows remains epic batch. |
| AC4 independent conversations / exact Stop | Stages 1–2 real held service/Agent/generation operations, repeated in Stage 4. |
| AC5 sidebar spinner/layout | Stage 4 actual semantic state and rendered wide/narrow layout. |
| AC6 unread and viewed-only ack | Stage 4 ProductStore atomicity/races and actual MessageList/report visibility. |
| AC8 single-instance, background and Quit | Stage 3 two-process lock/activation, original resource drain and native probe; installed both-OS gate carried forward. |

Carry to parent: full formal regression/quality/build; isolated emitted/declaration/offline packed consumer if applicable; both installed OS hidden-progress/tray/reopen/simultaneous-launch/Quit cases; Windows WebView2/Job Object/session/process cleanup and macOS signed native permission flows; actual final linked/installer footprint. Record these as pending until run. Earlier E08/E09/E10 residual acceptance remains separate and is not cleared by E11 source tests.

## Approved transition

The owner approved the final six-outcome/four-stage plan on 2026-10-16 with “进入开发吧”. The task is active on `codex/agent-background-host`; no further planning approval is needed for these stages. This plan is not implementation or platform acceptance evidence. Stage results below will be recorded from actual checks.

## Stage delivery evidence

Stage 1 implementation and independent review passed on 2026-10-16; see [results.md](results.md) for exact checks and limits. The local stage commit precedes Stage 2 product edits. Full/build/installed gates remain pending at the parent batch boundary.
