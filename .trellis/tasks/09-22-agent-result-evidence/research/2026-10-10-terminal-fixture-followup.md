# Terminal review fixture follow-up — 2026-10-10

First broad regression run during terminal-review implementation: 173 files, 25 failed / 148 passed; 69 failed / 2990 passed / 1 skipped tests. This is an intermediate result, not acceptance. The accidentally broad invocation was `pnpm test -- <paths> --maxWorkers=4`; use explicit local `pnpm exec vitest run <paths> --maxWorkers=4` for targeted checks.

Most failures are older runtime fixtures assuming the previous final no-tool boundary. Smart mode now permits one finishing check and one separate zero-tool review, both consuming the existing segment allowance. Adapt each fixture to its intent, keep actual Chat/Responses envelopes, preserve genuine once-only/recovery assertions and include no-tool review behavior. Never suppress the new rules solely to preserve old request counts.

Affected fixture files from that run:

- `tests/agentFinishingCheck.test.ts` — new no-plan behavior, review request counts and resume; terminal implementer owns these updates.
- `tests/agentGenerationRecovery.test.ts` — known parked job resume count.
- `tests/imageDiscovery.test.ts` — exact target pixel round counts, both protocols.
- `tests/agentReferences.test.ts` — selected/read-project-image pixel rounds, both protocols.
- `tests/agentGenerationReview.test.ts` — approved parameter/envelope rounds, both protocols.
- `tests/audioAgentExecution.test.ts` — promise-only, loading-only and real reads/writes, both protocols.
- `tests/agentProjectCreation.test.ts` — create/read/write continuous runs, both protocols.
- `tests/webResearchRuntime.test.ts` — search/read request counts, both protocols.
- `tests/memoryRetrieval.test.ts` — current memory refresh after completed tool.
- `tests/agentActivityPersistence.test.ts` — extra candidate activity step, both protocols.
- `tests/contextManagement.test.ts` — post-result compaction and no tool replay.
- `tests/responsesStream.test.ts` — budget continuation, original encrypted envelopes, aggregate usage.
- `tests/toolLoadingMeasurement.test.ts` — complete deterministic search request chain.
- `tests/agentUsage.test.ts` — aggregate provider usage across new model steps.
- `tests/agentToolTransactions.test.ts` — prepare failure/known atomic rollback response counts.
- `tests/agentAuditRemediation.test.ts` — task_read stale cached sources (detail/index/nested × withdrawn/revised/foreign × Chat/Responses).
- `tests/agentTools.test.ts` — complete plan chain, model-step segment continuation, legacy eight-step run.
- `tests/toolLoading.test.ts` — zero-tool checker request must not be treated as a loaded-capability request.
- `tests/agentBatchPreparationRecovery.test.ts` — corrected generation preparation after invalid arguments.
- `tests/toolValidationDiagnostics.test.ts` — corrected read after invalid arguments, both protocols.
- `tests/reasoningPolicy.test.ts` — frozen effort includes final read-only review.

Other changed-area failures observed in the same intermediate run need their respective owners to verify; they are not attributed to terminal-review code:

- `tests/e06-icon-entries.test.ts` — publisher metadata stale-generation fixture.
- `tests/d05ToolCatalog.test.ts` — intentionally changed advertised schemas/metadata baseline.
- `tests/d05SchemaEquivalence.test.ts` — contextual owner parser baseline.
- `tests/agentContextualOwnerRecovery.test.ts` — contextual owner read fixture.

The terminal implementer additionally owns `tests/agentFinalReview.test.ts` for original prose/envelope preservation, zero tools, source/span rejection, bounded predicates, current output provenance, stale/reload/Stop/timeout and segment limits. Later targeted/independent checks supersede this intermediate inventory.
