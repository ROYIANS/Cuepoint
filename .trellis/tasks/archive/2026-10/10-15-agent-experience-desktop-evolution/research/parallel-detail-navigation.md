# Research: Agent links opening real details beside the conversation

- Query: Identify the existing right-pane host, the cause of stop-conversation confirmation on shot links, reusable single-shot detail/editing boundaries, and the lifecycle/accessibility requirements for continuous Agent work.
- Scope: internal; source and installed dependency inspection only, planning rather than implementation.
- Date: 2026-10-15
- Task: `10-15-agent-experience-desktop-evolution`. This report supplements the earlier `10-15-desktop-agent-capability-research/research/interaction-audit.md` rather than repeating its general audit.

## Findings

### 1. Confirmed product decisions and delivery boundaries

The parent task records the user's requirement: clicking a business entity such as a shot in Agent opens its actual details in the existing right-hand parallel area, with the conversation, composer draft, reading position and execution owner preserved. Merely viewing an entity must neither navigate to its main page nor ask to stop the conversation.

**Additional decision confirmed by the user through the parent session during this research:** when the window cannot accommodate parallel columns, switch to a full-width detail view **inside the working surface**, retain the mounted/running conversation, and provide a return-to-conversation action. Do not use a drawer or dimming backdrop. This replaces the earlier unresolved narrow-window question.

**The user also confirmed that the first delivery supports viewing and editing one shot**, reusing existing single-shot field/relationship/media editing, saving, version-conflict and unsaved-draft protection. It is not a read-only delivery. Confirmation dialogs and media-specific editing Dialogs retain their independent purposes; “no business-detail drawers” does not require deleting those dialogs or rebuilding media editing inline.

These are requirements, not descriptions of current behavior. Current `ContextPanel` already supplies the wide-window sibling portal and arbitration, but its narrow presentation is a modal overlay. Reusing it without changing that mode does not satisfy the confirmed decision.

The parent session has assigned the boundaries as follows:

- **E01:** shared ContextPanel docked/full-width presentation replacement, core Agent shot entry points and the first real single-shot editor. Include existing ContextPanel consumers in shared-mode regression scope. Do not add whole-episode bulk/reorder/create/delete workbench operations.
- **E16:** extend parallel details to other business entity types and integrate target links originating inside source modals, retaining the source editing session/draft and its explicit return path. This is planned follow-up coverage, not silently implied complete in E01.
- Left application/topic navigation, approval dialogs, reference viewers and native file pickers have distinct purposes. Keep their existing purpose-specific behavior unless the respective child explicitly changes it.

Use local selection/presentation as the smallest design fit. Any optional URL/history representation must preserve the Agent pathname and thread owner and account for the current blocker examining all router attempts. This is an implementation design point, not another product-preference question. Both user-facing decisions above are resolved; no further question is needed for this report.

### 2. Files found and actual owners

All source anchors are repository-relative; later sections give field/link-specific anchors.

| File | Responsibility |
| --- | --- |
| `packages/studio/src/app/layout/AppFrame.tsx` | Persistent right sibling DOM host and working surface. |
| `packages/studio/src/app/layout/ContextPanelHost.tsx` | Single active panel, replacement protection and measured docking. |
| `packages/studio/src/app/layout/context-panel.tsx` | Feature-controlled stable portal and current modal narrow mode. |
| `packages/studio/src/features/agent/ui/AgentChatPage.tsx` | Conversation execution/draft owner and thread workspace. |
| `packages/studio/src/features/agent/ui/useThreadDeparture.tsx` | Route departure confirmation; session cleanup is in `useChatExecutionSession.ts`. |
| `packages/studio/src/features/video/ui/ShotEditorPage.tsx` | Whole-episode grid; no standalone single-shot detail found. |
| `packages/studio/src/features/video/ui/ShotTextField.tsx` | Existing field-specific draft/CAS adapter. |
| `packages/studio/src/app/drafts/useManualDraftGuard.tsx` | Dirty/pending local replacement, route and unload protection. |

