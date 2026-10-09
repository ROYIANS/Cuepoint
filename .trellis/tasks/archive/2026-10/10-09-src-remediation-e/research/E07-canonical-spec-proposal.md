# E07 canonical spec proposal — apply only after actual independent acceptance

## Quality guidelines addition

### 1. Scope / Trigger

All authored src changes and necessary regression runners/configuration use the root type check, formal quality CLI, meaningful tests and build/model gates. Imported vendor stays outside manual review but remains compiler/build input. Generated route is excluded from typed lint; generated icon data is included. SonarJS supplies local ESLint rules; no SonarQube service is required.

### 2. Signatures / Owners

`quality` runs `scripts/quality-check.mjs`; `quality:self-test` runs its actual CLI synthetic contracts. Root `eslint.config.mjs`, `knip.json`, pinned package/lock, exact `quality/debt.json` and `quality/unused-contracts.json` own policy. CI runs both commands before tests while retaining Node22, existing triggers, image publication and permissions. Local commands use the authorized explicit machine pnpm executable.

### 3. Contracts / Invariants

Typed recommended, Hook rules/dependencies, exhaustive switches and duplicated branches/conditions block new errors. Only individually reviewed error nodes with exact rule/file/parser tokens/semantic owner/count/reason may pass; producer hash and TypeScript version changes require review. Strict unknown/any throws fail; recognized caught rethrows and package-origin TanStack Redirect retain their contracts. Static value cycles and Domain→DB/UI or DB→UI value edges fail. Dynamic literal edges obey boundaries but do not create static cycles. Full-scope owned unused findings require precise retained API/import/declaration/runtime evidence. Any remaining nonzero Knip tool/config exit fails. Repair leaves stale debt/contracts until explicitly shrunk. Inline lint directives do not authorize exceptions.

### 4. Validation / Error Matrix

Mutation/owner transfer, changed multiplicity, duplicated JSON keys, stale removal, producer/evidence changes and unsupported tool outputs fail. Formatting/line relocation, exact parser tokens, type-only edges, supported retained APIs and caught error identity pass. Anonymous and named expression callback ownership binds actual call/new kind, optional call, argument role, other arguments, callback flavor/self-binding and control-flow owner. Indistinguishable callback/control boundaries cannot receive debt. Complexities, depth and nested ternary are visible review warnings; they cannot be baselined as debt.

### 5. Good / Base / Bad Cases

Good: narrow unknown values at actual boundaries and remove unused internal exports without changing bodies. Base: thirteen reviewed diagnostics preserve five sanitized wrappers, seven original failure/cancellation transports and one guarded every-render draft reconciliation. Seven unused contracts retain two stylesheet imports, one TypeScript companion declaration, two explicit native runtime/virtual imports and two documented audio deletion APIs without current UI callers. Bad: blanket ignores, automatic import of all baseline errors, every-src-as-entry reachability, arbitrary test deletion or assertions that hide unsafe inputs.

### 6. Required Tests

Actual production CLI must reject sibling callback and branch debt transfers, support formatting/recursion, detect stale/decreased debt and exact evidence changes, and preserve Knip exit authority. Accepted E07 runs 88 such cases. Run actual strict app types, full tests, model verification, build and Node22 fresh locked installation. Native draft test requires explicitly injected browser/runtime and proves stable primitive and memoized external values after in-flight persistence. Default CI skip is explicit; an opt-in acceptance run must prove execution. Current E07 exact local verification: 172 files/3028 tests, 419 owned graph files/1644 static value edges/6 literal dynamic edges, zero cycles/forbidden/unallowed findings, 512 visible review warnings. These are dated proof counts, not fixed acceptance thresholds.

### 7. Wrong vs Correct / Attribution and Limits

Wrong: zero warnings claim, counted unresolved historical metadata imports as repairs, normalized an unexplained tool exit into success, or treated source counts as user-visible performance. Correct: complete historical imported vendor/dependency closure, individual before/current rule interpretation, exact independent coverage, explicit generated-route token equivalence/restoration and real source hashes. Local macOS Node22 proof is not Linux GitHub execution; offline/generated-media native tests do not establish paid providers, mobile/device/OS scheduling, battery or latency behavior.

## Type-safety addition

