# E01: Agent business details — single-shot delivery

## Goal

Open and edit a real single shot beside the ongoing Agent conversation. In a narrow window, show detail full-width inside the same working surface and return to the still-mounted/running conversation. Opening details must not navigate away, ask to stop, or pause the run.

## Confirmed decisions and facts

- On 2026-10-15 the owner requested no business-detail drawers, right-side parallel detail and no conversation interruption.
- The owner selected full-width working-surface detail with Return to conversation when side-by-side does not fit; the conversation remains mounted and running.
- The owner selected viewing and editing a single shot in the first delivery, retaining existing saving, version conflicts and unsaved-edit protection.
- The owner subsequently limited each child task to necessary affected checks, deferring full regressions, build/packaging and native integration acceptance to the end of the complete batch.
- Research baseline: the host had one stable sibling portal and outgoing-panel arbitration, but narrow mode was a modal drawer (`app/layout/ContextPanelHost.tsx:78`, `app/layout/context-panel.tsx:61`, `ui/theme.css:894`, all under `packages/studio/src/`).
- Research baseline: shot links targeted the episode workbench (`features/agent/runtime/businessStore.ts:267`), triggered the real departure blocker (`features/agent/ui/useThreadDeparture.tsx:45`) and unmount cleanup abort (`useChatExecutionSession.ts:14`). ShotRow and ShotEditorPage own an episode grid and cannot simply become a detail pane.

## Evidence and ownership

- [Focused source report](../10-15-agent-experience-desktop-evolution/research/parallel-detail-navigation.md).
- [Original interaction audit](../10-15-desktop-agent-capability-research/research/interaction-audit.md).
- [Parent requirements](../10-15-agent-experience-desktop-evolution/prd.md) and [delivery roadmap](../10-15-agent-experience-desktop-evolution/roadmap.md).
- App/layout owns host geometry/focus. Video/library own business detail, editing, commands and media sessions. Agent owns its conversation and link integration.

## Dependencies and order

No prerequisite delivery. E01 is the recommended first delivery, followed by E02 Send/recovery. E16 explicitly depends on E01 for other entity editors and modal-source link handoff. E04 separately fixes thread-query identity; it must not be silently bundled here. Coordinate shared Agent/layout files sequentially.

## Requirements

- E01-R1: Replace narrow modal-drawer presentation for the shared business-detail host with full-width in-workspace detail. Preserve the same portal/editor tree and the mounted conversation owner across dock/full-width transitions; expose a clear Return to conversation control.
- E01-R2: Add typed in-place shot activation and cover recognized nonmodal shot links from tool preview/results, ordinary generation review/results, provenance/wrap-up and public Markdown/process text. Keep canonical destinations, external/citation behavior and real route-departure protection.
- E01-R3: Compose a lazy video-owned single-shot detail using the current shared repository/store, identity-tagged project/episode/shot reads and local loading/missing/error handling. Initial inspection must not clear episode filters or mount/scroll the full grid.
- E01-R4: Show and edit the applicable existing single-shot fields, relationship selectors and media slots through existing controls/commands. Preserve touched-field baselines, current membership semantics, SlotEditSession/DraftMediaSession, exact owner/target and visible save/error recovery. Existing media-operation Dialogs may remain; no new whole-episode operations are added.
- E01-R5: Guard A-to-B selection, close, return and replacement before changing editor identity. Aggregate descendant invalid/dirty/pending/error state synchronously. Preserve outgoing drafts on cancel/failure and ignore stale competing completions.
- E01-R6: Keep chat draft, transcript reading/follow intent, run/controller and streaming subscription during detail use. Hidden narrow conversation presentation cannot capture user focus/keyboard shortcuts, but its runtime must remain active.
- E01-R7: Shared ContextPanel consumers (task, memory, material, audio and music detail) follow the new no-drawer responsive presentation without losing their own edits, focus, media or execution sessions.

## Acceptance criteria

- [x] E01-AC1 (R1/R2/R6): During a deterministic real running-chat UI scenario, pointer/Enter activation of every supported nonmodal shot-link surface opens the correct shot without a stop prompt, Agent route/thread/run/controller change, provider duplicate or generation pause. Streaming continues.
- [x] E01-AC2 (R1/R6/R7): At adequate measured width, chat and detail are side by side with independent scrolling. At insufficient width, detail occupies the working surface with no drawer/backdrop; return and resize retain the same editor/session, composer draft and reading position.
- [x] E01-AC3 (R3): Slow, late, missing, foreign and failed detail reads show scoped states without old-target content or teardown of the Agent; inspecting a filtered-out shot does not write episode filters.
- [x] E01-AC4 (R4/R5): Editing current shot data persists through original product commands. Same-field Agent/manual conflict preserves draft and current value; different-field changes merge according to existing contracts. Media sessions keep their frozen target/baseline and cleanup only owned resources.
- [x] E01-AC5 (R5/R7): Dirty/pending/failed shot A, another inspector and rapid B/C requests follow outgoing guards; cancel retains the original editor, pending work cannot be discarded early, and stale confirmation cannot target a later entity.
- [x] E01-AC6 (R2/R6): Canonical copy/modified-link semantics, external links/citations, lazy transcript and memo isolation remain correct. Genuine topic/application navigation still uses the appropriate existing execution/draft protection.
- [x] E01-AC7 (R1-R7): Focused lifecycle/store tests and actual shared UI responsive/keyboard/scroll cases are recorded separately from static/compilation results; shared host consumers are included in regressions. Final native-window acceptance is tracked for the batch integration gate under the owner's subsequent testing-scope instruction.

## Out of scope

- E16 owns other business entity editor rollout and detail transition from batch-review modal dialogs, including preserving their draft and return surface. Keep those existing modal link paths intact until their complete handoff is delivered; do not install an inaccessible right pane behind the modal.
- No background Agent host, multiple tabs/panes, whole-episode grid/bulk/reorder feature, core replacement, second product store, general router bypass or arbitrary internal-URL viewer.
- No global removal of legitimate confirmation, file-picker, left-navigation or media-operation dialogs. No new manual field controls where the product currently has none.

## Planning readiness

Owner decisions and final review are complete. The owner approved starting E01 on 2026-10-15 (“OK，额。下一步考虑开始任务吧”). Only this delivery is activated; the remaining epic children stay in planning.

## Implementation result

E01 implementation and necessary affected verification are complete. See [implementation/review results](./research/implementation-results.md) for exact evidence and remaining batch integration checks. The checked criteria follow the owner-revised per-child validation scope; no final packaged/native acceptance is claimed. Changes remain uncommitted on `codex/agent-parallel-details`.
