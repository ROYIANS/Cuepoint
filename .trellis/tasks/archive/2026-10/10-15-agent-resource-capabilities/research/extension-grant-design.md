# Research: Reusable capability registration and host-checked resource grants

- Query: What is the smallest reusable E06 foundation that binds a real independent consumer, pins pending implementation/resource identity, and denies effects without pretending to implement an OS sandbox?
- Scope: Internal source investigation. Preparatory design only while E04 is active; no activation, implementation, spec/task metadata edits, Git, tests, builds, external search, installation or paid calls.
- Date: 2026-10-15

## Findings

### Recommendation and honest acceptance boundary

Keep the actual shared loop and add a small typed registration/identity layer plus a generic resource-grant port to **`@cuepoint/agent-core`**. Use the existing independent **`examples/agent-todo` `create_todo` capability** as the first actual consumer: it has schema-linked arguments, a prepared preview, default `ask` approval, an actual scoped SQLite mutation, and atomic evidence/completion. Add explicit host-issued authority for creating in one Todo list. No filesystem tool, executable, browser controller, network endpoint, new package, plugin framework or production grant-settings UI is needed to establish E06-AC1–3 for this selected capability.

The first stage proves reusable identity, scoped grant enforcement and no-effect denial through the real loop and a real independent business transaction. It **does not** prove filesystem containment, process confinement, redirect policy or external-server trust. Define the obligations for those resource families now, keep unsupported operations denied, and implement their backends only with the selected E08/E10 workflows. E06's PRD must retain this acceptance boundary when the parent converges its design; it must not claim that a typed port is already an OS enforcement mechanism.

The original `capability-comparison.md:79-96` and `host-integration-review.md:89-142` distinguish tool approval, resource policy, actual dispatch and OS confinement. They also reject replacing the current product transaction/ledger with an external worker's success record. This proposal preserves that distinction and selects neither Node sidecar nor Cordis nor a new background lifecycle.

### Files found and current contracts

| Source | Current role / implication |
| --- | --- |
| `packages/agent-core/src/tools.ts:3-44` | `ToolSpec` parser owns callback argument type; generic host context/preview, inferred result. Reuse the factory, not another tool definition system. |
| `packages/agent-core/src/tools.ts:47-93` | Unique names, 32,768-character raw input bound, offered-name validation; five persisted metadata checks and exact ask/assist/full/mandatory-confirmation matrix. No implementation version identity exists. |
| `packages/agent-core/src/capabilities.ts:3-36` | Capability groups are a bounded discovery catalogue, not lifecycle registrations. Max 36 loaded tools, max two requested groups, unsettled calls pinned by **name**, and per-step offered names. |
| `packages/agent-core/src/runtime.ts:30-73,86-170` | The only real model/tool loop; semantic host ports, complete-round approval barrier, fresh call/claim, atomic completion reconciliation, unknown-effect protection. |
| `packages/agent-core/src/runtime.ts:203-231` | Request admission precedes model request; round metadata currently looks up `tools.registry` by name after the awaited request. A mutable live registry would permit definition drift unless its offered implementation snapshot is frozen. |
| `packages/agent-core/src/index.ts`; `package.json` | One explicit emitted public root; no runtime dependencies. New neutral public exports belong here, with `.js` internal resolution and no Studio/Node/browser imports. |
| `examples/agent-todo/src/tools.ts:6-25` | Existing typed create/list/complete/discovery/external definitions; one justified heterogeneous erasure. `create_todo` already prepares a title and invokes the host's atomic mutation. |
| `examples/agent-todo/src/host.ts:15-30,59-89` | Actual public `executeRun` consumer, deterministic model, owned SQLite adapter, durable round/preview and transactional claim fingerprint. No Studio imports. |
| `examples/agent-todo/src/store.ts:24-84,124-166` | Actual process lifetime ownership, run revision predicates, exact approval decision, scoped writes and mutation+evidence+completion in one SQLite transaction. Lost acknowledgement/unknown fixtures already exist. |
| `packages/studio/src/features/agent/runtime/tools.ts:37-153` | Static built-in registry and product-owned tool composition. Do not migrate all creative tools merely to demonstrate registration. |
| `packages/studio/src/features/agent/runtime/toolDefinition.ts:6-24` | Studio binds core types to its own ProductStore/project/preview/recovery policy. Keep those fields out of core. |
| `packages/studio/src/features/agent/runtime/runChat.ts:101-141` | Product commit/preview/claim authority; exact fingerprint and offered/metadata/scope/approval checks. New identity must not be dropped by projection if/when Studio adopts extensions. |
| `packages/studio/src/features/agent/commands/agentTools.ts:207-222,378-404,413-425` | Existing approval ownership; atomic product effects/evidence/result; mandatory generation arguments+preview revision and no outstanding unknowns. |
| `packages/studio/src/features/agent/runtime/runCredentials.ts:7-27`; `runChat.ts:80-97` | Current key resolved at actual main/auxiliary dispatch against frozen connector identity; no credential snapshot belongs in a grant. |
| `packages/studio/src/platform/product/httpPolicy.ts:88-109`; `platform/http/requestBoundary.ts:11-13` | Current configuration/purpose/redirect-aware transport policy remains authoritative. A future generic network grant must add restrictions, never bypass this adapter. |
| `apps/desktop/src-tauri/capabilities/main.json:8` | Closed native IPC allowlist. It does not grant arbitrary filesystem/shell/MCP capability or establish child-process confinement. |
| `tooling/agent-example-check.mjs:15-80`; `quality/workspaces.json:55-87`; `tooling/workspace.mjs:38,74` | Independent packed-consumer gate and actual package/import discovery owners. New core sources/exports need real discovery, not broad entry exemptions. |

