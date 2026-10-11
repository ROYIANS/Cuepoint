# Planning decisions and primary-source constraints

Date: 2026-10-11. Research only; no product implementation, dependency installation, user database inspection or provider request.

## Authoritative decisions

The user approved this child for research/planning under `10-10-desktop-storage-sync`. Prior decisions select full feature reuse before centralized SQLite, fresh data without historical migration, workspace-owned media, complete original tool history, device-local credentials and single-person sequential-device synchronization. The archived full-product child establishes the current behavior baseline; its SQLite reference lane is not the normal desktop owner.

Technical selections for final review:

1. One shared typed product store, transaction context and reactive read boundary; keep existing TypeScript business commands and Agent tools as the sole business-rule owners.
2. Browser IndexedDB and normal desktop SQLite are alternate fixed startup adapters. Never mirror rows, automatically fall back on failure, or mix the old video-only catalog into the new full-product catalog.
3. One local SQLite transaction owner covers all 49 tables, including device-local connection records, so existing atomic setting/connection updates remain atomic. Classification for future portable projection is explicit; physical separation into multiple databases is not required in this child.
4. Native transactions use explicit transaction-scoped contexts, guarded short reads, a local write overlay and one checked atomic commit. A SQLite writer must not remain open while JavaScript awaits, hashes files or calls a supplier. Predicate/table guards cover phantom inserts as well as row changes; no paid callback is automatically replayed after a conflict.
5. Binaries use metadata plus a shared byte-access seam, with managed-file references native-side and Blob storage browser-side. Never fabricate an empty Blob to represent a missing asset, and do not eagerly read every file while listing metadata.
6. Fresh normal desktop storage gets its own explicit product format/root identity; older IndexedDB and schema-4 reference workspaces are not opened, copied or deleted. The normal UI has no new mandatory project-folder picker. Existing app-data ownership provides the default container.
7. Reuse native lock, containment, integrity, worker and file-intent recovery mechanisms, but replace the video-only schema/action layer rather than expanding duplicate Rust business commands.

## SQLite primary-source check

Checked on 2026-10-11:

- [Isolation in SQLite](https://www.sqlite.org/isolation.html): separate connections do not observe uncommitted writes; SQLite permits one writer at a time. WAL readers retain their read snapshot, and escalating a stale read snapshot can fail. This supports short native commit transactions, not a claim that several separate IPC reads automatically share a snapshot.
- [Atomic Commit in SQLite](https://www.sqlite.org/atomiccommit.html): SQLite journals and filesystem synchronization underpin database rollback/recovery. This does not make an unrelated asset-file rename atomic with a database commit. Cuepoint still needs its existing durable file intent, verified publication and recovery protocol.

The optimistic renderer unit of work and its revision/phantom guards are a Cuepoint design inference from those constraints, not a capability supplied automatically by SQLite. The actual implementation must demonstrate complete read-set validation and atomic mutation/evidence submission.

## Tradeoffs and deferred work

- Explicit transaction-context propagation touches many existing helpers, but retains one business implementation and avoids ambient-context races in interleaved promises.
- Conservative table guards may reject a transaction after an unrelated same-table write. Such rejection must stay visible and safe; do not weaken guards or replay paid execution to hide it. Measure representative Agent and autosave workloads before acceptance.
- File/row recovery can leave verified unreferenced files. Physical reclamation and a user-facing garbage collector are deferred; logical deletion must not pretend to erase bytes.
- Local SQLite serialization retains original run continuation data. Future synchronization needs a distinct reviewed portable codec; the partial checkpoint fixture is not that codec.
- Credential encryption, managed hosting, accounts, transport plugins, synchronization UI, cross-device apply and simultaneous collaboration are outside this child. No active SQLite database or `.local` directory is a synchronization artifact.
- macOS is the available actual packaged acceptance host. Windows/Linux runtime acceptance remains explicit follow-up, even though the implementation must avoid platform-specific persistence assumptions.
