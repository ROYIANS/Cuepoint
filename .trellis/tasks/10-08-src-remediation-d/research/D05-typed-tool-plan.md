# D05 typed-tool proposal (AR-05) + EX01

Research only, 2026-10-08. Owner: dispatched `trellis-research`, no children. **Only this file is owned/written.** No product/spec/task/ledger edits, installs, tests, status changes, commits or archival. D01 writer is done and its independent check remains active; D02 responsibility/import migration is a later proposal. Implement D05 only after the preceding units pass, refreshing their accepted overlapping source. This proposal neither closes AR-05 nor adds EX01 to the 51 findings.

## Evidence and boundaries

Read active task context/PRD/design/order, original `09-30-src-quality-architecture-audit/research/agent-runtime.md` AR-05:87–97, the relevant complete disk specs (`type-safety`, `agent-tools`, `agent-execution`, `agent-creative-skills`, `agent-library-tools`, `agent-batch-generation`, `agent-write-evidence`, `project-memory`, `agent-memory-retrieval`), and D02's proposed owners. Investigation is limited to tool definitions, their actual dispatch/schema/patch consumers, relevant existing regressions and the original memory serializer.

- `tools.ts:36–52` erases parse/prepare/risk/execute arguments to `unknown`; the plan executor restores them with casts at :143–145. `validateToolCall:170–187` actually parses strict arguments. This is a lost compile-time relation, **not evidence that unchecked arguments currently reach business code**.
- `businessSchemas.ts:15–23,62–70` already supplies `Spec<T>` and one object recipe producing runtime + advertised schema. Business `readTool/writeTool:145–235`, `libraryToolHelpers.ts:27–100`, and memory/task helpers retain typed callbacks internally but return erased definitions. Their repeated parsing is real validation, not an unsafe cast.
- `generationTools.ts:24–82` independently builds submit/job JSON; `generationProfiles.ts:14–36` builds their Zod/output types. Submit/job casts at :197–230 are avoidable. Batch limits/refinements and provider-specific `profileRequest` rules remain runtime constraints.
- `businessStore.ts:17,63–112` uses a dynamic row/table boundary, including `MediaRecord` double casts; `businessTools.ts:474,521–538` converts validated fields to project/beat/shot repository patches by assertions. `assetApi` plus the `Object.keys(...).flatMap` at :594–633 separates kind/schema/command correlation. `slot_update:713–738` asserts a string to a kind's slot type after a preview-only catalog check.
- `audioTools.ts:43–47` constructs a union through `ZodTypeAny`. Its inferred output can become `any`, so merely changing a return annotation would not type-protect audio callbacks. The `Extract` casts at :256–281 are not proof of a bad write, but cannot serve as the new narrowing boundary.
- `runChat.ts:127,168` independently checks effect, computed highRisk, normalized atomic, recovery and normalized requiresConfirmation before approval/preparation and again before claim. :296–311 records metadata with conservative invalid-argument fallback; do not turn that presentation fallback into permission.
- Existing integrity evidence is original AR-05's **registered=89, catalog=89, missing/unreachable/duplicate=[]**, not a newly executed result. Current inspected registrations/catalogs agree with the 13-source inventory below. `agentBusiness.test.ts:175–183` checks business duplicates/catalog/atomic/risk; `agentGeneration.test.ts:194` checks generation order/effects. `toolLoading.test.ts` checks offered/frozen sets, group behavior and loading budgets, not global 89-name parity. `agentTools.test.ts:226–237` and `agentToolTransactions.test.ts:118–129` cover effect/atomic drift. Add the missing global integrity and five-field/two-phase matrix.

## Chosen minimal interfaces and ownership

One small dependency-light leaf, proposed `src/lib/agent/toolDefinition.ts`, owns context, tool types, the definition function, name uniqueness and metadata equality. It imports `AgentToolEffect/Preview/...` and `Spec` **as types**; it imports no database, registry, skill catalog, execution runtime or family. `tools.ts` retains its public compatibility **type** exports and runtime APIs. This is a tool protocol leaf, not a new repository facade or service. Do not move/recreate D01 preparation, guard, reader or selection owners.