Related specs read: `.trellis/workflow.md`; `.trellis/spec/agent-core/library/{index,runtime}.md`; `.trellis/spec/agent-todo/cli/durable-host.md`; `.trellis/spec/agent-providers/library/protocols.md`; `.trellis/spec/frontend/{agent-tools,monorepo-boundaries,type-safety,quality-guidelines}.md`; `.trellis/spec/guides/{index,development-change-policy}.md`. The current fresh-development policy does not authorize a historical database migration or fallback reader for this new contract.

### Minimal typed registration and pending identity

Proposed public shape (names are design suggestions, not implemented exports):

```ts
interface ToolBindingIdentity {
  capabilityId: string;       // bounded code/host-owned namespace
  version: string;            // reviewed implementation/schema contract version
  registrationId: string;     // host installation generation; not model-supplied
}
interface CapabilityRegistration<Context extends ToolContext<Preview>, Preview> {
  identity: ToolBindingIdentity;
  tools: readonly ToolDefinition<unknown, Context, Preview, unknown>[];
}
// createCapabilityRegistry<Context, Preview>() returns:
interface CapabilityRegistry<Context extends ToolContext<Preview>, Preview> {
  register(input: CapabilityRegistration<Context, Preview>): {dispose(): void};
  snapshot(): readonly ToolDefinition<unknown, Context, Preview, unknown>[];
  assertCurrent(expected: ToolBindingIdentity): void;
}
```

Concrete family definitions retain inferred parser/callback types until the existing single dispatch erasure. Registration adds an immutable `binding?: ToolBindingIdentity` to each returned bound definition and corresponding `ToolMetadata`/`RoundDetail`/`RuntimeCall` snapshot; the raw tool factory need not invent installation identity. Extend `toolMetadataMatches` to compare all binding fields in addition to its five existing fields. Missing identity must not match a registered definition; current static unregistered tools remain unregistered. Do not backfill an old pending call with whichever implementation happens to be installed now.

Registration rules: reject duplicate currently active tool names/capability IDs, invalid bounded identity fields and reuse of a disposed installation identity within a live registry. Freeze/copy the advertised definition/parameter/identity envelope so later mutation of the caller's input cannot retarget an offer. Trusted hosts remain responsible for pairing a version with actual reviewed code; a caller-authored version is not a cryptographic implementation attestation. `dispose()` is idempotent, removes future discovery/availability and invalidates that registration only; an old disposer cannot remove a later replacement. Re-registering a changed implementation requires a new generation even when its human-readable version is unchanged.

**Freeze the actual definitions before the request**, alongside the per-step offered-name snapshot. The smallest first-stage integration uses an immutable registry snapshot when building the independent host, with live registration availability checked separately. A replacement enters a future run/explicit host composition, not an existing pending approval. Never rebuild the round's definition by searching a newly mutated live array after `request()` resolves. The same frozen definitions must produce advertised schemas, prepare, risk, execution and durable identity. Add binding to round metadata at `runtime.ts:229`; Todo's `commitRound` already spreads details into its call row (`host.ts:62`).

