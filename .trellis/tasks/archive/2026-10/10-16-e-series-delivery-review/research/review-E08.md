# Review E08 — desktop-workspace-media (52e584c7, 2b00d8e5, ca2da1a5)

Read-only review on `codex/agent-background-host`. Labels: [code] [test] [claim-only]. No builds or Rust tests were run for this report; test claims are read from `implementation-validation.md` and the test sources.

## Verdict

The native grant/scan/prepare core is well built: identity binding, two-phase hash verification, bounded decoder IO, kill-and-wait with an "unknown" quarantine, and a strict approval-bound atomic publish. Two real problems remain on the Windows path, and they bear on AC1/AC2: aliases abort the scan, and unsupported volumes get no scoped error. Windows has no process-tree ownership. `task.json` says `status: completed`, but its own meta says the Windows and installed checks were never run, so AC1/AC2/AC4 are not evidenced on Windows.

## Acceptance mapping

| AC | Status | Evidence |
| --- | --- | --- |
| AC1 macOS+Windows fixtures give verified original + PNG, imported with provenance and durable receipt | **Partly met** (macOS only, source level) | [code] `desktop_media.rs:894-1041` (`prepare_with_decoder`), `desktopMediaImport.ts:131-163` (`publishDesktopMediaImportItem` atomic: media x2 + receipt + `touchProject`). [test] `desktopMediaImports.test.ts:60,73`, `desktopMediaWorkflow.test.ts:17`. [claim-only] real FFmpeg fixture run was done by "the native implementation owner" (`implementation-validation.md`); the ignored Rust fixture is not in CI. Windows: never run (`task.json` meta.pendingAcceptance). |
| AC2 out-of-grant, unsupported Windows volumes, changed/replaced files, revoked permissions fail before product effects | **Partly met** | Changed/replaced: [code] `Version::check` `desktop_media.rs:159`, ancestor identity `:230-238`, post-copy hash `:963-973`; [test] `desktopMediaImports.test.ts:80`. Revoked/expired: [code] `Grant::check` `:211-222`, `RevokeDirectory` `:631-653`. Out-of-grant: structural (renderer never supplies a path, only opaque IDs) [code] `MediaAction` `:53-88`. **Unsupported Windows volume: not met as specified** (F2). |
| AC3 cancel stops owned local work, truthful committed/unknown outcomes, never replayed | **Met (macOS/source)** | [code] `run_with_wait` `desktop_media_process.rs:75-190`, `decoderStopUnknown` -> `unknown` `desktop_media.rs:355-358`, `OwnedDirectory.preserve` `:980-982`, `admitDesktopMediaImport` refuses re-admission `desktopMediaImport.ts:84-100`. [test] Rust `cancellation_kills_and_reaps_actual_child`, `failed_wait_remains_unknown...` (`desktop_media_process.rs:304-370`); TS `desktopMediaWorkflow.test.ts:30,57,74,85,100`. Windows: only direct child is owned (F3). |
| AC4 reload preview of thumbnail, derivative rows hidden from pickers, survive retain/delete, project copy, package round trip | **Met (source/test)** | [test] `mediaDerivatives.test.ts:28,47,56,66,75,84`. [claim-only] installed-app preview after reload (listed as pending). |

## task.json / PRD claims verified

- "no second ProductStore": [code] true. All claims go through `ProductJob::Binary` (`desktop_media.rs:886-891`) and the new `desktopMediaImports` table is in the same ProductStore.
- "no renderer path authority": [code] true. The envelope has `deny_unknown_fields` and no path field. The picker is native (`desktop.rs:335-345`).
- "independent source reviews passed": [claim-only] reviews are in `research/*-review.md` but are authored inside the same task.
- `status: completed` with `deliveryState: source-complete-final-checks-handed-to-owner`: the status is stronger than the evidence. The PRD AC boxes are still unchecked in the archived `prd.md`.

## Findings

### P1

**F1 — Windows scan aborts on any reparse point instead of skipping it** [code, unexecuted]
- `scan_with_read_check` does `let metadata = paths::stat_path(&path)?; if metadata.is_alias() { skipped += 1; continue; }` (`desktop_media.rs:761-766`).
- On Windows `stat_path` goes to `stat_file`, which returns `Err(containment)` for any `FILE_ATTRIBUTE_REPARSE_POINT` before an `alias: true` stat can be returned (`paths/windows.rs:127-134`). Unix returns `alias` from `symlink_metadata` (`paths.rs:103-111`), so the skip branch only works on macOS.
- Impact: one junction, symlink, OneDrive/cloud placeholder or dedup reparse entry anywhere in the chosen tree fails the whole scan with a generic message. The PRD says "Neither platform follows discovered aliases/reparse points", meaning skip, not abort. A typical `Videos`/`Documents` tree contains such entries. It is also `stat_path` on every non-video entry, so any unreadable child fails the scan.
- Fix: handle `containment` from `stat_path` per child as `skipped`. Add a Windows fixture with a junction.
- Test gap: no scan test uses an alias, and the Windows tests in `paths.rs:806` only cover the root and ancestor.

