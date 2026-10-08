# D05 typed-tool and memory serializer contract draft

Coordinator preparation only. Reconcile exact final owner/signature names after implementation and independent PASS before applying this contract.

## 1. Scope / Trigger

Maintain the schema-to-business-argument relation when defining or changing any built-in agent tool, family helper, registry entry, dispatch or durable approval metadata. Maintain the serializer envelope and source whitelist when changing memory selection wire text. Compile-time correctness and runtime validation have separate responsibilities.

## 2. Signatures / Owners

- `lib/agent/toolDefinition.ts` owns `AgentToolContext`, `TypedToolDefinition<Args, Name>`, `AgentToolDefinition = TypedToolDefinition<unknown>`, `ToolBody<Args, Name>`, `defineTool`, `assertUniqueToolNames` and `toolMetadataMatches`. It imports protocol/schema types rather than persistence, runtime or family values. `tools.ts` owns the assembled registry and its single justified argument erasure.
- `businessSchemas.ts` owns `Spec<T>` with an explicit Zod parsed-output/unknown-input relation and the actual `text`, `trimmedText`, `defaulted`, choice/object/array/optional/nullable recipes. `defineTool<Args, const Name>(spec: Spec<Args>, body: ToolBody<NoInfer<Args>, Name>)` infers business arguments only from the schema; callbacks cannot independently widen that inference.
- Prepare, risk and execute callbacks are function properties tied to that parsed argument type. Family arrays keep their heterogeneous typed definitions until the one justified registry erasure.
- `toolMetadataMatches<Args>` compares effect, computed risk, normalized atomic/recovery/confirmation against the persisted call. Both `runChat.ts` gates consume it. `generationProfiles.ts` owns the shared submit/job runtime specifications and their intentional advertised-schema ordering/projection; audio and existing business/library/task/memory helpers retain their actual domain schemas and commands. Existing `tools.ts` compatibility type exports remain for real consumers.
- `serializeMemoryEntries(entries)` retains its public readonly input/string result. A small exhaustive source projection owns summary/imported/manual source fields; empty entries return before constructing the envelope.

## 3. Contracts / Invariants

- Parsed schema output is the callback argument type throughout concrete tool definition and family helpers. Use literal names, discriminants and real typed projections where their domain relations are meaningful. Raw model arguments remain unknown until the selected tool's own parser succeeds.
- Only the central heterogeneous registry needs existential argument erasure. Record why dispatch remains sound: each erased definition carries its own parser and invokes its own callbacks on that parsed output. Do not cast raw arguments into business patches, suppress rules, introduce any, or scatter family assertions to satisfy the compiler.
- Advertised JSON schema, runtime parse/default/trim/refinement behavior, property order, tool names, catalogue membership and metadata remain compatible. Provider-specific generation limits and strict audio/default semantics are not rewritten for the type change.
- Schema construction may need a narrowly proved construction assertion where keys/optionality come from the same recipe. It is distinct from a coercion of untrusted data. Compile witnesses cover that recipe and callback mismatch.
- Effect, computed high risk, normalized atomic, recovery and normalized confirmation requirements are compared at both the approval/preparation boundary and execution-claim boundary. Invalid metadata cannot acquire permission from a presentation fallback. Preserve frozen offered-tool sets, durable ledger ownership, transaction rollback and paid unknown-outcome recovery.
- Argument validation failures remain actionable to the model. An invalid call does not execute; a newly issued corrected call may execute exactly once. Compiler rejection does not replace this runtime behavior.
- The serializer keeps the exact MEMORY_PREFIX/guidance/newline/JSON envelope, entry spread, source whitelist, field insertion order, empty/undefined/zero behavior and existing unknown-runtime fallback. Its entry spread is still deliberate compatibility; the source projection is not a claim that all extra entry fields are removed.

## 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| Callback expects a different schema output | Actual project compiler rejects the definition |
| Audio/default/transform schema | Callback receives its parsed output type; no inferred any |
| Duplicate/unreachable/missing registered name | Integrity check identifies the exact mismatch; dispatch/catalog remain complete |
| Raw model argument parse fails | No business execution/claim; model sees useful field/limit diagnostics |
| Any of five metadata fields differs before approval or claim | Reject at the corresponding gate; no partial business write or paid replay |
| Serializer input empty | Exact empty string |
| Summary/imported/manual/mixed input | Byte-compatible envelope and field order |
| Malformed unknown runtime source kind | Preserve the existing manual fallback without weakening typed exhaustiveness |

## 5. Good / Base / Bad Cases

- Base: one schema produces advertised parameters, parser and typed callbacks; registry dispatch parses its own unknown arguments then runs its own callback.
- Good: actual compile-negative fixtures reject wrong prepare/risk/execute arguments; the runtime validates both metadata gates and returns actionable correction diagnostics.
- Good: all current registered families/catalogue entries have matching names and no duplicates; serializer old/new bytes agree on representative and edge inputs.
- Bad: annotating every family as unknown, adding bivariant callbacks, allowing inference to widen from callback arguments, coercing raw fields to repository patches, trusting catalogue types as approval permission, or changing wire field order while claiming serializer compatibility.

## 6. Tests Required

Compile positive and negative examples with the actual project compiler and preserve expected failure witnesses. Verify current global registry/family/catalogue/offered-set integrity and every metadata field at both phases. Compare actual original/current advertised bytes and a meaningful valid/invalid/default parser corpus; finite cases supplement source/schema review rather than proving all possible inputs. Retain actual schema/refinement/default behavior, atomic business and ledger rollback, original frozen retry/recovery and actionable model self-correction tests for both Chat Completions and Responses. Serializer tests compare old/new bytes and include empty, mixed variants, zeros/undefined, whitelist/order and unknown-runtime fallback. Native probes are required for a concrete changed transaction/lifecycle risk; reuse accepted real runner entry points where applicable and record their exact frozen inputs. No weakened assertions, timeouts or live paid-provider claims.

## 7. Migration / Limits

Migrate every actual current family/helper/consumer, preserving concrete D02 persistence owners, D01 preparation leaves and D03/D04 session/query boundaries. Typed tool results remain unknown unless an actual domain need requires more; no generic CRUD/framework/registry redesign. Ancillary EX01 is tracked separately and does not increase the 51-finding count. D06 capability, D07 transport, D08 draft and E/QG01 work remain pending. Remaining static debt and justified construction/registry assertions are explicit; a typed registry does not prove effect metadata or paid-provider behavior.
