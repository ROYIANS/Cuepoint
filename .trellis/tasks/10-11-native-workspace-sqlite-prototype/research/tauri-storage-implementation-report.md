# Work package A implementation report

Status: storage source frozen for independent review. No work package B implementation or acceptance claim. No task lifecycle/spec/Git/root product dependency/generated-route/Electron draft changes were made by this implementer.

## Authored files and public API

`desktop/tauri/` contains the isolated Cargo crate/lock/toolchain pin, Node local-tool wrapper, small Rust modules (`contracts`, `paths`, `database`, `import`, `backup`, `workspace`, `worker`, feature-gated `hooks` and CLI), permanent native/parity tests, TS actual-helper corpus generator and immutable corpus, strict TS/ESLint/Knip configuration, regression runner and README with exact CLI requests/failpoints/finite limits.

One dedicated worker owns all SQLite connections, import/recovery/backup/close and restore initialization. A separately held `writer.sqlite` BEGIN EXCLUSIVE connection prevents live cooperating writers. Queued owned inputs are snapshots; cancellation uses an independent atomic registry. Actual COMMIT and completion publication are authoritative after late cancel/close. Native sources/destinations are trusted library/CLI paths, not renderer or portable DTOs.

Imports commit an intent before stage creation, record stage device/inode plus verified size/hash, copy/hash bounded 256 KiB chunks, independently verify staged/published bytes outside the metadata transaction, publish by exclusive hard link, and atomically insert ready asset/ref while deleting intent. Recovery validates exact IDs/refs/intent paths and recorded inode ownership; a legitimate two-link stage/final pair is handled, external alias/foreign intent ambiguity preserves bytes and refuses. Unknown/source files are never scan-deleted. Missing/corrupt assets preserve exact logical state.

Backup locks the queue, reserves a new destination, steps actual rusqlite Backup with cancel and elapsed-time bounds, validates schema/integrity/closure, verifies copied file size/hash and publishes a closed completion manifest last. Restore verifies that closed snapshot and copies to a separately reserved new root; incomplete roots cannot open or be reinitialized. Existing empty/populated targets retain their bytes.

## Executed gates

All final native gates passed with unchanged source hashes before/after (`tauri-storage-implementation-final-gates/receipt.json`):

- `cargo fmt --all -- --check`.
- Strict locked Clippy, all targets, normal and `test-hooks`, `-D warnings`, no new warning allowances.
- Locked normal all-target tests: **6 native storage + 2 parity**.
- Locked feature tests: **18 native storage + 2 parity**, no ignored/failing tests. Includes actual SIGKILL at seven import points, backup/restore before/after completion, live second process/death release, idempotent reopen, source/unknown retention, external aliases/foreign pending paths, missing/corrupt logical retention, strict corrupt/schema/manifest/no-overwrite cases, independent cancel/frozen queue, before/after-COMMIT lifecycle close, owner removal before publication/commit, snapshot queue isolation and backup completion/cancel authority.
- Locked normal release build. This is a storage library build, not a packaged Tauri app.
- Final `types`, typed ESLint (`--max-warnings 0`), Knip, byte-exact actual-helper regeneration check and Rust portable parity passed; raw final frontend logs are retained separately.

Root reported its separate coordinator CLI probe passed on actual SQLite **3.53.2**, including real UTF-8/slash/case owners, source deletion/reopen, exact snapshot/restore, 0.183-second live writer refusal, missing/corrupt preservation and precommit SIGKILL. Those coordinator records are independent and their pre-freeze binary hash is not substituted for this final manifest.

## Preserved failures and corrections

`tauri-storage-implementation-test-first.log`: first compile failed because rusqlite 0.40.2 does not implement SQLite u64 FromSql/ToSql and sha2 0.11's hybrid array no longer implements LowerHex. SQLite now uses checked i64/u64 conversion; digest uses an explicit small 32-byte hexadecimal encoder. `test-second.log` preserves an intermediate missing-helper compile failure after an interrupted patch; `test-third.log` preserves the first successful behavior run before later tests.

The initial native gate directory retains strict Clippy failures (large channel enum and collapsible ifs); boxed owned channel payloads and idiomatic Rust 2024 let chains fixed them. No lint suppression or test weakening. Initial JS lint/Knip failures were missing `URL` global and the dynamic Vite oracle entry; explicit environment/entry configuration fixed them. Root package dependencies and lock were not changed.

## Remaining boundaries

This is local macOS storage evidence only. Standard path-based opens have static link/type/root/DB identity checks; descriptor-relative/no-follow ancestor traversal is **not** implemented, so a hostile OS user racing check/open remains unproved. Ambiguous stage-create/before-inode-record interruption refuses with bytes retained. Process kills do not prove physical power loss, network filesystems or other OSes. Hook-injected errors are deterministic boundary tests, not proof of every hardware/fsync failure.

The library's full verified managed-read fixture API is bounded at 32 MiB and checks complete size/hash before releasing bytes. Work B must add the planned narrow 256 KiB bridge chunks/protected read or final checksum before assembling a WebView Blob; this A API is not a renderer filesystem port. GUI/ACL/dialog/CSP/packaged origin/media/documents/stream/print/microphone, app-size/memory measurements, production codecs/migration, credentials, plugin marketplace and live sync remain subsequent gates.

The exact frozen authored hashes and rebuilt CLI hash are in `tauri-storage-implementation-source-manifest.json`. The implementer has stopped A source edits pending independent review.