Illustrative interfaces (proposal, not implemented):

```ts
interface TypedToolDefinition<Args, Name extends string = string> {
  name: Name;
  title: string;
  description: string;
  parameters: Record<string, unknown>;
  effect: AgentToolEffect;
  atomic?: boolean;
  recovery?: "generation" | "repeatable";
  requiresConfirmation?: boolean;
  parseArguments: (raw: unknown) => Args;
  highRisk: (args: Args) => boolean;
  prepare?: (args: Args, context: AgentToolContext) => Promise<AgentToolPreview>;
  execute: (args: Args, context: AgentToolContext) => Promise<unknown>;
}
type AgentToolDefinition = TypedToolDefinition<unknown>;
type ToolBody<Args, Name extends string> =
  Omit<TypedToolDefinition<Args, Name>, "parameters" | "parseArguments">;

function defineTool<Args, const Name extends string>(
  spec: Spec<Args>, body: ToolBody<NoInfer<Args>, Name>
): TypedToolDefinition<Args, Name>;
```

Use function **properties**, not bivariant method declarations. Infer `Args` only from the supplied schema spec; `NoInfer` prevents an incompatible callback from widening inference. `defineTool` only joins `{...body, parameters: spec.json, parseArguments: raw => spec.schema.parse(raw)}`. Callers cannot independently supply a parser or parameters override. Results remain `unknown`; modeling every result is outside AR-05. Literal name inference helps concrete lookup but is not a substitute for catalog/runtime guards, and this proposal does not pretend TypeScript can infer the meaning of effect/recovery metadata.

Change `Spec<T>.schema` to the explicit **output** relation `z.ZodType<T, z.ZodTypeDef, unknown>` so raw/defaulted/transformed input is not conflated with parsed output. Existing `Value/ObjectValue` infer output T. Add only primitives actually needed below (trimmed bounded text and defaulted spec with its advertised-optional marker). Keep ordinary `s.text` behavior unchanged. Preserve `s.object`'s narrowly justified schema-construction assertion: keys and optionality derive from the same recipe; add a compile witness for that recipe. It is different from asserting unknown arguments into a domain patch.

Keep existing business/library/task/memory helpers and their transactions; make their callbacks schema-inferred (`NoInfer<T>` where needed), their return `TypedToolDefinition<T, N>`, and their name parameter literal-preserving. Family arrays infer heterogeneous definitions without `AgentToolDefinition[]` annotations or per-family casts. Retain present repeated parser calls at durable/direct-call boundaries until separately proven unnecessary; no parse-all wrapper is added after claim.

**Exactly one argument erasure site:** after all built-in families are assembled in `tools.ts`, check name uniqueness and project the heterogeneous array once:

```ts
const definitions = [/* typed foundation tools and all typed family spreads */];
assertUniqueToolNames(definitions);
export const BUILTIN_TOOLS =
  definitions as unknown as readonly AgentToolDefinition[];
```

This assertion expresses an existential registry's dispatch contract, not that a handler accepts arbitrary unknown: `validateToolCall` selects one definition and passes the result of **that definition's** parser; risk/preparation/claim/execution use that same pair. `runChat` preflight/claim and metadata-recording paths were traced. Preserve the public runtime shape/order and existing array injection APIs. Do not use `any`, a bivariant callback trick, per-family erasure, a cast inside each execute, schema/service classes, or a new registry map.

Typed family arrays must not be passed straight to erased injected-registry parameters. Migrate affected fixture injections/lookups to filtered, already-erased `BUILTIN_TOOLS` using family names (preserving their current fixture scope), or to concrete typed definitions when their input is known. No additional test-side erasure assertions. The actual product exception is `musicGenerationReview.ts:43–52`: use a named concrete `music_generate` definition exported by `audioGenerationTools.ts`, retaining its parse→prepare relation and avoiding a new import of the aggregate registry into the review path. Concrete name lookups may retain typing where inferred predicates prove it; a `find(name: string)` over a heterogeneous array does not prove argument correlation.

## Complete migration inventory

