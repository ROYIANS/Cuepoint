# Design

## Storage
Add AgentConfig and AgentRun in a new domain module and Dexie v8. ChatMessage gains optional runId, retry/error metadata as needed. One stable general Agent is seeded idempotently. Run captures connector ID/provider/model/base URL (no credentials), Agent instruction snapshot, user message ID, assistant message ID, request message snapshot, retryOfRunId, timestamps and status/checkpoint. Use transactions to create and finalize related rows; terminal statuses cannot transition back to streaming.

## Ownership and recovery
Use browser Web Locks with per-thread exclusive ownership for active execution. Recovery probes locks with ifAvailable and only interrupts abandoned runs when ownership is acquired. Never trust a timer alone: background tabs can be frozen. Unsupported locks must fail closed with an actionable message rather than silently permit competing execution. Legacy orphan streaming rows are migrated to interrupted. Resume text generation is an explicit new attempt, not continuation of an HTTP stream or reconstruction of hidden reasoning.

## Transport and writes
Keep OpenAI-compatible transport API; harden parsing and return finish metadata if available. No speculative second POST after invalid JSON/HTTP failures. A per-run serialized/coalesced writer checkpoints partial content and awaits its final flush before atomic terminal transition. Detached errors must never be unhandled. Abort is checked after async gates and before request dispatch. Recoverable UI renders partial text alongside a separate state notice/retry action.

## Retry context
Persist the exact approved request message snapshot before HTTP. Retry reuses it plus the recorded model and current credentials from the same connector; refuse changed provider/base URL or missing connector. A new run references the old one and reuses original user message identity. Reject retry when subsequent user turns exist rather than create ambiguous branches. Ordinary follow-up history excludes incomplete assistant messages. Completed retry answers occur once.

## Compatibility and risks
No new packages, server or changes to production/generation adapters. Run data remains studio-local and excluded from project exports. Large conversations duplicate request snapshots initially; context compaction/retention policy deferred, with a documented storage tradeoff. Checkpointing cannot promise saving tokens received immediately before abrupt process termination.
