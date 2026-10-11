# Research: Native workspace and SQLite prototype

- Query: What is the smallest practical Electron prototype that reuses the accepted portable workspace contract and proves owned files, SQLite persistence, restart, consistent backup and process-crash recovery?
- Scope: mixed; read-only repository inspection and official primary-source documentation. No install, product/config/spec edit, native launch, migration or Git operation.
- Date: 2026-10-11

## Findings

### Recommendation and boundary

Use an isolated `desktop/` package with one exact runtime dependency, `electron: "44.7.0"`, and its own lockfile. Reuse the already installed root Vite/TypeScript tooling rather than adding another build ecosystem or changing the root package/lock. Keep a small native storage owner, a sandboxed renderer with a narrow preload bridge, and permanent native tests separate from the production Dexie owners. This is a disposable proof, not a production runtime commitment, full UI port, production-table migration or sync implementation.

The official [Electron 44.7.0 release](https://releases.electronjs.org/release/v44.7.0) reports release date 2026-10-07, Node 24.21.0 and Chromium 152.0.7977.130. Electron previously fixed omitted SQLite builtin support in [PR 47706](https://releases.electronjs.org/pr/47706), with published backports in 36.7.3 and 37.2.3. These support the candidate; they do not substitute for probing `node:sqlite` in the exact installed Electron binary.

The local explicitly authorized Node executable reports v24.11.0; its SQLite exports include `DatabaseSync`, `StatementSync`, `Session`, `constants` and `backup`, and its SQLite engine reports 3.50.4. It emits an experimental SQLite warning. **This is local Node evidence only.** Capture Electron/Node/Chromium/SQLite versions from both the actual Electron main process and its binary's `ELECTRON_RUN_AS_NODE=1` regression runs. Fail startup/acceptance if required APIs or the pinned Electron version differ.

The [Node 24.11 SQLite documentation](https://nodejs.org/download/release/v24.11.0/docs/api/sqlite.html) documents synchronous `DatabaseSync`, prepared bindings, `timeout`, disabled extension loading by default, and asynchronous `backup(sourceDb, destination, options)`. Backup overwrites an existing destination; source changes can update/restart its operation. Keep its destination inside a newly reserved disposable backup root and serialize application writes for the entire database-plus-files backup.

### Files found and relevant code patterns

| File | Relevant responsibility / pattern |
| --- | --- |
| `src/lib/workspace.ts:37` | Validated branded workspace identity. Persist a new actual identity; `browser-local` at line 44 is explicitly adapter-local. |
| `src/lib/workspace.ts:46` | Reject malformed UTF-16; exact IDs remain distinct. |
| `src/lib/workspace.ts:59` | Canonical lowercase UTF-8 hex filesystem components; do not recreate or normalize this algorithm in native code. |
| `src/lib/workspace.ts:86` | `mediaWorkspaceRef` derives project/Studio-owned media references. Both `media` and prototype `output` asset kinds can use this contract. No new output-directory schema is needed for this proof. |
| `src/lib/workspace.ts:93` | `resolveWorkspaceRef` proves lexical containment only; native owner adds physical containment and native length constraints. |
| `src/lib/workspace.ts:141` | Actual commit outcome becomes authoritative once persistence starts. Preserve this cancellation boundary. |
| `src/lib/workspace.ts:156` | Browser Blob staging; native streaming must not use this function merely to materialize a large file in memory. Reuse its public identity/reference/hash contracts, not its ephemeral Blob stage. |
| `src/lib/sha256.ts:8` | Incremental `Sha256` is portable and keeps bounded hashing state. Stream 256 KiB chunks without a later whole-file rehash. |
| `src/lib/ids.ts:1` | Browser-compatible ID creation. Native root identity can use Node `randomUUID` while validating with shared `workspaceId`. |
| `src/domain/types.ts:9` | Exact Studio owner sentinel; imported workspace helper already owns this decision. |
| `tests/workspace.test.ts:21` | Existing exact reference/path/case/Unicode regressions should run unchanged after native addition. |
| `package.json:7` | Root package manager is `pnpm@10.15.0`; root scripts include strict types, quality, tests and build. |
| `tsconfig.app.json` / `tsconfig.node.json` | Existing root compiler excludes `desktop/`; native types must be a separately executed strict gate. |
| `node_modules/@types/node/sqlite.d.ts:625` | Existing installed `@types/node` 22.20.3 already declares SQLite backup options and `backup` at line 681. No additional Node types package is necessary for the proposed API subset. |
| `vite.config.ts` | Root plugins generate TanStack routes. Native build must use `configFile: false` and a separate configuration, avoiding this plugin and existing dev-server churn. |
| `eslint.config.mjs` | Root typed lint targets `src/**` only. Reuse equivalent strict rules for explicit desktop sources without new blanket allowances. |
| `knip.json` | Root owned source/entry inventory omits desktop. A separate explicit native reachability check/config is needed; root quality passing alone is insufficient. |
| `scripts/quality-check.mjs:11` | Root frozen inventory includes src/scripts/tests/quality/vendor and exact root configs, not desktop. Native acceptance needs its own exact source manifest/hashes. |
| `scripts/quality/lint.mjs:20` | Actual formal lint CLI explicitly scans `src/**`; extending only an ESLint file glob would not automatically make this CLI cover desktop. |
| `scripts/quality/architecture.mjs:37` | Root owned graph comes from `tsconfig.app.json` and `src/**`; separately inspect native imports/ownership, rather than claiming root graph counts include native files. |
| `.trellis/tasks/10-10-desktop-storage-sync/research/native-runtime-candidates.md` | Earlier Electron/Tauri comparison remains a candidate comparison. Full audio/microphone/PDF/print/other-OS acceptance remains outside this storage proof. |

Observed existing installed tools: Vite **7.3.6**, TypeScript **5.9.3**, `@types/node` **22.20.3**. Do not change these root pins to satisfy an isolated prototype. Use `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` and corresponding Node explicitly; do not use bare/runtime-bundled pnpm. The implementation owner can install within this approved bounded prototype: retain the isolated package lock and set package `pnpm.onlyBuiltDependencies: ["electron"]` for pnpm 10's Electron download lifecycle, rather than globally allowing dependency scripts; see [pnpm 10 build-dependency settings](https://pnpm.io/10.x/settings#onlybuiltdependencies). A package directory is isolation, not permission to alter existing root `node_modules` unexpectedly.

### Build and renderer bridge

Proposed authored layout:

```text
desktop/
  package.json / pnpm-lock.yaml
  tsconfig.json / eslint.config.mjs / knip.json
  build.mjs
  src/contracts.ts / nativePaths.ts / nativeWorkspace.ts
  src/main.ts / preload.ts
  renderer/index.html / renderer.ts / style.css
  tests/*.test.mjs / fixtures/crash-worker.mjs
  scripts/runtime-probe.mjs / ui-acceptance.mjs
  README.md
```

Names can change; keep storage/bridge/schema owners concrete, without a general plugin framework. Build with the existing root Vite JavaScript API using `configFile: false`, alias `@` to repository `src`, a Node target compatible with the pinned runtime, and externalized `electron`/`node:*` dependencies. Use an ESM main/native library and a **single bundled `.cjs` preload**. For the installed Vite 7 use `build.rollupOptions`, not the newer latest-documentation Rolldown key; see [Vite 7 library build](https://v7.vite.dev/guide/build). Build the renderer independently, retaining a fixed set of bundled resources.

[Electron ESM documentation](https://www.electronjs.org/docs/latest/tutorial/esm) says sandboxed preload scripts do not support ESM imports. Bundling preload as CJS avoids disabling the sandbox to make imports work. [Electron sandbox documentation](https://www.electronjs.org/docs/latest/tutorial/sandbox) also limits preload `require`; do not require filesystem/SQLite or local runtime chunks there.

Set `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`; deny navigation/new windows and unnecessary permission requests. Expose concrete methods such as `createProject`, `importSelectedFile`, `listWorkspace`, `createBackup`, `restoreBackup`, never arbitrary SQL/path/IPC-channel/eval access. Main selects source files through a native dialog and owns paths. Test-only failpoints/root overrides belong to the acceptance harness or internal storage constructor, not the renderer bridge.

Validate sender WebContents identity, main-frame identity, and the exact trusted custom-protocol origin before every handler; validate a closed request shape with bounded values and return sanitized typed results. Use `textContent` for display filenames/titles/errors. The [Electron security guide](https://www.electronjs.org/docs/latest/tutorial/security) recommends isolated/sandboxed renderers, sender validation and custom protocols rather than unrestricted `file://`. A fixed resource allowlist under `cuepoint-prototype://app/` is smaller than a general path-to-files protocol. Register the standard/secure scheme before `app.ready`, without `bypassCSP`, according to [Electron protocol documentation](https://www.electronjs.org/docs/latest/api/protocol).

Set an isolated Electron `userData` path before readiness; no shared browser profile/IndexedDB origin. `app.requestSingleInstanceLock()` improves app UX, but a process with another profile can bypass this app-level identity. It cannot replace a workspace lock; [Electron app documentation](https://www.electronjs.org/docs/latest/api/app) describes its scope and command-line macOS behavior.

### Minimal schema and native writer owner

Use a single `workspace.sqlite` per disposable workspace, `user_version = 1`, a fixed application/format identifier and exactly one metadata row carrying persisted workspace ID. Separate explicit creation of a newly reserved root from reopening: an existing workspace with its DB removed/empty/corrupt must reject, not silently receive a new identity. Validate existing format/version before mutations; unknown/future versions reject rather than being silently recreated. Use short prepared-statement transactions with foreign keys and explicit integrity checks. `journal_mode = DELETE` and `synchronous = FULL` are sufficient prototype choices and avoid a raw-WAL-file backup design; record effective pragmas instead of assuming requests succeeded.

Suggested smallest useful schema:

- `workspace_meta`: identity, format/schema version, creation timestamp.
- `projects`: exact ID/title, prototype timestamps.
- `assets`: exact stable ID, project/Studio owner, kind `media | output`, display name, MIME, positive safe byte length, digest and canonical relative path; ready rows only.
- `asset_references`: exact IDs linking a project to an asset, with small integer timing fields; demonstrates that missing bytes preserve metadata/references without claiming full timeline semantics.
- `pending_imports`: operation ID, owned staging/final relative path, asset/project identity and explicit metadata necessary for safe rollback; never a generic raw tool/credential packet.

Keep local availability (`present | missing | corrupt`) as a verified read result; do not delete asset/reference rows after ENOENT or digest mismatch. A later logical-delete command is a distinct domain action. The prototype does not need production deletion propagation or a new production output layout.

Acquire a separate device-local **`writer.sqlite`** connection and hold `BEGIN EXCLUSIVE` until workspace close. Keep that transaction/database separate from normal metadata transactions and backup. Fail quickly with a small bounded busy timeout, never an indefinite main-thread wait. Use the same physical canonical root even when the caller spells an ancestor differently. Release/close the owner on normal shutdown; process death releases operating-system locks. Verify this in actual independent child processes. [SQLite locking documentation](https://www.sqlite.org/lockingv3.html) describes the exclusive lock and OS-backed advisory locking. This is a local-filesystem cooperative-owner design, not a guarantee on NFS/cloud-mounted directories or against processes ignoring locks. Exclude the device-local writer DB/journal from portable backup.

Every storage operation, recovery pass and backup runs through one queue. Backup takes the queue for its entire snapshot/copy/verification/publication operation. Avoid holding the metadata write transaction across asynchronous file reads; the dedicated writer lock supplies process ownership while metadata transactions remain short.

### Physical path containment and copy/recovery protocol

Canonicalize the selected root with realpath. Distinguish an ordinary system ancestor spelling such as macOS `/var` versus `/private/var` from a symlink inside the app-owned root. Reject a symlinked workspace directory itself and any managed subdirectory/file/SQLite path. Walk each owned component with `lstat`, enforce directory/regular-file kind, verify real containment with `path.relative`, and revalidate at materialization/read/cleanup boundaries. Reject hard-linked managed DB/media files where an external alias would undermine ownership. Use no-follow opens for final regular files where the host supports them. [Node filesystem flags](https://nodejs.org/download/release/v24.11.0/docs/api/fs.html) document that Windows lacks `O_NOFOLLOW`; its support on this macOS host cannot be claimed as Windows proof.

The shared hex components preserve case and Unicode identities. Native code should reject overly long encoded components/paths before I/O, rather than truncating/renormalizing them. Use a documented conservative prototype component bound and test `ENAMETOOLONG` handling. Display filenames do not affect stored paths. Validate all recovery paths from stable IDs; a damaged journal must not authorize arbitrary deletion.

Recommended import state machine:

1. Snapshot validated request/project/asset identity, generate owned staging/final refs, and commit a pending-import row before the first managed-file write. Check cancellation.
2. Open the selected source once, check regular/nonempty file and initial size, copy in bounded chunks to a newly exclusively created staging file, incrementally hash, check short reads/cancellation, flush/close. Recheck source size/identity/change indicators so ordinary editing during copy rejects instead of silently producing mixed content.
3. Validate directories again and publish with an **exclusive** final-file primitive. `rename(stage, existing)` can overwrite; a preceding existence check does not close the race. `link(stage, final)` then unlink stage is a useful tested macOS local-filesystem option, or `COPYFILE_EXCL` with final verification. Neither may link to the original source. Observe errors and any remaining staging state.
4. Immediately before the short metadata transaction, check cancellation; atomically insert the ready asset/reference data and remove the pending operation. A committed transaction must report its committed outcome even if cancellation is signaled afterward.
5. On reopen, acquire the writer owner first. Recover only paths named by validated pending operations. Remove their incomplete staging/final files only if no committed record owns them; preserve unrelated files, ready assets and references. Mark missing/corrupt ready files on reads, rather than treating them as abandoned staging.

This makes each precommit crash recoverable without a partially ready row and each postcommit crash retain complete records. Keep original imports untouched. Fault cleanup must also be recoverable: retain pending metadata until owned cleanup has succeeded. Do not broadly recursively delete a tree supplied by a corrupt row or an arbitrary renderer path.

Pure Node path/lstat checks and final `O_NOFOLLOW` do **not** supply an atomic descriptor-relative directory traversal primitive for all platforms. The prototype can prove actual rejection of static/app-boundary symlinks and tested replacements; it must not claim immunity to every hostile concurrent OS directory swap. This user scope ignores external file edits and has one cooperative writer, making that explicit boundary practical.

### Consistent backup and restore

Under the exclusive operation queue:

1. Reserve a new backup directory with exclusive `mkdir`/`mkdtemp`; never reuse a path that might contain user files. Record an incomplete operation; readers ignore it.
2. Run SQLite `backup` to a new owned destination. Reopen this snapshot read-only, validate schema/identity/integrity, then enumerate the exact committed asset/reference closure from it.
3. Copy only referenced owned binaries into backup, verify every expected byte length/digest, and fail if a required file is missing/corrupt. Never label a partial backup complete. Hash the closed backup DB too.
4. Write a strict versioned manifest with workspace ID, schema, DB digest/size and canonical asset entries. Publish a complete marker/manifest last, using exclusive/atomic owned-file publication. Report completion only after verification/publication succeeds.
5. Restore only into a newly reserved root via `mkdir({recursive: false})`. An existing root, including an empty directory, rejects. Validate manifest, DB schema/identity, checksums and complete binary/reference closure before marking the new root usable. Preserve IDs/refs exactly; do not remap like project-copy ZIP. Never include writer locks, Electron profiles, original absolute source paths or credentials.

Exclusive root reservation avoids the POSIX race where an existence check followed by directory rename overwrites an existing empty destination. A restore interrupted after reservation is an explicit incomplete owned root; reopen must reject/recover it through the restore state, not initialize it as a new workspace. Do not automatically clear an unrecognized destination.

The [SQLite backup guide](https://www.sqlite.org/backup.html) guarantees a consistent database result; it does not encompass application media files. Immutable committed media plus the operation queue and verification provide the proposed application-level closure. Files may still be externally deleted during copying; that must fail the backup. Checksums are integrity checks, not authentication/encryption.

### Meaningful permanent verification

Use built-in `node:test` for the native suite against the bundled native storage module under **the Electron binary's Node mode**. Existing browser Vitest setup deletes/reopens Dexie and does not provide native crash evidence. A second small real Electron acceptance program must create a sandboxed BrowserWindow and exercise the actual preload/IPC/SQLite owner, not a fake bridge.

| Test family | Required observable result |
| --- | --- |
| Runtime probe | Exact Electron pin and Node/Chromium/SQLite versions; required SQLite constructor/backup execute in actual main process. |
| Identity/reopen | Close the process, reopen same root; workspace/project/asset/reference IDs and digests exactly retained. |
| Owned copy | Same display filename creates distinct IDs; source inode/path not live authority; editing/removing original leaves managed bytes/hash intact. |
| Case/Unicode/length | `Project`/`project`, composed/decomposed Unicode, separators and Studio refs remain distinct; malformed surrogate/oversized path rejects without ready rows. |
| Parent/source/write failure | Deleted/missing owner, empty/truncated source, copy error, injected ENOSPC/EIO and persistence failure retain source and committed assets; no new ready row. Injection is exception-path evidence, not actual full-disk proof. |
| Process kill | Parent receives an exact failpoint handshake, terminates child abruptly, waits for exit, launches a fresh child. Kill after journal creation, partial copy, final-file publication, immediately before DB commit, and after commit before reply. Precommit cases recover safely; postcommit keeps complete data. Repeat reopen recovery for idempotence. |
| Writer collision | Two real processes with different Electron profiles targeting the same canonical root: second rejects quickly; after first kill, a third succeeds. Preserve this same-root proof separately from app-single-instance UX. |
| Containment | Symlinked owned root/subtree/final/DB/backup path and hardlink aliases reject; outside sentinel content remains exact. Root-alias spelling cannot bypass writer lock. |
| Missing/corrupt managed file | Stable record/ref/timing remains; availability changes explicitly; backup fails closure; no logical deletion. |
| Backup serialization | Queue an import/output mutation during a multi-step backup; result is one exact committed database/file state, not a mixed version. |
| Backup corruption/interruption | Missing manifest/complete marker, wrong identity/schema, altered DB/binary, traversal/duplicate/unknown manifest fields reject. Kill before/after completion marker and preserve respective incomplete/complete authority. |
| Restore protection | Existing nonempty **and empty** root rejects without byte changes. Successful new-root restore preserves identity/ref/hash closure; interrupted restore is not mistaken for an initialized workspace. |
| Real UI/IPC | Visible native window loads local bundled resources; actual bridge creates/imports/lists/backs up fixtures. Renderer has no Node/SQLite/SQL/path API; malformed requests and a foreign frame/window reject before any storage mutation. |

The [Electron automated testing guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing) provides automation examples. An external Playwright/Webdriver dependency is optional for this narrow proof: a separately launched trusted main-process acceptance harness can interact with the actual BrowserWindow renderer and collect results/screenshots without giving the product renderer a testing backdoor. Preserve startup failures/console diagnostics and final source hashes.

Required native gates: strict TypeScript with DOM plus Node types for the shared portable closure; typed lint with no broad debt; explicit entry/reachability checks; standalone build; native process tests; actual UI/IPC acceptance. Run root types/quality/build and existing affected workspace/hash/protocol regressions to prove compatibility. Root checks alone omit `desktop/` and cannot certify it. Never infer Windows/Linux success from macOS native execution.

### Related specs

- `.trellis/spec/frontend/workspace-storage.md:15`: exact hex IDs, lexical/native distinction, owned source copy, bounded hashing, cancellation and missing-reference invariants.
- `.trellis/spec/frontend/checkpoint-protocol.md:13`: persistent real identity, exact refs and strict partial coverage; no full-production/table/sync claims from a native fixture.
- `.trellis/spec/frontend/type-safety.md`: strict/no-unused/verbatim import types; unknown external boundaries narrowed explicitly.
- `.trellis/spec/frontend/quality-guidelines.md` E07 formal contract: actual authoritative gate outputs, exact evidence, no blanket ignores/new debt and no broadened acceptance claims.
- `.trellis/spec/guides/cross-layer-thinking-guide.md`: native renderer/IPC/storage/file boundaries need exact contracts and owners.
- `.trellis/spec/guides/code-reuse-thinking-guide.md`: reuse the existing portable derivation/hash owners rather than fork their contracts.

## Caveats / Not Found

- No Electron/native/SQLite product integration existed in the inspected repository; proposed layout and state machines are research recommendations, not implemented behavior.
- No install or native Electron probe/launch was performed by this researcher. Electron API availability, binary/download/lifecycle behavior and all listed native tests remain implementation/acceptance gates.
- Official exact Node 24.21.0 SQLite and latest-v24 URLs were inaccessible through the web tool. Official Node 24.11.0 docs and existing local declaration/runtime confirm only the conservative API subset; exact bundled Electron probing remains mandatory. Latest generic Node documentation describes newer APIs and must not silently dictate this implementation.
- Latest Vite documentation now uses Rolldown, while installed Vite is 7.3.6. Use the official Vite 7 docs and actual installed API/types.
- Process-kill recovery demonstrates process failure, not removal of OS caches or a physical power-loss test. SQLite `FULL`/file flush/directory flush ordering strengthens intent but does not turn a kill test into power-loss proof. The [SQLite atomic-commit explanation](https://www.sqlite.org/atomiccommit.html) explicitly relies on OS/storage behavior. On macOS `fullfsync` is a SQLite-only optional pragma documented in [SQLite pragmas](https://www.sqlite.org/pragma.html); it does not flush ordinary media through the same SQLite VFS.
- SQLite and pure Node filesystem safeguards assume a supported local filesystem/cooperative ownership. No NFS/network-volume or malicious OS-user race claim. Windows no-follow/junction/drive limits, Linux filesystems and actual distributable installers need later native acceptance.
- No credential-vault, real API key, live provider, paid operation, complete tool-history projection, full 49-table migration, desktop microphone/media/PDF/print compatibility or production desktop commitment is satisfied by this child.
