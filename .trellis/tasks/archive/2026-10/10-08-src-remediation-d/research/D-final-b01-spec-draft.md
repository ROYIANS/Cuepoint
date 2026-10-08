## B01 native harness isolation and failure authority (2026-10-08)

### 1. Scope / Trigger
Maintain when changing the standalone B01 browser runner or its local Vite setup, particularly repeated runs across different fixture configurations.

### 2. Signatures / Owners
`scripts/b01-browser-regression.mjs` creates a fresh temporary `cacheDir`, explicitly scans the actual B01 fixture HTML via `optimizeDeps.entries`, and removes its cache after closing Vite. Main-frame document requests are counted; only initial fixture loading is allowed during the SPA regression sequence.

### 3. Contracts / Invariants
Keep every existing business assertion and timeout. Unexpected full-document reload is a failure, not authority to reinitialize fixtures, retry interactions, ignore missing bridge objects or increase waits. Cache separation is test isolation, not a product fix or proof of the original failure cause. Keep prior failures and configuration/runtime inputs.

### 4. Validation / Error Matrix
| Condition | Required result |
| --- | --- |
| Initial fixture document | One allowed main-frame document request |
| SPA route/history and dialogs | All existing assertions; no extra document request |
| Extra document navigation/reload | Explicit test failure |
| Consecutive cold runner instances | Separate temporary caches, same semantic assertions |

### 5. Good / Base / Bad Cases
Base: all19 scenarios pass from a fresh isolated cache. Good: an unexpected reload fails instead of silently recreating controls. Bad: calling a warm rerun proof that an unobserved root cause was fixed.

### 6. Tests Required
Preserve exact before/after assertion/timeout comparison and actual consecutive cold runs. Final current-source batch must include this runner. Retain failed logs and distinguish observed behavior from causal inference.

### 7. Migration / Limits
This scoped correction does not establish why earlier blank-page/bridge failures occurred; observational isolated and forced-cold shared controls both passed. It does not modify product behavior, install dependencies, migrate every other historical native program or close formal E/QG01 work. Local Chromium fixtures do not prove full-product or live-provider behavior.
