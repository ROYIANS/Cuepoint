# Model catalog refresh for desktop 0.1.3

Completed on 2026-10-14 against local `main` at
`ad9fc272ec6422f18a1d356f265a69b05e8cee32`, before the release-preparation commit.

## Scope and result

Following the mandatory release step in `docs/desktop-distribution.md`, upgraded
the exact dev dependency `@opencode-ai/models` from `0.0.103` to `0.0.104`, then
regenerated the existing projection with `models-dev:baseline`. Its source
snapshot advances from `2026-10-13T05:37:08.674Z` to
`2026-10-14T05:31:23.550Z`. Scope, projection code, matching and runtime sync
behavior remain unchanged.

- Baseline entries: 379 to 381; provider count remains 18.
- Added `gemini-4-argon` under both `aihubmix` and `google`.
- `meta/muse-wonder-1.0` now includes upstream reference cost data: input 4,
  output 20, cache read 0.2 per million tokens.
- No entries removed, no other projected entry changes, and no provider-origin
  changes.
- Generated JSON gzip size: 9,746 to 9,811 bytes; remains within the existing
  compact-baseline release guidance.

The package/license version attribution in `THIRD_PARTY_NOTICES.md` now reads
`0.0.104`. The installed package still declares MIT, and its LICENSE text is
reproduced exactly by the existing notice. The installed package metadata points
to `anomalyco/models.dev`; after the scoped refresh, the parent session updated
the notice's upstream link to that canonical repository. The reproduced license
and copyright text remain unchanged.

## Verification

All commands used the machine executable
`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` with that Node directory
prepended to PATH (pnpm 10.15.0).

| Check | Result |
| --- | --- |
| `add -D -E @opencode-ai/models@0.0.104` | Passed; one dependency replaced |
| `models-dev:baseline` | Passed; 381 entries, package 0.0.104 |
| `models-dev:verify` | Passed; pinned, installed and projected versions agree |
| Eight catalog/metadata/UI/price test suites | 101 tests passed |
| Scoped `git diff --check` | Passed |
| Lockfile inspection | Only the model package importer, integrity and snapshot changed |
| Current non-historical `0.0.103` references | No remaining references after notice update |

The add command retained an existing peer warning for `@emoji-mart/react` versus
React 19.3.0, plus the existing `whatwg-encoding` deprecation warning. No other
dependency version, optional peer, runtime behavior or policy was changed to
resolve these warnings. Raw logs and before/after data were kept outside the
repository; only this concise result is retained in the task.

The parent session runs the complete frozen-source release gates after this
refresh. These checks establish projection and consumer behavior, not paid
provider calls, current actual billing, packaged application behavior or hosted
installer success.
