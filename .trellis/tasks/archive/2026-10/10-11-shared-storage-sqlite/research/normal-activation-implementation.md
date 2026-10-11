# Normal SQLite build activation implementation

Date: 2026-10-12. Implementer: `/root/normal_sqlite_activation`.

The standard desktop `build:app` entry now selects the existing complete `product-sqlite` feature by default. The isolated full-product prerequisite was independently accepted in `isolated-final-signoff.json` before this activation dispatch. This report verifies the narrow source policy and focused checks; the parent still owns the real normal build and packaged startup/write/reopen proof. It does not complete or archive the task.

## Change boundary

Only `desktop/tauri/scripts/build-app.mjs` product source changed: two policy lines and one stale isolated-build comment. The source SHA-256 changed from `5ce4ca71f17633289f52097b140b9efc657245d85eb286830f189a4058031dd2` to `400b055517253c142264c780a857a1bee73cff0611b8cc7cf11ea88cddc12f05`. `normal-activation-01/build-app.diff` preserves the exact diff and `build-app.before.mjs.txt` the input bytes. The script was unchanged throughout all checks.

The existing feature selection and bundle receipt now consistently use SQLite for normal no-flags builds. Shared React pages, commands, Agent, adapters, Rust profile injection and dependencies stay on their already accepted implementations. No migration, fallback or additional catalog was added. The explicit isolated IndexedDB reference remains valid; acceptance fixtures remain a separate build lane. No test expectations were mechanically changed to SQLite.

## Lane verification

| Invocation | Verified source policy |
| --- | --- |
| Normal no flags | `product-sqlite`, SQLite, normal identifier/profile |
| Normal `--sqlite-product` | Same normal SQLite result |
| `--isolated-product` | `desktop`, IndexedDB, dedicated review identifier/profile |
| `--isolated-product --sqlite-product` | `product-sqlite`, SQLite, dedicated review identifier/profile |
| `--acceptance` | Historical `acceptance` feature and SQLite fixture identity |
| Conflicting fixture selection | Both `--acceptance --sqlite-product` and `--acceptance --isolated-product` reject before side effects |

Six lane groups / seven invocations passed. Verification extracted and evaluated the actual source declaration prefix and actual native-feature/storage expressions in a fresh VM containing only argument/environment values. It did not import or execute the build entrypoint, launch builds or substitute a mocked bundle result. The source and decisions are in `normal-activation-01/lane-decisions.json`.

## Checks

All commands used the explicit machine pnpm, version `10.15.0`, with Node `v24.11.0`. All exited 0, and their raw logs were inspected.

| Check | Result |
| --- | --- |
| `pnpm --dir desktop/tauri types` | PASS |
| `pnpm --dir desktop/tauri lint` | PASS, `--max-warnings 0`, no diagnostics |
| `pnpm --dir desktop/tauri quality` | PASS, Knip, no diagnostics |
| `pnpm exec vitest run tests/productStorage.test.ts tests/productStorageQueries.test.ts` | PASS, 2 files / 16 tests |
| Scoped `git diff --check` | PASS |

`normal-activation-01/checks.json` records exact commands, exits, versions, timing and log hashes. These focused logs do not change the separately reviewed full-source quality outcome: twelve allowances and 584 visible warnings. The complete unchanged adapter/business evidence remains qualified by its original source identity, not rewritten by this build-policy change.

## Remaining parent work

Build with `CARGO_INCREMENTAL=0 /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri build:app`, then launch the exact archived normal app from its new receipt. Verify `dev.cuepoint.prototype.offline`, storage `sqlite`, WK store `ed4550f181f509d050d0643fe7cb7ae0`, fresh `product-workspace-v1`, actual writes/managed bytes/full routes/Agent saved result, clean reopen and no unsolicited POST. Complete independent activation review, owning spec updates and the final concrete local commit/journal/archive gate afterwards. No normal-host result is claimed here.

No build, CUA, app-data or credential access, provider request, commit, push or merge was performed by this implementation agent. Only this script and the owned task-local implementation evidence/report were written. Windows/Linux actual-host checks remain deferred.
