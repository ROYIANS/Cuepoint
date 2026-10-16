# E11 current lifecycle and sidebar inventory

Date: 2026-10-16. Source baseline: `eab6c911` after E10 source delivery. This is source inspection and requirement capture, not a background execution or installed-platform acceptance result.

## Confirmed current behavior

| Concern | Current source evidence | Consequence for E11 |
| --- | --- | --- |
| Execution belongs to a React instance | `packages/studio/src/features/agent/ui/useChatExecutionSession.ts:16`, `:25`, `:31` hold one controller, abort on unmount and abort on thread change. | A module/view flag alone cannot provide independent executions; accepted ownership and cancellation must leave this hook. |
| Start/admission is coupled to navigation | `packages/studio/src/features/agent/ui/chatExecutionFlows.ts:91`, `:100`, `:117`, `:131` acquire ownership, navigate, admit and await the real loop. | Separate UI navigation/draft feedback from durable admission and host commands while preserving immediate Send and original admission identity. |
| Thread exclusion already exists | `packages/studio/src/features/agent/runtime/runOwnership.ts:46` uses a per-thread Web Lock, with branded in-memory ownership and actual drain. | Concurrent conversations do not imply two owners in the same conversation. Moving to another runtime requires real common ownership/fencing, not copying a capability or weakening its checks. |
| Execution-only departure modal | `packages/studio/src/features/agent/ui/useThreadDeparture.tsx:52`, `:90`, `:98`, `:103`; callers at `AgentChatPage.tsx:224`, `:232`, `:340`. | Remove the stop-to-leave UX together with its route/local automatic abort paths. Do not merely change the modal text or remove rendering. |
| Generation work also follows the view | `packages/studio/src/features/agent/ui/AgentChatPage.tsx:138` pauses generation/audio batches on thread cleanup and pagehide. | Inventory all model/tool/job/generation owners so ordinary departure does not silently pause part of an accepted execution. External unknown/no-replay guarantees remain. |
| Transport follows page lifetime | `packages/studio/src/platform/runtime/runtimeFetch.ts:25`, `:30` abort native waits on pagehide/beforeunload. | Decide which requests belong to a long-lived host and which remain ordinary page requests; do not globally disable lifecycle cleanup. |
| Product store and MCP are currently renderer/session bound | `packages/studio/src/platform/product/store.ts:21`, `:24`, `:39`; `apps/desktop/src-tauri/src/desktop.rs:90`, `:1887`, `:1893` close the product on main-window destruction and invalidate native resources on page-load start. | Window destruction/reload needs explicit product/MCP authority and service-lifetime design. A hidden window or a sidecar by itself does not establish these guarantees. |
| Sidebar has no per-conversation execution/read inputs | `packages/studio/src/features/agent/ui/TopicSidebar.tsx:53`, `:246`, `:290` accept threads and render title/time/actions without a running/unread projection. `packages/studio/src/features/agent/models/chat.ts:11` has no read cursor. | Add a shared typed state projection for all rows and design acknowledgement against actual answer revisions. Do not infer running/unread from selection or generic modification time. |
| Unsaved-editor departure has a separate owner | `packages/studio/src/app/drafts/useManualDraftGuard.tsx:18`, `:63`, `:161`. | Preserve this protection when removing execution-only blocking. Destructive deletion/clear also remains a separate operation. |

## Product intent resolved so far

- The owner's screenshot places a compact loading indicator after the conversation title at the trailing edge of the sidebar row.
- Running and unread indicators, concurrent independent conversations and removing stop-before-leaving are mandatory E11 outcomes. These are no longer optional follow-ups or E12 work.
- Keep one active execution owner within a conversation; Stop/approval/output must target the original conversation/run rather than whichever page is currently selected.
- macOS and Windows are both in scope, desktop is primary, and compatible Web behavior should share the product implementation.
- Necessary stage checks and stage commits continue; full builds/packaging/installed-platform gates remain in the epic's final batch.

## Lifetime decision confirmed on 2026-10-16

After the main session proposed keeping the application running on window close and ending the managed host only on explicit Quit, the owner answered: “是的，需要支持桌面端后台运行，且不支持多开窗口”.

- Ordinary conversation/page navigation detaches a view without cancelling accepted work.
- Closing the desktop product window keeps the application and its owned executions alive in the background.
- Reopen/repeated launch must return to the existing application and one product window, not open another store/host/window.
- Explicit application Quit ends managed execution; a later cold startup reconciles persisted records without blind external/model/tool replay.
- There is no user request for an app-exit daemon, survival after actual process death, or continued execution while the machine sleeps. Those mechanisms are outside this E11 lifetime choice.

Runtime and single-instance mechanisms are engineering choices to justify in the technical design. A retained sole main WebView with an application-level execution service is being compared against independently running JS/Node hosts. Do not claim hidden-window scheduling, remote-effect cancellation, restart continuation or a package-size measurement without corresponding evidence.

## Acceptance shape to carry into implementation planning

Use held deterministic operations in two actual conversation flows to verify concurrent progress, selection changes, route/history transitions, per-run Stop and approval isolation. Render the real sidebar with running plus unread states, including new updates arriving during read acknowledgement. Verify that a subscription/read event cannot mark a newer unseen revision read and that dirty editor protection still works. Add actual native process/window/reconnect cases only for the lifetime the owner selects; report source, deterministic UI/native and installed-OS results separately.