Other source owners, link entry points, reusable editing components and tests are enumerated in Sections 4–9 with their actual paths/anchors.

### 3. Why a shot click currently asks to stop

The supported source path is:

1. `businessStore.navigation("shot", row)` produces `/p/{projectId}/e/{episodeId}/shots?shot={id}` (`businessStore.ts:267`). Generation receipts/previews use the same shape (`features/video/agent/generationRuntime.ts:64`); `generationTargetDestination.ts:4` returns the typed route/search form.
2. `AgentRunDetails.tsx:151`, `CreatedEntityLinks.tsx:71`, `:110`, `:112` and generation surfaces render ordinary TanStack `Link` navigation.
3. `AgentChatPage.tsx:176` installs `useThreadDeparture(activeThreadId, runs)`. Its `shouldBlockFn` does not distinguish viewing details from departure (`useThreadDeparture.tsx:45`). An active run therefore produces the stop-and-leave dialog (`:83`). The predicate also holds interrupted/failed runs with tool work (`models/agentToolSelection.ts:11`), so “active” is broader than streaming alone.
4. If navigation succeeds, the Agent route is left. Execution-session cleanup aborts its controller (`useChatExecutionSession.ts:14`); the page also pauses image/video and audio generation on effect cleanup (`AgentChatPage.tsx:110`).
5. The destination renders the entire ShotEditorPage, focuses/highlights a grid row, and may **persistently clear the episode's shot filters** to reveal it (`ShotEditorPage.tsx:254`). This is locate-in-workbench behavior, not detail inspection.

**Implication:** preserve the Agent route/thread/owner and make supported detail activation a selection/presentation action. Do not solve this by globally disabling `useThreadDeparture`, calling its one-shot bypass for details, or pretending actual route departure can keep running. Real topic switches, new/delete topic actions and application navigation retain their existing protection unless a separate background-execution requirement changes it.

The earlier audit's unscoped predicate concern remains separate: `activeRef.current = (runs ?? []).some(runBlocksThread)` is not thread-filtered (`useThreadDeparture.tsx:29`), while transcript/workspace props are filtered (`AgentChatPage.tsx:725`). A detail pane does not fix topic-query identity; keep that child task distinct.

### 4. Reuse the actual right-pane host; extend its presentation contract

`AppFrame.WorkingSurface` renders main content and `.app-context-panel-host` as siblings (`AppFrame.tsx:219`). React context and feature callbacks follow the portal; the DOM host owns no queries, mutations or execution. The host reserves width only when an active pane is docked (`:222`). The current threshold is measured **working-surface width** ≥ active module-navigation width + requested pane width + 480 (`ContextPanelHost.tsx:78`). It is not a fixed viewport breakpoint. A default 400px pane plus 260px topic navigation requires a 1140px working surface; collapsing navigation changes that calculation.

`ContextPanel` registers a feature's stable ID/width/depart/close callbacks (`context-panel.tsx:51`). The active editor subtree stays in one portal target across resizing (`:95`, `:99`); docked mode uses `role="complementary"`, leaves main content interactive and does not trap focus (`:99`, `:128`). Existing users include task inspection, memory context, material details, audio inspection and music details.

The complete existing ContextPanel consumer list found in current source is:

| Existing consumer | Pane width | Existing departure owner |
| --- | --- | --- |
| `features/agent/ui/TaskInspector.tsx:240` | 400 default | Aggregated task/records/wrap-up manual drafts and pending lock. |
| `features/agent/ui/MemoryContextDetails.tsx:112` | 400 default | Rejects close/replacement while exclusion mutation is locked. |
| `features/library/ui/materials/MaterialDetailPanel.tsx:76`, `:166` | 400 default | Missing/loading presentation; material editor's manual draft guard and active/requested selection. |
| `features/audio/ui/AudioWorkspacePage.tsx:251` | 320 | Rejects close/replacement while its action is pending. |
| `features/music/ui/MusicWorkspacePage.tsx:196` | 300 | Rejects while work action or generation submission is pending. |