Pending call checks occur before preview/approval, in the transactional approval decision, and again inside the transactional execution claim. `RuntimeHost.tools.assertScope` is an existing host gate rather than a new generic service dictionary; bind it to scope+registration checks and reuse it on the fresh execution candidate before claim as well as the first pass. The actual host claim must still revalidate registry generation, frozen identity, arguments/preview/decision, offers and grant facts at the point it admits execution. An added core precheck cannot replace that transaction.

After process restart, the host may reattach only the same persisted installation generation/version with the expected implementation; missing or changed bindings refuse resumption. A newly minted registration ID must not silently repair an old approval. Keep installation identity in the example's own persisted JSON envelope; no Studio schema migration or universal package storage is needed.

Effect/concurrency contract: reuse existing `effect`, computed risk, `atomic`, `requiresConfirmation` and `recovery`; keep actual execution **serial**, as `runtime.ts:126` already implements. Do not advertise read concurrency, add unused parallel flags or change scheduling in E06. Per-resource/process concurrency comes with the real E07/E12 scheduler. Disposal/revocation means no new admission under that authority; it cannot prove an already-started effect was undone. Retain an in-flight completion/unknown record and let the host drain its owned work; do not invent synchronous cancellation guarantees or release another owner's resource.

### Resource-grant port: typed facts, host authority and same preview/execution

Use a generic fact type owned by the selected host/capability; avoid a speculative union containing every possible OS/backend option. The neutral port carries no ProductStore, path library, raw credentials or generic `services: Record<string, unknown>`.

```ts
interface ResourceGrantRef { id: string; revision: number }
interface ResourceGrantSnapshot<Fact> {
  version: 1;
  subject: {runId: string; callId: string; scopeId: string};
  binding: ToolBindingIdentity;
  facts: readonly Fact[];
  grants: readonly ResourceGrantRef[];
}
interface ResourceGrantRequest<Fact> {
  subject: {runId: string; callId: string; scopeId: string};
  binding: ToolBindingIdentity;
  facts: readonly Fact[];
  signal: AbortSignal;
}
interface ResourceGrantPort<Fact> {
  prepare(request: ResourceGrantRequest<Fact>): Promise<ResourceGrantSnapshot<Fact>>;
  assertCurrent(expected: ResourceGrantSnapshot<Fact>, signal: AbortSignal): Promise<void>;
}
```

`prepare` resolves and checks already host-issued authority; it **does not grant access**, solicit model consent or dispatch the resource operation. Deny missing/revoked/foreign authority and unknown resource kinds. It returns bounded, serializable, immutable canonical facts+grant revisions for the exact call/binding. The host extends its own generic preview with that snapshot; core already carries typed `Preview` unchanged. The existing preview owner persists it before approval. Execution uses precisely those facts, not a freshly resolved target with the same label. Any relevant fact/authority revision change rejects; a new preview/decision requires a new explicit call or deliberately defined review flow, never an implicit upgrade of the old approval.

`assertCurrent` is a useful admission check, **not a dispatch sandbox**. The typed host operation that owns the actual effect must repeat/consume the expected facts and live authority at its real boundary. A filesystem callback followed by arbitrary unchecked `fs`, `spawn`, `fetch` or renderer IPC would bypass the port. The port is a trusted-host contract; it does not confine malicious arbitrary JavaScript implementations. There is no new raw OS handle in ToolContext.

For the first consumer, `TodoResourceFact = {kind: 'todo-list'; listId: string; action: 'create'}` is enough. Bind `listId` to the host's canonical `run.scope`, not a model string. The real typed service can accept `mutate(callId, signal, operation, expectedGrant)`; inside `TodoStore.atomic` recheck the exact current call/binding, scope, live grant generation/revocation/ancestry and expected fact before SQL mutation, evidence and original completion commit together. Existing `atomic` proves rollback if this check denies. Do not throw a generic non-atomic write error and label it `rolled_back` merely because the policy expected no effects; core conservatively treats such errors as unknown (`runtime.ts:165-168`). Future non-atomic hosts need a distinct proven pre-dispatch denial contract when that case actually exists.

