# D01 boundary and acceptance

## Gap and actual ownership

Current C source retains three value SCCs: generation batches/runtime, tool ledger/loading and tasks/records/wrapups/evidence. Local DB guards/selectors/readers currently import modules that also own commands or paid transport. Extract unchanged semantic responsibilities: `domain/agentToolSelection`, `db/agentTaskGuards`, `db/agentGenerationTarget`, `lib/agent/generationPreparation` (names may adapt to existing patterns). This keeps the DB readers next to persistence and pure selection next to the domain. Preparation owns flush/hash/config/profile/input snapshot outside write transactions.

Expected modified owners: db/agentGenerationBatches, db/agentTaskRecords, db/agentTasks, db/agentTools; lib/agent/generationRuntime and toolLoading. Read actual immediate callers; preserve needed public exports but redirect actual DB consumers to leaves. Keep executeAtomicTool, nested writes, ownedGenerationBatch and wrapup freshness gates. No paid/provider changes, schema migrations, dynamic import cycle hiding or new registry. Existing C bounded-reader, duration, media/history contracts remain.

## Verification

Capture before hashes of every product path before edits; new paths null. TypeScript, model gate if appropriate, focused genuine entry regressions across tools/loading/frozenoffers/approvals, generation/permissions/samecallrecovery/two-workerbatch, records/wrapups/taskguard/cancel and rollback. Add tests only for meaningful boundary risks or genuinely uncovered call paths. AST value-only SCCs must disappear globally, no parse errors/new cycles, and runtime use of all extracted leaves must be verified.

Use explicit `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`; focused `exec vitest run <files>`. NativeC01 runner `scripts/c01-browser-regression.mjs` verifies real Dexie evidence/transaction lifetimes, plus relevant existing native runner if your changes affect those boundaries. Set C01_PLAYWRIGHT_PATH to `/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs` and C01_CHROMIUM_PATH to `/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`. No installs.

Independent review requires report and exact all before/after maps; unit remains in_progress until main matches current hashes and closes AR04/PD04. Original finding was structural debt, not demonstrated initialization crash; preserve that limit. Main handles static baseline differential/AST setup, docs and ledger.