Current narrow mode differs from the approved behavior in four concrete ways:

- `overlay: !host?.docked` (`context-panel.tsx:61`).
- Fixed full-viewport edge positioning plus dimming backdrop (`theme.css:894`, `:904`).
- `role="dialog"`, `aria-modal`, trapped focus and outside-pointer blocking (`context-panel.tsx:99`, `:108`, `:128`).
- AppFrame makes main content, header and rail inert while this overlay is active (`AppFrame.tsx:125`, `:164`, `:192`, `:220`).

**Required design change:** represent full-width workspace detail as a real presentation mode instead of reusing the existing overlay boolean. Keep one stable feature/editor owner and portal target; hide/isolate the conversation's presentation without unmounting its runtime/draft/transcript. Provide a named detail heading and “返回对话” action within the working surface. Return restores usable conversation focus and its prior reading position. Exact landmark/focus policy belongs in design; modal semantics and a screen-wide backdrop must not remain as accidental carryovers. Width transitions must preserve the same manual editing session and playback owner.

E01 owns the shared ContextPanel mode change and regression coverage of the listed consumers. This does not claim that all independent Dialogs or left navigation have also been redesigned.

### 5. Real shot details: read versus edit reuse

No standalone `ShotDetailPage`/`ShotDetailPanel` was found. The canonical Shot model includes shot number/status/order, duration/content/notes, category/closeup/sound/emotion/camera fields, scene/characters/beat, props/style and firstFrame/lastFrame/clip (`features/video/models/shots.ts:109`). A detail view must show the actual selected record and meaningful owner context, not only the tool's short summary or a frozen preview.

| Boundary | Existing reuse | Cost / constraint for the new detail flow |
| --- | --- | --- |
| Current record display | Shot model/normalizers, `shotRelations`, `MediaPreview`, current query/store contracts | Foundation of the editable detail. Fetch project+episode+shot under explicit readonly context; verify all ownership and return identity-tagged loaded/missing/error. No need to fetch/mount every shot or clear episode filters. |
| Text fields | `ShotTextField` supports shotNumber and `TextShotField` (`shotColumnFields.ts:5`): content, notes, category, sound, emotion, cameraAngle, cameraGear, focalLength, sceneCloseup | Direct reuse preserves `shot:{id}:{field}` keys, field baselines, autosave, status/retry/latest. Aggregate pending/error status into the local pane selection/close guard before replacing an editor. Do not key by updatedAt or whole row. |
| Duration | `DurationInput` | Existing numeric baseline and draft controller are usable. Invalid raw text is local UI state; this component does not expose parent status. Explicitly account for invalid/pending/error on switching details instead of assuming text-field retention covers duration. |
| Status, scene and character membership | Current controls live inside `ShotRow`; commands are `patchShot`, `setShotCharacterSelected` | Reuse domain commands and extract only the relevant presentation. Preserve latest-membership intent for characters (`shots.ts:150`), exact owner guards and visible errors. Do not copy/rewrite transactional rules in Agent/layout. |
| Props/style | `ShotRelationsEditor` | Reusable small form, but its save calls `repository.patchShot(shot.id, patch)` without a baseline (`:41`). Existing semantics are immediate selection, not the text/slot frozen-baseline protocol. Aggregate saving/error state; if introducing manual staged edits, explicitly adopt appropriate field baselines. |
| Current media viewing | `MediaPreview` with `inspect`; shot slot result/reference/prompt data | Direct reusable viewing. Media reads expose unavailable/corrupt states; metadata alone does not prove native bytes exist. Video controls must not be nested inside a link/button. |
| Editing firstFrame/lastFrame/clip | `EditableGenerationSlot` → `GenerationSlotEditor`, `SlotEditSession`, `DraftMediaSession`, `setShotSlot` | Reuse the existing dedicated media-edit Dialog (`GenerationSlotCard.tsx:355`, `:545`), including frozen session, uploads/reuse, save/conflict/cancel cleanup and parent open/pending protection. This Dialog is permitted by the confirmed decision; no inline form extraction is required for E01. |
| Entire `ShotRow` | Shared field bindings only | Not an appropriate detail container: requires `useSortable`, viewport context, grid columns, insert/move/duplicate callbacks and fixed 160px height (`ShotRow.tsx:158`, `:173`, `:191`; `shotColumnFields.ts:24`). |
| Entire `ShotEditorPage` | Existing main workbench remains canonical | Not appropriate inside a 400px pane: episode-wide queries, filters, DnD, bulk controls, keyboard and DOM locate effects. Reusing it would also introduce unrelated filter writes during inspection. |

