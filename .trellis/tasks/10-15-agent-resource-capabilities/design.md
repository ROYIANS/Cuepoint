# E06 reusable capability and authority foundation

## Selected concrete slice

Use the existing neutral `@cuepoint/agent-core` loop and its independent `examples/agent-todo` consumer. Add typed registration/disposal and versioned implementation identity, then enforce a host-issued grant for the existing atomic `create_todo` operation in one concrete Todo list. The existing create arguments, exact approval barrier and mutation/evidence/completion transaction remain authoritative. No additional package, Studio dynamic install UI, new loop or production native/external capability enters this stage.

This resolves the first capability/package choice using the source-backed research in `research/extension-grant-design.md`. Filesystem/process/network/server families receive explicit enforcement obligations and deterministic deny-before-effect fixtures. They remain unsupported until their real owner/backend is implemented. These fixtures do not establish OS confinement, filesystem containment, redirect enforcement or MCP trust. Actual native workflow/platform and grant UI choices belong to E08/E10 before those effects can be enabled.

## Neutral registration and immutable offers

Add one small public registration module in agent-core with bounded host-owned capability ID, reviewed version and registration generation. Register unique active capability IDs and tool names; reject invalid/reused installation identities within a live registry. Dispose is idempotent and only invalidates its own generation. Old disposal cannot remove a replacement. Copy/freeze the advertised schema/identity envelope so caller mutation cannot alter an offer. Trusted host code still owns pairing the declared version with reviewed code. This does not sandbox arbitrary JavaScript.

Keep existing parser-inferred ToolSpec definitions and the one heterogeneous dispatch erasure. Bound definitions add optional binding identity; static existing tools remain static. Carry bound identity through ToolMetadata, durable round/call metadata, matching and the independent host fingerprint/approval/claim. A missing or changed binding never matches an existing registered pending call. A restart may reattach only the exact persisted installation generation; it cannot repair an old approval by assigning a new generation.

Freeze actual offered definitions before awaiting the model, in addition to offered names. The same immutable definitions provide schema, preparation, metadata and execution. Check current installation availability at admission and again in the actual host execution claim. Replacing/disposal while a request or approval is pending cannot select a newly installed same-name implementation. Preserve 36 loaded tools, two requested groups, unsettled name pinning, serial execution and complete-round approval barriers. Reuse effect/risk/atomic/recovery/mandatory-confirmation metadata; do not introduce unused parallel scheduling flags.

## Typed resource facts and actual authority

Expose neutral generic resource grant request/snapshot/port contracts. The snapshot includes an explicit version, run/call/scope subject, exact binding, immutable serializable concrete facts and grant identity/revision references. Prepare resolves already host-issued authority; it does not issue access, dispatch work or ask the model for consent. Unsupported kinds and absent/foreign/revoked authority deny. Keep raw credentials and platform handles out of snapshots.

The concrete Todo fact is one list identity and `create` action derived from the actual run scope. Persist the snapshot in the existing host-owned preview before exact approval; include it in the approval/claim fingerprint. At dispatch, do not silently resolve the same label to a new fact. Any changed registration, subject, fact or grant generation requires a fresh explicit review/call under the host contract.

Todo owns durable authority records in its own SQLite store. Root authority is explicit trusted setup for one scope/list/action. Derived authority is a subset tied to parent identity/revision; it cannot widen list/action, replace its lineage, or survive parent revocation/regrant. A copied reference alone grants nothing. Recheck actual call identity, scope, live registration, exact prepared grant facts and all live ancestors inside the same transaction that owns the Todo mutation, evidence and original completion. Denial rolls back that real atomic transaction and never reaches the SQL mutation/effect seam.

Core checks supplement this actual effect boundary; a callback followed by unchecked fs/spawn/fetch/IPC is not enforcement. Disposal/revocation prevents new admission but cannot prove an already started effect was undone. Existing authoritative completion reconciliation and conservative unknown outcomes remain intact; never infer rollback or retry from a policy expectation.

## Ownership and compatibility

Core stays dependency-free and platform-neutral; internal relative imports use emitted `.js` names and all reusable public exports go through its explicit root. Todo remains the only new concrete resource authority owner and consumes public core APIs. Studio keeps its static built-ins, exact paid-generation confirmation, ProductStore transaction/evidence, current credential resolution, scoped references and existing HTTP/native boundaries. No schema migration or unused Studio adapter is introduced to imply dynamic install support.

## Necessary validation

Core source tests cover typed inference/compiler witnesses, duplicate/dispose/replacement, frozen schema/offer, actual executeRun pending-request/pending-approval identity, budgets and mandatory-confirmation ordering. Independent Todo source-level conformance exercises real SQLite allow/deny/revoke/stale/derived-scope checks, exact preview-to-dispatch facts, races at claim and atomic boundary, completion reconciliation and unknown no-replay. Unsupported resource fixtures deny with zero effect dispatch; label them policy fixtures.

Follow the owner's necessary-only cadence. Use direct affected source suites and type checks, scoped lint and package/import architecture. Do not invoke core/Todo package scripts that build as a side effect. Emitted declarations, build/pack/install independent-consumer acceptance, broad regression, native/package and live-service gates stay deferred until the batch ends. Source-level public consumption is distinct from verified packed artifacts.

## Explicit source validation profile

Implement the bounded E06 source-only test and noEmit type profiles in research/source-validation-plan.md before changing reusable package sources. Map only the three existing exact public entries in this explicitly selected test lane; do not import the default freshness-gated configuration, change production exports, forge receipts or build implicitly. Keep the actual Todo source fixture under root tests, outside the example production emit tree. Retain the unchanged default/emitted/packed gates for final acceptance. Later Studio source test/dev profiles are follow-up only when their real consumer needs them; the current running Vite is not evidence that changed core source has been consumed.
