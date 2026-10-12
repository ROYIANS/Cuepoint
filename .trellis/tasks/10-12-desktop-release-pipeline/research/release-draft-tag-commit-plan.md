# Completion Tag Repair — Concrete Commit and Recovery Plan

## Reviewed outcome

The completion PATCH explicitly retains manifest tag/source; strict ownership
checks stay intact. Focused7/full99 release tests, desktop types/lint/Knip,
diff-check and independent review pass. The current complete501 draft has seven
uploaded assets. Read-only metadata-byte/server-hash verification reproduces its
complete payload marker and existing Git-tag source; no runtime test is claimed.

## Proposed local work commits

### 1. `fix(release): retain tag and source when completing drafts`

- `desktop/tauri/scripts/publish-draft.mjs`
- `desktop/tauri/scripts/release-pipeline.test.mjs`
- `.trellis/spec/frontend/desktop-distribution.md`

### 2. `docs(release): record completed assets and tag recovery proof`

- `.trellis/tasks/10-12-desktop-release-pipeline/check.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/design.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.jsonl`
- `.trellis/tasks/10-12-desktop-release-pipeline/implement.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/prd.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/task.json`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-upload-http-boundary.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-draft-tag-boundary.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-draft-tag-implementation.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-draft-tag-review.md`
- `.trellis/tasks/10-12-desktop-release-pipeline/research/release-draft-tag-commit-plan.md`

All14 paths belong to this follow-up and are attributed to root/implement/check.
Unrecognized modifications: none. No raw research output, logs, installers,
metadata JSON or dependency copies are included. The old65 recovery instructions
are labeled superseded; they must not run against the moved501 tag.

On confirmation create both local work commits on
codex/release-draft-tag-retention, fast-forward local main and remove the merged
development branch. Do not push. Archive/journal completion is separate until
the actual delivery outcome is verified.

## Specific owner-authorized GitHub recovery

- Object: existing unpublished release410798352, currently
  untagged-9da48a16a3d20375b28d, complete501143bd marker and exact seven assets.
- Action: PATCH that ID with tag_name=desktop-v0.1.0 and
  target_commitish=501143bdaeae10506743b2576ff453251077bfc2. Retain its exact
  current name/body, draft=true, prerelease=true and make_latest=false.
- Before writing, revalidate current release/marker/asset IDs and digests and the
  existing remote tag against the prepared snapshot. Stop if changed.
- After writing, verify actual association, unpublished mode, complete marker,
  unchanged name/body/asset IDs/sizes/digests and Git-tag source again.
- No deletion, reupload, installer rebuild, Git-tag movement, workflow rerun or
  public publication is included. The owner retains the final Publish action.

The exact request and read-only proof are prepared in a temporary directory
outside Trellis. At plan presentation, no remote recovery had been executed. Local source regression
proof does not substitute for the post-PATCH actual outcome.

The complete local grouping is presented for project workflow Phase3.4's single
confirmation. The remote draft-association write requires explicit approval of
the concrete action above; it is not inferred from local implementation approval.

## Owner-approved actual recovery — 2026-10-13

The owner replied `ok` to the complete local commit grouping and specific remote
association repair. Root re-read the release/current tag and rechecked exact
ID/mode/name/body/marker/asset IDs/sizes/digests before PATCHing release410798352.
The response and a fresh GET both confirm tag_name=desktop-v0.1.0,
target_commitish=501143bdaeae10506743b2576ff453251077bfc2, draft=true,
prerelease=true, immutable=false. Name, complete body and every one of seven
asset identities/hashes are unchanged. The existing Git tag still points to501.
No deletion, asset upload, workflow rerun or public publication occurred.

GitHub still returns a temporary draft html_url containing untagged despite the
correct actual tag_name field; the API field/marker/current Git ref, rather than
that webpage slug, establish the restored association. Current owner-review URL:
https://github.com/ROYIANS/Cuepoint/releases/tag/untagged-cb375d029bf7f34f9d6c

The historical attempt2 Actions failure remains recorded; the current complete
draft is restored and ready for owner review/publication. Source fix work commit
`168a28e2b87547a0b2bb402c6aa0a61ba987f39c` ensures future completion requests explicitly retain the tag.
The approved documentation work commit records this actual checkpoint before
local main integration; pushing and public publication stay with the owner.
