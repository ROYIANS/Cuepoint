# Validation — first execution-reliability delivery

## Implemented
- Integrated prior matching enabled sound-group preload and shared same-execution guidance.
- Deterministic execution summary from run/thread-owned tool ledger, exposed in existing process heading and shadcn diagnostic popover.
- Distinguishes no calls, preparation, reads, tool returns, failures/rejections, approvals, unknown effects, model-step budget, interruption and cancellation. Does not infer business success from assistant text or network call completion.
- Missing old ledger entries remain unrecorded, not zero; counts and recovery flags consistently use owned rows. No automatic retries or paid submissions added.

## Automated evidence
- Full Vitest: 115 files / 1344 tests passed.
- Focused runtime/presentation suites: 3 files / 56 tests passed.
- Helper compatibility fix rechecked: 30 tests passed; retained original offered-tools array order.
- Final typecheck and production build passed after the UI ownership/missing-record refinements. Existing large-chunk build warnings remain.
- Model snapshot verified: 197 files, 85 providers, 1855 models.
- Diff whitespace check passed.
- Scripted Chat and Responses reproduce promise-only, loader-only and failed-read endings and verify their actual ledger-derived presentation. Other tests verify one-request read/write progression, paid review parking, Stop and frozen retries.

## Limitations and acceptance
Browser inventory on this turn returned `Codex auth token is unavailable`. No desktop/narrow visual acceptance or live-model request trace was available. No paid API request was made. Automated tests do not establish live model obedience, nor that the original screenshot was caused by transport rather than model choice.

R1 remains in progress for real-model and browser acceptance. R2 semantic outcome evidence, batch generation and arrangement are not delivered by this patch. First delivery committed as f03fe2b.


# Second delivery — create and continue

## Delivered
- `project_create` now defaults to an explicitly previewed one-time binding of a clean unbound smart conversation to the project it just creates. Video, audio and music can continue with scoped reads/writes in the same run. Explicit `continueInProject=false` retains create-only and separate-chat behavior.
- Project/seeds, run/thread binding, code-owned creation provenance and completed result commit together. Exact replay does not duplicate creation; prior create-only previews fail the new revision check before effects.
- Same-envelope calls re-read current scope. Original requests, prior runs and offered-tool history remain unchanged; next-boundary facts/memory and allowed sound capabilities refresh. Existing paid review and Stop behavior remain.
- Result UI shows association with the current conversation only after checking durable provenance and both bindings. Receipt projection accepts that exact creation source.

## Verification
- Implementer focused suites: 5 files / 110 tests passed, including 23 new creation tests and both Chat/Responses pipelines for all three project kinds. These are scripted model responses with real local business writes, not live model evidence.
- Typecheck passed; final production build passed (29.38s) with existing large-chunk warnings.
- Independent review passed: final full suite 123 files / 1502 tests with four workers, lint/typecheck and whitespace checks passed. First high-concurrency run timed out on one existing 32-round test; its file passed alone (22 tests) and the full four-worker rerun passed without changing timeouts. See `check-creation-continuity.md`.
- Browser inventory failed with unavailable Codex authentication on this turn. No browser fixture or real-model trace was available; no production credentials were inspected and no paid generation was performed.

## Remaining boundary
Scope-pinned references, same-round reference outputs, earlier current-run foreign writes/uncertain effects and prior thread generation jobs/batches block automatic binding before project creation. Explicit create-only remains available. General project switching, contextual owner defaults, broader typed recovery, free-text completion verification and semantic no-call continuation are not delivered. The original promise-only symptom remains a live-model acceptance item, not a solved claim.

# Third delivery — one-use unfinished-plan finishing checkpoint

## Delivered
- A successful tool-free reply now receives one additional check only when this run actually saved a matching unfinished plan through the atomic plan tool, all calls completed, and model budget remains. Inherited plans, no-plan advice, conversation mode, unsettled/failing calls and final-segment-step replies preserve their previous behavior.
- One transaction preserves candidate public activity, original protocol output and the generated bounded historical receipt/ledger reminder. The marker survives explicit resume and context compaction; no automatic replay of writes or generation is introduced.
- The model may continue authorized tools or finish with an honest advice/input/blocker explanation. Stop, paid confirmation and model-step budget retain precedence. No public encrypted reasoning, plan-as-proof, or arbitrary result payload in the generated system facts.

## Evidence and limits
- Independent focused coverage: 57 tests across the two new files, including both protocols doing real local project creation after a premature text response, once-only CAS, Stop/reload/resume, final-step budget, paid confirmation, ownership, malformed envelopes and actual context compaction.
- Browser inventory was retried and again returned `Codex auth token is unavailable`. No browser acceptance or real model trace was available; no paid provider request was made.
- This is a bounded unfinished-plan self-check, not a semantic false-claim detector. Candidate text has already streamed and remains in history. No-plan promises, falsely completed plans and unsupported final prose remain possible. R1 and R2 therefore stay in progress.

## Final gate
- Full Vitest with four workers: 125 files / 1559 tests passed (9.85s).
- TypeScript (`pnpm lint`) passed; production build passed (16.30s), retaining existing large-chunk warnings. Whitespace check passed.
- An existing reasoning-policy fixture initially expected three requests despite its saved unfinished plan. Updated it to require the fourth finishing-check request, identical frozen effort on every request, and exactly one business execution. Focused three-file gate passed 64 tests before the final full rerun. No product behavior was weakened to satisfy the old assertion.