All 89 definitions must use schema-linked definitions; no family is excluded merely because it currently reparses at execute. Counts below are from current inspected catalog/source recipes, to be refreshed when D05 actually starts. Preserve registry order in `tools.ts` and order within every family.

| Source / count | Actual migration |
| --- | --- |
| Foundation in `tools.ts` / 2 | workspace empty strict spec; plan spec with existing unique-step/max-one-in-progress refinement. Remove plan casts. |
| `ipTools.ts` / 6 | Existing library read/write helpers return typed definitions; unchanged confirmation/CAS/receipts. |
| `audioTools.ts` / 7 | Same helpers; repair `audioMusicUnion` output inference and narrow whole args by kind before destructuring. |
| `musicTools.ts` / 4 | Same helpers and music integer/duration contracts; no provider rule relaxation. |
| `audioGenerationTools.ts` / 4 | Typed empty/speech/music/job specs; named music definition for review; preserve submission/intent/recovery implementations. |
| `materialTools.ts` / 10 | Library helpers **plus two raw definitions** `material_read_text` / `material_read_image`. Retain revision/scope/refinement/queue rules. |
| `toolLoading.ts` / 1 | `load_tool_groups` loading spec; frozen permission ceiling, next-step offer, atomic result and 36-tool cap unchanged. |
| `taskTools.ts` / 5 | Current `tool<T>` + existing task/record specs; atomic bookkeeping/source ownership unchanged. |
| `businessTools.ts` / 33 | Four reads, 12 project/episode/beat/shot CRUD, 12 asset CRUD, duplicate/reorder/studio-copy/slot/orphan (5). Typed helpers **and** dispatch/patch boundaries below. |
| `generationTools.ts` / 7 | Batch, batch-read, capabilities, submit, check, apply, job-list specs; remove recovered-Args assertions; retain batch refinement/confirmation. |
| `memoryTools.ts` / 4 | Existing typed reader helper; reviewed lifecycle/source/stale/exclusion checks unchanged. |
| `referenceTools.ts` / 4 | Discovery/search/read/image specs; keep strict image union and advertised `oneOf`, ownership/queue/digest checks. |
| `webTools.ts` / 2 | Define two concretely schema-linked branches, reuse current ownership/postflight code; remove unknown→search/read casts. Do not invent a network service. |

`audioMusicUnion` should use a mapped tuple of each `Spec`'s actual Zod schema, retaining output union without `ZodTypeAny`. A tuple-construction assertion may be local and documented (map preserves tuple position); it must not substitute `any` for output. Compile-negative branch/field examples must fail. In audio create/update, switch on `args.kind`, then destructure within each case; do not assert a stripped rest object to a full discriminated union containing projectId/kind. Keep current default speaker profiles, revisions and sound receipts.

Generation's ordinary parameter tree should have one actual `s.Spec` owner in `generationProfiles.ts` (exports submit/job specs plus compatibility schema/type exports); `generationTools` consumes it for both advertisement and parser. Batch composes the submit spec, retaining `validateBatchLimits` refinement. Keep native `profileRequest`/verified provider restrictions and defaults in their existing owner, not a new capability framework (D06 is later).

Use spec recipes for the shared object/array/enum/required structure. Retain current Zod trim/strict/default behavior: submit defaults `parameters={}`, `inputs=[]`; advertised fields remain optional. Preserve **intentional current wire projection differences** explicitly at their leaf: target slot advertisement currently has only `type:string`, while runtime has min1/max30; parameter strings have runtime bounds absent from advertisement. Do not silently add bounds/defaults or normalize every Zod refinement into JSON. Keep existing size/aspect/mode descriptions and enum/property/required ordering. Other existing Zod-only refinements may use `{schema, json}` specs with their current advertisement; do not write a universal Zod→JSON converter. The compile guarantee is parser-output→callback; JSON equivalence is verified separately.

Assertions to retain where justified: `as const` catalogs, widening enums to readonly string arrays for membership checks, object/tuple recipe construction with preserved keys/positions, guarded object views used only for whitelisted presentation, and legacy `parseGenerationSlot/normalizeEpisodeStory` repairs. They are not unchecked model-to-command casts. Remove casts that recover tool Args or manufacture native patches; verify the actual boundary rather than counting every `as` as a defect.