Normal `useVideoWorkspaceRepository()` returns the shared repository singleton, not a provider belonging only to WorkspaceChrome (`workspaceRepository.tsx:920`, `:931`). App can compose a video-owned detail entry under the existing Agent surface; the Agent should not become owner of shot schemas or mutation code. `feature-organization.md` requires named reviewed cross-feature APIs rather than broad publication of private UI modules.

**Minimum E01 reuse checklist:** display the selected shot and project/episode context; reuse all ten existing text fields (shot number plus the nine TextShotField values), status and duration; reuse scene/character selections and props/style relations; expose first-frame/last-frame/clip previews and their existing dedicated editing Dialogs. Use existing patchShot/setShotCharacterSelected/setShotSlot operations, exact field/slot baselines and current retry/latest/cleanup. Beat/order can remain visible context; adding whole-episode operations is outside this single-shot editor. This is composition of existing editing capabilities, not a request to replace them with new persistence or staging machinery.

Text/duration saves use touched-field baseline checks in the real transaction (`shots.ts:136`). Concurrent Agent writes to a different field can merge; same-field third-value conflicts must preserve the draft and expose recovery. Media editing must retain the frozen owner+entity+slot identity, baseline and callback in `SlotEditSession` (`slotEditSession.ts:9`), stage/clean only session-owned media, and use `setShotSlot` with the baseline. An inspected or edited live entity must never rewrite a historical approval preview or authorize a new generation request.

### 6. Typed targets, link coverage, history and accessibility

Existing typed targets are already sufficient to avoid rebuilding identity from hrefs where structured data is available:

- `ProductionTarget` (`features/video/models/production.ts:5`) is a discriminated union of shot, character, scene, prop and style. Shot includes `projectId`, `episodeId`, `entityId` and optional `ShotPictureField` slot; asset variants include project/entity and typed slot. Jobs and batch baselines already carry this type.
- `BusinessKind` (`features/agent/runtime/businessStore.ts:17`) includes project, episode, beat, shot, character, scene, prop, style and media. `OwnedBusinessRecord` (`:26`) discriminates the row by kind; `readBusinessRecord` validates owner/episode through its explicit store (`:80`).
- `AgentToolPreview.target` remains only `{label, href}` (`features/agent/models/agent.ts:48`), and completed result links are parsed from stored JSON. Those historical paths need bounded URL recognition; do not force a write-result schema migration to open existing links.
- ContextPanel registration is presentation identity only (`id/width/depart/close`), not a business-entity union. Do not put video records or mutations into the layout coordinator.

Changing CreatedEntityLinks alone misses several currently reachable shot links.

