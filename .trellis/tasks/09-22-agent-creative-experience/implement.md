# Delivery plan

## Order
1. R1: audit actual execution evidence and pending readiness changes; specify stop behavior, run protocol/permission tests, and evaluate a real-model sample where available.
2. R2: extend the delivered direct-write evidence to sound generation. Prioritize query-status correctness, historical/current provenance, actual output availability and sound task-record sources; then design unsupported-claim handling with streaming and false-positive tests. Coordinate readable version-bound music confirmation (R8).
3. R3: use that contract for reviewed audio batches, item progress, reload and explicit failure retry.
4. R4: implement reviewed selection/arrangement with real durations, idempotency and revision conflicts.
5. Parent: run integrated desktop and narrow-screen scenarios, document limitations, review acceptance criteria and user-facing copy.

Parent-child linkage does not enforce dependencies; later children must explicitly consume the accepted earlier contracts. Existing uncommitted readiness changes stay intact and are reviewed as baseline work, not silently reimplemented or committed during planning.

## Required scenarios
- Start/continue in a bound project; tools already available; read -> edit -> result.
- Advice-only, missing connection, actual approval, declined approval, Stop, failed local validation, uncertain remote result, model-step limit.
- No tool calls with a completion claim; read-only state summary; stale historical claims; plan-only completion; actual current effects; concurrent manual edits.
- Eleven-segment partial batch, reload during progress, explicit retry, no duplicate paid submission and no duplicate saved take.
- Selected without placed; placed using another version; trimmed durations; existing manual spacing; repeated arrangement; concurrent clip edit.
- Keyboard, narrow viewport and visible compact progress/outcome details.

## Gates
Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly. Run focused Vitest suites, then full `test`, `lint`, production `build`, `model-bank:verify` where applicable, and `git diff --check`. Browser fixtures must use isolated projects and mocked paid providers. Record real-model evaluation separately; do not equate deterministic mocks with model obedience. No paid production test without concrete authorization.

## Tracking
R1 and R2 are in progress with first deliveries recorded in their validation documents; R3/R4 remain planning. Refine child design and execution manifests before starting later work. Film/music-feedback additions require revised designs before implementation. R6/R7 remain parent-owned backlog and require dedicated plans; R8 readable confirmation is delivered in music-generation-review, with structured creative intent still deferred; do not conflate them with audio batches. Commit and deployment are separate user actions.

## Film integration follow-up
Use the additional scenarios in [film-feedback.md](./film-feedback.md) in cross-project acceptance. Prioritize creation continuity/context/recovery with R1 and bounded receipts with R2 before considering a one-call film skeleton. Evaluate heterogeneous local shot batching independently of paid generation batches; explicitly choose atomic or partial semantics and test duplicate/lost-response recovery. Script-range impact reporting precedes any automatic synchronization policy.