## Actual BusinessRow and command boundaries

No generic CRUD rewrite. `businessStore` owns the dynamic **read/projection** boundary. Add a kind-discriminated owned-record union from existing domain types:

```ts
type RowByKind = {
  project: Project; episode: Episode;
  beat: StoryBeat & { projectId: string; episodeId: string; order?: number };
  shot: Shot; character: Character; scene: Scene; prop: Prop; style: VisualStyle;
  media: ReturnType<typeof metadata>; // metadata only, never Blob
};
type OwnedBusinessRecord = {
  [K in BusinessKind]: { kind: K; row: RowByKind[K] }
}[BusinessKind];
```

Resolve the existing `getRow/listRows` database access with explicit kind branches using typed `db.projects/episodes/shots/.../media`, retaining **all** current owner/studio/episode validation. Beat still comes from `normalizeEpisodeStory`; media still projects `blob.size`. Proposed typed API: `readBusinessRecord(kind,id,ownerId?,episodeId?): Promise<OwnedBusinessRecord>` and `listBusinessRecords(kind,ownerId?,episodeId?): Promise<OwnedBusinessRecord[]>`. The record discriminator is an internal wrapper: previews/hashes/results continue using the same original `row`, **not** `{kind,row}`. Current generic `BusinessRow` may survive solely in bounded dynamic-key presentation, legacy slot parsing and internal raw snapshots; it must not supply a repository patch. Avoid a generic `getRow<K>` implemented by a blanket `as RowByKind[K]`; either consume the discriminated record directly or implement concrete overloads/typed branches. Typed projection is no permission bypass and does not claim imported historical blobs are intrinsically valid. Keep existing `getRow/listRows/projection/navigation` compatibility for bounded presentation/snapshot consumers by delegating reads to those typed branches and exposing the same row bytes; command-bearing slot dispatch consumes the discriminated record. Direct consumers are `businessTools`, `businessWriteReceipt`, `projectContext` (projection only) and `wrapupEvidence`; the latter three need no command rewrite. If signatures require adaptation, they enter D05 write/review scope, with unchanged receipt budgets/effectiveStyle, project facts and result-evidence provenance. No wrapper may turn that dynamic compatibility view back into a native patch.

Concrete affected command boundaries:

1. `project_update`: derive accepted patch from its spec; destructure exactly as today. Normalize nullable defaultStyle/generationDefaults only when the property is owned. Build the details argument with `satisfies Parameters<typeof patchProjectDetails>[1]`, using the **D02 accepted direct owner import**. Keep logline/setting/output/shot-settings commands and whitelist/receipt order. Remove `as Parameters<typeof repo...>`; no full-repo namespace returns.
2. `beatPatch/shotPatch`: accept inferred field-spec output, not `Record<string,unknown>`; return the actual command argument types (`Parameters<typeof patchStoryBeat>[2]` / `Parameters<typeof patchShot>[1]`). Preserve explicit null→undefined for sceneId/beatId; shot style null means none, omission inherits/preserves, `inheritStyle:true` clears to undefined and conflicts with any owned styleId. Never widen to arbitrary `Partial<Shot>` including ownership/slot fields.
3. Asset create/update: replace the uncorrelated `Object.keys(assetApi)` loop with four explicit **typed recipe invocations** for character/scene/prop/style using their concrete field spec and named command callbacks. Reuse the current three-operation assembly rather than introducing per-entity classes; each callback sees its own fields and native patch parameter. If generic indexed-command types force assertions, four explicit schema-bound branches are the chosen fallback. Keep delete/copy effects, catalog names and preview/result behavior. A type-only command table can document all four owners; it must not recreate `repo.ts` as a runtime facade.
4. `slot_update`: consume a narrowed owned record; validate `slot` against that kind's catalog again on execution, with a predicate yielding the actual `CharacterImageSlot/SceneImageSlot/PropImageSlot/StyleImageSlot/ShotPictureField`. Then use its real set-slot command. Legacy `parseGenerationSlot` remains. Preserve picture/video, relation/media owner, batch-candidate selection, preview revision and atomic-write checks. Do not cast a generic string solely because preparation once validated it.
5. `project_create`: keep its explicit one-time binding/replay/seed IDs/receipt behavior. Remove the generic helper's `args as {continueInProject?:...}` via a **typed callback hook** supplied only to the project-create recipe (creation check + existing completed replay handling), executed at the same preflight/transaction positions. Keep the replay predicate, completed atomic result, original arguments and creationContract2. No generic CRUD abstraction should absorb this special behavior. Minimal helper-local hook contract is:

