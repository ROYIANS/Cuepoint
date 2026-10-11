# Desktop parity delivery sequence decision

Date: 2026-10-11. The user selected option A after prioritizing complete existing features and Agent/AI. The final design/execution summary still needs implementation approval.

## Common goal

One shared product UI and business layer, complete native feature parity, app-internal data/files, and no default historical migration. Retain existing Agent behavior, tools, approvals, transactions, model protocols and styling. Agent is the first end-to-end acceptance priority.

## Option A — complete existing features first, centralized SQLite replacement later

Recommended for the latest priority: shortest path to a usable complete desktop product.

1. Use the existing Web product UI, commands and IndexedDB owner inside the normal packaged Tauri application. Explicitly decouple runtime identity from storage selection: native hash navigation/OS adapters remain active; product queries and commands intentionally use the existing IndexedDB owner during this development stage.
2. Gate the prior SQLite product slice as inactive for that stage; do not copy/mirror projects between two owners or expose mixed project catalogs. Preserve prior source/tests and isolated evidence rather than delete or overwrite a developer workspace.
3. Adapt centralized network/streaming, device-local credentials, run ownership, file/dialog/export, media/document/recording/print differences. Reuse actual feature bodies and existing Blob copies; no external source path becomes a live asset authority. Verify which ordinary Web APIs work before replacing them.
4. Run the shared Agent first, then exercise the complete current feature/tool matrix in the actual packaged app. Remove capability gates only where the selected owner supports the feature. A basic chat pass cannot stand for complete Agent/tool parity.
5. In a following reviewed storage stage, extract the shared typed transaction/store abstraction and switch the product to SQLite plus managed files centrally. Use fresh development data by default; no promise of preserving the temporary stage's records unless the user later explicitly requests that behavior.

Observable first-stage exit: shared normal packaged application supports connector/model configuration, Agent streaming/Stop/history/retry and tool/approval/task flows, plus the inventoried existing product capabilities. Its product persistence is truthfully IndexedDB, not SQLite. Remaining platform failures stay visible in the evidence and prevent a full-parity claim.

Tradeoff: SQLite is postponed, and the interim desktop stage relies on WebKit IndexedDB/Blob persistence. It is a deliberate development sequence, not a full Dexie-to-SQLite compatibility strategy.

## Option B — SQLite from the first Agent delivery

Preserves the earlier selected native storage ownership immediately, with more prerequisite adaptation.

1. Inventory table/query/field/binary operations actually used by existing commands and Agent. Build a bounded typed app-storage interface with explicit transaction-scoped context and shared query invalidation, not a full Dexie compatibility engine.
2. Refactor existing TypeScript commands to consume that context. Nested local business commands and tool-ledger completion join the same outer transaction. Browser uses the Dexie adapter; native uses a coherent fresh SQLite owner.
3. Choose and verify a native atomic transaction implementation (bounded snapshot/change-set commit with revision guards, or explicitly owned transaction sessions). Retain structural validation and native ownership while keeping product transformations/Agent rules shared.
4. Add Agent core persistence and the same native runtime services as option A, then bring tool families and their data dependencies online in the parity-map order. Existing video SQLite/file infrastructure can be reused, but its per-action writes cannot substitute for a composable Agent atomic transaction.
5. Validate Agent plus business mutation/receipt atomicity, failure/cancel rollback, completed-call replay across reopen, typed fields/undefined/null semantics, staged binaries and actual packaged full-feature behavior.

Observable first usable exit: shared native Agent and selected tool flows read/write only SQLite/managed files and preserve atomic execution evidence. Complete parity requires all inventoried dependencies to be connected; the first vertical slice does not claim all tools are finished.

Tradeoff: the user receives complete Agent/tool parity later because storage/transaction extraction precedes it. This route still reuses business logic and UI; it should not become a per-feature Rust rewrite.

## Decision status

The user's explicit answer is “先完整功能，再集中换 SQLite（推荐）”. Option A is the selected delivery order. The old project-local world candidate and option B are not the execution sequence. Complete the design/implementation artifacts and present final review; task creation/sequence selection do not alone start product implementation.
