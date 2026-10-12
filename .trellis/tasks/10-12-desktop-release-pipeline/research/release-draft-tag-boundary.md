# Draft Completion Tag Retention — 2026-10-13

## Reached failure and authenticated observation

The owner supplied a draft showing UPLOAD COMPLETE/source 501143bd, while the
publisher failed at owned() immediately after its final PATCH. Authenticated
read-only GitHub inspection confirmed release 410798352 remains draft=true,
prerelease=true and immutable=false, but tag_name is
untagged-9da48a16a3d20375b28d. Its complete ownership marker still specifies
desktop-v0.1.0 and source 501143bdaeae10506743b2576ff453251077bfc2, with
payloadDigest e6238995c358df7911976ddc05a6617880682d29126d4dd81b7e80c5d5c78bc4.
All seven expected assets are uploaded and expose sizes and SHA-256 digests.

Run 38271681646 attempt 2 reached the final response check. Every pre-PATCH
owned read passed, and complete notes persisted. The persisted tag field now
differs, explaining the exact failing condition; the draft/mode/immutable fields
are valid. The final PATCH supplies body, draft, prerelease and make_latest but
omits tag_name and target_commitish. GitHub's official update contract allows
these explicit fields; it does not document an omission resetting a draft tag.
Describe the reached result as observed integration behavior, not a universal
documented PATCH rule.

Reference: https://docs.github.com/en/rest/releases/releases#update-a-release

## Smallest local repair

- Product-tool owner: desktop/tauri/scripts/publish-draft.mjs. Explicitly retain
  manifest.context.tag and sourceSha in the completion PATCH. Keep draft=true,
  prerelease=true, make_latest=false and the strict final owned() check.
- Regression owner: desktop/tauri/scripts/release-pipeline.test.mjs. Drive the
  normal collector/publisher flow with a GitHub API fixture that assigns an
  untagged name on a draft PATCH missing tag_name. Require exact tag/source and
  complete closure after repair; retain failures if the server nevertheless
  returns changed mode/tag/ownership. Existing fake Object.assign semantics
  conceal this reached boundary.
- Root owns task/spec conclusions and concrete local commit/recovery plan.
  Independent Trellis check reviews the frozen source and unchanged workflow.

No broad untagged discovery, ownership bypass, installer rebuild, version/tag
movement, asset overwrite/delete, automatic public publication or CI tests are
part of this source correction. Existing fully uploaded assets must be retained.

## Validation and recovery boundary

Use approved local Node24.11.0/pnpm; meaningful focused red/green, complete release
tests, desktop types/lint/Knip, independent review and diff-check. Preserve the
earlier Content-Length correction and packaging-only workflow.

Read-only recovery preparation may compare the uploaded manifest/SHA256SUMS and
seven asset digests against the complete marker and current remote tag. A
concrete owner-authorized recovery would change only the existing draft's tag
association to the already-existing desktop-v0.1.0/source501143bd, preserving its
ID, assets, complete notes and unpublished mode. Do not perform that remote
PATCH solely from implementation approval. The old65 recovery is superseded by
the owner's changed tag/new run. No further obsolete-draft deletion applies to
this current complete501 draft.

## Final local and read-only recovery proof

Seven new completion regressions and all99 release tests pass. Desktop
types/lint/Knip and diff-check pass; independent review reports no unresolved
finding. The only production change is the completion PATCH's explicit
tag_name/target_commitish fields; strict final checks and both workflows remain.
See [implementation](./release-draft-tag-implementation.md) and
[independent review](./release-draft-tag-review.md).

Root downloaded the existing release-manifest.json and SHA256SUMS assets to a
temporary directory, hashed their actual bytes and compared them with GitHub's
asset digests. The exact checksum file matches the manifest's five installers;
every installer's remote uploaded state, length and SHA256 matches that manifest.
The seven-file payload digest recomputes to
e6238995c358df7911976ddc05a6617880682d29126d4dd81b7e80c5d5c78bc4, exactly matching
the complete ownership marker. The current existing remote desktop-v0.1.0 tag
resolves to the same501143bd source. These are metadata-byte/server-hash checks;
installer bytes were not fully downloaded or executed. An earlier large-artifact
download was stopped when slow, and an initial metadata request hit EOF before
a successful bounded retry. Neither is described as a completed original-bundle
download or runtime test.

The concrete recovery request for release410798352 explicitly sets tag_name to
desktop-v0.1.0 and target_commitish to501143bdaeae10506743b2576ff453251077bfc2,
retaining its current exact name/body, draft=true, prerelease=true and
make_latest=false. No asset mutation or Git-tag change is requested. Request JSON
and downloaded metadata stay temporary outside Trellis. Before an authorized
PATCH, re-read the release/current tag and require unchanged ID, unpublished mode,
complete marker and exact asset IDs/digests; after it, verify tag/mode/body/assets
again. Stop on changed state rather than overwrite owner edits.

At the read-only preflight checkpoint, no remote mutation had been performed. Restoring the current complete draft does
not require another upload or rerunning the old501 job; that job checks out the
older publisher and can lose the association again. Its historical failure can
remain recorded while the owner reviews this verified package set. Future tag
builds must include the local completion-payload repair.

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
