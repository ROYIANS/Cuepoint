# Research: Creation-to-edit continuity

- Query: Safest bounded continuation after unbound `project_create`, preserving the user's existing goal without requiring another message. Review same-run one-time binding versus explicit handoff.
- Scope: internal
- Date: 2026-09-22

## Findings

### Current behavior is intentional, not a missing loop

`project_create` currently returns real project/seed IDs but deliberately leaves thread and run unbound. Its description and preview tell the model to open a new project conversation (`src/lib/agent/businessTools.ts:183`). Audio/music skill instructions independently repeat this restriction (`src/lib/agent/skills.ts:12`). The existing loop already calls another model step after settled tools (`src/lib/agent/runChat.ts:145`); the creation interruption is therefore also an explicit scope/product contract.

`CreatedEntityLinks` offers a button that creates a fresh bound thread with connector/model copied, but no original goal, conversation context or run (`src/components/agent/CreatedEntityLinks.tsx:10`). The destination is only cached in a React ref, so remount/reload can create another empty thread. Merely improving this button does not provide automatic same-run continuation.

### Files found

| File | Responsibility |
| --- | --- |
| `src/lib/agent/businessTools.ts` | Project-create schema, preview, seeds and atomic write wrapper |
| `src/db/agentTools.ts` | Atomic mutation/result transaction, approval CAS, model-step guards |
| `src/lib/agent/projectScope.ts` | Durable run/thread scope checks and bound audio/music requirement |
| `src/db/repo.ts` | General bind-once-before-messages API, thread creation, project seeds |
| `src/db/agentRuns.ts` | Initial frozen request, allowed tools, reference/memory context and history |
| `src/lib/agent/runChat.ts` | Two-phase pending-tool preparation/execution and model request loop |
| `src/lib/agent/projectContext.ts` | Next-boundary project fact refresh without rewriting original input |
| `src/lib/agent/toolLoading.ts` | Frozen allowed groups and next-request instruction refresh |
| `src/lib/agent/memoryContext.ts` | Next-request project memory refresh and base-envelope integrity |
| `src/lib/agent/runWriteOutcomes.ts` | Ownership-sensitive projection of real business write receipts |
| `src/lib/ai/referenceWire.ts` | Per-request live scope and reference provenance checks |
| `src/lib/agent/materialImageInput.ts` | Studio/project material read provenance pinned to original scope |
| `src/lib/agent/imageDiscovery.ts` | Unbound cross-project image grants become invalid under another binding |
| `src/components/agent/CreatedEntityLinks.tsx` | Existing empty-project-chat handoff |
| `src/components/agent/AgentChatPage.tsx` | Route cancellation, send lock, execution lock and navigation ordering |
| `tests/agentBusiness.test.ts` | Creation seed, rollback/replay and intentionally unchanged binding tests |
| `tests/agentProjectContext.test.ts` | Binding immutability, scope, context refresh and deletion regression tests |

### Same-run binding review

Parent proposed `continueInProject?: boolean` (default true), with false retaining create-only behavior. This is feasible as a narrowly typed exception, but must not reuse/relax general `bindChatThreadProject`.

1. **Atomic boundary is suitable.** `executeAtomicTool` uses all DB tables and commits mutation + completed tool result together (`src/db/agentTools.ts:229`). Create project, initial rows, run/thread binding and a code-owned origin marker in this transaction. Keep ordinary thread-binding API unchanged (`src/db/repo.ts:1823`). Validate latest live smart ordinary run, absent run/thread project, no task ownership and exact creating call before applying the exception. Do not infer binding from a model-supplied project ID.
2. **Replay has an outer guard hazard.** `writeTool.execute` calls `assertProjectToolScope` before reaching atomic replay (`src/lib/agent/businessTools.ts:55`). Once bound, `project_create` is rejected (`src/lib/agent/projectScope.ts:25`). A dedicated completed-call replay path must validate saved run/thread/call identity, exact original arguments/name and valid saved result before returning it, without re-creating rows. It must never bypass scope for a new call.
3. **All calls are prepared before any is executed.** `executePendingTools` prepares/approves the whole round first, then executes sequentially with the same local `run` object (`src/lib/agent/runChat.ts:55`). After the creation binds, previously prepared siblings may refer to other projects. Re-read live run for each execution, recheck current scope, reject foreign/stale siblings with an explicit non-ambiguous error. Dependent actions belong to the next model step. Two default-binding creates in one round must create/bind only the first; never switch again. Do not accidentally mark a guaranteed no-effect scope rejection as unknown.
4. **Receipt projection currently rejects binding.** `runWriteOutcomes.ts:61` explicitly rejects every `project_create` receipt when `run.projectId` exists. Add only a code-owned creation-origin exception that pins exact call/project and checks the receipt's seed ownership. Never turn this into a generic exemption for arbitrary created owners.
5. **Prior writes need a policy.** An unbound run may already have `continueInProject=false` creates or writes into another project. Binding the whole run then changes how prior receipts are projected (`runWriteOutcomes.ts:60`). Minimal implementation should reject automatic binding when pre-existing completed business writes belong elsewhere, with a useful fallback, or introduce per-operation scope history. Do not silently suppress genuine prior results by interpreting all old calls under the new project.
6. **Reference scope is the highest-risk edge case.** Unbound studio material reads persist `referenceInput.projectId = studio` (`materialImageInput.ts:30`); `resolveMaterialInput` requires exact current project identity (`:40`). Unbound image discovery can reference other projects, but after binding `resolveDiscoveredImage` rejects them (`imageDiscovery.ts:123`). The full saved continuation is revalidated on every request (`src/lib/ai/referenceWire.ts:30`), so creation may commit and the very next model request fail. Before binding inspect continuation/Responses/base context for scope-dependent reference inputs. For a bounded first version, fail closed with an actionable create-only/handoff option when incompatible inputs exist. A broader solution must explicitly retire obsolete context inputs from upcoming envelopes while preserving the original ledger and audit; never relabel them as owned by the new project or weaken provenance validation.
7. **Next-boundary refresh mostly exists.** `refreshRunProjectContext` appends a first project fact message and preserves original request (`projectContext.ts:49`); `refreshRunMemoryContext` adds project memory before dispatch. `runChat.ts:150` orders tool loading, project, memory, compaction correctly. No need to rewrite historical requestMessages, tool envelopes, user message or agentSnapshot.
8. **Frozen tool instructions need migration care.** Group descriptions/instructions are snapshotted at run creation (`toolLoading.ts:16`), so old runs retain instructions that say creation must stop. New runs should use updated instructions. For supported old runs, a code-owned next-boundary binding notice can override obsolete behavior without replacing allowed tools from current global settings. Autoload only an already frozen, allowed audio/music group and stay within tool-count limits. Do not add currently disabled skills or task-mode permissions.
9. **Old approval semantics must not silently change.** Include binding mode/version in preview revision; old create approvals should fail revision check before writes. Description/preview must tell users whether the project will become the current conversation's project. Existing `continueInProject=false` behavior remains explicit.
10. **Navigation should remain stable.** Same-run binding must not navigate to a new thread; `AgentChatPage` aborts execution when route ownership changes (`:112`). Live thread project UI should update from DB. Suppress/adjust the old 'open another project conversation' CTA when the result says the current conversation is now bound.

