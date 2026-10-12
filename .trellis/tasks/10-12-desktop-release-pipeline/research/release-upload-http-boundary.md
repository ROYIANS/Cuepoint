# Release Asset Upload HTTP Boundary — 2026-10-12

## Reached failure

The owner reports that all installers built but the tag-only draft job failed in two seconds at `POST /repos/ROYIANS/Cuepoint/releases/410451700/assets` with HTTP 400. The release ID in the upload URL shows the publisher reached asset upload; the log does not include the response body. Do not infer a token/permissions, duplicate-file or package-build failure from this status alone.

## Source and smallest gap

`githubApi.upload` in `desktop/tauri/scripts/publish-draft.mjs` supplies a Node file stream to `fetch` without an explicit `Content-Length`. GitHub's official release-assets contract requires that header. A stream does not carry an automatically known byte length. Existing publisher tests use a high-level fake upload method, so they do not check the real HTTP request framing.

Reference: https://docs.github.com/en/rest/releases/assets#upload-a-release-asset

## Change boundary

- Owner: `desktop/tauri/scripts/publish-draft.mjs`; measure the upload file's byte size and send that length with its existing streaming binary body. Keep the upload URL trust boundary, content type, authentication, draft-only behavior, hash/ownership reconciliation and no-overwrite checks.
- Regression: add focused actual HTTP/wire-framing tests at the GitHub API adapter boundary, demonstrating the old chunked request and corrected explicit byte length, complete binary parity and unchanged failure propagation/stream cleanup. Keep existing publisher protocol tests.
- Reports/spec/task context: root records concise Markdown conclusions and reviewed contracts. Raw output stays temporary outside the task.

No installer rebuild, version/tag movement, draft deletion, public publication, remote upload, workflow dispatch or CI test reintroduction is part of the local repair. Original successful package artifacts may support owner-controlled recovery after the adapter passes review. Re-running the old Actions run executes its original source, not a later local correction.

## Verification target

Use approved Node 24.11.0 and local-machine pnpm. Run focused regressions, the existing desktop release suite, desktop types/lint/Knip, and independent source/recovery review. A local wire test proves request framing, not successful hosted asset upload. Do not claim the exact remote 400 response body was inspected unless it becomes available.

## Read-only hosted checkpoint

Public GitHub Actions metadata confirms the owner report:

- Tag run: https://github.com/ROYIANS/Cuepoint/actions/runs/38230826261
- Event `push`, source `65b4b61db76c3b112154df251f2c97bf9db8ea80`, attempt 1.
- Prepare, all four build targets and collect succeeded; only draft failed.
- Complete set artifact `desktop-set-38230826261-1`, ID `11739003244`, 211,771,731 ZIP bytes, not expired at review. Reported artifact ZIP digest: `sha256:b3703a4f241e1755ea2f192e5ac1939a3a3f0fe17d316e102186d285024c39ef`. No asset bytes downloaded in this read-only inspection.
- Earlier manual run `38229025571` succeeded from the same source, and correctly had no draft lane.

GitHub CLI is installed but the current execution environment has no authenticated session. Draft details and response body were not inspected. Public metadata establishes successful builds/collection, not original package bytes or software runtime acceptance.

A researcher drove the existing `githubApi.upload` through real Node 24.11.0 fetch to a loopback HTTP service with a 70,000-byte binary file. It observed no Content-Length and chunked framing; a server requiring length returned 400. The same request with exact length returned 201 and complete byte parity. This establishes the adapter defect independently; it does not claim the original remote response body was recovered. Temporary probe files were cleaned.

## Final local outcome

The adapter now sizes and streams one opened FileHandle, supplies Content-Length and closes resources in finally. Eight actual HTTP regressions, all 92 release tests, desktop types/lint/Knip and diff-check passed. Independent review found no unresolved source issue; both workflows, policy, artifact verifier and publisher protocol remain unchanged. See [implementation](./release-upload-http-implementation.md) and [independent review](./release-upload-http-review.md).

## Concrete original-set recovery

Recovery uses the corrected local publisher and exact artifact from the original tag run. `verifyReleaseDirectory` does not compare the current Git HEAD; the release policy and artifact validator are unchanged by this repair. The original manifest/source/tag/payload remain authoritative. Actual installer bytes, the private draft and its ownership marker have not been inspected locally. The publisher will verify them and stop on changed or unknown assets; it will not delete or clobber them.

The following commands are prepared for owner-controlled recovery, not executed. Run from this repository with the corrected publisher and an authenticated GitHub CLI account that has Release write access. Keep shell tracing disabled so `gh auth token` is passed only to the child environment.

```bash
cd /Users/xiaomengdao/WebstormProjects/aifenjing

cuepoint_release_dir="$(mktemp -d "${TMPDIR:-/tmp}/cuepoint-release-resume.XXXXXX")"

gh run download 38230826261 \
  --repo ROYIANS/Cuepoint \
  --name desktop-set-38230826261-1 \
  --dir "$cuepoint_release_dir"

env \
  GITHUB_TOKEN="$(gh auth token --hostname github.com)" \
  GITHUB_REPOSITORY=ROYIANS/Cuepoint \
  GITHUB_SHA=65b4b61db76c3b112154df251f2c97bf9db8ea80 \
  GITHUB_EVENT_NAME=push \
  GITHUB_REF=refs/tags/desktop-v0.1.0 \
  GITHUB_RUN_ID=38230826261 \
  GITHUB_RUN_ATTEMPT=1 \
  /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node \
  desktop/tauri/scripts/publish-draft.mjs \
  --directory "$cuepoint_release_dir"
```

Execute the second command only after the artifact download succeeds. A successful recovery verifies five installers plus two metadata assets and marks UPLOAD COMPLETE, retaining Draft + Pre-release for the owner to publish. No new build or version/tag change is necessary. Merely merging this repair into main then using Re-run failed jobs on the old run still checks out its old tag source.

References: [GitHub CLI artifact download](https://cli.github.com/manual/gh_run_download), [GitHub workflow rerun source identity](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs). Hosted recovery and public publication remain unperformed; the task stays in progress.