Scope/inheritance rules belong to the actual host authority store, not to model arguments or capability loading:

- Default deny. A trusted host may mint the selected root grant for a specific Todo list/action; fixture setup is explicit authority, not `permissionMode=full` or a prompt granting access.
- A child authority may select only a subset of the parent's canonical resource/action facts, retain the parent grant identity/revision, and add restrictions. No wildcard, unrelated list, new operation, root escalation or independently reminted copy of inherited authority.
- The effect owner checks all live ancestors; parent revocation invalidates descendants even if their serialized snapshots still look valid. Replacing/regranting a parent changes generation, so old child/approval facts do not revive automatically.
- Grant identity/revision/scope is distinct from execution ownership and approval. It does not create a run/thread lock, inherit paid approval, allow an otherwise unavailable tool, or expand frozen offered-tool permissions. No child-Agent runtime is added here; deterministic derived-scope cases establish the rule for E12.
- A copied/reforged grant reference alone has no authority: the host checks its persisted row, subject/scope, ancestry, binding and exact requested facts. Keep secrets out of snapshots; a credential **reference** still needs current resolution at dispatch.

### Concrete resource families: obligations, not invented implementations

| Family | Same concrete facts preview and dispatch must identify | Actual host enforcement needed before enabling it |
| --- | --- | --- |
| Filesystem | Granted root/handle identity, exact resolved relative target, read/write operation, file/version or overwrite expectation | Native owner resolves canonical paths/handles and symlinks under its stated threat model, checks current grant at open/commit and enforces root/overwrite/version policy. Prefix-string checking in core is insufficient. No filesystem capability is registered by E06. |
| Process | Approved executable/tool identity, argv, cwd authority, environment profile and its allowed resources | Owned spawn backend resolves executable, checks exact argv/environment/cwd and resource bounds, provides real process-tree cancellation and separately states OS confinement. Allowing a Tauri command is not confinement of the child it starts. No shell/process backend here. |
| Network | Normalized destination/origin, method/purpose, connector/credential reference and relevant request/release constraints | Current credential and configured-origin/purpose policy at each actual dispatch/redirect; reject target drift and restrict data egress as defined by that operation. No generic grant disables Studio's existing `authorizeRuntimeHttp`. |
| Server/MCP | Selected server instance + connection generation, namespaced tool/resource identity/schema version and transport configuration identity | The actual client verifies connection generation, schema, resource permission and current credentials; reconnect/uninstall cannot retarget old approvals. Starting stdio also needs process/resource enforcement. No default external server, MCP bridge or arbitrary stdio in E06. |

Only the selected Todo fact needs a production-shaped concrete implementation in this foundation stage. For unsupported families, a deterministic no-effects host fixture can return explicit deny and prove that denied operations never invoke its effect seam. That establishes fail-closed orchestration, not symlink, network, process or server confinement. Document missing backend as unsupported, not “granted but partially enforced”.

### Independent consumer slice and unchanged Studio policies

Integrate the existing `create_todo` definition into one registered capability, leaving its arguments, atomic mutation and exact approval behavior intact. Extend the Todo host's own preview (`types.ts:20`) with the prepared grant snapshot, and its persisted call fingerprint/decision with binding+resource facts. Register under the public core APIs in `examples/agent-todo`; call the same `executeRun`, not a demonstration-only registry path or a second loop. The existing deterministic model requires no provider request. Keep existing static list/discovery/external scenarios available for their current conformance rather than broad conversion of every tool.

Store the selected authority/install generation in the example's own current JSON records or a minimal explicitly owned authority table; no universal ProductStore abstraction or second product transaction owner. `TodoStore.decide:124` and host claim `host.ts:77-85` are the exact places to reject stale binding/grant/preview. `TodoStore.atomic:139-158` is the final effect boundary. A new deny/removal/replacement scenario must reach those actual paths; a Map-only unit example cannot satisfy AC1–3.

Studio may remain on static built-ins for this first slice. Its named tool families, sole ProductStore, exact mandatory paid-generation review and current credential path are preserved. If a selected Studio extension is added later, update all actual projections together: `AgentToolRoundDetail` currently explicitly Picks fields (`agentTools.ts:112`), `claimFingerprint` explicitly lists fields (`runChat.ts:136`), and `AgentToolCall extends ToolMetadata` alone does not prove persistence/claims carry a new identity. Do not add a fake optional getter or unused facade to imply that Studio dynamic install UI is complete.

