# Task Artifact Retention

## Owner decision

On 2026-10-12 the owner requested cleaning Trellis logs and research artifacts, keeping useful Markdown research conclusions. This rule applies to active and archived tasks and supersedes earlier instructions to retain complete raw evidence trees.

## Keep

- Task identity and lifecycle in `task.json`; requirements, final design and implementation plan in `prd.md`, `design.md` and `implement.md` when present.
- Curated `implement.jsonl` and `check.jsonl` context, with references to existing files.
- Authored Markdown containing research comparisons, architecture decisions, behavioral contracts, implementation results, independent review conclusions and final acceptance limitations.
- Project specs, workflow/runtime helpers and developer journals.

Judge Markdown by its content. A file named `scope`, `handoff` or `preflight` can contain a real technical conclusion; dependency READMEs and copied spec snapshots are not task conclusions.

## Disposable

Raw logs, JSON receipts, screenshots, trace payloads, build output, copied sources/spec contexts, dependency trees, caches, temporary tools, superseded dispatch instructions and historical commit inventories do not belong in the permanent task archive. Do not copy a whole project or `node_modules` into a task to preserve a check.

Use temporary output outside the repository where practical. Summarize completed checks, the relevant source revision/digests, failures and unresolved limits in a compact Markdown conclusion before discarding raw output. Never relabel a failed or unperformed check as passed because its log was removed. Delivery artifacts and GitHub Actions diagnostics follow the delivery system's own retention policy.

## Cleanup and recovery

Repair JSONL references when a task is archived or an artifact is removed: resolve surviving task documents to the actual archive location, and remove references to disposable or nonexistent files. Do not delete the manifests themselves.

The 2026-10-12 cleanup preserved task core records and authored conclusions. Historical prose may still mention raw evidence paths that are no longer on disk. Such references record what was observed then; they do not imply currently retained raw proof. Previously tracked artifacts can be retrieved from Git at `00a465ab132d0dc7c8d140702e34eb9a24fe79ef`. Local ignored caches/dependencies are intentionally disposable. No Git history rewrite is part of routine artifact cleanup.
