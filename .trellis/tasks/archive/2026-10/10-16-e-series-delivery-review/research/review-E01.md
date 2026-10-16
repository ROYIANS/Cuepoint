# Review E01 – agent-parallel-details (5f8b6ab0)

Reviewer: read-only. Code reviewed on `codex/agent-background-host` (E16 has since refactored `app/details/*`; line refs are current HEAD).
Targeted tests run: `shotDetailPanel, shotDetailQueryLifecycle, shotDetailTarget, contextPanelCoordinator, contextPanelDom, e01ManualDraftDeparture, businessDetails` → 7 files / 60 tests pass [test].

## Verdict
Core design (single stable portal, lazy video-owned `ShotDetailPanel`, identity-tagged query, synchronous draft aggregation, guarded A→B/close) is sound and well tested at the unit/jsdom level. The headline ACs that need a real layout/running chat (AC1, AC2, AC6 part, AC7 "actual UI") rest on a standalone Chromium script that is **not part of `vitest`/CI**, so they are only claim-backed here. No P0. No P1 functional gap found. Several P2/P3.

## AC map
| AC | Status | Evidence |
| --- | --- | --- |
| AC1 running chat + every shot-link surface opens in place, stream continues | Partly met | Surfaces wired [code]: `AgentMarkdown.tsx:7-9`, `AgentRunDetails.tsx:158`, `GenerationReview.tsx:140`, `AgentGenerationResults.tsx:44`, `TaskWrapup.tsx:93`, `ProjectImageSources.tsx:14`, `CreatedEntityLinks.tsx:72,111,113`. "Streaming continues / no provider duplicate" only in `tooling/agent-parallel-details-browser.mjs` (manual, not in `npm test`) [claim-only]. |
| AC2 side-by-side vs full-width, same editor/session, return, resize | Partly met | Docking math `ContextPanelHost.tsx:78-79`; single portal subtree `context-panel.tsx:122-150`; DOM identity/caret/focus tests `contextPanelDom.test.ts:62,96,119,127,139` [test] but jsdom has no real geometry — width thresholds, independent scroll, hidden-composer paint only in screenshot review [claim-only]. |
| AC3 slow/late/missing/foreign/failed reads, no filter write | Met | `ShotDetailPanel.tsx:135-158` (key-tagged result, ownership check line 145, `matched===null` → missing, retry); `shotDetailQueryLifecycle.test.ts:75,93,119`, `shotDetailPanel.test.ts:130,199` [test]. No `filters` import in panel [code]. |
| AC4 edits via original commands; conflict semantics; media frozen target | Met (unit) | Text/duration through `ShotTextField`/`DurationInput` (existing controllers); `shotDetailPanel.test.ts:143,180`; media via `EditableGenerationSlot` with `setShotSlot(..., baseline)` `ShotDetailPanel.tsx:236-239`. Media sessions have no test in the panel suite (only the open-state wiring `:94`) [code]. |
| AC5 dirty/pending guard, A/B/C, stale confirmation | Met | `ShotDetailPanel.tsx:62-103` (`switching` latch, "busy" refusal), `shotDetailPanel.test.ts:76,94,163`; host arbitration `ContextPanelHost.tsx:52-77`, `contextPanelCoordinator.test.ts` [test]. |
| AC6 canonical/external links, Genuine nav protected | Partly met | Parser `shotDetailTarget.ts:9-26` + tests `shotDetailTarget.test.ts`; modifier/`download` bail-out `BusinessDetails.tsx:176`. Departure protection for real navigation is pre-existing (`useThreadDeparture`); not re-tested here. |
| AC7 records lifecycle vs static separately | Partly met | `research/implementation-results.md` does separate them and is honest that earlier counts are not summed. But "24/24 browser scenarios" evidence points to a deleted `/var/folders/...` tmp dir — not reproducible artefacts [claim-only]. |

## Findings

### P2-1 Selection controls bypass the field/baseline contract the PRD requires (R4/AC4)
`ShotDetailPanel.tsx:207-230`: status, scene, and character checkboxes call `repository.patchShot(...)` / `setShotCharacterSelected(...)` directly, with no baseline/expected-value; text fields and slots do carry baselines. Last-writer-wins on a single field is probably the existing grid semantic, but there is no test for a concurrent Agent change to `status/sceneId` while the pane is open (the conflict test `shotDetailPanel.test.ts:180` covers text only). Either document that these are intentionally unconditional or add a test. Also a failed selection leaves `selection` reported `dirty:true` (line 192) while the control re-reads the DB value, so the UI can show the stored value yet block departure until the user clicks 放弃 — acceptable but surprising.

### P2-2 Detail provider lifetime is the Agent page, not the thread
`AgentChatPage.tsx:60-62` mounts `ShotDetailsProvider` once per page; `_studio.agent.tsx:15` changes `threadId` without keying. An open shot pane therefore survives switching thread inside Agent (and is lost on leaving `/agent`, including by link-clicks to unrelated routes, which unmounts `ShotDetailPanel` via provider teardown with only the route departure guard to protect drafts). Behaviour is defensible but not stated in PRD (R6 speaks of the conversation not the pane); add a test or a one-line spec note. Same applies to the E11 background host: detail state is not retained across Agent route re-entry.

### P2-3 Responsive/side-by-side ACs have no automated test in the suite
Docked/full-width threshold, independent scroll, `inert` conversation + hidden paint (the opacity fix listed as defect 4 in `implementation-results.md`) are only asserted by `tooling/agent-parallel-details-browser.mjs`, which `package.json` `test` does not run. A CSS regression (`ui/theme.css`) would not be caught. [claim-only]

### P3-1 `data-unsaved-fields` reads a ref during render (`ShotDetailPanel.tsx:127`) so it can lag one render behind `entries`; harmless today (diagnostic only) but misleading if a test/selector relies on it.
### P3-2 Stale text in archived PRD: "Changes remain uncommitted on codex/agent-parallel-details" (prd.md, Implementation result) though 5f8b6ab0 is committed.
### P3-3 Scoped ESLint left 60 complexity/nested-ternary warnings (implementation-results); `ShotDetailFields` (`:172-243`) is a ~70-line JSX function with 3 inline async closures; consider splitting.
### P3-4 `ShotDetailPanel.tsx:73-76`: re-open of the same target sets `active` without any departure check — fine, but the new `request.id` outcome relies on the `onPresented` layout effect (`context-panel.tsx:102-104`) re-firing; covered by `contextPanelDom.test.ts:50`, not by a same-target re-open test.

## Claims vs code
- "Agent remains mounted, no stop prompt": true by construction (no route change; `BusinessDetails.tsx:180` `preventDefault`+`api.open`) [code]; runtime proof claim-only.
- "Existing consumers (task/memory/material/audio/music) follow no-drawer presentation": one consumer (TaskInspector) is exercised in the fixture; others explicitly not [claim-only per the results doc itself].
- "Real route departure retained": `readState` splits route vs local dirtiness for media dialogs (`:46-48`) – matches described defect 3 and `shotDetailPanel.test.ts:94`.