### Explicit handoff alternative

Preserving old immutable scope is architecturally safest: atomically create a durable destination thread plus a bounded handoff record tied to source call, then transfer only genuine user instructions and validated project result IDs. Never copy model status claims as proof, previous approvals as new authorization, references without valid new ownership or unpaired tool envelopes. The existing button can resume that exact destination idempotently and offer a populated draft. To auto-run it, execution must transfer Web Lock ownership and controller/navigation bookkeeping through the shared page executor (`AgentChatPage.tsx:372`), including crash/reload states and suppression of duplicate sends. This is substantially more work than a guarded one-time binding for a clean unbound run, and merely filling a draft still requires a user click.

### Bounded recommendation

Implement same-run creation binding as a **dedicated, code-owned exception with provenance**, restricted to ordinary unbound smart runs that have no incompatible active reference context or prior foreign write scope. Keep create-only and new-project conversation fallback available. Refresh project/memory and frozen allowed tools at the next safe request boundary. This meets the common 'create then write script/draft' flow without weakening general cross-project authorization. If supporting arbitrary rich unbound history is required in this batch, choose explicit handoff instead of expanding the one-time exception ad hoc.

### Essential tests

- Video/audio/music create -> read -> edit with one initial user message; Chat and Responses transports.
- Create + seeds + run/thread marker + result all roll back on ledger failure.
- Reload/replay exact completed create returns original project; zero duplicate projects.
- Old approved preview refuses new binding semantics before mutation.
- Bound conversations, task/conversation mode, changed thread scope, deleted project, mismatched source call/args reject.
- Same-round double creates and preapproved foreign siblings never widen scope or create unknown effects for proven rollback.
- Create-only false retains unbound behavior and multiple-create use case.
- Receipt source remains valid after binding; fake/mismatched marker never grants receipt validity.
- Scope-bound material text/image and external project discovery in saved continuation do not cause a surprise post-create HTTP failure or cross-project leak.
- Earlier foreign write results remain accurately projected or automatic binding is explicitly rejected.
- Actual next payload includes new project facts and valid memory, correct offered tools; original request and prior function envelopes remain intact.
- Stop/reload after creation preserves binding and result, no automatic network resubmission.

### Related specs

- `.trellis/spec/frontend/agent-project-context.md`: immutable general binding and request-boundary facts.
- `.trellis/spec/frontend/agent-execution.md`: locks, route cancellation, no startup resubmission.
- `.trellis/spec/frontend/agent-tools.md`: approval identity, frozen capabilities, atomic results.
- `.trellis/spec/frontend/agent-creative-skills.md`: creation seeds and atomic receipts.
- `.trellis/spec/frontend/agent-write-evidence.md`: source/ownership requirements for write projections.
- `.trellis/spec/frontend/agent-references.md`, `agent-image-discovery.md`, `agent-library-tools.md`: source-bound references and per-request checks.

### External references

None required; this review concerns repository-specific ownership and persistence contracts, not provider or framework API changes.

## Caveats / Not Found

- Research only: no code changed, no tests run, no real provider requests.
- No durable handoff mechanism is present in the inspected result button; React-ref destination reuse is session-only.
- Same-run binding is a deliberate revision of the current immutable-scope specification, so specs and existing unchanged-conversation tests must be updated together.
