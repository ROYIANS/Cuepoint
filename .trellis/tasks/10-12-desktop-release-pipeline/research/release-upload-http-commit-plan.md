# Release Upload HTTP Repair — Concrete Commit Plan

## Reviewed outcome

The GitHub asset adapter now supplies the exact Content-Length from the same
opened descriptor it streams, closing the stream/handle on success and failure.
Actual Node-fetch HTTP regressions demonstrate old chunked HTTP400 and corrected
full-byte framing. All 92 release tests, desktop types/lint/Knip and independent
review passed. Both workflows, release policy, verifier and publisher protocol
are unchanged. Source hashes remain the frozen values in the implementation and
review conclusions.

The public tag run's four builds and collector succeeded. The original sealed
set is available; no authenticated draft recovery or public publication has been
performed. Task status remains in_progress. No archive belongs in this batch.

## Proposed local work commits, in order

### 1. `fix(release): send exact content length for streamed asset uploads`

- `desktop/tauri/scripts/publish-draft.mjs`
- `desktop/tauri/scripts/publish-draft-http.test.mjs`
- `.trellis/spec/frontend/desktop-distribution.md`

### 2. `docs(release): record upload repair and original artifact recovery`

- `.trellis/tasks/10-12-desktop-release-pipeline/check.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/design.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/prd.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/task.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-upload-http-boundary.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-upload-http-implementation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-upload-http-review.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-upload-http-commit-plan.md`

## Attribution and integration

All 13 paths belong to this narrow follow-up and are attributed to the root,
implementation or independent-review agent. Unrecognized dirty paths: none.
Raw logs, evidence copies, installer binaries, dependency caches and generated
research output are not included.

On owner confirmation: create these two work commits on
`codex/release-upload-content-length`, fast-forward local main, remove the merged
development branch and leave pushing to the owner. No remote upload, tag
movement, dispatch, public publication or archival is part of this commit/main
integration confirmation. The reviewed original-set recovery commands are in
[the boundary conclusion](./release-upload-http-boundary.md).

Trellis workflow Phase3.4 requires the concrete file grouping to be presented
once for confirmation before local work commits. This document is that complete
grouping; no commit had been created when this plan was presented.

## Owner-confirmed checkpoint

The owner replied `ok` to the complete plan. Source/spec work commit
`74df43ea75258a39ee302c98149a4762ed693336` was created. The second work commit records this
checkpoint before the authorized local fast-forward main integration and branch
cleanup. Remote push and original-draft recovery remain unperformed.