```ts
type WriteHooks<Args> = {
  beforePreview?: (args: Args, ctx: AgentToolContext) => Promise<void>;
  beforeWrite?: (args: Args, ctx: AgentToolContext) => Promise<void>;
  completedReplay?: (args: Args, ctx: AgentToolContext) =>
    Promise<{value: unknown} | undefined>;
};
```

Its options use `WriteHooks<NoInfer<T>>`. Project creation alone supplies hooks: beforePreview runs inside the current read transaction after scope/flush; beforeWrite runs inside `executeAtomicTool` after revision validation; completedReplay runs at the start of execute's existing try block before scope/flush. Copy the existing replay transaction/checks rather than redesigning recovery. Other tools omit them. The `project_create` choice of all-table preview scope stays explicit.

D02 may have removed `repo.ts` before these changes. Use its accepted projects/episodes/shots/assets/media/shared owners; refresh actual exported argument types. D05 owns no repository command bodies and must not restore a namespace facade, import runtime tools from DB, or import aggregate tools into the D01 leaves.

## Metadata, duplicate and behavior guards

A shared pure `toolMetadataMatches(tool,args,call)` compares **exactly** current effect, computed highRisk, `Boolean(atomic)`, exact recovery and `Boolean(requiresConfirmation)`. Preserve both calls in `runChat`: (a) after validation before preparation/approval, (b) after fresh validation immediately before permission check and claim. Fresh user-confirmed generation override remains the effective input; immutable original envelopes stay untouched. Missing/false legacy flags compare as they do now; do not widen legacy plan/batch repair predicates. `highRisk` exceptions are not automatically known side-effect failures.

`assertUniqueToolNames` compares names only, independent of Args. Use it at built-in assembly; `toolSchemas/validateToolCall` also reject duplicate names in injected registries rather than silently selecting the first. This is a small linear guard, not a registry service. Catalog overlap (audio/music share some names) is intentional: compare deduplicated catalog union with registry, while duplicate **registrations** reject. Keep the offered set/frozen ceiling intersection and current unknown/disabled-tool errors.

Preserve write+receipt+ledger atomicity; owner drafts flush outside writes; prepare revision rechecks inside writes; serialization bounds; saved replay; actual error results. Retain `submit_generation` recovery=generation+confirmation, query recovery=repeatable, and sound tools' current repeatable intents+confirmation. A typed helper must not catch transport/storage ambiguity into `AtomicToolRollbackError`. Known local validation/rejection can fail; uncertain accepted paid work stays unknown and resumes by owned lookup/GET, never another POST.

## EX01: original serializeMemoryEntries only

`src/lib/memory/retrieval.ts:84–114` currently whitelists source; the nested conditional is **not a demonstrated source-evidence leak**. Choose `if (entries.length === 0) return "";`, then the same prefix/guidance/newline/JSON composition and `{...entry, source: projectMemorySource(entry.source)}` mapping. Helper is local, takes `MemorySource`, and uses explicit cases:

- summary object insertion order: `kind, taskTitle, taskId, summaryId, summaryRevision, itemKind, itemIndex`;
- imported: `kind, taskTitle, summaryRevision` (undefined still omitted by JSON.stringify);
- manual: `kind` only.

Default: `void (source satisfies never); return {kind: "manual" as const};`. This gives a compile failure for a newly added source kind while preserving today's **runtime unknown-kind fallback to manual**. Do not introduce an assertNever that throws on that fallback. Missing/null source retains today's property-access error; no new repair policy. Preserve allowed **entry-level unknown enumerable fields** via the spread; only source extras/evidence remain omitted. Overwriting source must retain its original entry-key position, not rebuild/reorder the entry whitelist. Do not mutate entries/source/audit or change guidance/escaping/normalization/ranking/plannerVersion/fingerprint/capacity/whole-entry budget.

