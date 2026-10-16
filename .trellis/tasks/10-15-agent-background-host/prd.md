# E11: 后台 Agent 宿主与重连恢复

## Goal

Make conversation execution independent of the selected page, with truthful per-conversation activity/read state and the desktop application lifetime confirmed by the owner. Preserve the reusable Agent core and sole product transaction owner.

## Background and confirmed scope

The owner authorized this existing child of [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md). Planning resumed after E10 source delivery on 2026-10-16. The screenshot supplied that day places the running indicator at the trailing edge of a conversation row. The latest clarification is: “是的，需要支持桌面端后台运行，且不支持多开窗口”. This accepts the preceding proposed lifetime: window close retains the application-managed host, explicit Quit ends it, and reopening/repeated launch returns to the same window.

Desktop is primary and **both macOS and Windows are in scope**. Web shares supported behavior for the lifetime of its document. The six confirmed outcomes are captured by R1/R4/R5/R6/R7/R8 below. This is an independent-conversation delivery; model-created child Agents belong to E12.

Selected architecture, alternatives, actual ownership and packaging implications are in [design.md](design.md); staged work, checks and rollback points are in [implement.md](implement.md). Product decisions are resolved. The owner approved the final plan on 2026-10-16 (进入开发吧); implementation is active. This record does not establish platform success.

## Requirements

- **E11-R1 — Lifetime and reattachment.** Accepted execution continues across conversation switches, new topics, product routes and in-app Back/Forward. Desktop close hides the existing window and retains its application-managed execution; reopen attaches to that same host. Explicit application Quit ends it. A cold startup reconciles saved state without automatic model/tool/effect replay. Browser tab-close survival and execution after application Quit are excluded.
- **E11-R2 — Host and reusable boundary.** Use the reviewed app-lifetime Studio service in the retained sole main WebView, with existing Rust resource owners. Preserve the single public Agent loop. Record the runtime/worker alternatives and their actual IPC/packaging costs in the design; no additional runtime binary or second product store is planned. Platform feasibility requires real runtime evidence.
- **E11-R3 — Actual authority and continuity.** Retain the actual product transactions, live ownership capabilities, current credentials, scoped reference materialization, transport and MCP session/registration authority. Reattached views read immutable current snapshots; saved IDs and subscriptions never authorize dispatch. Submitted attempts, exact-revision scoped drafts/imports, actionable failures, existing AI task-wrapup preparation and owned generation work survive ordinary page detachment within the app/document lifetime. Manual summary editing/saving protection remains distinct from the retained AI request.
- **E11-R4 — Independent conversations.** Different conversations can execute concurrently with independent output, approval and Stop. Preserve exclusion within one conversation and exactly one actual owner per invocation/run; B cannot release, abort or overwrite A. Parked approvals and unknown effects remain truthful blocking/attention states rather than fictitious live progress.
- **E11-R5 — Sidebar running icon.** Display a compact trailing loading/in-progress icon for each actually executing/stopping conversation, selected or otherwise, following the screenshot. It clears only when that owner's real state changes; route loading, global sending and stale persisted running rows are not evidence of active work. Preserve long-title truncation, actions, narrow navigation, accessible labels and reduced motion.
- **E11-R6 — Durable unread.** Display a separate unread indicator for meaningful assistant output, decisions and reports not yet seen. Running and unread can coexist. Internal phases, metrics, title/model edits and subscription delivery do not create/read content. Acknowledge only the exact revision actually presented in a visible foreground reading surface; an older or late report cannot be consumed by an unrelated latest-message acknowledgement. Retain read state across reattachment/restart with no unsafe clearing on query errors.
- **E11-R7 — Ordinary departure.** Remove the execution-only “当前话题仍在执行 / 停止并离开” blocker/dialog and real implicit cancellation on sidebar switches, new topics, route/history changes and page cleanup. Keep explicit targeted Stop, destructive delete/clear safeguards, manual business-editor drafts, pending mutations and conflict protection. Do not merely hide the dialog while teardown still aborts.
- **E11-R8 — One desktop application/window.** Enforce one application instance/product window per actual profile before opening storage or admitting work. Closing leaves a discoverable resident app. Dock/tray/platform reopen and repeated launch show/focus the existing window without a new owner/session. Provide explicit Open/Quit entry points on both platforms; parallel conversations do not require extra windows or stores.

## Acceptance criteria

