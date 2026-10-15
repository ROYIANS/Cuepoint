# Desktop release pipeline — final verification

## Result and owner decision

Completed under the owner's final packaging-only scope. On 2026-10-15 the
owner reviewed the task's actual delivery status and approved archival with
“可以，归档”. The original task remained active because its latest task-local
notes stopped at the 0.1.0 draft-tag recovery; later 0.1.3 success was recorded
in the desktop-settings task and developer journal instead.

The final scope is four native package builds, five installer files, exact
artifact collection and tag-owned draft delivery. The owner's 2026-10-12
instruction moved functional testing before publication to the owner and
removed automatic quality/native/UI/smoke tests from this delivery workflow.
The independent GHCR quality lane remains separate. Original mandatory
runtime-test and H1a assertions are superseded delivery prerequisites, not
passed runtime checks.

## Observed hosted delivery

Authenticated read-only GitHub inspection on 2026-10-15 confirmed:

- [Actions run 38550667540](https://github.com/ROYIANS/Cuepoint/actions/runs/38550667540)
  is completed/success at source
  `cedb6cca482bc35fd2592197b752943e62e98ccc`.
- All seven jobs succeeded: prepare, macOS ARM64 build (`macos-14`), macOS Intel
  build (`macos-15-intel`), Windows x64 build (`windows-2022`), Linux x64 build
  (`ubuntu-22.04`), collect and draft.
- [Release desktop-v0.1.3](https://github.com/ROYIANS/Cuepoint/releases/tag/desktop-v0.1.3),
  ID `412611571`, is public (`draft: false`) and a prerelease. It was published
  at `2026-10-14T10:57:21Z` / `2026-10-14 18:57:21 Asia/Shanghai`. Its target
  source matches the run and its body contains `UPLOAD COMPLETE`.
- All seven expected assets are uploaded and expose server-reported SHA-256
  digests. Asset names and byte sizes are recorded below. This inspection did
  not download/re-hash or execute the installers.

| Asset | Bytes |
| --- | ---: |
| Cuepoint_0.1.3_macos_arm64.dmg | 16,049,689 |
| Cuepoint_0.1.3_macos_x64.dmg | 16,580,083 |
| Cuepoint_0.1.3_windows_x64_setup.exe | 12,295,020 |
| Cuepoint_0.1.3_linux_x64.AppImage | 150,370,808 |
| Cuepoint_0.1.3_linux_x64.deb | 16,485,690 |
| SHA256SUMS | 490 |
| release-manifest.json | 1,697,226 |

The successful `draft` job followed by an observed public prerelease establishes
the actual delivery sequence. Public publication was controlled by the owner;
this closeout makes no remote changes. These observations concern the exact
0.1.3 source above, not a fresh hosted build of the later monorepo revision.

## Acceptance disposition

| Original area | Final disposition and evidence |
| --- | --- |
| AC1: locked native builds and host prerequisites | Four corresponding-host package builds succeeded. Mandatory native-runtime suites were removed from delivery by the owner; no cross-platform runtime pass is inferred. |
| AC2: five normal-product installers | Five expected installers are uploaded. The implemented build/collector retains target, source, version, product, file and hash checks; this closeout does not repeat payload extraction. |
| AC3: installed-payload UI/import/reopen proof | Superseded as an automatic delivery gate. Manual functional validation remains the owner's responsibility; missing per-case records are not backfilled as passes. |
| AC4: collection and real draft upload | Actual collect/draft jobs succeeded, seven uploaded assets and the complete marker are observed, and the release is subsequently public. Earlier upload/tag failures and their repairs remain in research history. |
| AC5: release documentation and limits | Current desktop distribution spec, desktop README and 0.1.3 notes retain packaging-only coverage, signing/baseline limits and owner publication. |
| AC6: local source verification and review | Prior recorded local release checks and independent review are retained; full suites are not rerun for this task-only closeout. Automated delivery-test requirements follow the owner's later scope change. |
| F1: final task lifecycle | Owner-approved closeout reconciles the PRD/design/plan, refreshes metadata/context, archives the task and records a journal entry. |

## Current source and prior verification

The pipeline is `.github/workflows/desktop-release.yml`; current build, policy,
collector and publisher owners are under `apps/desktop/scripts/`. Build receipts
explicitly use `state: packaged` with empty checks/evidence arrays. The original
`desktop/tauri` paths and deleted development branches remain only as historical
source anchors. All task source changes are integrated into `main`.

The last draft-tag correction is source commit
`168a28e2b87547a0b2bb402c6aa0a61ba987f39c`. Its recorded verification includes
focused 7/7 and full 99/99 release regressions, desktop types/lint/Knip and an
independent review; see [draft-tag review](research/release-draft-tag-review.md).
The later monorepo integration separately recorded desktop release 99 passing
in the archived Agent task and session 69. These are prior source checks, not
new executions or substitutes for actual platform runtime evidence.

The current [desktop distribution spec](../../../../spec/frontend/desktop-distribution.md)
already describes the final packaging-only contract and explicit tag/source
retention. No new source contract or spec change is needed for this closeout.

## Remaining manual coverage and historical limits

Preserve per-platform installed/extracted startup, import, managed-file reopen,
system Save, media/device/provider interactions and power-loss limits where no
specific corresponding-host result is recorded. Session 66 specifically kept
settings A6/A9c/A10 as post-release follow-up because itemized real-machine
records were missing. Unsigned Windows and ad-hoc/non-notarized macOS packaging
remain the accepted test-distribution policy.

Earlier failed Actions attempts and the exact 0.1.0 recovery are historical
outcomes; successful 0.1.3 delivery does not rewrite those failures. Raw logs,
copied workspaces and installer bytes are not added to the task archive.

Archival validation is limited to task JSON/context resolution, current source
owner paths, whitespace and Git change scope. This session changes only task
and journal records, and starts no build, test run, push, tag or release write.
