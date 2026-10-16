# Review E06 — agent-resource-capabilities (d4c2c877)

Reviewer mode: read-only. Branch `codex/agent-background-host`. Evidence labels: [code] [test] [claim-only].
Severity: P0 data loss/security, P1 gap against PRD, P2 robustness/maintainability, P3 nit.

## 1. Verdict

The delivered foundation is small, coherent and tested at the level it claims. The core registry, frozen offers, persisted binding identity and the Todo host's multi-boundary authority recheck all work as designed. I found no P0. The main weaknesses are:

- Part of the PRD wording ("list/create" authority) is only partly delivered.
- The neutral registry and grant port are not wired into the core loop. They depend on host convention.
- Nothing in the product (Studio) consumes the registry or `ResourceGrantPort`.
- The "unsupported family" deny test proves very little.

Test evidence reproduced on HEAD: `npx vitest run -c vitest.agent-source.config.ts` gives 5 files / 67 tests passed (36 core + 31 Todo, matching the PRD claim) on Node 24.11 [test].

## 2. Acceptance criteria map

| Criterion | Status | Evidence |
| --- | --- | --- |
| R1 One neutral loop; Studio stays in its owners | Met | `packages/agent-core/src/capabilityRegistry.ts` imports only `./tools.js`. Studio static tools are unbound (`ToolMetadata.binding` optional, `tools.ts:22,30`). [code] |
| R2 Registration/disposal, versioned identity, scope inheritance, resource requirements | Mostly met | Registration, disposal and identity: `capabilityRegistry.ts:40-66` [code], `resourceCapabilities.test.ts:21-75` [test]. "Effect/concurrency metadata" reuses existing `effect/atomic/recovery` (declared in the design). "Resource requirements" are not on the tool definition: they are free-form facts the host picks (see F4). |
| R3 Exact host-issued list/create authority in Todo, revocation, revisions, subset scope | Partly met | Create: `store.ts:128-205`. Only `{kind:'todo-list', action:'create'}` exists (`types.ts` `TodoResourceFact`). `list_todos` and `complete_todo` carry no authority (`tools.ts:13,17`). See F1. |
| R3 Define fs/process/network/server obligations and deny unsupported before effects | Partly met | Obligations are in spec `capabilities.md` §3 (last bullet). The deny fixture is weak (F5). |
| R4 Discovery budgets, pending-call pinning, mandatory confirmation, unknown semantics | Met | 36-tool bound and unsettled-call pinning untouched (runtime tests pass). New pinning via `offeredDefinitions` (`runtime.ts:215-228`, `99-103`). Atomic completion reconciliation unchanged (`runtime.ts:157-166`). [code][test] |
| AC1 Todo binds create through public APIs, real SQLite, no Studio/browser imports in core | Met | `tools.ts:25-34` uses `createCapabilityRegistry`. Core `types: []` project. Todo test file uses real file SQLite (`agentTodoSource.test.ts:51-110`). [test] |
| AC2 Remove/replace/revoke cannot retarget a pending approval or widen a child | Met | `toolMetadataMatches` compares all 3 binding fields (`tools.ts:90-97`). `runtime.test.ts` cases "does not retarget…", "keeps a parked approval pinned…". Todo `agentTodoSource.test.ts:113-143,198`. [test] |
| AC3 Preview/approval/claim/atomic use the same facts; denial gives zero mutation; unsupported families deny | Met for create, Partly for "unsupported" | Same snapshot rechecked at `host.ts:114`, `store.ts:252` (approve), `store.ts:274` (atomic, inside the txn). `agentTodoSource.test.ts:79-110` iterates tampering kinds. Unsupported fixtures: see F5. |

