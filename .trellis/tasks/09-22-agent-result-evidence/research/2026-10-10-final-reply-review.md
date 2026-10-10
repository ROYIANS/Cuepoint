# Bounded final-reply review — approved 2026-10-10

The user explicitly approved at most one execution finishing self-check and at most one read-only completion-claim review in smart mode, accepting the added model cost and latency. Preserve original text, approval, Stop and budget. This design does not promise complete semantic detection.

## Execution finishing check (R1)

Extend the existing durable once-only checkpoint to smart successful no-tool endings without requiring a saved unfinished plan. Keep the existing unfinished-plan provenance path and marker compatible. Eligible runs require enabled tools, remaining segment budget, current owned run/thread/task/project and no failed/rejected/unknown/unsettled calls. No-plan calls may be empty. Conversation mode, genuine Stop, pending approval, exhausted budget or an already used checkpoint never gain another self-check.

The extra normal model request tells the model to execute already authorized work or explain advice/input/approval/blocker. It uses bounded owned ledger/receipt facts. It does not use keyword intent detection, force tool choice, alter permissions, replay writes or erase already streamed text. A second text ending can finish normally. Persist original Chat/Responses envelopes and the once-only marker across resume/compaction.

## Final-prose claim review (R2)

At the final successful no-tool boundary after any finishing check, make at most one separate read-only request using the same frozen connector/model/protocol and API key. No tools, fallback provider or paid-generation capability is offered. Count it within available model segment budget and record metrics separately from business execution. If there is no budget, content, compatible connection or eligible smart run, store an explicit unverified/skipped outcome rather than manufacturing coverage.

Before network work, persist a once-only review record with candidate text identity, current run/project identity and a bounded code-owned evidence snapshot. Reload must not automatically repeat a pending/failed review. Review failure, timeout, Stop, invalid response, storage conflicts or stale evidence remains unverified. Keep original public text/reasoning, Responses output, tool results and approvals unchanged.

The review request extracts bounded completed-work claims, exact original character spans and evidence references. Validate the response schema, offsets and original text slices; references must occur in the supplied evidence set. Never accept a model-provided source or a generic supported flag as proof. Only explicit structured predicates that code-owned facts can establish may receive a verified predicate result. Other prose may be described as model-assessed consistency with referenced observations, not certified truth. Missing evidence is unknown, not proof of no effect; contradictory structured observations and unsupported attributions are separately visible.

Evidence comes from owned committed write receipts and current verified generation outputs/provenance; history, plans, read-only/network completion and remote generation status do not become mutation proof. Bound records/text/output size and disclose omitted evidence. Never include raw parameters, credentials, arbitrary tool JSON or secret reasoning. Guard task/project deletion and concurrent revisions before publishing review.

## UI and compatibility

Use a compact process-adjacent status: checking, checked with observations/limitations, or unverified. Expand details to claims and validated source links; preserve original prose and readable narrow layout. Legacy runs without review metadata remain explicitly unreviewed. No extra conversation setting, repeated loop or silent text replacement.

## Ownership and tests

The terminal-review implementer owns `db/agentFinishingCheck.ts`, `lib/agent/finishingCheck.ts`, final `runChat.ts` integration, additive review domain/DB/helpers, compact final-review UI and associated tests. Coordinate shared domain/source helpers with R1/R2 implementers; do not edit their tool or sound-source modules. Root integrates the R1 typed-error serializer into runtime catches.

Test both protocols for no-plan action/advice/pause/input, once-only marker, budget, approval/unknown/Stop/reload, original envelope identity; claim review on true/false/mixed/old/partial facts, invalid source/span/tool output, timeout/reload staleness and preserved text; no replay or extra provider submissions. Run targeted suites/TypeScript, then independent full quality/test/build and actual desktop/narrow browser checks. Real-model acceptance remains a separate trace with a configured isolated connector.
