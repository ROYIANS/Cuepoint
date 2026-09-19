# Project image discovery implementation plan

Status: implementation and native browser checks passed; final independent review/build and post-fix native rerun passed. Ready for commit approval.

## Activation
- [x] Obtain final integrated planning approval and activate this child only when its prerequisite is satisfied.
- [x] Load Phase 2.1 and dispatch trellis-implement with explicit file ownership; prohibit nested dispatch, unrelated rewrites and commits.

## Implementation
- [x] Implement scoped discovery with stable candidate locators and ambiguity/missing/current/reference/candidate handling.
- [x] Extend read_project_image with exclusive ledger-proven discovery input while preserving old bound mediaId behavior.
- [x] Implement bound/unbound native input validation and revalidation before/after encoding; retain live ownership and capability guards.
- [x] Update skill instructions, input pairing, history/compaction and source labels without granting mutation or arbitrary cross-project access.
- [x] Verify user-language tool loops, correct actual pixels, replacement/deletion races, provenance forgery and both protocols.

## Quality and finish
- [x] Focused regression suites then explicit local pnpm lint/test/build; git diff --check.
- [x] Main session independently runs native Edge/IndexedDB tests with mocked billed services, desktop/390px/keyboard; save reproducible evidence.
- [x] Independent trellis-check reviews the whole change, fixes concrete findings and reruns affected gates.
- [ ] Update executable specs and retrospective, prepare concrete commit plan, commit only with applicable authorization, archive child and record journal.

Commands use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; no bundled runtime pnpm or unnecessary installs. Do not claim authenticated/live model verification from mocks. Network requests during implementation use fixtures unless live paid calls are expressly authorized.

## Prerequisite and parent integration
Web-research child must be implemented and verified before activation. After this child, run combined web research + named-project image inspection and record parent AC1–AC5 evidence.
