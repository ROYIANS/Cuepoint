# Draft Completion Tag Retention Implementation — 2026-10-13

## Repair

The final completion PATCH in `publish-draft.mjs` now explicitly includes
`tag_name: manifest.context.tag` and
`target_commitish: manifest.context.sourceSha`. Its existing complete notes,
ownership marker, draft/prerelease mode and `make_latest: false` remain intact.
The strict post-PATCH `owned()` validation is unchanged. This is one production
payload-line change, not a new recovery mode or an ownership bypass.

This addresses the reached integration result documented in
`release-draft-tag-boundary.md`: all seven assets and complete notes persisted,
but the final returned/persisted draft tag became `untagged-...`. The official
update contract permits these explicit request fields; the observed omission
behavior is not claimed as a universal documented GitHub rule.

## Meaningful regressions

The existing collector/publisher fixture is reused. An opt-in API fixture
reproduces the observed tag reset when completion PATCH omits `tag_name`, rather
than concealing the boundary with unconditional `Object.assign` retention.

Before repair, the focused run exited 1: the normal completion case reached the
unchanged final `owned()` check and failed with the observed wrong-mode/tag
error. The ownership-response cases also failed their specific expected error
because the earlier missing-tag failure masked them. After repair, all seven
focused cases pass:

- Normal collection, seven uploads and completion retain exact tag, source,
  complete marker, payload digest and unpublished prerelease mode. An identical
  retry preserves the release ID and every existing asset without uploading
  again or deleting assets.
- Final PATCH responses with a wrong tag, published mode, non-prerelease mode,
  immutable release, absent ownership marker or changed ownership source still
  reject. These mutations occur only after the prior reads and asset closure
  pass, so the tests exercise the final response validation.

## Final local checks

Approved local Node 24.11.0 and the explicit machine pnpm path were used. All
final checks exited 0:

| Check | Actual outcome |
| --- | --- |
| Focused completion regressions | 7 passed; 0 failed/skipped/canceled |
| Desktop `test:release` | 99 passed; 0 failed/skipped/canceled |
| Desktop `types` | Passed |
| Desktop `lint` | Passed; zero warnings |
| Desktop `quality` / Knip | Passed |
| Owned source `git diff --check` | Passed |

Frozen SHA-256:

```text
577d2da0264a6fbe5def9b7166b20602db69fd312ca11ed255cdca9895bb727d  desktop/tauri/scripts/publish-draft.mjs
684f80f6fa693cd848ed4e9327ad416ba68b69dcb5701e07e9b6026d4cb4158d  desktop/tauri/scripts/release-pipeline.test.mjs
```

The prior Content-Length/stream-cleanup correction, package-only workflow and
all source/hash/tag/asset ownership checks remain unchanged. No remote request
or mutation, installer rebuild, version/tag change, dependency install or Git
mutation was performed. These protocol regressions prove local request and
response handling; successful hosted tag association and owner-authorized
recovery of the existing uploaded draft remain separate outcomes. No raw logs
or fixture copies were retained under Trellis.
