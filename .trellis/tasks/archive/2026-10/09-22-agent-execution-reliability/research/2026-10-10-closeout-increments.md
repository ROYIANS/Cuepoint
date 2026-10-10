# R1 closeout increments — 2026-10-10

The user explicitly authorized completing and accepting all remaining existing tasks before starting the next major initiative. This continues the previously authorized R1 implementation. The following deterministic increment is independent of the pending no-plan review cost decision.

## Confirmed remaining behavior

Business tools still require owner IDs or reject omitted IDs before scope resolution; audio/music writes require project IDs even in a durably bound conversation. Existing `audio_read` / `music_read` demonstrate the allowed default. Use only the durable frozen run/thread project binding; do not guess a project or episode. Explicit supplied IDs remain authoritative and conflicting IDs fail.

Structured `INVALID_TOOL_ARGUMENTS` already exists after D05. Extend the same contract for scope, missing/foreign target, episode and stale-preview failures, with code-owned effect certainty and bounded recovery suggestions. Never infer safety from error text or replay uncertain effects.

## Implementation boundary

- Own business owner resolution and audio/music tool-family project resolution in prepare and execution. Preserve the original model envelope and saved arguments. Revalidate scope and target ownership at each normal boundary.
- Preserve projectless/studio behavior, explicit foreign-ID rejection, created-project continuation, approvals, revisions, disabled capabilities and Stop. Missing or ambiguous episode remains an explicit read/select recovery.
- Extend approved typed tool errors with `not_started`, `rolled_back` or `unknown` certainty. Reuse the current validation error serialization. Preserve typed causes across atomic rollback; committed effects remain proven only by ledger/receipt.
- Recovery suggestions explain read context, reread target, prepare a new call, review again, inspect existing job or stop; they grant no automatic retry or permission.
- Keep current no-plan/checkpoint/runtime termination behavior unchanged in this increment. The cost/trigger policy is awaiting the user's explicit decision and will have its own design.

## Owned code and verification

Business schemas/store/tools, shared project scope resolution, audio/music tool schema and resolver, shared tool-error contract, atomic rollback cause preservation and their narrow tests. Do not edit sound task result-source files, claim-review UI or `runChat.ts` terminal logic concurrently with R2.

Tests must exercise omitted bound IDs, explicit conflict, projectless/studio calls, foreign/missing episodes, created-project next boundary, stale preview/scope, rollback causes and unknown effects without automatic replay. Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; run focused tests and TypeScript. Full quality/test/build and independent review follow integration.