task.json claims: "core 36 and Todo 31 tests" [verified by run]. "no OS effects claimed" [consistent with code]. "neutral `types: []` noEmit", "scoped lint 0 errors / 15 warnings", "architecture 655 files" [claim-only, not re-run: lint/architecture were out of this review's allowance].

## 3. Findings

### P1

**F1. PRD "list/create" authority is delivered as create-only; `complete_todo` and `list_todos` bypass the grant model.** [code]
- `TodoResourceFact` has a single action `'create'` (`examples/agent-todo/src/types.ts`; `factFor` at `store.ts:25`).
- `complete_todo` is `effect:'write', atomic:true` (`tools.ts:17`). It mutates the same list but needs no host-issued authority. `atomic()` only enforces authority when `call.name === 'create_todo'` (`store.ts:272-277`).
- Design (`design.md`: "exact list/create resource") and R3 read as authority per list for the Todo family. What shipped is one tool gated.
- Effect: a `full`/approved `complete_todo` is governed only by permission mode, which the spec itself says must never stand in for resource consent (`capabilities.md` §3 "Resource prepare…", §5 Bad case). The foundation is proven for one tool, not for the family.
- Recommend: either gate `complete_todo`/`list_todos` with facts `action:'complete'|'list'`, or record explicitly in the PRD that only `create` is gated.

### P2

**F2. The registry is not on the loop's admission path; availability checks are host convention.** [code]
- `createCapabilityRegistry().assertCurrent` is never called by core. `runtime.ts` only calls `host.tools.assertScope` (`runtime.ts:114,128,137,150`). The "current installation at admission and at claim" guarantee exists only because Todo's `assertScope` calls `store.assertInstallation` (`host.ts` diff, lines ~93-100).
- Another host that registers a capability and forgets `assertScope` gets frozen offers and binding comparison, but no revocation. Spec §3 says "Check current scope/registration… throughout", as a rule, not as a mechanism.
- `snapshot()` is also not consulted by core: `executeRun` filters `host.tools.registry`, a host-supplied array (`runtime.ts:227`). A host can therefore bypass the registry entirely.
- Recommend: an optional `RuntimeHost.tools.assertBinding(binding)` called by core for any call/definition with `binding`, so a bound tool cannot be executed without a host check.

**F3. `ResourceGrantPort` and `createCapabilityRegistry` have a single consumer (the Todo example); Studio and E10 do not use them.** [code]
- `rg` for the registry/port symbols across `packages/` finds core, the Todo example and `studio/.../mcp/runtime/runRegistry.ts` only. Studio MCP derives its own binding (`mcp/runtime/tools.ts:22-25`) and its own authority check, not `ResourceGrantPort`.
- Consequence: E06 has put a public contract (exported from `index.ts:19-21`) whose only proof is a CLI example. E10 later bypassed it, so the "reusable foundation" claim is untested against a second host. This is an integration seam finding, also relevant for the E10 review.

**F4. "Resource requirements" are not declarative.** [code]
- `ToolDefinition` carries no `requires` facts. The host decides which facts to put in `prepare` (`host.ts` `prepareCreate`, `facts: [{kind:'todo-list',...}]` hardcoded). Core therefore cannot check that a bound tool actually obtained a grant before `execute`. A tool that skips `prepareCreate` still runs, and only the host's atomic txn catches it (`store.ts:272` requires `call.preview.authority` for `create_todo` only by name).
- Matches the "spirit" of the PRD but not R2's "resource requirements".

**F5. The "unsupported family" fixture is close to tautological.** [test]
- `agentTodoSource.test.ts:221-231` sends `facts:[{kind:'filesystem'…}]` to `store.prepareCreateAuthority`. That rejects because `sameFacts` compares with `todo-list/create` (`store.ts:26`), not because a family deny policy exists. There is no policy table; any unknown string would pass the same way. The test proves "Todo does not accept a foreign fact", not "unsupported fs/process/network/server deny before effects". The PRD and task.json do label them "policy fixtures", so the claim is honest, but AC3's wording overstates.

**F6. Authority lookup is non-deterministic across multiple valid roots/children.** [code]
- `store.ts:180-189` iterates `SELECT … WHERE run_id=?` without `ORDER BY` and picks the first row whose chain validates. If a run has both a root and a derived child, the preview's grant chain depends on row order. Tests pass because only one is valid at a time. Not a security issue (every candidate is valid), but the evidence snapshot/audit becomes unstable.

**F7. Registration generation set grows unbounded and is process-local.** [code]
- `capabilityRegistry.ts:43,55` keeps every used `registrationId` forever. After restart it is empty, so "reused generation" is only caught within a live registry. Todo reconstructs durable identity from SQLite and makes `registrationId` a random UUID (`store.ts:93`), so reuse is practically impossible; the guarantee is real only because the Todo host chooses UUIDs. Spec §3 says "never been used in that live registry", which is honest. Minor.

### P3

- **F8.** `issueCreateAuthority` is called unconditionally by `cli.ts:34` right after `begin`. In the shipped CLI there is no separate user decision: the "trusted host setup" is automatic. Fine for an example; the PRD wording "Todo authority defaults deny and is issued explicitly by its trusted host" holds only for programmatic use [code].
- **F9.** `immutableJson` (`capabilityRegistry.ts:19-30`) throws on `undefined` property values in a JSON schema and drops symbol keys. Acceptable, but a registration with `{default: undefined}` fails with a generic Chinese message.
- **F10.** `snapshotToolDefinitions` freezes the envelope but `Object.freeze({...tool})` is shallow for callbacks. As documented, "trusted host code", not a sandbox [code].
- **F11.** Studio-facing error strings in core are Chinese (`capabilityRegistry.ts:47-49,60`) while core is neutral/library; Todo uses English. Mixed locale in a neutral package is a small spec-consistency issue.
- **F12.** Test debt outside this task: `vitest.agent-source.config.ts` hard-fails on Node <24.11 (`:4-6`), so the E06 suite is not part of the default `npm test`, which runs `build-agent-packages` first. The default gate does not exercise these 67 tests (not verified: I did not run the default gate).

## 4. Lifecycle, revocation and error handling [code]

- Revocation: `revokeAuthority` bumps `revision` and sets `revoked` (`store.ts:162-167`). `ancestry` rejects a revoked ancestor or one whose revision differs from the child's recorded reference (`:140-150`). Old preview references stay invalid after regrant because the new authority has a new id. Correct.
- Installation replacement: `installCreateCapability` deactivates all rows, disposes toolsets, and issues a new random `registrationId` (`:87-98`). `assertInstallation` checks DB state plus in-memory `assertCurrent` (`:121-126`). Correct. Edge: `toolsFor` re-creates a toolset for a disposed installation after restart (`:115-119`), but `assertInstallation` still refuses it via the DB.
- Atomic boundary: authority, installation, approval and arguments are rechecked inside `store.transaction` before the SQL mutation (`store.ts:267-283`); any failure is wrapped as `RolledBackError`. The evidence row stores `binding` and `authority` snapshot (`:282`). Good.
- Errors on in-flight revocation after an effect started: documented as "cannot prove undone" and the completion reconciliation path is unchanged (`runtime.ts:157-170`). Consistent.
- `prepare` throws if the call is not `pending` or the run not `running` (`store.ts:177-178`), so it cannot mint authority. Covered by the test "a copied root reference cannot authorize another run" (`:113`).

## 5. Spec compliance (`.trellis/spec/agent-core`)

- `library/capabilities.md` is new, accurate about the actual code (I checked §2-§3 against the files) and states the evidence limits. Matches `runtime.md` additions.
- Spec §6 says the Todo suite "must actually execute, not count a skipped SQLite suite as proof": the config throws on old Node, so skipping cannot happen silently. Good.
- `RuntimeHost.request` got a new 4th parameter (`runtime.ts:43`), a breaking change for any other host. In-repo consumers (Todo, Studio) were updated in the commit; external packed consumers were explicitly out of scope.

## 6. Comparison with dsh (`/Users/xiaomengdao/WebstormProjects/deepseek-harness`)

| Area | dsh | Ours (E06) | Assessment |
| --- | --- | --- | --- |
| Capability lifecycle | Cordis plugins/effects: `ctx.effect` disposers, services via `Context`/`Service` (`packages/sandbox/sandbox/src/index.ts:8`; `packages/jobs/jobs-local/src/index.ts:193`). Every capability is a dynamically loaded plugin with ownership scoped by disposal of its context. | Hand-rolled `createCapabilityRegistry` with generation ids (`capabilityRegistry.ts`). | Deliberately different. dsh gets scoped disposal for free from Cordis; ours reimplements a tiny subset. Ours is simpler but only protects one process and one host path (F2). |
| Resource authority | Policy is data resolved per call: `SandboxExecutionPolicy {mode, workspaceRoot, sessionId}` carried per call, not fixed on the provider (`sandbox/sandbox/src/index.ts`, "carried PER CALL"). Escalation approval is a distinct flow (`sandbox/src/escalation.ts`, `approveEscalation`). | Durable, revisioned grant chain with parent/child subset and in-transaction recheck (`store.ts:128-205`). | Ours is stronger on durability, revocation and exact preview-to-effect binding. dsh is stronger on actual enforcement: real process confinement (`sandbox-local`, `sandbox-windows-acl`), path containment by filesystem identity (`fs/fs-sandbox/src/containment.ts:50-76`). Ours enforces only a Todo row, no fs/process/net backend. |
| Reporting enforcement strength | `SandboxEnforcement = 'full' \| 'partial'` explicit so callers don't treat partial as full (`sandbox/src/index.ts`). | Spec prose only: "policy fixtures, not confinement". | dsh models the weaker case in types; we only document it. Worth adopting before E08/E10 enable real effects. |
| Credentials | Separate `credentials` + `authorization` services with flows, prompts, secret masking (`credentials/authorization/src/types.ts`). | Studio keeps its own credential resolution (not in E06 scope); grant snapshots forbid credentials. | Different scope; no weakness for E06 itself. |
| Runtime extension | `extensions/` (`tool-cordis`, host runner) supports run-time plugin install/inspection by the agent. | No dynamic install; explicitly out of scope. | Deliberately narrower; correct for this stage. |
| Tool timeouts/guards | `guard/timeout-policy` wraps `tools/execute` with a cooperative deadline (`timeout-policy/src/index.ts`). | None in E06; core loop aborts only via signals. | Divergent; not an E06 requirement. |

Net: our design is weaker on real confinement and on typed "enforcement completeness". It is stronger on durable, revisioned, transaction-bound authority for a business effect, which dsh does not model (dsh's authority is a per-call policy plus an escalation approval).

## 7. Summary of top findings

1. **P1 F1**: Authority is create-only. `complete_todo` and `list_todos` are ungated, so the "list/create" PRD wording is only partly met.
2. **P2 F2**: The registry/`assertScope` pairing is convention; core cannot enforce that a bound tool was checked against its live registration.
3. **P2 F3**: Public registry/grant contracts have one consumer (Todo example). Studio MCP (E10) did its own binding/authority instead, so the foundation is unproven against a second host.
4. **P2 F5**: The unsupported-family test only shows fact mismatch, not a family deny policy, and does not back AC3's wording.
5. Positive: the multi-boundary recheck (approve, claim, atomic txn) and binding-pinning are real, tested and match the spec. The 36+31 test claim reproduces.
