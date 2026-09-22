# Agent Creative Execution Experience

## Goal
Users can ask the creative Agent to do a clear job, see actual progress, handle necessary decisions once, and inspect trustworthy results without repeatedly typing “start” or “continue”. General execution/evidence behavior applies across creative tools; audio production is the first end-to-end acceptance scenario. Music remains generation-oriented.

## Background and evidence
- The user supplied screenshots showing project-bound audio reads failing and promise-only replies after an explicit start request. Their AI retrospective raises unsupported completion claims, confusing prior state with current effects, weak batch visibility, and timeline risks. The retrospective is a report to investigate, not proof of the historical executions.
- `src/lib/agent/runChat.ts` continues on real tool calls but finishes a successful no-call response; it does not semantically verify business completion claims.
- `src/lib/agent/taskWrapup.ts` already distinguishes source evidence from assistant claims; normal replies do not have equivalent systematic outcome projection.
- `src/lib/agent/audioGenerationTools.ts` already requires durable paid approval, including full-access mode. `src/lib/audioGeneration/runtime.ts` retains jobs and saved results. These are foundations, not missing features to rebuild.
- Audio selection and timeline placement are separate writes. Takes retain decoded duration; clip revisions and undo protect concurrent edits. There is no complete audio batch generation/arrangement UX yet.
- Commit `1e0b58d` fixes bound-project read recovery. Uncommitted `execution-followup.md` work in the audio/music integration task preloads matching enabled groups and clarifies same-execution continuation. It passed 114 files / 1308 tests, typecheck and build. Scripted model tests are not live-model behavioral acceptance.
- Browser automation was unavailable during these investigations; original failing model envelopes and tool arguments have not been verified.

## Requirements and ownership
| ID | Priority | Outcome | Child |
| --- | --- | --- | --- |
| R1 | P0 | Clear action requests progress through actual tools; legitimate stop reasons are understandable and recoverable | agent-execution-reliability |
| R2 | P0 | Separate current project facts, this execution's effects, pending work and unverifiable claims | agent-result-evidence |
| R3 | P1 | Review and run a batch of voice segments with durable per-item progress and explicit retry scope | audio-batch-experience |
| R4 | P1 | Select takes and arrange real-duration clips without duplicate placement or silent loss of manual edits | audio-arrangement-experience |
| R5 | P0 | Concise, accessible desktop and narrow-screen UX shared by manual and Agent paths | All children |
| R6 | P1 | Create heterogeneous film shots with validated references, explicit batch semantics and duplicate-safe recovery | Parent film backlog; child not yet activated |
| R7 | P2 | Make script/source-range invalidation and structured beat/shot synchronization behavior explicit | Parent film backlog; child not yet activated |
| R8 | P0/P1 | Make saved-version music confirmation readable and faithfully map creative intent to supported generation parameters | Parent music UX backlog; coordinate R2, detailed child pending |

Source-feedback mapping: suggestions 1/2/7/10 -> R2; 6 and promise-only screenshot -> R1; 3/8 -> R3; 4/5 -> R4; 9 -> deferred tag assistance.

Additional film retrospective is mapped and source-checked in [film-feedback.md](./film-feedback.md). Creation continuity, contextual ownership and structured recovery extend R1; authoritative write receipts, seeded-entity disclosure and change-impact evidence extend R2. These additions apply across project types and are not delivered by the first R1 patch. Film batches and synchronization are tracked as R6/R7, not folded into audio-only children.

Music retrospective is mapped in [music-feedback.md](./music-feedback.md). Prioritize R2 generation state/evidence, historical provenance and sound task sources. Existing version-bound paid approval must be retained; readable confirmation and parameter intent become R8. Multi-track music remains deferred. The third delivery corrects failed/unknown/pending query conflation and exposes per-task observations; broader generation outcome verification remains pending.

## Acceptance criteria
- AC1: A clear request in a bound audio project proceeds through read/edit calls in one execution without a redundant user “start”. Preparation/progress text alone is never presented as verified business completion. Advice-only and pause requests retain their intent.
- AC2: Legitimate interruptions distinguish missing input, missing connection, approval, rejection, failure, unknown effect, user Stop and model-step budget. Unknown paid effects are not resubmitted automatically. A model-response ending is distinct from the requested work being verified complete.
- AC3: A compact outcome display cites persisted calls/jobs/entities and distinguishes pre-existing state from current-run additions/updates. Read-only calls, plan checks and assistant text cannot supply mutation proof. Partial/unknown outcomes remain visible.
- AC4: With 11 requested segments, a mixed result (e.g. 9 saved, 1 failed, 1 pending) reports those exact states. Reload preserves progress; retry targets only explicitly approved eligible items and never regenerates saved items by accident.
- AC5: Take selection and placement are independently inspectable. Arrangement uses actual duration/trim metadata, has a reviewable effect preview, and repeated execution does not duplicate clips. Concurrent user edits cause a conflict instead of an overwrite; manually arranged clips are retained unless a concrete change is approved.
- AC6: Paid generation still requires the existing approval mechanism; model-supplied confirm flags never grant permission. Project ownership, revisions, disabled skills, conversation mode and Stop remain enforced.
- AC7: The main UI remains concise: one compact progress/outcome surface, details on demand, IDs hidden behind details. Use existing shadcn components/default radii, no decorative left borders, no nested oversized cards or form wall. Keyboard and narrow-screen flows are validated.
- AC8: Script saved, audio saved, selected, placed, and not auditioned are distinguishable. Metadata checks never imply acoustic quality acceptance.
- AC9: Automated protocol/repository tests and desktop/narrow browser fixtures pass; a small controlled real-model evaluation records tool choices and stop reasons. Without that evidence, report live behavior as unverified, not fixed by mocked tests.
- AC10: Music draft saving, approval, submission, provider observation, local saving and playback availability are distinct. Failed/unknown/pending queries do not imply active generation. Approval binds exact saved inputs; changed inputs require renewed review. Historical job facts do not prove current-run submissions, and sound task results retain source/job/output provenance. Apply the detailed scenarios in music-feedback.md.

## Out of scope and deferred items
No arrangement DAW, MIDI, stems, covers or music extension; no new provider integration; no automatic microphone or picker access; no promise of perfect semantic claim detection; no keyword-only forced continuation loop; no automatic replay of uncertain paid submissions. Provider-specific tag syntax assistance is a follow-up after R1–R4, not a required tag-form editor. No broad visual redesign.

## Status
Initiative is in progress. R1 has a committed first delivery for tool readiness and ledger-based execution summaries; browser/live-model acceptance remains outstanding. R2 is in progress with direct-write receipts and compact outcome presentation; query-observation truthfulness is added in the next batch, while full asynchronous/semantic outcome acceptance remains pending. R3–R4 remain planning children. Film feedback adds planned R1/R2 follow-ups and parent-owned R6/R7 backlog; it does not mark those behaviors implemented. Detailed contracts must be resolved in the owning child before implementation.
