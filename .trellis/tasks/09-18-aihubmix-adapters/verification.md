# Verification

## Integration checks
- Root integration checks: 4 files / 77 tests passed, covering catalog, connector persistence, APIMart and AIHubMix send guards, shared model-selection policy and project ZIP key exclusion.
- Root TypeScript lint passed.
- Browser smoke on local `/connectors`: AIHubMix card, installation modal, default Base URL and explicit public-catalog/probe copy visible. Empty-key connection test reports “请填写 API Key”. Public discovery with no key successfully returned 853 live catalog models. Modal closed without saving credentials.
- No live authenticated requests, key access or paid generation performed.

## Independent full-scope review
- Reviewed PRD, design, implementation plan, research and all check-context specs. Traced provider registration, public discovery, authenticated connection testing, connector-scoped model selection, pre-mutation send guard, native media parsing and guarded downloads against actual code paths.
- Confirmed existing APIMart and generic provider dispatch behavior, credential exclusion from project ZIPs, metadata failure/selection-change rejection, prototype-key normalization regressions, protected URL validation, abort propagation, error redaction and no automatic retry.
- Checked current official image/video and image task-list documentation: task envelopes, list pagination fields, required prompts, native reference fields and protected content routes agree with the client.
- Fixed one test-fixture issue in `tests/aihubmix.test.ts`: the native video reference test now uses documented `input_references: [{type: "image_url", url}]` and `frame_images: [{frame_type: "first_frame", image_url: {url}}]` instead of an incompatible reference shape. The exact-body assertion continues to prove the client preserves those fields. No product-code defects or unresolved design findings were identified.

## Final quality gate
Commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` exclusively.
- Lint / TypeCheck: passed (`tsc -b --pretty false`).
- Tests: 22 files / 308 tests passed, including 89 provider-client tests and all existing provider/repository regressions.
- Build: passed in 26.58 seconds. Existing large-chunk warning remains (`_studio.agent` 7,895.78 kB, gzip 1,903.69 kB); unrelated bundle restructuring is outside this task.
- `git diff --check`: passed.
- The native-reference fixture correction changes tests only; lint and full tests were rerun after that correction. The production build contains the final product code.

## Known limits
Public catalog is provider-wide, not per-key entitlement. Authenticated probe verifies task-list access only. Async tasks require provider-account activation. Optional schema discovery may be blocked by provider CORS. Generation UI, scheduler, job persistence and material writes remain deferred. Pre-existing `.tanstack/` remains untouched and excluded from the proposed commit.