### 1. Scope / Trigger

External package/JSON/provider results and legacy IndexedDB normalization are unknown until their existing field-specific contracts narrow them.

### 2. Signatures / Owners

`domain/legacyScalar.ts` owns only explicit historical primitive coercion. Package codec/slot/domain/database migration owners define required/optional/text/ID/foreign-key policies. Local object records, OGL uniform maps and union predicates stay next to their consumers; no global factory or duplicated schema framework.

### 3. Contracts / Invariants

Accept documented string/number/boolean/null/undefined primitives only at the designated legacy fields. Preserve historical defaults, trimming and identifier collision/reference checks. Reject structured arrays/objects and unsupported modern identity values before coercion; extension bags remain structured where documented. Keep discriminated union callbacks typed, capture narrowed values before asynchronous callbacks, and preserve original thrown/cancellation values where contracts require identity.

### 4. Validation / Error Matrix

Legacy primitive conversions retain exact historical outputs. Invalid modern IDs/FKs, duplicate/coercion collisions and structured forbidden inputs reject with their existing actionable boundary errors. Typed-only edits preserve emitted bodies; actual runtime changes need behavior evidence. Do not widen types to any, cast raw values to entity records, or stringify an unchecked provider terminal status.

### 5. Good / Base / Bad Cases

Good: exact unknown-array guards and typed per-key dictionaries preserve existing bounds and ordering. Base: null-prototype model lookup retains own-key behavior; responses terminal status first narrows to string. Bad: treating an assertion as validation or broadening legacy conversion to arbitrary objects and future package profiles.

### 6. Required Tests

Meaningful legacy primitive/modern ID/FK/collision/migration package tests, unknown boundary/tool behavior and original/current emitted-body proof apply to their actual owners. Keep immutable prior fixtures and their exact current API adapters; narrow adapter scope rather than rewriting historical modules.

### 7. Wrong vs Correct

Wrong: metric count reduction as behavior proof, mass ESLint fixes without before-byte/body checks or removed meaningful compatibility tests. Correct: exact per-file independent review and current consumer/type/native regression evidence, separating mechanical assertions/exports from behavior-changing boundary validation.

## Hook-guidelines addition

### 1. Scope / Trigger

Use actual effect dependencies and stable callback ownership for live references, async imports, active run predicates, audio cursor/player effects and deferred external draft reconciliation.

### 2. Signatures / Owners

Keep existing components/hooks. Exact runtime type predicates express narrowed active business state; refs retain current owned readers and callbacks. `useDebouncedDraft` owns external JSON-version tracking and its guarded reconciliation attempt.

### 3. Contracts / Invariants

Track an external version only after controller rebase succeeds. A value arriving while persistence is in flight must be retried after completion even if its primitive value or memoized object identity does not change. Guarded every-render reconciliation preserves equality/version guards and does not loop. Hook suggested dependencies must be assessed against lifecycle semantics before adopting them.

### 4. Validation / Error Matrix

Updated external values during pending save reconcile after successful completion and subsequent renders. Failures retain exact local draft and original error identity. Task/session replacement retires async ownership, and effects clean up listeners, observers and audio/player resources.

### 5. Good / Base / Bad Cases

Good: capture full call context for dependent async work and cancel retired operations. Base: stable primitive/memo value rebase succeeds after persistence completes. Bad: adding only initialValue/controller dependencies and permanently missing a deferred failed rebase attempt.

### 6. Required Tests

Actual ReactDOM/TextDraftField/Dexie primitive and memoized regression must reproduce the dependency-only failure and pass the guard implementation. Deterministic hook-host tests have explicit scheduler limitations; retain native scene evidence for actual relevant ownership.

### 7. Wrong vs Correct

Wrong: automatic Hook autofix or fake hook rendering as proof of all React scheduling. Correct: individual reviewed effect contract, one exact documented Hook allowance and current native source/body/DB proof. No StrictMode/concurrent or OS behavior claim beyond executed cases.

## Material API update

Replace the old canonical `useMaterialInProject` reference with `adoptMaterialInProject`. This is an imperative DB command, not a React Hook; existing source/native/test callers use the new name. Immutable D05 modules retain the old spelling only through the precisely scoped original-materials test adapter. No broad alias is added to the live DB module.