The mandatory approval matrix still checks `requiresConfirmation` **before** `full` (`tools.ts:88-93`). Resource grants, installation, child scope, discovery, Skills text and `full` must never replace the exact existing generation approval or reinterpret unknown calls. Confirmed local completion wins over a late exception; missing/unreadable completion stays unknown; no automatic external-effect replay. Credentials remain current per dispatch and never enter registration/grant/call snapshots.

### Necessary validation and delivery limits

Use the actual public-source core fixtures and independent host behavior. Existing seams: `packages/agent-core/src/{tools,runtime}.test.ts`, `examples/agent-todo/src/conformance.test.ts` (real owner/SQLite/approval/claim/unknown scenarios), `tests/agentRuntime{Ownership,ClaimRaces,Credentials}.test.ts`, existing generation-confirmation tests, and `tooling/workspace.test.mjs` forbidden-import negatives. New test source must be discovered by the existing quality/workspace owners.

Minimum changed-scope evidence:

1. Typed definition inference stays intact; actual compiler witnesses reject wrong arguments/preview/resource fact types. Duplicate names/IDs and old-disposer/new-registration cases fail safely. Do not prove safety using only TypeScript.
2. Through actual `executeRun`, freeze a model offer, replace/dispose while awaiting response or approval, then attempt resume: no new implementation executes; pending arguments/preview/identity remain unchanged. Also race revocation immediately before claim and inside the selected atomic effect boundary.
3. Independent Todo allow: prepared concrete list facts equal approved and executed facts; one mutation/evidence/completion commits. Deny/foreign fact/revoked grant/stale revision/parent revoked/child widened: actual mutation count and effect-seam invocations remain zero. Pending approval cannot be rebound to a new installation or authority generation.
4. Preserve completion reconciliation and unknown external fixture: late commit acknowledgement uses the original result; unreadable confirmation and unknown external intent do not replay. Keep mandatory confirmation true under ask/assist/full with a resource grant present; no credential value serialized into previews/results/events.
5. Retain 36-tool/two-group bounds and pinned unsettled names; version identity is additional, not a reason to unload the pending call or widen frozen offered names. Preserve serial execution and the complete-round approval barrier.
6. Unsupported filesystem/process/network/server fixtures explicitly deny before their effect seam; label this policy fixture, not OS sandbox acceptance.

No tests or builds were run for this research. Per-stage implementation should use necessary source-mapped tests/type checks. `packages/agent-core/package.json`'s test script and `examples/agent-todo` type/build scripts invoke package builds; do not accidentally start those under the owner's deferred-build instruction. The full isolated pack/install/emitted declaration/process conformance gate in `tooling/agent-example-check.mjs` is retained for the final batch acceptance. Source-level independent consumption now is not a claim that changed emitted/packed artifacts were already checked.

## Caveats / Not Found

- No present dynamic register/dispose API, versioned pending binding, generic resource-grant store, production OS confinement backend, general shell or MCP host was found in the inspected owners. Existing grouped capability loading is not those features.
- Root-resource grant UX/default policy, the first real native workflow/platform, overwrite/cleanup rules and real confinement backend remain genuine product/host choices **before enabling actual OS/external effects**. E08 and E10 already name those decisions. They need not block this no-OS-effect foundation or cause a premature Node/Rust/Cordis architecture choice.
- The first Todo host resource is an actual application-owned list, not proof that a filesystem resource handle can be enforced identically. Generic fact typing permits reusable composition; each new backend still owes actual resolution, enforcement and denial evidence.
- `version` identifies an explicitly paired implementation contract; trusted host code can lie or bypass its own ports. This stage does not load untrusted executable plugins or sandbox arbitrary JavaScript. Installation trust and backend confinement cannot be inferred from registry typing.
- No migrations, child-agent execution, background lifetime, generic job/artifact system, installable Skills, MCP connection, programmatic interpreter, generic permission settings/dashboard, second product store or provider protocol change is included.
- Original comparison notes are local-baseline research, not current upstream or runtime acceptance. No external references were needed or consulted.
