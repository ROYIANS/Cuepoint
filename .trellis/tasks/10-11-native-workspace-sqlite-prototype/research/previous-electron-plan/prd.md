# Native workspace and SQLite prototype

> Runtime reconsideration (2026-10-11): the user questioned Electron weight and requested SiYuan research. Electron-specific implementation has stopped, with unaccepted code/probes preserved. This Electron candidate plan is historical pending a runtime decision and updated planning; it does not authorize further Electron-specific work. Storage acceptance requirements and parent decisions remain in force. See `research/runtime-reconsideration.md`.

## Goal and authorization

Prove a small, independently runnable desktop storage slice on disposable native workspaces before choosing a production runtime or migrating real user data. The coordinator recommended this next step after acceptance of the browser managed-copy and partial checkpoint foundations; the user explicitly replied **"开始吧"** on 2026-10-11. That approval covers this bounded implementation and its local acceptance. Electron is a pinned prototype candidate chosen for the existing TypeScript/browser application, not an irreversible production-runtime decision.

## Smallest behavior gap and owners

Current accepted code creates independent browser Blobs and partial protocol fixtures; it cannot persist a portable workspace identity, ordinary managed files and SQLite records across a native process restart. Add an isolated `desktop/` prototype with a native storage owner and a narrow trusted renderer bridge. Reuse `src/lib/workspace.ts` path/identity contracts and `src/lib/sha256.ts` hashing without changing accepted browser behavior.

Expected authored boundary: `desktop/` package, native adapter, minimal fixture shell, build/quality configuration, permanent native regressions and documentation; this child task's planning/evidence; a scoped native-storage specification after acceptance. No root dependency replacement, existing dev-server interruption or generated-route change.

## Requirements

1. Pin Electron and verify `node:sqlite` in that actual Electron runtime. Run a local desktop window, not just a Node CLI simulation. All workspaces and Electron profiles are disposable and independent from browser production data.
2. Persist a real workspace ID once, with a versioned minimal SQLite schema. Reopen keeps identity and exact prototype records/refs. Refuse unsupported/corrupt state rather than silently creating a new identity over existing data.
3. Support a small project record, independently copied asset records and a project-owned output/reference fixture. These are explicitly prototype records, not production codecs or a generic export of 49 Dexie tables. All imported files are copied into the workspace; source deletion/change after import cannot affect accepted copies. Display names never determine storage paths.
4. Import outside the metadata transaction in bounded chunks; stage/hash/size-verify first. Commit metadata only after complete managed bytes are available. Interrupted copies/renames/transactions recover without a false ready record. Preserve successful commits after interruption. Recovery never deletes source files or logically tombstones missing managed assets.
5. Enforce native root and path containment, reject symlinks/unsafe managed entries and overlong portable components before unsafe writes. A canonical root remains device-local; portable refs contain no original paths. Document the protection limit against hostile concurrent filesystem replacement.
6. Serialize mutating native operations and prevent a second writer to the same workspace. Detect/release stale ownership after genuine process exit without bypassing a live owner. Reject lifecycle/concurrent races rather than silently interleave backup and imports.
7. A missing or corrupt managed file retains its metadata/reference and reports an availability error. No absence-based deletion. Exact identity, owner and checksum checks remain authoritative.
8. Create a consistent backup containing the versioned SQLite snapshot plus the complete verified files it references. Stage the backup and publish only when complete. A corrupt/incomplete backup cannot become a ready workspace. Restore creates a separate new disposable root and never overwrites an existing workspace. Reopened restored identity/references/bytes match the snapshot.
9. The sandboxed renderer receives specific typed operations, not arbitrary filesystem paths, SQL, execution or Electron objects. Native selections originate in trusted main-process dialogs. Validate IPC sender, operation payload and navigation policy. No remote content/credentials/paid requests.
10. Native filesystem failures, cancellation and actual process termination at meaningful import/backup boundaries have permanent regression coverage and retained independent evidence. Power-loss durability and Windows/Linux native acceptance are explicitly separate gates.

## Acceptance

- Actual pinned Electron reports runtime versions and exercises SQLite; a local sandboxed window loads and executes fixture operations through the production prototype bridge.
- Create/import/output/ref/reopen preserves ID, record contents and independent file hashes. Same filename and case/Unicode-sensitive IDs remain distinct.
- Source removed or edited after import leaves managed bytes intact; managed file removed/corrupted leaves stable metadata and an explicit missing/corrupt state.
- Process termination before/after import and backup publication distinguishes incomplete work from committed work. Reopen recovery is idempotent and preserves unrelated/committed content.
- Invalid refs, root alias/symlinked managed directories, unsupported DB/backup formats, wrong owner, truncated/corrupt backup and active second writer reject safely.
- Backup during serialized operations corresponds to one consistent version; complete restore has exact original identity/refs/hash closure; existing restore destination is never overwritten.
- Strict native types, typed lint, meaningful permanent native tests/build, relevant unchanged portable-helper regressions and root project quality/types/build pass. Final independent review records source hashes and actual executed commands.

## Excluded and retained parent gates

No real Dexie migration, full production UI port, native credential-vault integration, production original-tool-history codec, live sync backend, provider authentication/encryption, marketplace, installer/release/deployment or real-user workspace mutation. No production compatibility claim for all audio/microphone/PDF/print features or other OSes. Parent task stays in progress. All user history-retention decisions remain requirements for the later field-reviewed production codec, not satisfied by a small fixture.

## Scope changes

Research may refine package/build/API mechanics within this prototype. Any expansion into production data migration, live services or a permanent desktop runtime decision must be reviewed separately. Work commits require the concrete Phase 3.4 file plan after acceptance; no push.
