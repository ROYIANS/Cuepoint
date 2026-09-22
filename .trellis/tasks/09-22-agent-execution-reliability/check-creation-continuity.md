# Creation continuity — independent review

## Findings (fixed)

- File: `src/db/agentProjectCreation.ts`, `tests/agentProjectCreation.test.ts`
- Issue: A reference read completed earlier in the same tool envelope had not yet been copied into run continuation by `appendToolResults`. Inspecting only request/continuation/audit references could allow project creation and binding, then fail the following request on the original reference's scope.
- Fix: Reported to the implementer, who added a completed sibling result check before creation and a regression. The original reference is not relabeled or removed; the error supplies the explicit create-only path.

- File: `src/db/agentProjectCreation.ts`, `tests/agentProjectCreation.test.ts`
- Issue: Network generation jobs and bookkeeping batches are not completed business-write calls. Binding their existing thread to a new project would invalidate the scope of current or earlier-run generation work.
- Fix: Reported to the implementer, who blocked automatic binding when the thread already owns image/video generation jobs or batches, or its runs own sound generation jobs. Reviewer replaced partial `as never` fixtures with complete typed records, added the sound-job case, and replaced a source assertion with normal discriminated-union narrowing.

- File: `src/lib/agent/businessTools.ts`, `tests/agentProjectCreation.test.ts`
- Issue: The special completed-creation replay path bypasses the normal create scope guard; it needed explicit current-project/origin checks while still accepting the original unbound context on a valid replay.
- Fix: Implementer added explicit context-project conflict rejection and exact created-project provenance checks. Regressions cover modified arguments, foreign thread/project context, wrong origin marker, reload replay and deleted owner.

## Findings (not fixed)

No unresolved implementation defect found within this batch's bounded scope. Reviewed atomic creation/seeds/binding/result rollback; old approval revision invalidation; original requests and offered tools remaining unchanged; per-call durable scope refresh; foreign preapproved siblings; create-only behavior; exact receipt provenance; next-boundary project/memory/tool context refresh; and Stop preservation.

Browser and live-provider acceptance remain unverified because the main session's browser authentication was unavailable. Deterministic Chat Completions and Responses fixtures both execute create → read → write for video, audio and music from one user message. Those fixtures verify orchestration and persistence, not real-model compliance or elimination of promise-only final replies. The product retains its existing genuine approval, Stop and unknown-effect boundaries.

## Verification

- Lint / TypeCheck: pass (`pnpm lint`, TypeScript build).
- Full tests: pass, **123 files / 1502 tests**, using `pnpm exec vitest run --maxWorkers=4`.
- The first unconstrained full run, concurrent with TypeScript, had one existing 32-request-loop test exceed its 5-second timeout; the other 1501 tests passed. The affected file then passed all 22 tests in 2.37 seconds alone, and the entire suite passed with four workers. No timeout increase or production workaround was introduced.
- Root runs the final production build; its result is recorded in `validation.md`.
- No live model or paid media-generation requests were issued by this review.
- Unrelated concurrent application/brand changes were left untouched.
