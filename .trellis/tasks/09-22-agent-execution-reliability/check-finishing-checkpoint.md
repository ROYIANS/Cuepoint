# Finishing checkpoint — independent review

## Findings (fixed)

- File: `tests/agentFinishingCheck.test.ts`
- Issue: Initial new tests did not exercise real base-history compaction after the checkpoint, invalid live ownership, or stale expected-step callbacks.
- Fix: Reviewer added eight cases: Chat and Responses compaction preserve the exact candidate/checkpoint/tool tail and opaque reasoning; deleted/rebound thread, deleted/foreign assistant message and missing project reject without a marker; stale callbacks leave the one-use opportunity intact. Implementer separately added paid-tool approval and final-budget-step continuation regressions during review.

No implementation change was required by this review.

- File: `tests/reasoningPolicy.test.ts`
- Issue: The first integrated suite retained the former three-request expectation for a fixture that saves an unfinished plan and then approves a write. The new one-time checkpoint correctly adds a fourth request.
- Fix: Updated this regression to require four requests with the same frozen `high` reasoning effort, checkpoint step 3, completed run, and exactly one controlled business execution. This preserves the test's original reasoning/approval guarantees while asserting the new behavior.

## Findings (not fixed)

No unresolved defect found within this third delivery's stated boundary. The checkpoint transaction validates current ownership, matching current-run completed atomic plan provenance and step identity. It commits the marker and candidate history together. Concurrent calls consume it only once; Stop/reload/resume retain it. A text answer at the final segment step still completes normally. Following tool requests retain the existing approval and budget rules.

The receipt prompt filters owned calls, uses the existing strict receipt projection, limits entries, exposes uncovered/omitted counts, and describes revisions as historical. It does not use arbitrary payloads, labels, plan titles or job status claims as evidence. Missing receipts do not assert absence of side effects. The public candidate remains in existing activity history; encrypted Responses reasoning stays in the private protocol envelope. Context compaction only replaces base history and preserves the checkpoint tail.

Known intentional limits remain: a run without a current-run unfinished plan receives no check; any failed/rejected call suppresses the check, even after later recovery; a second plain response can end with the plan incomplete. This mechanism does not classify user intent, force business effects, or block inaccurate streamed prose before display. These are documented scope boundaries, not hidden claims of semantic validation.

## Verification

- Reviewer focused gate: **3 files / 64 tests pass** (`agentFinishingCheck.test.ts`, `agentFinishingCheckPrompt.test.ts`, `reasoningPolicy.test.ts`) after the request-count regression adaptation.
- Main-session TypeScript and production build passed. The initial integrated test run had only the outdated request-count assertion described above; final integrated rerun is recorded in `validation.md`.
- Diff whitespace: pass.
- Main session owns final full tests, TypeScript and production build; results are recorded in the task validation artifact.
- Browser/live-model checks were unavailable because browser authentication failed; no paid model or media-provider request was issued for this review.

Final main-session gate: 125 files / 1559 tests pass; TypeScript and build pass. Existing build chunk-size warnings remain.
