# Trellis Artifact Cleanup — 2026-10-12

## Owner scope and result

The owner requested removing unnecessary logs and research files and keeping useful Markdown research conclusions. This maintenance covers all 89 task directories (87 archived completed tasks and two ongoing tasks). It does not archive or complete either ongoing task.

| Measurement | Before cleanup | Cleanup checkpoint |
|---|---:|---:|
| Regular files in `.trellis` | 297,864 | 1,172 |
| Logical file bytes | 5,381,832,487 | 7,446,156 |
| Authored `research` Markdown retained | — | 367 |

The checkpoint was measured after pruning artifacts and repairing references, before adding this conclusion, the retention guide and session note. Task-local deletions totaled 296,446 files / 5,372,511,515 bytes, including 17,291 Git-tracked paths; expired ignored update backups and Python caches were also removed. No product files were deleted by this cleanup.

## Retained and removed

- Retained task identity/status, requirements, designs, implementation plans, JSONL context manifests, specs, runtime helpers and journals.
- Retained authored research, architecture/contract decisions, implementation results, final and independent review conclusions, including substantial scope/handoff/preflight reports.
- Removed raw JSON/JSONL evidence, logs, screenshots, media fixtures, archives, temporary tools, copied source/spec workspaces, dependencies, build caches, obsolete commit inventories and dispatch instructions. `research` contains only Markdown.
- Repaired 217 archived-context path references and removed 25 missing/disposable references across 95 manifests. Removed two duplicate desktop-distribution entries in the active task manifests, retaining the latest reason.

## Verification and prevention

All 348 task-core identity/requirements/design/plan hashes and 100 non-task management files matched their pre-cleanup bytes at the cleanup checkpoint. Subsequent intentional management edits are `.gitignore`, workflow retention wording, guide/index and journal; no task identity or lifecycle changed. All surviving JSONL `file` references resolve to actual files.

Seventeen ignore-rule controls verify that task core files and authored Markdown stay visible, while raw output and copied workspaces are ignored. The [retention guide](../../../spec/guides/task-artifact-retention.md) defines the future policy.

Historical Markdown may mention removed raw paths. Previously tracked artifacts remain retrievable from Git revision `00a465ab132d0dc7c8d140702e34eb9a24fe79ef`; ignored caches/dependencies were intentionally discarded. Git history has not been rewritten.

## Separate packaging correction

The reached `ENOBUFS` source-list failure is independently fixed by streaming Git's NUL-delimited output and excluding the same root metadata trees before output. The release regression suite passed 84/84, desktop types/lint/Knip passed, and independent full repository hash parity and child-process failure probes passed. See `release-source-list-buffer-implementation.md` and `release-source-list-buffer-review.md` for the recorded local conclusions. Cleanup is not a substitute for that fix. Actual GitHub package builds/collection/draft delivery remain pending.

The owner authorized local commits and fast-forward main integration. Source correction commit: `a231dcf2e61ef3035466ef4c5ee0881b37654f7e`. This cleanup/documentation commit records the approved checkpoint; remote package delivery remains pending. No push, tag, workflow dispatch or Release mutation is included.

## Final duplicate pass

A final content review found 19 historical Markdown files made visible by the consolidated ignore rules. Eight substantive audit/diagnostic conclusions remain. Eleven copied, superseded or pending-integration documents (154,089 bytes) were additionally deleted; five of those were byte-identical duplicates of retained E02–E06 independent reports. These were previously ignored local files, so the 17,291 tracked-deletion count is unchanged. All JSONL references still resolve.
