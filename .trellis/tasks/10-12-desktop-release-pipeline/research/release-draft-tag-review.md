# Independent Draft Completion Tag Review — 2026-10-13

## Result and observed boundary

No unresolved source or spec finding remains in the reviewed repair. No reviewer
source fix was required. Current authenticated observations from root supersede
the earlier unauthenticated stale-draft hypothesis: release410798352 contains
the complete501143bd ownership marker and seven uploaded assets, remains an
unpublished prerelease, but its persisted tag is `untagged-...`. The failure is
the final post-PATCH ownership check. Deletion/reupload of that current complete
draft is not the recovery plan.

GitHub's [update contract](https://docs.github.com/en/rest/releases/releases#update-a-release)
permits explicit `tag_name` and `target_commitish`. It does not specify that
omitting them universally resets a draft tag. The regression therefore models
the reached integration behavior, not a newly asserted official API rule.

## Independent source and test assessment

- The production diff changes only the final PATCH payload, adding the exact
  manifest tag/source fields. Before this request the existing remote tag,
  source, ownership and complete asset closure checks still run. Complete body,
  marker, `draft: true`, `prerelease: true` and `make_latest: false` remain.
- The strict post-PATCH `owned()` check remains byte-identical. There is no
  acceptance of arbitrary untagged drafts, altered source/payload markers,
  published/immutable objects, new discovery mode or automatic remote recovery.
- The normal collector/publisher regression uses an opt-in API fixture that
  changes the draft tag when PATCH omits it. The recorded old-source focused
  run fails in the actual final ownership check; the repaired request passes.
  Assertions cover exact tag/source, complete marker/payload, seven assets,
  unpublished mode and identical retry without asset deletion or reupload.
- Six additional responses mutate tag, published/prerelease/immutable mode,
  absent marker or marker source only after earlier checks passed. All must
  reject at final response validation, keeping the protective check effective.
- Independent byte comparison verified the entire publisher equals HEAD after
  precisely replacing that single payload literal. The Content-Length adapter,
  existing HTTP regressions, both workflows, release policy, artifact verifier
  and artifact selector equal HEAD. No tests were restored to packaging CI.

## Frozen verification

The implementer records focused7/7 and complete release99/99 with zero failure,
skip or cancellation; desktop types, lint (zero warnings), Knip and source
diff-check exit0. The reviewer reconciled these outcomes with the current frozen
hashes and independently ran full `git diff --check` (exit0). Unrelated product,
native and broad quality gates were not repeated for this final payload change.

```text
577d2da0264a6fbe5def9b7166b20602db69fd312ca11ed255cdca9895bb727d  desktop/tauri/scripts/publish-draft.mjs
684f80f6fa693cd848ed4e9327ad416ba68b69dcb5701e07e9b6026d4cb4158d  desktop/tauri/scripts/release-pipeline.test.mjs
```

Lint: pass. TypeCheck: pass. Release tests: pass. The updated distribution spec
matches the explicit request fields, unchanged strict checks and recovery limit.
No raw logs, temporary copies or JSON evidence were added under Trellis.

## Remote recovery limits

This review performed no authenticated write, draft deletion, asset upload,
installer rebuild, tag movement, workflow rerun or public publication. Root is
preparing read-only original artifact verification separately. Repairing the
specific current draft association requires exact ID/body/marker/seven-file
hash/current-tag proof and owner authorization. The proposed PATCH preserves
existing complete notes/assets and unpublished mode; it must not become a
generic ownership bypass. Hosted repair success remains unobserved at review.

## Owner-authorized restoration and independent postcheck

After the owner explicitly approved the concrete association repair, root
restored the existing release410798352 to `desktop-v0.1.0`. An independent fresh
authenticated GET of the release, all seven assets and the Git tag then passed
comparison with the prepared original and restored snapshots:

- Actual `tag_name` is `desktop-v0.1.0`; draft/prerelease remain true, immutable
  remains false and `published_at` is null.
- Original release ID, title and complete body are identical. All seven asset
  IDs, names, uploaded states, byte sizes and SHA-256 digests are identical.
- The original remote Git tag object remains unchanged and points to
  `501143bdaeae10506743b2576ff453251077bfc2`.

The API's `html_url` still uses a temporary `untagged-*` draft slug; this does
not contradict the independently verified actual `tag_name`. The complete
existing draft association is now observed as repaired. This postcheck made
read-only requests, did not repeat unchanged source tests, and retained no raw
repository evidence. There was no public publication, deletion, reupload or
Git tag movement in this restoration. Automatic completion with the new source
on a future hosted run remains distinct from this specific observed recovery.
