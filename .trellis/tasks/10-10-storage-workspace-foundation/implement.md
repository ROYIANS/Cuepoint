# Workspace and migration foundation implementation plan

Status: implemented and independently accepted on 2026-10-10; product commit recorded in task.json; archive follows the approved batch. Parent dependency: `.trellis/tasks/10-10-desktop-storage-sync`. Later checkpoint/plugin work depends on this child reaching its exit evidence.

## Ordered work

1. Inspect existing media/material/output import owners and identify the smallest shared boundary; do not duplicate filename, MIME or owner validation.
2. Add workspace-relative identity and path validation helpers with unit tests for valid roots, traversal, absolute paths, duplicate names and foreign workspace IDs.
3. Add the staged managed-copy primitive and route `uploadMediaFile` through it. Preserve existing media IDs/ownership transaction behavior and make failure cleanup observable in tests.
4. Add a disposable binary-owner fixture enumerator for `MediaRecord`, nested `MaterialPayload` media blobs, audio recordings and output references. Report unresolved or missing content explicitly.
5. Run targeted media/material tests, then the TypeScript and repository quality checks required by the frontend spec.

## Exit evidence

- New helper tests cover success, cancellation, empty input, read failure, same-name files and path safety.
- Existing media, material and package tests pass without changing current user-facing behavior.
- The fixture output proves which binary owners are included and identifies any gaps for the next checkpoint child.
- No provider, account, native packaging, live migration or product UI change is included in the diff.

## Rollback

Revert the importer integration while retaining the pure workspace helpers and tests if an existing browser import path exposes an unanticipated behavior change. Do not delete existing media records as a rollback strategy.
