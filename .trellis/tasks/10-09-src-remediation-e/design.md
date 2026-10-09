# Technical design: Source remediation E

## Architecture and responsibility boundaries

Keep the existing feature UI, domain, lib, and persistence owners established in D. A small UI departure contract reports actual dirty/pending and protects its editor/session owner. Persistence retains ownership/CAS and atomic evidence boundaries. CSS cleanup is usage-driven. Build loading and static tooling are separate from business logic.

## E01 session and departure flow

Freeze the opening input, task/thread/project identity and revision. Compute real dirty against that baseline. Propagate dirty/pending to the owner synchronously where dismissal races matter; do not depend solely on passive effects for an immediate close. A departure request from Dialog/Sheet Escape, close, inspector board, in-page task/thread change or router/back/forward passes through the same logical decision: clean -> proceed; pending -> retain; dirty -> explicit continue/discard resolution. Reuse `useManualDraftGuard` for router/beforeunload where its current pathname semantics apply, extending only where justified. Local selection changes must be intercepted before state mutation/key replacement. Cancellation retains the mounted editor, input and current selection. Successful save updates the baseline/closes according to the existing UX; rejected save retains the frozen scope, draft and retryable error. Completion from an old async session cannot write into a newer editor. Existing memory promotion epoch semantics remain intact.

Use existing caught-error patterns and synchronous per-owner pending locks for the named gallery/library/episode writes; keep fields and modal open until success. Do not classify the already-caught IP binding as an unhandled error. Real Radix/TanStack/browser/IndexedDB fixtures exercise departure, rejected writes and immediate duplicate actions without replacing production component behavior.

## E02 and E03 interaction/style contracts

Separate row keyboard activation from child action events. Check focused target and menu behavior rather than adding broad preventDefault. Repair the actual CSS cascade so breakpoint declarations survive later base rules. Resolve class usage across JSX, dynamic generation and responsive behavior before deleting obsolete audio/music rules. Preserve representative computed layout/visuals.

## E04 transactional work

Determine the complete read/write table closure for each simple memory mutation; keep ownership/revision/evidence reads inside the same transaction. Generic atomic tool and complex promotion/wrapup boundaries remain broad where required. Batch candidate media IDs and collect current/history retention once or fixed bounded passes in that original transaction. Every existing retention source and rollback stays covered. Replace gallery/library all-table subscriptions with equivalent useful projections/scopes where proven. Count scans independently from browser scheduling and timing observations.

## E05 and E06 runtime work

Sparks use one demand-driven animation lifecycle with visibility/reduced-motion cleanup and active/pointer semantics preserved. Instrument actual browser callbacks for idle/active/hidden/unmount. Measure four message/model scenarios before changing lazy entries. Existing lazy MessageList/ModelIcons are not missing boundaries. Prefer bounded icon catalogs and demand-loaded rich/code renderers only if current chunk/network evidence supports them; preserve markdown semantics/fallback/scroll. Report exclusive and shared bytes correctly and keep latency observations bounded by the measured environment.

## E07 gate and retirement

Refresh both production and test/full entry reachability, plus source/config/dynamic imports. Remove only confirmed unused assets and exports/dependencies. Retain legitimate constructors/retention helpers and scoped live queries. Decide retirement of legacy test-only context/generation against their actual contracts; no deleting meaningful tests merely to make analysis green.

Use pinned typed ESLint/SonarJS and value-only dependency rules with a portable local command. Confirm architecture rules against current legitimate owners; direct scoped DB UI queries are not inherently violations. Any accepted debt entry has rule, file, stable semantic signature, count, reason and owner, rejects additions/increases and stale entries, and shrinks on repairs. Metric-only clone/complexity signals receive review rather than arbitrary broad suppression. Verify synthetic lint and forbidden value-edge failure, type-only compatibility, unused-entry interpretation and repaired baseline removal. Exercise repository Node22 and locked installation. Add a quality job step without touching publication/permissions. No claim of CI execution or SonarQube server setup from local results.

## Compatibility and rollback

No planned schema migration. Preserve CAS, ownership, paid submission/retry, export/import and audio/media retention contracts. Work in one ordered unit at a time; independently review before recording closure. Revert only that unit's implementation if semantics cannot be verified, preserving its failed evidence and earlier accepted units. Installing tooling must not use the Codex pnpm or rebuild unrelated dependency state gratuitously. Historical accepted evidence stays byte-identical; current path references change deliberately after archive.

## Planning state

This design proposes the existing continue-editing / explicit-discard semantics for approval. Implementation starts only after the subsequent human approval of the final planning summary and curated context validation.
