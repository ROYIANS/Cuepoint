# Shared storage context brief

This is a dispatch brief, not a replacement for owning specs or full research. Read PRD, design and implement in full. The manifests omit very large files to avoid silently truncated injection; relevant workers/checkers must explicitly read their owning full files before editing/checking them.

## Mandatory directed reads

- All command/query work: `.trellis/spec/frontend/state-management.md` and `research/storage-seams.md`; inspect every touched owner and its adjacent tests. The schema/call-site inventory is `research/storage-callsite-inventory.json`.
- Rust/native/file work: `.trellis/spec/frontend/native-workspace.md`, `.trellis/spec/frontend/workspace-storage.md`, full `research/native-owner-and-files.md` and native boundary/recovery tests.
- Agent/history/receipt work: full `research/agent-state-and-device-boundaries.md`, `.trellis/spec/frontend/agent-tools.md`, `agent-execution.md`, `agent-write-evidence.md`; source owners determine exact continuation, recovery and atomicity.
- Reactive/UI work: `.trellis/spec/frontend/hook-guidelines.md`, `state-management.md`, `native-product-runtime.md` and byte/missing-media contracts.
- Independent final checker: all three full research reports, shared conformance/real-native tests and PRD AC matrix, not just this brief.

## Non-negotiable integration facts

- One shared UI/business/Agent; every current domain and tool. Fixed IndexedDB browser versus fresh normal SQLite desktop. No native feature-denial guards, fallback, mirror or second catalog.
- Baseline49 tables,219 transaction call sites,96 reactive query call sites. `projectIpLinks` key is projectId; immutable version tables use versionId; compound/optional unique indexes and primary-key ordering matter.
- Explicit StoreTx flows through nested preview/business command/receipt/completed ledger; root is the only commit. Overlay must support query read-your-writes, clone semantics and absence/phantom/delete-recreate guards.
- Own undefined differs from omitted field in current revision hashes. Use a lossless local codec; portable partial checkpoint JSON is unsuitable.
- No SQLite writer across awaits, byte IO or supplier calls. No automatic mutation/paid callback retry. Native COMMIT with lost reply is not confirmed rollback; durable same-workspace operation lookup works with a new session after reopen and binds payload fingerprint.
- All three declared Blob carriers become managed binary references native-side. Metadata lists do not hydrate them. Real loader/URL availability and typed storage errors are required; fake Blobs or stale decoded buffers cannot establish deliverable availability.
- Verified file publication precedes one atomic claim/domain/job/evidence commit. Intent recovery handles death/cancel safely and retains unknown files. Physical GC is deferred.
- All49 local tables, including connector secrets, share one private transaction owner to preserve settings atomicity. Future portable scope excludes secrets/continuation/live authority, but local SQLite must preserve original same-device records.
- Move fresh music variant/draft association out of scattered localStorage into the product owner; send shortcut/session sidebar remain intended device/session preferences.
- Fresh app-data product format/root; no previous IndexedDB/schema4/profile/key read, carry or deletion. Current fixtures define data, not migration.
- Implement whole coverage behind isolated selection; switch normal startup only after complete acceptance. Full-browser parity happens after all owner/hook adaptations, not after contract skeletons.
- Actual macOS packaging/restart/file evidence is required. Existing Unix file identity cannot prove Windows behavior; record other systems as unverified follow-up.

## Research source identities

Research started on branch `codex/native-agent-full-product`, commit `61b928ed7b3b4ca94da5591ebba91ee6cff71f03`. Three agents examined source/test contracts independently and wrote only their owned research. Primary SQLite/Tauri links are embedded in the full native report and architecture decisions. No user data, keys, providers, installs, application launches or implementation tests were accessed/run during research.
