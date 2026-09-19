# Web research implementation plan

Status: implemented; lint/full tests/native verification passed. Independent build/review passed; ready for parent integration and final commit plan.

## Activation
- [x] Obtain final integrated planning approval and activate this child only when its prerequisite is satisfied.
- [x] Load Phase 2.1 and dispatch trellis-implement with explicit file ownership; prohibit nested dispatch, unrelated rewrites and commits.

## Implementation
- [x] Implement additive search configuration storage and fixed Tavily adapter with bounded responses, timeout, redaction and no auto retries.
- [x] Add connection controls and GET usage test; isolate from model dropdowns and exports.
- [x] Add strict search/read tools, setup/skill enablement, captured configuration checks and established network permissions.
- [x] Present source links/coverage and integrate task research observations without business-success claims.
- [x] Verify errors, cancellation, storage failures, deletion, completed-call replay and both protocols.

## Quality and finish
- [x] Focused regression suites then explicit local pnpm lint/test/build; git diff --check.
- [x] Main session independently runs native Edge/IndexedDB tests with mocked billed services, desktop/390px/keyboard; save reproducible evidence.
- [x] Independent trellis-check reviews the whole change, fixes concrete findings and reruns affected gates.
- [x] Update executable specs and retrospective, prepare concrete commit plan, commit only with applicable authorization, archive child and record journal.

Commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; no bundled runtime pnpm or unnecessary installs. Do not claim authenticated/live model verification from mocks. Network requests during implementation use fixtures unless live paid calls are expressly authorized.

## Closeout
User approved commit/archive on 2026-09-19. Work commits: 3bbcedc and 6ba3c83. Task archival and session journal are recorded in subsequent bookkeeping commits.