| Surface | Current source | Required coverage decision |
| --- | --- | --- |
| Tool preview target | `AgentRunDetails.tsx:151` | Core coverage; may be clicked during running or waiting approval. |
| Completed write results, single/collapsed/flat | `CreatedEntityLinks.tsx:71`, `:110`, `:112` | Core coverage including old persisted hrefs; preserve quiet disclosure and 20-item bound. Task records reuse this component (`TaskRecords.tsx:222`). |
| Generation confirmation target | `GenerationReview.tsx:139` | Core shot view; opening target must preserve in-progress proposal edits and must not approve or generate. |
| Single generated result | `AgentGenerationResults.tsx:43` | Core shot view; typed target available directly. |
| Batch draft and comparison targets | `AgentGenerationBatches.tsx:342`, `:368` | E16 modal-source integration; retain source draft and return path, described below. |
| Project image provenance | `ProjectImageSources.tsx:13` | E01 recognized nonmodal shot links; E16 other entities. Preserve historical source availability versus current detail availability. |
| Task wrap-up outcome source | `TaskWrapup.tsx:87` | E01 recognized nonmodal shot links; E16 other entities. Preserve stored evidence hrefs. |
| Markdown body/process/reasoning | `MessageList.tsx:35`, `:187`, `:199`; `AgentRunDetails.tsx:23`, `:280`; `ThinkingPanel.tsx:6` | Currently only `{variant: "chat"}`, no application anchor handler. E01 core shot hyperlink coverage includes ordinary recognized shot URLs in prose; E16 extends other entity kinds. |
| Saved-result summary | `AgentWriteOutcomes.tsx:24` | “查看记录” currently calls activity `reveal` to show the originating call; it is **not** an entity link. Preserve this meaning; its subsequent target link opens the entity. |
| Other destinations | Memory/project continuation/settings/external web links | Keep intentionally distinct. “在此项目继续创作” creates/navigates to a thread (`CreatedEntityLinks.tsx:18`); it is not a passive detail click. |

Stored targets currently contain href/label, and `CreatedEntityLinks` accepts any single-slash internal href. Recognition must therefore be bounded to supported entity URL shapes and valid decoded IDs, with explicit unavailable/unsupported behavior; a local-looking path is not sufficient authority to render a foreign record. Preserve canonical hrefs for copy/open-in-new-tab and historical data; do not rewrite completed receipts or infer success from navigation labels.

Installed `@lobehub/ui` 5.47.1 supports `components`/`componentProps` on Markdown. Its default anchor goes through `mdx/mdxComponents/Link.mjs:7`, then `A/index.mjs:7`; ordinary relative hrefs become native anchors, while http links use `_blank`. `LobeChatTheme.tsx:31` supplies no `aAs` override, and no application `aAs` was found. **Thus raw Markdown links are not equivalent to TanStack links and may perform document navigation rather than pass through the same blocker.** Native route URLs use hash history, so they need the same explicit recognized-target handling. These are installed-code facts, not a runtime assertion. Keep citation/footnote handling and external web behavior when adding supported target handling; don't replace every anchor indiscriminately.

Use a real accessible anchor with the canonical destination, or a clearly labeled native button for an action-only affordance. Ordinary click/Enter on a supported link should select details; preserve modifier/middle-click/copy semantics according to the reviewed design and prevent the ordinary click's main-route navigation. Label the opening destination and expose a heading/close-or-return control. Arrow glyphs alone do not explain whether an action opens another page or the parallel details. Keep memoized Markdown configuration and lazy MessageList loading; selection must not remount every historical body or eagerly pull video editor code into an empty chat.

**Important E16 integration case:** the two batch target links are inside a modal `DialogPrimitive.Content` (`AgentGenerationBatches.tsx:274`). Its local draft and pending save block close (`:249`) and route departure (`:184`). Simply changing its link callback to open an external right-pane portal leaves that pane behind the source dialog's modal focus/inert boundary. E16 must provide an intentional detail transition/return path that retains the batch editing session and draft, for example suspending/hiding the source modal presentation while keeping its owner mounted and restoring it on return. It must not silently discard the batch, destroy its session, leave the detail inaccessible, or call route blocker bypass. Merely adding a new right-pane link is not complete E16 acceptance. The batch review Dialog can retain its independent purpose; conversion into the context-pane registration is not required.

**E01 link checklist:** recognized nonmodal shot links in tool previews, CreatedEntityLinks flat/collapsed/single modes and TaskRecords, GenerationReview, single generation results, ProjectImageSources, TaskWrapup and message/activity/reasoning Markdown. **E16:** other entity types on these surfaces, batch draft/comparison modal handoff and non-Agent rollout. E01 must not claim every business link has been converted.