- [ ] **E11-AC1 (R1/R3/R7):** With A executing, visit B/new topic/settings/project and use Back/Forward during preparation, streaming and approval. No execution-leave dialog or cancellation occurs. Return to A with the same output/identity/approval and no second model request or duplicate tool/write; late A completion cannot steal B's route/draft.
- [ ] **E11-AC2 (R1/R3):** Startup/reload reconciliation preserves confirmed partial/results and conservative interrupted/waiting/unknown state, without replaying paid/external work. Reopening a retained window is not a startup, store reopen or host reset.
- [ ] **E11-AC3 (R1/R2/R8):** Actual native/installed macOS and Windows acceptance verifies chosen hidden-window progress and lifecycle. Source compilation and browser fixtures are recorded separately; pending installed checks remain in the epic batch until performed.
- [ ] **E11-AC4 (R3/R4):** Hold real controlled model/tool work in A and B concurrently, observe independent progress, and Stop one while the other continues. Same-thread duplicate Send/reconnect cannot establish a second owner. Interleaved approval, generation and results retain original ownership.
- [ ] **E11-AC5 (R5):** Both active rows show their own trailing icon while either/neither is selected. Actual finish/Stop/failure updates only the matching state. Verify long titles, action hover/focus/touch, narrow picker, keyboard/accessibility and reduced motion in rendered UI. Token/metrics updates do not rerender all sidebar rows/root.
- [ ] **E11-AC6 (R6):** While viewing B, new A output/report creates unread; busy+unread coexist. A visible revision-41 ack racing revision 42 leaves 42 unread. Hidden/covered content, an unseen tail while scrolled up and unseen late historical reports remain unread; an actually viewed historical report may clear only its own exact revision. Title/internal/no-op changes do not create false markers; deletion/clear wins late publication/ack and read errors are not all-read.
- [ ] **E11-AC7 (R7):** Ordinary sidebar/new-topic/settings/project/history departure never asks to stop execution. Real manual dirty/pending/conflict guards, explicit Stop and target-specific delete/clear protections remain functional, including after Agent-owned generation is detached from route cleanup.
- [ ] **E11-AC8 (R1/R3/R8):** Close with two runs active; they continue under one retained host. Reopen/repeated launch yields one main window/store/session and original request counts. Explicit Quit closes new admission, signals original owners, retains truthful stop/readback/publication through bounded shutdown, then exits; repeated Quit is idempotent and cold restart dispatches nothing automatically. Timeout/forced cleanup cannot be reported as drained or remote cancellation.

## Dependencies and evidence

Prerequisites are the delivered [E06 capability contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) and [E07 jobs/results contracts](../archive/2026-10/10-15-agent-jobs-results/prd.md). Preserve integration with delivered [E10 MCP](../archive/2026-10/10-15-agent-mcp-integration/prd.md), including exact original stop/status/publication and current private authority. These are actual ordering constraints, not consequences of the task tree.

Current source-backed investigation:

- [Lifecycle/sidebar inventory and confirmed product lifetime](research/lifecycle-and-sidebar-inventory.md).
- [Execution, drafts, generation and sole product/MCP owner](research/product-execution-boundaries.md).
- [Pinned native lifetime, single-instance alternatives and OS evidence](research/native-background-and-single-instance.md).
- [Running projection, publication/read races and report ownership](research/sidebar-running-unread.md).

Original broader inputs remain [host integration](../10-15-desktop-agent-capability-research/research/host-integration-review.md) and [capability comparison](../10-15-desktop-agent-capability-research/research/capability-comparison.md). Current files were investigated against E10 source delivery instead of assuming old line anchors remain current.

## Delivery and boundaries

Each of the four stages receives necessary affected tests, spec updates, changed-scope review and a local commit before continuing under standing owner authorization. Full regression/formal quality/whole-app builds/packaging/installed acceptance run once at the epic batch end; no remote push is authorized. Necessary native hidden-progress feasibility is a scoped runtime probe, not a release build. Any unperformed macOS/Windows acceptance remains explicitly pending.

Preserve one reusable Agent loop, sole ProductStore and exact live authority. No extra application windows, second DB, arbitrary renderer IPC, automatic external-effect replay, OS daemon, browser tab-close guarantee, historical migration/backfill or E12 child-Agent feature. No transient preparation/model-validation text, user-bubble side captions or ordinary success toasts. OS sleep/force termination/renderer destruction are conservative recovery boundaries, not promised continuation.