## Necessary verification when implementation reaches D05

Nothing below was run in this research turn. Use the explicit local `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; no installs or Runtime pnpm. Capture accepted pre-D05 source/schema outputs first and independently review every changed product file after implementation.

**Compile negatives must really be compiled.** App tsconfig includes only `src`; Vitest alone does not typecheck tests. Add a small nonexecuted fixture such as `tests/typecheck/agentToolDefinition.ts` and a dedicated config extending app with src + this fixture, using the same compiler/strict options. Run local pnpm `exec tsc -p tests/typecheck/tsconfig.agent-tools.json --noEmit --incremental false` plus the normal static differential. Put `@ts-expect-error` on the actual failure lines; a generic standalone imitation is not acceptance. Positive controls and negatives import the real defineTool/specs/helpers:

- real generation submit spec paired with an execute accepting `{jobId:string}` must fail; real job spec passed to `prepareAgentGeneration(args,context)` must fail;
- real submit parsed output has required defaults `parameters/inputs`; prepare/risk/execute see that output, never the raw optional input;
- actual plan schema's `status` rejects an unrelated enum; parser/parameters override keys cannot be supplied to defineTool;
- typed outputs/callbacks from the real business beat/shot specs reject numeric text and extra native patch fields; nullable scene passed unnormalized to native patch fails, legal nullable style conversion passes. Test the actual slot predicate’s narrowed enum passed to the native slot command; raw `slot:string` remains a runtime catalog check, not a fictitious compile guarantee. Likewise `schema.parse(raw:unknown)` intentionally permits arbitrary input at compile time and validates at runtime; negatives construct typed outputs/callback arguments, not malformed raw parse calls;
- actual audio union: segment text is string, chapter has no speaker-only fields; disjoint branch access and numeric text reject. If these compile, the union remains erased and D05 fails;
- exercise actual read/write/library helper options to ensure callbacks cannot widen Args. Use `IsAny`/assignment witnesses for audio union and concrete helper parse outputs, not brittle source-text scans.

Concrete fixture examples use the proposed exports of the real generation spec/runtime; they are typecheck-only and register nothing:

```ts
import {defineTool} from "@/lib/agent/toolDefinition";
import {generationSubmitSpec, generationJobSpec,
  generationJobSchema} from "@/lib/agent/generationProfiles";
import {prepareAgentGeneration} from "@/lib/agent/generationRuntime";
import type {z} from "zod";