### 7. Single-pane arbitration and draft protection

The existing host provides useful guarantees (`ContextPanelHost.tsx:52`):

- One active registration at a time. Ask the outgoing `depart(proceed, cancel)` before close/activate.
- Retain outgoing ownership during confirmation, reset a canceled incoming opener, reject competing requests and ignore obsolete acceptance after unregister/cancel.
- Close via ContextPanel also delegates to its feature's departure callback (`context-panel.tsx:62`). A clean read-only inspector can proceed immediately.

**Limit:** the host sees registration IDs, not the selected business entity. `request` returns immediately for the already active ID (`ContextPanelHost.tsx:53`). Shot A → B inside a single shot-detail registration needs an explicit local selection guard. Keying the editor by B before asking would destroy A's draft. Follow the existing MaterialDetailPanel retained active/requested ID pattern (`MaterialDetailPanel.tsx:53`) or TaskInspector retained owner/session pattern (`TaskInspector.tsx:73`), preserving pending-lock and cancellation behavior.

`useManualDraftDeparture` reads synchronous owned state, can guard a local replacement without routing, disallows discard while pending, awaits cleanup before departure and reports cancellation back to the host (`useManualDraftGuard.tsx:74`, `:102`, `:125`). Continue restores focus/selection/scroll. It does not automatically know a descendant's draft: parent must aggregate every editable child status and establish pending synchronously. TaskInspector does this for its children (`TaskInspector.tsx:149`, `:161`); memory details explicitly reject replacement during their pending mutation (`MemoryContextDetails.tsx:112`).

`useDebouncedDraft` retains controllers by project+entity-field and flushes at cleanup/unload (`drafts.ts:234`, `:282`). This is reuse of one protocol, not guaranteed disk durability or an excuse to hide unresolved errors on pane replacement. Mounting the same editable field twice with the same retained key can make both consumers resume the same controller/status callback; prefer exactly one active editable presentation of a selected field and preserve that subtree across wide/full-width modes.

Missing/removed entity handling must distinguish initial not-found from an already assigned dirty session. Initial invalid owner/ID shows missing with no mutation controls. If the Agent deletes or changes an open entity, retain only the matched editing context needed for readable drafts, mark it unavailable and disable writes until the user resolves/discards them. Query envelopes include owner/entity even for `null`; stale A data cannot render as B or become B's save callback (`hook-guidelines.md:49`). Use explicit query error recovery so a failed side-detail read does not tear down the running Agent through the root error boundary; `useProductQuery` currently throws errors (`platform/product/queries.ts:45`), while `useProductQueryState` exposes errors and retained values.

### 8. Proposed requirements and observable acceptance

These are child-task acceptance proposals derived from confirmed intent and source constraints, not claims of implemented behavior.

| Scenario | Observable expected result |
| --- | --- |
| Running response; shot preview/result/prose link clicked or Enter-activated | Correct shot opens beside chat; route/thread/run unchanged; no stop dialog/abort/pause/duplicate request. Tokens and saved steps continue. |
| Reading old transcript with composer text/attachments | Opening/closing preserves composer, transcript node and reading/following intent; width reflow does not jump to bottom. |
| Narrow/short workspace | Full-width detail inside work surface; reachable 返回对话, no drawer/backdrop; return preserves mounted chat/drafts/run/reading. |
| Resize parallel/full-width while editing/playing | Same editor/DOM/session survives with draft, caret, baseline, pending operation and playback. |
| Task/memory inspector already open | Clean replacement proceeds; dirty/pending protection stays. Cancel retains outgoing pane; stale incoming request cannot reopen. No conversation-stop dialog. |
| Edit A then request B/C/close/return | Guard precedes identity change; no cross-shot save or pending discard. Failure retains draft/recovery; rapid-click policy is deterministic. |
| Late A read after B; missing/foreign/deleted/read-failed target | Scoped loading/missing/error; no A-as-B or cross-owner writes. Pane failure leaves Agent running; scoped retry. |
| Manual edit concurrent with Agent write | Different fields merge; same-field conflict preserves draft/current row and retry/latest. No whole-row autosave. |
| Inspect target while approval/proposal waits | No approve/send/reject/frozen-preview change; approval still validates exact scope and revision. |
| E16 batch-modal target link | Detail is visible and keyboard reachable; batch local edits remain mounted/retained; explicit return restores the initiating batch surface. No inaccessible pane behind modal content. |
| Unsupported/external URL, citation, modified click | Preserve reviewed fallback/citation/external/copy semantics; arbitrary paths are not entity authority. |
| True topic/application/Back departure | Conversation/draft protection remains; detail opening never disables or consumes it. |
| Inspect a shot hidden by workbench filters | Show the shot in details without modifying episode filters or mounting/scrolling the main grid. |