**F2 — "Unsupported Windows volume" never produces the scoped error AC2/PRD require** [code]
- Windows rejection comes from `require_local_ntfs` with code `nativeFilesystem` (`paths/windows.rs:58-62, 88-110`).
- `safe_message` only maps `"platform"` to the NTFS text (`desktop_media.rs:715`); `nativeFilesystem` falls to `_ => "本地素材处理失败，请检查文件后重试"` (`:717`). The `"platform"` code is only produced for non-mac/win OS (`desktop.rs`, `desktop_media_request`).
- Result: SMB, exFAT or removable drives fail at pick with a generic failure. The failure is safe (before any effect), but the "clear scoped error" part is not delivered. The message mapping and the code never meet.

### P2

**F3 — Windows has no descendant ownership (no Job Object)** [code]
- `OwnedChild::terminate` does `kill(-pgid, 9)` on Unix and `child.kill()` elsewhere (`desktop_media_process.rs:25-35`). The Windows branch only sets `CREATE_NO_WINDOW` (`:94-97`).
- The PRD scopes this ("direct child kill-and-wait"), so this is not a PRD miss. It is weaker than dsh (see comparison) and relies on the pinned FFmpeg never spawning children. Nothing enforces that at runtime. Also no `PROCESS_CREATION` mitigation, no low-priority or memory cap on the decoder (only a wall-clock 120 s deadline `:17`).

**F4 — Decoder verification is check-then-exec by path (TOCTOU)** [code]
- `verified_decoder` hashes the file and returns a `PathBuf` (`media_decoder.rs:127-188`). The caller later runs `Command::new(executable)` (`desktop_media_process.rs:196`), so there is a window between verify and exec. The directory identity is re-checked after the hash, but not at exec.
- Impact is bounded: it needs write access to the app resource dir (normally not user-writable when installed in `/Applications` or Program Files, but it is for per-user installs such as `~/Applications`, `%LOCALAPPDATA%`). The threat model is "same-user malware", which already wins elsewhere. Low practical risk; flag only because the code advertises "verify before launch".
- Mitigation: copy the verified bytes to an owned 0700 directory and exec from there, or exec by fd (`fexecve`). On Windows keep the file handle open without `FILE_SHARE_WRITE|DELETE` during spawn.

**F5 — Windows root-ancestor pins live for the whole grant** [code]
- `Grant._pins = pin_ancestors(&root)` held until the grant is dropped (`desktop_media.rs:208-210, 412-413, 429-430`). Pins open ancestors without `FILE_SHARE_DELETE` (`paths/windows.rs:155-172`).
- Grants idle-expire at 30 min (`GRANT_IDLE`) but only get dropped on the next `pick`'s retain (`:431-434`) or revoke. Until then the user cannot rename or delete the chosen folder's parents (e.g. `Videos`) from Explorer. Also `MAX_GRANTS=8` x ancestors. Windows-only and unexecuted, so unverified in practice.

**F6 — Expiry is lazy, so an expired grant keeps its pins and manifest** [code]
- Expiry is only checked on use (`Grant::check` `:211-216`); no timer sweeps. Memory holds the manifest (<=256 entries with hashes) and Windows pins. Minor.

**F7 — Scan hashes every candidate file in full while holding the operation lock** [code]
- `paths::hash_file` over each file up to 512 MiB / 2 GiB total (`desktop_media.rs:801-807`), then prepare copies and hashes the file again (`:941-973`). Correct (gives content binding), but a 2 GiB scan takes minutes before the user sees a list, and the scan runs on the blocking pool with `MAX_ACTIVE=2` (`:310-318`). Cancel is polled per 64 KiB via the `hash_file` callback, which is fine.

**F8 — Source copy opened without `O_NOFOLLOW`/handle-relative open** [code]
- `File::open(&source)` after the `check_entry` (`desktop_media.rs:926-935`). The ancestor swap race is closed on Windows by `pin_ancestors`. On macOS it is closed only indirectly: the opened file's `(dev, ino, nlink)` must equal the scanned identity (`:936-940`), and a final SHA-256 of the copy must equal the scan hash (`:963-973`). I could not construct a bypass (nlink==1 and the hash binding make a substituted file fail), so this is defensible, but it is the "identity after open" pattern, not containment by construction. Worth a comment/spec note.

### P3

