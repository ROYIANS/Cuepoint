# Shared business reuse and native Agent integration

Status: implementation approved on 2026-10-11 after final PRD/design/execution-plan review. Complete-feature-first delivery with Agent priority and internal IndexedDB is authorized; commits/push/merge remain separately scoped.

## Goal

Run the existing complete Web product in the normal Tauri desktop application as early as practicable, prioritizing Agent/AI and reusing its current interface and business implementation. Keep product data in application-internal IndexedDB during this stage, then replace persistence centrally with shared storage interfaces and SQLite/managed files in a later reviewed task.

## Background

- Parent: `10-10-desktop-storage-sync`; all six earlier children are accepted and archived.
- Existing shared video pages demonstrate UI reuse, but some Dexie/Rust business mutations are implemented twice; many other pages and Agent commands still depend directly on Dexie.
- The initial project-local world candidate was not selected. The user explicitly wants rapid full desktop feature parity, considers Agent/AI the most important capability, and rejects rebuilding completed Web features one domain at a time.
- After a concrete comparison, the user selected: complete features first using internal IndexedDB, then a centralized SQLite replacement. The approved architecture choice changes delivery order; it does not authorize two competing product stores or a second UI.
- Read-only source evidence is recorded in `research/agent-reuse-audit.md`, `research/shared-storage-feasibility.md` and the runtime inventories. Earlier world reports remain candidate/history evidence only.

## Requirements

### R1 — Complete existing product parity

Reuse the existing routes, pages, components, styles and business commands for Agent, projects/video, world/entities, global/IP/material libraries, media/reference inputs, audio/music, generation and exports. Do not restrict the task to project-only entities, omit global reuse from the target, or call a chat-only demonstration complete. Cloud synchronization and other features not implemented in the current Web product are outside this parity target.

### R2 — Agent first, same behavior

Keep existing model protocols/parsers, reasoning/streaming UI, context algorithms, memory/references, tasks, plans, previews, permissions/approvals, tools, generation recovery, finishing/final review and complete original tool history. All registered tool families belong in the parity matrix. Do not implement a NativeAgent or a separate native tool registry with altered business semantics.

### R3 — One temporary IndexedDB product owner

The browser continues its current owner. During this desktop stage the normal Tauri product deliberately uses its own internal IndexedDB owner and existing transaction bodies. Do not simultaneously expose the prior SQLite project catalog, mirror native rows into Dexie, fall back after a failed write, or import old browser/SQLite data. Preserve existing SQLite infrastructure/tests for the later storage replacement and isolated prototype lane.

### R4 — Separate runtime identity from storage choice

Tauri identity still controls trusted IPC, native hash navigation and system services. Product storage selection controls repository/Dexie behavior and capability gates. Fix the native-only gates that currently disable existing IndexedDB-backed features; do not pretend the packaged application is a browser by disabling its actual native identity.

### R5 — Central model/network integration

Reuse current Chat Completions/Responses, SSE and request boundaries with centralized runtime transport. Support cancellation, timeouts, streaming and request failure without duplicating provider protocols or distributing native requests across tools. Model/AI, search, media polling and downloads must be inventoried. Credentials stay device-local; do not copy old connections or leak credentials through IPC logs, URLs or evidence.

### R6 — Internal files and native system behavior

Imported assets are internal byte copies; originals are not live authorities. Existing Blob/media logic can remain the owner for this temporary stage. Adapt only actual packaged gaps in file dialogs, downloads/exports, clipboard, documents, media playback, recording and print. Native exports must not require a mirrored SQLite project; canceled or failed operations must not report success or overwrite a destination.

### R7 — Preserve durable execution guarantees

Retain existing IndexedDB transaction composition: business mutations and completed tool results/receipts commit together, canceled/failed operations roll back, and durable replay does not repeat a completed call. Verify actual packaged run ownership, Stop/retry/resume and generation unknown-outcome handling. Never weaken these guarantees merely to open an unavailable route.

### R8 — Fresh development and later storage work

Use a fresh isolated application data store for acceptance, with no historical migrations or compatibility readers. This stage does not promise preservation of its development records during the later SQLite switch unless a future task explicitly requests it. Fresh data does not mean fresh business implementation.

### R9 — Evidence and completion

Use a feature/tool parity matrix with explicit supported/blocked/verified outcomes. Run relevant existing behavioral tests, complete required quality gates and verify the actual normal packaged app. Local provider fixtures prove deterministic transport/streaming/failure behavior; genuine supplier results need separate labeled evidence after connection configuration. Unverified or failed features cannot be represented as complete parity.

## Acceptance criteria

- [x] AC1 (R1, R2, R9): A route/feature/tool-family matrix covers the entire existing product and contains no unexplained or silently dropped capabilities at completion.
- [x] AC2 (R3, R4, R8): Normal packaged product reads/writes its internal IndexedDB only, while retaining native IPC/hash navigation; no competing SQLite product owner or old-data import occurs.
- [x] AC3 (R1, R2): Desktop Agent and product reuse the existing UI, model protocols, tool schemas, approvals and business commands without a parallel native implementation.
- [x] AC4 (R2, R5, R7): Actual packaged Agent verifies connector/model configuration, streaming/reasoning, Stop, failure retention, history after reopen, retry/resume, approval/denial and representative tools; every registered family receives mapped regression/runtime evidence.
- [x] AC5 (R5): Central runtime transport preserves shared response/parser behavior and passes cancellation, partial-stream, timeout, provider-error and media/request integration checks; secrets are not exposed in evidence.
- [x] AC6 (R6): Managed internal copies survive loss of the external source; native file export/cancel/existing-target, playback/document/recording/print/clipboard flows have truthful packaged outcomes.
- [x] AC7 (R7): Existing nested business-write/tool-ledger rollback and completed-call replay cases pass, including actual restart persistence and run ownership behavior.
- [x] AC8 (R9): Relevant browser regressions and root/desktop types, lint, quality, builds, Rust checks and normal packaged build pass on the final source.
- [x] AC9 (R8): Later centralized SQLite replacement is recorded as a separate parent deliverable; this task neither performs migration nor claims SQLite product storage.

Acceptance reconciliation (2026-10-11): the independent final checker finds AC1–AC9 satisfied for the approved macOS representative-family plus individual shared-contract scope. Packaged actual evidence1–106 and browser1–18 retain their original provenance; the final matrix and source review describe each finite outcome. This does not mean95 separate live tool runs. Live Tavily is conditional, with its real native synthetic transport separately verified; failed-chat retry stays a retained failure while summary regeneration is a positive recovery. Cross-platform OS and physical-printer evidence remain deferred. AI summary drafts remain human-reviewable and unfinished synthetic business tasks are not the development task's completion criterion. Implementation is accepted pending concrete work-commit/archive approval; no commit, task archival or merge has occurred.

## Out of scope

- Central SQLite replacement, full sync codecs or cloud/service deployment in this task.
- Historical browser/SQLite migration, credential migration or compatibility readers.
- New product features, a second native UI/Agent, model-protocol reimplementation or unrelated styling/icon changes.
- Full cross-platform OS acceptance beyond the available macOS host; portable code/build boundaries remain part of implementation, other OS evidence must be reported separately.
