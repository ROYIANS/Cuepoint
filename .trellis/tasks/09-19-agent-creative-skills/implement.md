# Implementation sequence

User approved the reviewed plan on 2026-09-19; task activated.

1. Build the business operation matrix from domain types/repository methods. Add strict schemas and bounded read/search tools for every included entity. Review reserved studio and ownership handling.
2. Implement CRUD/domain operations using existing repository services, revision checks, concrete approval previews and atomic tool-result bookkeeping. Validate replay and cascading changes before adding network effects.
3. Wire grouped skills and flat entity/action/result UI. Verify ordinary-chat exclusion and immutable permissions across ask/assist/full.
4. Add durable generation job types, additive Dexie migration and repository transitions. Define unknown submission, remote task identity, downloaded result and application states before adapter orchestration.
5. Integrate supported APIMart/AIHubMix image/video capabilities, polling controller, recovery, result download and target association. Reuse domain proposals and conflict handling. Test remote/local crash windows and deletion races.
6. Verify cross-entity scenarios and polish desktop/mobile previews, approvals and recovery. Update specs and record results before committing.

## Validation
Use /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm for lint, test and build.
- Entity schemas, CRUD and scope matrix; dangling references and cascades; bounded batch/pagination behavior.
- Frozen approval, stale revisions, duplicate/resumed writes, deleted target and pending editor drafts.
- Fake provider submit/query/download contracts for both existing adapters, including no-ID uncertainty and no duplicate paid POST.
- Restart during each generation stage; concurrent tabs; stop/end semantics; model limits and continuation.
- Desktop/mobile UI: short readable action rows, change previews, result previews, navigation and visible failure/recovery states.
- Full regression suite once integrated. Browser fixtures never use live credentials or charge paid services.

## Risk checkpoints
- Database migrations must be additive; keep persisted tool/job snapshots readable.
- Do not expand supported models beyond verified adapter/profile contracts.
- Existing generation-intent helpers do not yet provide the new durable executor.
- Existing restore helpers are selective; do not introduce an unsupported universal undo claim.
- If implementation reveals a new product decision beyond confirmed scope, record evidence before changing the scope.

## Completion
All six implementation steps completed. Independent review findings resolved. Full gate:653 tests, lint, build and browser fixtures passed. See validation.md. Pending Phase3.4 commit confirmation; no archive/journal commit yet.

Follow-up: defaults now enable all six skills for both fresh and legacy configurations through one-time persisted migration. Four regression cases added; settings/tools/runs35 tests and lint pass.

## Generation-review follow-up
AI-prepared editable confirmation is implemented. Immutable original envelopes + atomic confirmed override; requiresConfirmation for paid submit in all modes; per-kind defaults and independent project/global recommendations; flat responsive form with model/profile-dependent controls, reset/cancel and default save/clear. Independent review fixed input-mode loss when switching providers/defaults. Final gate and browser results are recorded in validation.md.

## Execution segment follow-up
1. Add durable segment accounting and atomic budget pause; retain existing tool/approval recovery constraints.
2. Update runtime and existing status/actions without adding a separate panel.
3. Exercise cap/resume/reload/no-replay regression tests, full type/test gates and a browser pause/continue fixture. Document the new budget contract.

Segment follow-up complete: 32-request pauses, explicit allowance extension, accurate paused UI, legacy recovery and no-replay coverage. Full697-test gate and browser continuation check pass; see validation.md.
