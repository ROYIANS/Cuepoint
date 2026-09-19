# Validation — task verification and wrap-up

Date: 2026-09-19
Status: implementation and quality review complete; awaiting work-commit approval.

## Delivery
- Durable v14 summary families and append-only versions, owned by task/thread.
- Read-only structured AI preparation using the selected chat connector/model/effort.
- Offline manual drafting and editing; separate save, summary confirmation, completion.
- Acceptance findings, results, decisions, lessons, unresolved work and source inspection.
- Flat desktop/mobile inspector, history, editable drafts retained on conflicts.
- Current evidence verification, full-source staleness, lifecycle/ownership/CAS guards.
- Cancellation and abandoned-request recovery without automatic network retry.

## Automated gate
Using `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`:
- Full suite: 58 files, 734 tests passed.
- Type-check (`lint`): passed.
- Production build: passed; existing large-chunk warning remains (Agent bundle).
- `git diff --check`: passed.
- Independent reviewer: 33 wrap-up/task/migration tests and 76 existing orchestration,
  execution, tool and context regressions passed; no remaining blocking findings.

One duplicate simultaneous worker suite observed an execution-test timeout and an old
source test relying on random UUID ordering. No timeout was increased; the source
fixture now queries its exact compound identity and its7 targeted tests pass.

## Browser checks
Disposable Edge/Playwright contexts on local Vite port 5185, fake connector only:
- Offline manual draft → acceptance edits → save → confirm → explicit completion.
- Saving/confirming a summary does not complete the task.
- Completed task reopened → previous review stale → new findings reset to review.
- Competing revision rejects save and retains unsaved local text.
- Desktop1440×1000 and mobile390×844; no horizontal overflow; history and Escape.
- Explicit AI request exposes no tools; returned acceptance stays pending human review.
- Provider failure preserves prior confirmed summary; reload sends no retry request.
- Abandoned preparing state recovers while inspector remains closed.
- No paid API, image/video generation or real user data mutation used for validation.

## Review corrections
- Latest-family CAS prevents an old editor/confirmation bypassing a newer review.
- New manual versions preserve unresolved/lesson content; unavailable results become
  review work instead of silently disappearing.
- Source quotas prevent long conversations displacing all actual business effects.
- Historical generation calls reconcile current media/target-slot state.
- Removed CRUD outputs cannot be certified from old create/update success; legitimate
  deletion effects and historical lessons remain valid.
- Current/old summary source navigation checks live availability; bodies stay historical.
- Unknown/local context budgets are bounded and checked before POST.
- Recovery runs at route mount/focus, independent of opening the review sheet.
- Confirmed-version ordering has a deterministic creation-time tie-break.

## Deliberate limits
Preparation is a single explicit request with at most48 source excerpts of1800
characters each, plus task requirements. Coverage is visible; input beyond the selected
model budget requires a larger-model selection or manual review. Staged automatic
summarization is deferred and is not represented as implemented. Long-term memory
management and retrieval are the next roadmap children, not part of this delivery.
