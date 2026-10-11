# Tauri native workspace and compatibility prototype

## Goal and user value

Prove that a lighter desktop candidate can reliably own SQLite metadata and managed files while retaining Cuepoint's existing React media workflows. Produce a runnable, disposable macOS prototype and measured evidence before selecting a production desktop runtime or migrating real user data. This is a prerequisite of the continuing `10-10-desktop-storage-sync` parent, not completion of synchronization.

## Background and decisions

- The user approved the native persistence experiment with "开始吧", then reopened the Electron choice because of its bundled browser. On 2026-10-11 the user explicitly selected **"先验证 Tauri 2（推荐，优先轻量）"**. Tauri 2 is the experiment candidate; production adoption depends on the results.
- Accepted browser helpers provide independent Blob copies and exact portable references; the checkpoint/provider foundation covers a deliberately partial immutable fixture. Neither proves persistent native SQLite/files, production migration or a live sync service.
- Tauri keeps React/HTML/CSS and uses an OS WebView plus a Rust core. This host has Apple Command Line Tools but no discovered Rust installation. Verified fixed versions and project-local toolchain mechanics are in `research/tauri-prototype-plan-research.md`.
- Original runtime-independent storage requirements remain in force. Earlier planning artifacts are preserved losslessly under `research/previous-electron-plan/`. The 15 unaccepted Electron authored files and limited probes are identified in `research/runtime-reconsideration-draft-manifest.json`; they are not Tauri evidence.
- This revised complete plan adds Rust ownership and actual packaged-WebView compatibility/measurements. Status remains `planning` until final review; the candidate choice itself is resolved.

## Scope and ownership

Use an isolated `desktop/tauri/` package with Cargo/npm locks, Rust owner, small React fixture window, strict quality configuration and permanent tests. Preserve root dependencies, browser production data, credentials, existing WebStorm server and unrelated generated-route edits. Two dependent work packages belong to this child: **A, native persistence**, then **B, packaged desktop compatibility**. B begins only after A's storage gate passes.

Preserve the Electron draft unchanged during planning. Before final commit, relocate only manifest-identified authored files to a task research archive, preserving paths and verifying hashes. Do not ship the obsolete draft or installed dependencies; unknown files are untouched. No whole-directory reset.

## Requirements

| ID | Required behavior |
| --- | --- |
| R1 | Pin Tauri, Rust, SQLite binding and frontend bridge. Build/launch an actual `.app` from packaged assets, record actual toolchain/SQLite/OS/WebView versions, and use independent disposable roots and WebView profile. No production IndexedDB mutation. |
| R2 | Persist one portable workspace UUID and versioned minimal SQLite schema. Separate create-new-root from open-existing-root. Reopen preserves exact identity/records; unsupported, corrupt or incomplete state rejects instead of initializing over it. |
| R3 | Store prototype projects, independently copied assets (media or output) and project references/timing. Stable IDs, owner, exact canonical ref, display name, MIME, positive bytes and SHA-256 are authoritative. Display names never determine paths; source deletion/change cannot affect accepted copies. These are not codecs for the 49 production Dexie tables. |
| R4 | Persist import intent before bounded copy/hash outside the metadata transaction. Publish complete bytes without overwrite, then atomically commit ready metadata/ref and remove intent. Recheck owner, lifecycle and cancellation immediately before real commit. Recover copy/publication/transaction interruption idempotently, preserve committed work and source files, and never mark incomplete work ready. |
| R5 | Validate canonical native root and managed components; reject symlinks, unsafe hard links/types, wrong ownership/refs and excessive portable lengths before unsafe writes. Roots/source paths stay device-local. Document actual hostile concurrent filesystem replacement limits. |
| R6 | Serialize writes/import/backup/recovery/close and hold a separate lifetime SQLite writer connection to prevent a second cooperating writer. Live contention fails promptly; actual process death releases ownership. Snapshot inputs before queue waits and enforce operation/lifecycle identity. |
| R7 | Missing/corrupt managed bytes retain stable metadata, refs and timing, with explicit availability errors. Local absence never becomes replicated logical deletion. |
| R8 | Back up a consistent SQLite snapshot plus complete verified managed-file closure. Exclusively reserve a fresh destination, publish completion last and reject incomplete/corrupt backups. Restore into a separately reserved new root with exact identity/refs/hashes; never overwrite even an existing empty target. Incomplete restore cannot open. |
| R9 | Rust owns paths, SQLite, dialogs and operation authority. Expose typed domain commands, not arbitrary filesystem paths, SQL or shell/plugin powers. Exercise explicit application-command ACL, trusted window/origin, strict payloads, CSP and navigation policy, including negative cases. |
| R10 | Permanent real-filesystem/SQLite tests cover failures, cancellation, lifecycle races, writer contention and actual child-process termination around import/backup acceptance. Retain raw failures and independent final-source review. Physical power loss, network filesystems and other OSes are separate gates. |
| R11 | In packaged macOS WebView, exercise real image/video, PDF/DOCX workers, audio decode/play/seek/fade/mix/WAV, actual storyboard print and incremental SSE code paths using local fixtures. Save exact export bytes through native dialogs. Prototype-only narrow adapters are allowed; trivial mocks/full-app migration are not substitutes. Denied/canceled/error paths remain useful. |
| R12 | Measure actual prototype app/archive bytes, startup and idle/media process-tree memory with build/OS/fixture context. Do not infer production RAM/performance or compare with an incomplete Electron draft. |