export const wrongExecute = defineTool(generationSubmitSpec, {
  name: "compile_only_submit", title: "compile fixture", description: "compile fixture",
  effect: "network", highRisk: () => false,
  // @ts-expect-error submit output cannot be consumed as job-id arguments
  execute: async (_args: z.output<typeof generationJobSchema>) => ({}),
});
export const wrongPrepare = defineTool(generationJobSpec, {
  name: "compile_only_job", title: "compile fixture", description: "compile fixture",
  effect: "network", highRisk: () => false,
  prepare: (args, context) => {
    // @ts-expect-error actual submit preparation requires parsed submit output
    return prepareAgentGeneration(args, context);
  },
  execute: async () => ({}),
});
```

**Runtime gaps:** add focused global integrity coverage (new `agentToolDefinition.test.ts` or equivalent existing extension) for all 89 unique registered names, deduplicated complete catalog including discovery + five task tools, missing/unreachable=[]; registration order and `toolSchemas` advertisements match pre-D05 JSON. Duplicate a real definition in an injected registry and assert both advertisement and dispatch reject with zero handler/preparation effect. Do not fabricate 89 success executions without valid owners/arguments.

Extend the real run-loop metadata tests across each of the five fields and **both phases**. Cover drift before initial preparation/approval and approved resume; for the second check mutate an **earlier, already preflighted** definition during a later tool's awaited preparation after the earlier permission check has completed, then assert no claim/execute/POST. Assert both-phase timing via actual calls/ledger, not a helper-only equality test. Include absent vs false legacy flags and wrong run/provider-call/duplicate provider IDs.

Retain focused existing families/behavior suites: `agentTools`, `agentToolsReview`, `agentToolTransactions`, `toolLoading`, `toolValidationDiagnostics/Safety`, `agentBusiness`, `agentProjectCreation`, `agentGeneration`, `agentGenerationRecovery/Review/Batch/BatchSafety`, `agentBatchPreparationRecovery`, `agentMemoryTools`, `agentReferences`, `imageDiscovery`, `agentIpTools`, `agentMaterialTools`, `audioMusicAgentTools`, `musicDurationContract`, `audioAgentExecution`, `musicGenerationReview`, `agentTaskOrchestration/Review`. Select existing exact files once at entry; preserve actual handlers/transactions, not mock-only replacements. If the three presentation consumers need adaptation, retain `agentProjectContext`, `runWriteOutcomes`, `agentTaskWrapup` and generation-source evidence regressions as well.

Concrete known/error witnesses: malformed JSON/unknown fields/oversize remain safe INVALID_TOOL_ARGUMENTS before prepare/approval; `business_read_text` invalid `field:script` + limit24000 still emits bounded diagnostic issues; foreign owner/stale preview and batch preparation fault produce genuine known local error with no partial write; mutation/receipt/result-ledger failure rolls back; actual lost paid response/multiple provider IDs/storage acceptance failure retains unknown and zero repeated POST; aborted/reloaded owned job query does not create another submit. Preserve integer music rules fixed by earlier work. Fake provider and actual local fixture bytes suffice; no live paid API needed.

EX01 extend `memoryRetrieval.test.ts` with byte-exact golden strings for empty/manual/summary/imported (including absent optional fields), reordered entry keys and entry-level extension keys; insert source-private evidence/extras and verify they stay absent. Unknown source kind degrades to manual with the same bytes; malformed missing/null source retains its error. Compare exact envelope token count and selections/omissions immediately at the budget boundary, 8-entry cap/order and frozen audit source. Existing memory request/compaction and exclusion regressions remain relevant. No source/evidence-policy expansion is authorized.

## Later writer/checker scope and acceptance decisions

Product writer, sequential after D04 PASS: new protocol leaf; `tools.ts`, `businessSchemas.ts`, `libraryToolHelpers.ts`, all 12 family files in the inventory, `generationProfiles.ts`, `businessStore.ts`, `musicGenerationReview.ts`, `runChat.ts`, `lib/memory/retrieval.ts`, and their directly affected fixtures/tests/typecheck config. Conditional signature-only consumer scope: `businessWriteReceipt.ts`, `projectContext.ts`, `wrapupEvidence.ts` as described above; `mimoSpeechSpec.ts` only if the Spec output change exposes an actual typing incompatibility, with no profile-policy change. Direct family-consumer tests identified include business/project-context/creation/audit, IP/material/audio/music, generation/review/batch, task orchestration/evidence, reference/discovery, and memory tools; refresh exact import search at entry and update those consumers without extra erasures. Registry/metadata changes need no DB schema or persisted-envelope migration. Main alone owns specs/context/ledger/task status and sequence; independent checker reviews overlaps against the latest accepted D01–D04 owners.

Main risks are inference accidentally falling to unknown/any, changed JSON/default/trim behavior, key-order-induced revision/budget changes, weakened atomic/error recovery classification, or an aggregate import recreating a value cycle. The acceptance choice is explicit: one typed definition function + existing Spec/helpers, one registry erasure; separate runtime-only refinements; typed real command projection; legacy source fallback retained. Reject generic services, universal schema converters, removal of protective legacy parsers, per-family casts, default throwing serializer fallback and repo-facade restoration. Refresh the narrow changed-import/value graph under main/check ownership; no new static value SCC is acceptable. If a mapped tuple or indexed asset generic cannot compile honestly, use explicit concrete union/asset branches, never any. If the 89 count changed through an authorized prior unit, reconcile actual catalog first instead of forcing this stale count or calling tools missing.
