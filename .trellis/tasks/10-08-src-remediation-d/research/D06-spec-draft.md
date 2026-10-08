# D06 generation capability contract draft

Coordinator preparation only. Existing model facts and boundary differences below are requirements, not a new implementation or current-provider verification. Exact accepted owner/signatures must be filled after D06 independent PASS.

## 1. Scope / Trigger

Maintain this contract when changing single/batch generation review controls, project output defaults, model parameter transitions or `profileRequest` validation. Share existing capability facts without conflating provider policies, UI representations, permissive import parsing and executable request validation.

## 2. Signatures / Owners

- `domain/generationCapabilities.ts` owns `GENERATION_CAPABILITIES`, existing ordered image/video constants/model predicates, `GenerationCapability`, `CapabilityParameters`, `ParameterContext` and `ParameterIssue`. Actual pure entry points are `getGenerationCapability`, `defaultImageParameters`, `defaultVideoParameters`, `projectGenerationParameters`, `generationResolutionChange` and `validateGenerationParameters`; exact final contracts are subject to independent acceptance.
- Existing `GenerationConfigurationFields` remains the shared single/batch UI. Project output settings remains its APIMart-specific adapter with its own components and draft/CAS lifecycle. Existing profile schema/type owner from D05 remains authoritative for tool arguments.
- `domain/output.ts` retains actual compatibility exports and project-default parsing/version/native-key responsibilities. `generationProfiles.ts` retains D05 schema ownership and delegates the shared facts/parameter validator, with `GENERATION_PROFILES` referencing the actual capability list. Existing model/mode/owner orchestration remains in its feature consumers; no form registry is introduced.

## 3. Contracts / Invariants

- Preserve every current model name, option ordering/case/default and provider-specific legal combination. Do not add model support, import repair, profile versions or new gateway parameters.
- Model/mode changes project allowed parameters from the same capability facts used by validation. Preserve prompt, target IDs, approved input roles and connector session; remove only fields that the existing transition already removes. Incompatible proposals remain visible/actionable rather than silently repaired into executable requests.
- APIMart frame request may represent follow-input ratio as omitted/adaptive, while persisted project defaults require explicit adaptive. Treat these as boundary representations, not permission to omit an arbitrary fixed ratio.
- Existing `profileRequest` missing-mode derivation remains inputs ? reference : text; it does not infer frame roles. Explicit user application of selections owns frames/reference/text derivation. Rendering cannot silently authorize a proposal with first-frame inputs and missing mode.
- Preserve existing duration/resolution/reference constraints, current image/video ratio sets and upload/input limits. UI hiding a field does not prove an invalid request is safe; executable validation remains authoritative.
- Single/batch call/revision/project/busy ownership, explicit confirmation, remembered defaults, paid submission/recovery, receipt/ledger and mutation guards remain in their existing owners. Saving project defaults cannot submit paid work.
- Project default parsing remains permissive for historical imports, while supported-profile validation and explicit editor Save stay strict. CAS/rebase/acknowledge/dirty/retry/latest semantics remain unchanged.

## 4. Validation / Error Matrix

| Condition | Required behavior |
| --- | --- |
| Unsupported provider/model or parameter | Existing explicit validation error; no paid submission |
| Model/mode switch | Preserve target/input/prompt/session identity; apply only the existing legal parameter transition |
| Incompatible reference/frame/resolution/duration | Explain/reject through authoritative validation; no rendering-time permission |
| Hidden stale field | Preserve existing clear/omit behavior consistently across review and project defaults |
| Busy/revision changes during review | Existing synchronous ownership/confirmation guard prevents wrong target submission |
| Save defaults | Persist reviewed defaults with existing CAS; zero generation request |
| Historical unsupported stored values | Preserve import compatibility and explicit invalid editor feedback |

## 5. Good / Base / Bad Cases

- Base: single and batch use the existing shared fields with the same ordered capability projections.
- Good: project defaults adapt APIMart follow-input semantics without changing request representation; invalid combinations remain editable and do not submit.
- Good: model switches preserve target and inputs, and saving defaults makes no paid provider call.
- Bad: a generic form registry hides policy differences, rendering infers frame mode, imports are silently upgraded, or a model option newly becomes executable without accepted gateway policy.

## 6. Tests Required

Compare actual before/after model matrices, ordered options/defaults and runtime validation. Cover every supported model, important negative parameter/reference combinations, hidden field transitions and target/input/session preservation. Use actual single/batch/project settings consumers, including busy/revision/confirmation and save-defaults-no-submit behavior. Keep D05 advertised-schema bytes/type fixtures and D01 preparation/paid recovery contracts intact where overlapped. Native UI/DB checks must demonstrate concrete changed state/CAS risks, not claim provider support from local mocks. Preserve failures and do not weaken assertions/timeouts.

## 7. Migration / Limits

No form factory, provider request framework, audio/music capability rewrite or unrelated layout/performance work. Shared facts/projections have actual consumer responsibilities; separate adapter policies remain explicit. Model catalogue data and finite local fixtures do not independently verify live provider availability or paid output. D07 transport, D08 drafts and E/QG01 remain later work. Whole-D current-source acceptance and model/build/native gate remain mandatory.
