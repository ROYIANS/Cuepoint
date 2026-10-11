# Execution plan

> Runtime reconsideration (2026-10-11): the user questioned Electron weight and requested SiYuan research. Electron-specific implementation has stopped, with unaccepted code/probes preserved. This Electron candidate plan is historical pending a runtime decision and updated planning; it does not authorize further Electron-specific work. Storage acceptance requirements and parent decisions remain in force. See `research/runtime-reconsideration.md`.

## Approval and sequence

The user's 2026-10-11 "开始吧" explicitly approves the coordinator's next-step recommendation: pinned native runtime, managed file/SQLite persistence, reopen, backup and failure recovery on isolated fixtures. The child records that authorized scope. Do not request the same start permission again. Permanent runtime selection, production migration and external deployment are not implied.

1. Research actual runtime/API/build/security constraints; persist primary-source findings. Curate context and activate the child only after PRD/design/plan are ready.
2. Dispatch one `trellis-implement` owner for `desktop/` package/source/build/tests/docs. It is not alone and may not revert root/generated/user edits. Use only the explicit local pnpm; dependency installation stays inside `desktop/` with Electron exactly pinned. No root dependency replacement, product migration, task lifecycle/spec/commit edits or nested agent dispatch.
3. Implement native persistent identity/schema validation, single writer, bounded owned staging/hash, short metadata transactions, recorded-intent recovery, availability checks, consistent backup and new-root restore. Follow existing portable path/hash owners without duplicating them.
4. Implement the narrow sandboxed local fixture shell/preload/main sender boundary and actual Electron capability/UI acceptance. Add permanent crash/backup/corruption/containment/second-writer tests with real child processes. Test failure hooks remain internal.
5. Freeze implementation source and run independent `trellis-check` review. Review all this child scope, not only the latest fix. Retain failed probe evidence separately from repaired results; fixes must be checked against the final source manifest.
6. Coordinator performs actual local native window/screenshot acceptance, unchanged root/helper quality gates, examines source hashes and claimed limits, and records the result. Existing WebStorm Vite process and generated-route formatting stay untouched.
7. Capture native contracts/pitfalls in a scoped specification. Produce one concrete local work-commit/archive/journal plan and ask for the Phase 3.4 confirmation only after acceptance. Keep parent in progress and do not push.

## Exit checklist

- [ ] Pinned actual Electron `node:sqlite` execution and minimal local renderer bridge.
- [ ] Stable reopened identity and exact records/asset/output/ref round-trip.
- [ ] Independent source copy, same-name and case/Unicode distinct paths, bounded copy/hash.
- [ ] Missing/corrupt managed bytes preserve logical records and refs.
- [ ] Native containment/link/type/length checks and live second-writer refusal.
- [ ] Actual process kill before/after materialization/metadata commit, idempotent recovery.
- [ ] Complete consistent DB/file backup, interrupted/corrupt rejection and new-root restore without overwrite.
- [ ] Exact unknown IPC/backup/DB boundaries, lifecycle/cancellation/serialization probes.
- [ ] Desktop strict types/lint/build/native tests; relevant portable-helper regressions and final root gates.
- [ ] Independent full-scope review, source manifest, screenshot and finite acceptance limits.
- [ ] Spec update and concrete commit plan; user owns push.