Behavioral tests should exercise the actual link entry points, retained owner and real store failure/concurrency callbacks. Existing coordinator tests cover cancel/competing/stale registration cases; DOM tests cover stable portal/editor node and focus across current dock/overlay modes (`tests/contextPanelCoordinator.test.ts:23`, `tests/contextPanelDom.test.ts:44`). They do not prove the new full-width mode or an Agent run survives detail activation. Add focused integration evidence for those behaviors during implementation, plus real-window keyboard/scroll/modal-source and short-window checks. No app/tests/install were run here.

### 9. Related specs and external/version references

Read the relevant sections of these canonical specs (large files may need chunked reading):

- `.trellis/spec/frontend/desktop-ui.md`: stable host, measured allocation, ownership, scroll/focus; amend the narrow-modal detail contract for full-width mode.
- `.trellis/spec/frontend/agent-activity-ui.md`: quiet preview/result links, mounted batch review, reachable approvals and activity reveal.
- `.trellis/spec/frontend/chat-performance.md`: scroll/following owner, memoized Markdown, lazy MessageList.
- `.trellis/spec/frontend/hook-guidelines.md`: owner-tagged query envelopes including null, explicit transaction context, local selection guard and DB-only awaits.
- `.trellis/spec/frontend/agent-execution.md`: real-departure confirmation and exactly-once navigation; do not bypass it for details.
- `.trellis/spec/frontend/state-management.md` A04/B01/D08: frozen target/baseline, touched-field CAS, retained missing-target drafts and text/slot lifecycle.
- `.trellis/spec/frontend/video-workspace.md` and `feature-organization.md`: shared repository/commands/ProductStore and named cross-feature UI contracts.

Installed versions inspected: `@lobehub/ui` 5.47.1, TanStack Router 1.170.38, React 19.3.0. Declaration ranges are in `packages/studio/package.json:54`, `:69`, `:80`; these environmental observations introduce no dependency pin. No external network docs were accessed. Markdown behavior/customization was read from installed publisher code under `packages/studio/node_modules/@lobehub/ui/es/`: `Markdown/Markdown.mjs`, `hooks/useMarkdown/useMarkdownComponents.mjs`, `mdx/mdxComponents/Link.mjs`, `A/index.mjs`. Do not copy vendor renderers into product.

## Caveats / Not Found

- Research only; this report is the only written file. No source/spec/metadata changes, git operations, app/test/build/install or remote calls. Existing tests were read, not run.
- No standalone shot detail component exists; compose a video-owned single-record editor. The route/blocker/cleanup path is source-backed, but actual focus, latency and packaged Tauri behavior need implementation acceptance.
- Both user decisions are resolved: editable single-shot details and narrow full-width workspace switching. E01 owns shared mode/core shots; E16 owns other entities/modal-origin integration. Purpose-specific media/confirmation Dialogs remain.
- Background or closed-window execution, a multipane framework, universal dialog replacement and a new persistence owner are outside this finding. The requirement is to retain the existing Agent during in-workspace detail viewing.