The parent decisions remain unchanged: independent app, embedded DB plus managed bytes, sequential devices for one person, app-authoritative edits, future provider plugins and complete original tool history with field review. This child neither implements nor weakens later production requirements.

## Observable acceptance

| Gate | Observable outcome | Requirements |
| --- | --- | --- |
| A1 Runtime/parity | Actual pinned Rust/SQLite executes. TS-generated golden fixtures and Rust agree on exact owner/case/Unicode/ref/hash; malformed UTF-16/wire input cannot alias IDs. | R1, R3, R5, R9 |
| A2 Persistence | Create/import/output/ref/close/reopen retains identity, records, timing and hashes. Same names and case/Unicode IDs stay distinct. Original source changes/deletion leave accepted bytes intact. | R2, R3, R4 |
| A3 Availability/containment | Missing/corrupt files preserve refs. Invalid paths/links/owners/schema and a live second writer reject. Killed-owner reopen works without bypassing a live owner. | R2, R5, R6, R7 |
| A4 Recovery/authority | Kill real processes after intent, during copy, after publication, before/after DB commit and before/after backup completion. Reopen is idempotent, incomplete work is not ready, commits survive, unrelated/source files remain unchanged. Cancellation/queue/lifecycle results follow actual commit. | R4, R6, R10 |
| A5 Backup/restore | Consistent snapshot/file closure; strict wrong identity, traversal, duplicates, corruption, truncation and interrupted restore reject. Complete new-root restore matches identity/refs/hashes. Existing empty/populated targets retain all bytes. | R5, R8, R10 |
| B1 Bridge/isolation | Actual pinned `.app` starts from bundled assets; its packaged-origin UI drives normal import/reopen/backup/restore commands. Unapproved window/origin/command, extra fields and arbitrary path/SQL requests reject. Normal release excludes test hooks, reports and loopback service/policy. | R1, R9 |
| B2 Media/documents | Local image/video decode/play/seek; real offline PDF worker/CMaps/fonts extract known Chinese text; real DOCX worker handles valid/corrupt/aborted input. Actual audio helpers decode/play/seek/fade and render a short WAV with checked timing/samples. | R11 |
| B3 Microphone/delivery | Only a user gesture may request native microphone and record about 3 seconds, kept only in disposable local workspace. Verify denied/stop/dispose/decode. Actual storyboard component with multi-page data prints white A4 landscape, no chrome, full content and correct episode. Native CSV/ZIP/WAV save is byte-exact; canceled dialog changes nothing. OS permission/print checks may require user action and are labeled honestly. | R9, R11 |
| B4 Streaming | Free loopback fixture emits spaced SSE to the actual bounded reader and appropriate real adapters. Delta timestamps precede completion; cancellation disconnects, CRLF/multibyte/budget/terminal-error semantics pass. No paid request; test-only network policy cannot ship. | R9, R11 |
| B5 Quality/measurement | Native fmt/strict Clippy/locked tests/build and frontend strict types/typed lint/reachability pass, alongside relevant portable-helper regressions and final root types/quality/build. Final hashes, exact command exits, real window evidence and bounded measurements receive independent full-scope review. | R1, R10, R12 |

## Technical constraints and deferred work

Rust ownership is a port, not direct Node-native reuse. Current TS helpers remain the wire oracle with Rust parity tests. Direct Rust domain commands keep arbitrary frontend SQL out of the write boundary. Asset-to-Blob UI samples are at most 32 MiB; native copy/backup uses bounded chunks rather than whole-file memory allocation.

Normal app is offline. Free local SSE and acceptance reporting are separate test-build facilities. This child proves only this macOS host. Windows/Linux WebViews, signing/installers/release, real migration/full UI port, native credential vault, production original-tool-history codecs, live sync/auth/encryption, large-media transport and user-installable plugin marketplace remain parent work. A local stream does not prove remote-provider compatibility; process kills do not prove physical power-loss durability.

All user-owned decisions for the experiment are resolved. Unproven runtime behavior is an execution gate, not assumed success. Critical compatibility failure keeps the child unaccepted and returns concrete findings for review; it cannot be silently removed from scope. Commit/archive/journal requires a later exact file plan after acceptance; no push.
