# Task orchestration validation — 2026-09-19

Implementation and independent review passed. User approved the two planned commits and task archive on 2026-09-19. Only this first roadmap child is implemented.

## Product outcome
Home Task mode saves thread intake intent; sending alone creates no task. A frozen
eligible smart run may use task tools after requirements clarification. Task goal,
acceptance criteria, Todo, current documents, revision history and evidence persist.
Inspector provides flat Overview / Working records tabs, filters/search, human edits,
version inspection, source expansion and actual entity links. Subsequent requests use
bounded latest records. AI creation does not alter prior Chat/Responses envelopes.

## Checks
- Explicit local pnpm lint: PASS (TypeScript).
- Full test gate: 57 files / 719 tests PASS.
- Production build: PASS. Existing large-chunk advisory remains (Agent bundle ~8.14MB
  uncompressed); this delivery does not change bundle splitting.
- git diff --check: PASS.
- Independent Trellis review: core implementation and full applicable frontend scope;
  fixed unsupported completion evidence, oversized internal snapshots, bounded artifact
  metadata and paginated full source reads. 7 independent regressions added.

## Acceptance evidence
| Requirement | Verification |
| --- | --- |
| AC1 clarify then create | Real UI switched home to Task; first mocked reply clarified; zero task rows; reload retained intent; second reply ran 7 actual registered tools |
| AC1 real work + evidence | task_read/create, proposal, character_create, source read, verification, update_run_plan; actual IndexedDB character and linked result checked |
| AC2 correction | Edited proposal through dialog; next captured request included corrected text; prior versions retained |
| AC3 no duplicates/replay | Reload left one task/one character; repo tests repeat creation and calls, simulate rollback and preserve retry/Responses state |
| AC4 ownership/conflict | Foreign sources/records, stale revisions, unknown/failed business claims rejected in tests; browser concurrent edit kept local draft and displayed conflict |
| AC5 modes/UI | Ordinary Agent and conversation-only lack creation tools; optional planning disabled still retains task core; desktop1440 and mobile390 editor/history verified |
| AC6 resumed context | New runs include revised goal/criteria and bounded records; full source/document paging available; frozen previous requests unchanged |

Browser scripts are local disposable fixtures (`/tmp/task-workflow-ui.cjs`,
`/tmp/task-record-ui.cjs`) running Edge against an isolated dev origin on port5185.
All provider traffic intercepted to fixture .test domains; no paid external calls.
Screenshots: /tmp/task-records-desktop.png, /tmp/task-records-mobile.png,
/tmp/task-records-mobile-editor.png, /tmp/task-workflow-evidence.png.

## Review fixes and durable lessons
1. A completed network-tool ledger is not proof that generation succeeded. Check actual
   result state, and distinguish pending/failed/conflict/downloaded/applied stages.
2. Internal requirement snapshots need a separate bounded capacity large enough for
   two valid goals, criteria and Todo lists. Model-authored documents remain12k max.
3. A preview is insufficient after recovery; source IDs must support bounded full reads.
4. Manual CAS uses the revision captured when opening the editor, not latest live data.
5. Existing task instructions and frozen run protocol state must not be rewritten after
   dynamic creation. Tool results convey changes in the current run.

## Limits / next delivery
Source ownership and status can be validated; the model's prose still needs semantic
review. No new live web research, automatic task completion, cross-task memory or
background execution after closing the page. Next child is task wrap-up: results,
unresolved work, lessons and explicit user acceptance before memory promotion.
