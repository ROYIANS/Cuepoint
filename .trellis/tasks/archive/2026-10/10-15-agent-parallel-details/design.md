# E01 technical design: retained conversation and single-shot detail

State: approved and in progress (2026-10-15). Actual single-shot viewing/editing; right-side parallel presentation when space permits; full-width detail in the working surface with Return to conversation when narrow; chat remains mounted/running; no business-detail drawer.

## Source-backed structure

See [focused research](../10-15-agent-experience-desktop-evolution/research/parallel-detail-navigation.md). AppFrame already has a persistent sibling portal host, active-panel arbitration and outgoing departure guards. Its narrow mode currently uses modal overlay semantics. Shot links currently route to an episode grid and trigger the Agent route blocker/cleanup. There is no independent single-shot detail component.

## Presentation and lifetime

1. Extend the existing layout-owned presentation contract to express `docked` and `full-width` workspace details explicitly. Replace the detail host's narrow overlay/backdrop with a working-surface allocation; leave unrelated dialogs and left navigation unchanged.
2. Keep the same portal target, feature subtree and editor owner across width changes. Do not render separate desktop/mobile editors, key by width/updatedAt, or unmount AgentChatPage to display full-width detail.
3. Wide mode leaves chat and detail interactive with independent scrollports. Full-width mode shows the active detail and makes the hidden conversation presentation inaccessible to pointer/keyboard/assistive focus while preserving its React/session/runtime owners. Header/navigation behavior follows normal working-surface navigation, not accidental inherited modal isolation.
4. Return/close restores the existing transcript reading anchor/follow intent, composer draft and sensible opener focus. Responsive resize alone is not editor departure and cannot trigger a discard or stop prompt.
5. Existing task/material/memory/audio/music ContextPanel consumers use the same new no-drawer presentation and need regression coverage. Their domain behavior remains owned by those features.

## Target activation and link policy

- Add a small typed, product-owned detail action for an explicitly owned shot target `{projectId, episodeId, shotId}`. Layout manages presentation; the video feature loads and edits the shot. Agent must not become the shot domain owner.
- Keep canonical hrefs in historical receipts and anchors. Normal click/Enter on recognized supported shot destinations opens details without changing the main route/search, using a one-shot route bypass or disabling `useThreadDeparture`.
- Cover nonmodal tool preview targets, CreatedEntityLinks (flat/collapsed/historical), ordinary generation review/result targets, image provenance/wrap-up targets, and recognized shot links in public Markdown/process text. Use stable publisher-supported Markdown customization; preserve lazy loading, memoized configuration, external links, citations/footnotes and private reasoning boundaries.
- Recognize only the current allowed shot URL shape, including native hash-history representation where present; decode and validate IDs and then validate real ownership through reads. A single-slash internal URL alone is not authority. Unsupported destinations retain their existing explicit navigation behavior until E16 supports them; never pretend an unsupported target opened.
- Preserve canonical copy/open-new-context semantics for modifier/middle activation according to runtime support. Ordinary in-place activation is the new behavior; explicit navigation remains subject to its real departure policy.
- Batch-review modal target handoff and other business entity editor rollout belong to E16. Keep that exclusion explicit: a side portal behind an active modal is inaccessible, so merely swapping its Link is not sufficient. Do not silently discard a batch draft to open the pane.

## Video-owned single-shot content

Create a named video detail entry that accepts an owned target, exposes a local departure contract and lazily composes a single record. It uses the existing shared repository/ProductStore and queries project, episode and shot with an identity envelope even for missing results. Local read errors stay inside the detail surface so a failed detail read does not tear down the running Agent.

Show and edit applicable existing single-shot data: shot number/status, duration, content/notes, category/closeup/sound/emotion/camera fields, scene/character/beat ownership, prop/style relationships and first-frame/last-frame/clip slots. Reuse existing commands and field/media editor machinery. Do not mount the whole episode grid, run its filter-clearing locate effects, or bring bulk/reorder/global table shortcuts into details. Do not invent new business controls for fields that currently have no manual editor.

Reuse ShotTextField/DurationInput and domain field keys/baselines. Extract small existing row controls where needed without importing DnD/viewport context. Preserve immediate-selection semantics for relationship commands and latest-membership handling; staged edits need appropriate baselines. Existing media-specific Dialogs may remain for their independent edit operation, retaining SlotEditSession/DraftMediaSession and exact target/baseline/callback. This task does not ban legitimate operation dialogs or require an inline media-editor rewrite.

## Draft, selection and conflict protocol

- One active editable instance per entity-field; preserve that instance across presentation changes.
- Aggregate text, numeric invalid/pending/error, relationships and media-session state in a synchronous owned departure snapshot. Do not assume a retained debounced text controller covers another child's invalid/pending state.
- Before switching A to B, closing or replacing with another panel, ask the outgoing local editor guard. Keep A active until resolution; a canceled or stale B/C request cannot activate later. Shared host registration arbitration and same-registration entity selection both need coverage.
- Pending writes retain ownership and cannot be discarded before settlement. Failed/unknown outcomes remain readable and recoverable. Use existing changed-field CAS, exact slot baselines and transaction commands; never save a stale entire row.
- If the Agent updates/deletes the selected entity, preserve unresolved drafts under their original identity, show unavailable/conflict state and prevent foreign/stale writes. Viewing current content never changes a frozen approval preview or approves generation.

## Compatibility and rollout

One shared Studio implementation serves browser and native. No database schema migration or second store is planned. Add named integration APIs consistent with vertical feature ownership; avoid broad private UI exports. Update desktop-ui's accepted narrow-detail contract, component/draft guidance and Agent link behavior as implementation lands.

Keep the current route-based workbench available for explicit navigation and unrelated features. Parent E04 owns query identity for switching chat topics; E01 only ensures its own detail queries are scoped. Background Agent ownership, tabs/multiple panes, reordering an episode and universal URL routing are outside E01.

Rollback should revert only the accepted presentation/activation integration after pending edits settle; it must not delete confirmed shot writes, retained drafts or run records. No storage conversion is involved.
