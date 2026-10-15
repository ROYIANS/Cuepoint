# Epic coordination plan

## Current planning work

- [x] Record owner authorization for one epic, sequential delivery and in-place details.
- [x] Link the original investigation and create independently verifiable backlog children with explicit dependencies.
- [x] Map every original finding to a child in `roadmap.md`.
- [x] Record the selected narrow-window full-width/no-drawer behavior.
- [x] Finish E01 source review, edit-scope convergence, technical design and actual validation plan.
- [x] Validate all task links, dependency records and context manifests (18 records; no context warnings after explicit full-reading guidance for large specs).
- [x] Present the task tree and the selected first-delivery scope to the owner.

## Sequential delivery protocol

1. Keep the parent planning; select E01 as the recommended first delivery and then E02-E05 as the early experience sequence. The owner may reorder independent children.
2. Read the selected child's evidence and scope-specific specs, resolve its product decisions, and write reviewed `prd.md`, `design.md` and `implement.md` for complex work.
3. Review the concrete delivery summary before activation; task-creation authorization does not stand in for a completed implementation plan.
4. Activate only that child, use the Trellis implement/check sub-agents for its bounded implementation and quality review, then integrate findings/spec changes in the parent session.
5. Run checks appropriate to the changed owner, complete actual user-visible acceptance, and checkpoint/archive only under the applicable authorized finish workflow.
6. Update the roadmap, dependency readiness and cross-delivery acceptance. Then converge the next delivery rather than attempting all backlog items in one branch.

## Validation planning

Task-organization validation uses `python3 .trellis/scripts/task.py validate <task-dir>` and link/JSON/dependency consistency checks. Product checks are not run for these documentation changes.

For future product children, use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` explicitly. Root scripts currently include `lint`, `quality`, `test`, `workspace:check` and `test:storage:native`; app/package scripts are selected only when relevant. Real UI behavior and the affected native/package lifecycle need separate acceptance from compilation. E01 must add its concrete source-backed test/fixture commands before implementation review.

## Parent completion

The parent owns integration review, not implementation of every child by itself. Confirm chosen delivery evidence, residual/deferred scope and current docs. Keep source findings and genuine runtime evidence distinguishable. No branch creation, commit, merge, push, release or archive is requested by the present task-organization action.
