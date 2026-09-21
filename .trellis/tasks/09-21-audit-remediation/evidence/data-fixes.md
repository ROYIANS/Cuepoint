# Data remediation

Implemented F01/F04/F05/F06 with transaction-level regression coverage.

- Draft controllers now retain a per-field baseline, rebase only clean fields from live records, defer external rebase while a write is in flight, and preserve conflicting text through the backup barrier. Episode story, world setting, series logline, and asset text repositories compare edited fields against the latest record inside the same Dexie transaction. Conflicts roll back atomically and surface `DraftConflictError`; the UI offers retry and an explicit adopt-latest action.
- ZIP export adds `mediaMetadata.json` (original filename, MIME and owner). Import validates metadata ownership, MIME, duplicate IDs and one-to-one file mapping before persistence, restores Blob types and filenames, and remains compatible with packages without metadata. `.jfif` is inferred as JPEG.
- Connector migration versions 20/21 move duplicate definitions to recovery-only aliases, deterministically retain the newest active row, enforce a unique active definition index, and preserve historical IDs. Resolver paths can use aliases; explicit edits rotate alias credentials and disconnect removes all aliases.
- Story beat undo writes a captured assignment only when the current shot is still unassigned in the original episode/project, so a newer tab assignment wins.

Tests: `pnpm lint`; focused Vitest (86 tests including `auditDataIntegrity`, `draftConcurrency`, `connectorMigration`, `mediaMetadata`, repository/package/reference suites) passed. Full suite had one expected migration-version assertion updated from 19 to 21; rerun focused suite passed. Root should run the full gate after agent/UI changes and browser cross-tab checks.
