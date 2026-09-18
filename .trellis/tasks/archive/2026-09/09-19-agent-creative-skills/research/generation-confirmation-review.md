# Generation confirmation follow-up review

Reviewed 2026-09-19: GenerationReview/AgentRunDetails/AgentChatPage, generationReview,
commitGenerationReview, effectiveToolInput, confirmation snapshots and preferences.

## Findings

**C1 — Fixed: applying defaults discarded the immutable input mode.** The original
UI replaced all parameters with global defaults which intentionally omit mode.
An existing first-frame proposal then inferred reference mode and became invalid,
with no input-mode control to recover. Model changes had the same issue. Added
`applyGenerationSelection` as the shared explicit-selection transformation: replace
connector/model/parameters, derive video mode from unchanged input roles, omit an
inapplicable APIMart frame aspect ratio, and retain prompt/target/inputs. Conflicting
duration/resolution and mixed roles remain visible validation errors, not silent
corrections. The main session wires all three selection entry points to this helper.

The helper preserves incomplete prompt edits verbatim, including an empty prompt:
changing configuration while typing must not throw a full submission-validation
exception. Confirmation still validates prompt completeness through the existing
form and service boundary.

## Verified contracts

- Original tool arguments, assistant tool-call envelopes and Responses reasoning
  items remain unchanged. User-reviewed arguments and their fingerprint live in a
  separate override; only submit_generation with a confirmation snapshot and saved
  approval can execute one. The result reports the actual provider/model/parameters.
- Review preparation is local; it neither uploads nor queries/submits generation.
  The original proposal is revalidated before/after deriving the new preview; final
  execution recomputes the reviewed fingerprint before any paid submission.
- Target and input lists cannot change in the review service or database commit.
  CAS checks call/run/thread/latest ownership, original arguments/preview, decision
  state, unresolved competing operations and absence of a prior generation job.
  Competing confirmations cannot both commit.
- requiresConfirmation is a code-owned definition and durable snapshot. All three
  permission modes park submit_generation for explicit confirmation; other tools
  retain their prior permission policy. Ordinary conversation does not gain tools.
- Preferences contain only reusable connector/model/parameters. Reads do not
  initialize settings or silently repair invalid choices. Invalid/ambiguous choices
  are surfaced rather than falling back; recommendations never mutate an existing
  AI/user draft. Applying a recommendation is an explicit UI action.
- AgentChatPage checks remaining approvals before resuming; confirming one of
  several generation proposals does not execute the others without their decisions.

## Independent regression additions

- `generationReviewDraft.test.ts`: nine cases for input-derived modes, APIMart frame
  ratio, independent parameter replacement, immutable prompt/target/inputs, empty
  editing drafts, and incompatible settings remaining explicit.
- `agentGenerationReviewTransactions.test.ts`: failed approval storage leaves both
  decision and override unchanged; later confirmation succeeds once. Database
  reopen after approval preserves the reviewed request and sends exactly one paid
  fixture POST on explicit continuation, with unchanged original wire arguments.

The reviewer ran these files together with the owner's generation review and
preference tests: **34/34 passed**. No real provider call was used. Final browser
verification and the integrated regression gate remain with the main session.
