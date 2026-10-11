# AIHubMix provider vision metadata correction

## Change boundary (before implementation)

Root actual attachment preflight rejected the selected model with unknown vision capability. The public official catalog receipt in `aihubmix-gpt6-luna-public-vision.json` declares `input_modalities: "text,image"`, but has no capabilities.vision. AIHubMix already normalizes these modality tokens; its normalized `metadata` only uses the generic explicit capabilities parser. Fix the missing provider-specific mapping at that existing row boundary.

Owners: `src/lib/ai/aihubmix.ts`, a new meaningful `tests/aihubmixVisionMetadata.test.ts`, the existing AI connector spec section if required, and this follow-up's research reports. Explicit boolean capabilities.vision (including false) takes precedence; otherwise only valid normalized exact image input yields a positive declaration. Missing, malformed or non-image modality never yields a guessed positive. Keep generic metadata parsing, model-name policy, vision guard, durable run creation, wire encoders and all other providers unchanged. No manual override, profile/credential mutation, actual model call, build or CUA. Root owns final packaging and real image inference.

Initial reproduction, final checks and frozen hashes follow after their commands finish. Source tests do not prove current key entitlement or paid-provider inference.


## Implementation and outcome

`listAIHubMixModels` now parses explicit generic metadata once, then supplements only its missing vision field from AIHubMix's existing validated/normalized input tokens. An exact `image` input token supplies provider `vision:true`; explicit boolean vision (especially false) is preserved. Missing/invalid/non-image input supplies no invented positive, leaving the existing exact model-bank/unknown resolution unchanged. Duplicate rows retain the existing conservative false precedence and minimum capacity, and special model IDs retain null-prototype lookup safety. Chat classification still rejects known media output or incompatible endpoints.

Only `src/lib/ai/aihubmix.ts` changes product behavior. Existing connector test's exact expected result now includes the new metadata, without weakening classifications or auth assertions. No model-name rule, generic parser change, manual override, guard bypass, run storage change, source fallback or extra request was introduced.

## Test proof and limits

The new 24 cases cover valid comma-string/array tokens, case/spacing normalization, absent/invalid/non-image modality, explicit true/false precedence, duplicate conflict, special IDs and media classification. Two integration cases use the selected supplier row's exact relevant fields, real local PNG import and `beginAgentRun`, then both Chat and Responses materializers. Wire data contains the exact imported PNG bytes; persisted run/message records do not retain image base64. Four reject cases create no run/messages and keep the imported reference. Discovery HTTP is injected, so this proves the exercised shared code/data path, not native transport, account entitlement or actual visual analysis.

Before product correction, seven of the initial 24 regressions failed, including both real attachment preflight cases with unknown-vision rejection. The initial array parameter tables were corrected to wrap each input in an object, ensuring Vitest supplies full array inputs. After correction, all new cases passed; a related old exact-object expectation failed because it omitted the new metadata and was updated. Strict compilation caught a missing required protocol in the new connector fixture; it was repaired. All initial failed logs remain separately recorded.

| Gate | Observed result | Evidence |
| --- | --- | --- |
| Final full root Vitest | 212 files; 3610 passed; one skipped | `aihubmix-vision-full-vitest-final.log`, 19:45:07 / 35.52s |
| Focused discovery/metadata/references | Five files; 237 cases passed | `aihubmix-vision-focused-final.log`; subsequent protocol fixture typing change additionally covered by final full suite |
| Root TypeCheck | PASS | `aihubmix-vision-root-types.log` |
| Strict new test typing | PASS, exit 0 / empty normal output | `aihubmix-vision-test-types-final.log` |
| Root quality | PASS | `aihubmix-vision-root-quality.log` |
| Whitespace | PASS | Observed `git diff --check` exit 0 |

Quality retains 13 reviewed allowances, 568 visible review warnings and zero failures; one additional complexity warning is visible, with no allowance added. Architecture remains 460 files / 1857 static edges / nine literal dynamic edges / zero cycles. Desktop/Rust/vendor inputs were not changed by this bounded fix, so their previous successful checks are reused without claiming newly executed runs. This reviewer ran no build, CUA, paid request, public HTTP fetch, credential/profile edit, commit or archive.

## Frozen evidence and follow-up

[The source freeze](aihubmix-vision-source-freeze.json) contains all four changed product/test/spec paths; [the verification receipt](aihubmix-vision-verification.json) records completed exits, raw hashes and retained failure history. The official public supplier GET receipt is `aihubmix-gpt6-luna-public-vision.json`; it declares input capability but is not proof of key entitlement or inference quality. Root owns serial packaging and actual same-model image dispatch, draft-retention and image-response observations. Whole task acceptance remains open. Root separately reported successful new-bundle A4 landscape / three-page PDF saving; its system evidence oracle is outside this mapping review.