- F9: `Operation.started.elapsed() > 10 min` timeout (`desktop_media.rs:257`) is measured from reservation, including the time spent waiting on the native directory dialog (`pick` reserves before `picker()`), so a user who leaves the dialog open >10 min gets `mediaTimeout` after choosing.
- F10: `safe_message` collapses `decoder`, `decoderOutput`, `mediaDecoderIntegrity`, `unsupported` to one generic message, so the UI cannot tell "decoder tampered" from "bad file".
- F11: `png_dimensions` validates CRC and chunk boundaries (`desktop_media_process.rs:236-297`), good, but it does not check colour type/bit depth or decompressed size (PNG decompression bomb is bounded only by the 640x640 header and 8 MiB input). Safe because the PNG is produced by the pinned decoder and later only previewed.
- F12: `desktop_media.rs` is 1712 lines mixing state machine, scan, copy and tests; the `request` match arms contain long inline `json!` one-liners (`:468-473`, `:541`) that are hard to review. Maintainability only.

## Security checklist

| Area | Result |
| --- | --- |
| Path confinement / traversal | Good. IDs only, `canonical_root` rejects `..` and non-absolute, `relative_name` is control-char filtered (`:792-799`). |
| Symlinks | macOS: `symlink_metadata` skip + identity; Windows: reparse = error (F1: should skip). Hard-link files skipped (`nlink != 1`, `:782`). Directory nlink not checked (not needed). |
| TOCTOU | Mitigated by identity + size + mtime + content hash re-verification; residual F4/F8. |
| Process teardown | Unix process group kill + reap; unknown wait retained and reaped by a background thread (`desktop_media_process.rs:149-168`). Windows direct child only (F3). |
| Output bounds | stdout 8 MiB / stderr 64 KiB drain with overflow kill (`:15-16, 46-61`). |
| Native approval identity | The Agent path requires `call.decision === 'approve'`, matching preview revision, same step/run/thread, `highRisk false`, and rechecks at publish (`desktopMediaImport.ts:30-43, 150`). Strong. |
| Late response | Receipt wins over late Stop (`performImport` catch block); `ReleaseOperation` refuses `unknown`; tombstones prevent ID reuse (`desktop_media.rs:301-309`). |
| Rust `unsafe` | One `extern "C" kill(-pid, 9)` (`desktop_media_process.rs:29-31`): the pid cast `as i32` is safe for Unix pids. After a successful reap, a later `kill(-pgid)` could hit a reused PGID, but `terminate()` runs before `wait()` and `settled` guards `Drop`. The background loop re-calls `terminate()` repeatedly (`:155-158`) before `wait` succeeds; this is acceptable since the child is not yet reaped and so its PID/PGID cannot be reused. |

## Test adequacy

- Good: real child kill/reap tests, lost-wait test, real-store transaction tests, claim-race and late-Stop UI tests.
- Gaps: no Windows execution; no alias/junction scan test; no test of grant idle expiry with Windows pins; `prepare_with_decoder` is tested through an injected decoder, and the real FFmpeg path is `#[ignore]`d; no test that a replaced decoder after `verify` is refused (F4).

## Comparison with dsh (read-only)

| Aspect | Ours (E08) | dsh | Assessment |
| --- | --- | --- | --- |
| Windows process teardown | direct `Child::kill()`; no Job Object (`desktop_media_process.rs:25-35, 94-97`) | `createKillOnCloseJob` with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, suspended-create then assign then resume, `terminateJob`, `isJobEmpty` (`packages/subprocess/win32-process/src/process.ts:340-356, 414-509`) | **Ours weaker.** dsh owns the whole tree and avoids the spawn-before-assign race. |
| Path containment | identity tuples, ancestor re-stat, Windows handle pins; explicit alias skip | realpath target key plus `isPathUnder` lexical fast path with dev/ino ancestor fallback for 8.3/case aliases (`packages/fs/fs-sandbox/src/containment.ts:50-76`) | Different goals: dsh confines to roots, ours freezes a file identity. Ours is stronger for TOCTOU (content hash), weaker on Windows alias spellings (no 8.3/case-insensitive handling beyond the handle identity). |
| Sandboxing of the child | none (verified binary, fixed args, `-protocol_whitelist file,pipe`, no network) | restricted token + ACL grants for Windows (`packages/sandbox/sandbox-windows-acl`) | Ours acceptable only because the decoder is fixed and input is a private copy; no OS sandbox on the decoder, which parses untrusted media. Consider a restricted-token or macOS `sandbox-exec` profile later. |
| Output limits | bounded drain + overflow kill | spill package for large output | Comparable for the single-PNG case. |

## Recommended follow-ups

1. F1: skip aliases per child on Windows and add a junction fixture test.
2. F2: map `nativeFilesystem` (and other native error codes) in `safe_message`.
3. F3: use a kill-on-close Job Object for the decoder (copy dsh's suspended-create/assign/resume sequence), or document it as a hard single-process invariant with a test.
4. F4: exec from an owned verified copy or an open handle.
5. Record real Windows/Intel/installed results before ticking AC1/AC2/AC4.
