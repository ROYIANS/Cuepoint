# Film script impact increment

## Change boundary

The existing episode draft repository already removes source ranges that no longer
match the saved script. The Agent result omitted that effect. The smallest change
is to capture normalized before/after stories inside the existing atomic tool
callback and return bounded, code-owned historical range/retained-shot facts.

Expected authored files: `src/lib/agent/businessTools.ts` (private projection,
script-only preview disclosure and result), `tests/agentFilmScriptImpact.test.ts`
(real repository/tool/ledger regressions), and this validation record. No changes
to normalizers, episode command owners, shot content/order, tool arguments,
permissions, paid execution, runtime, UI or historical results are required.

All seven remaining tasks are authorized for actual development and acceptance.
This increment covers the existing R2 source-range criterion only. Semantic
synchronization is explicitly `not_performed` and is deferred scope.

## Validation

On 2026-10-10:

- `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/agentFilmScriptImpact.test.ts tests/agentBusiness.test.ts tests/agentProjectCreation.test.ts tests/agentToolTransactions.test.ts --maxWorkers=4`: exit 0, four files, 91 tests passed.
- `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint`: exit 0, actual app TypeScript check.
- `git diff --check -- src/lib/agent/businessTools.ts tests/agentFilmScriptImpact.test.ts .trellis/tasks/09-22-agent-result-evidence/validation/2026-10-10-film-script-impact.md`: exit 0.

The new file has 13 actual tool/repository/protocol tests. It proves one valid
range survives while another loses its association; preexisting malformed,
mismatching and absent ranges are not counted. All shot JSON bytes and canonical
revision tokens remain unchanged, including sibling/foreign shots and a malformed
foreign FK. An unchanged script reports zero new invalidations; title/logline-only
patches have no `scriptImpact`.

The large fixture has 47 invalidated ranges and 45 retained shots: each array
contains 40 IDs, with exact omitted counts 7 and 5. Range order follows persisted
beat order; shot IDs use deterministic lexical order. Shot edits/additions after
preview are preserved and observed inside the actual mutation transaction.
Episode edits after preview refuse the stale operation. Reload plus later manual
edits still returns the exact saved historical result and does not overwrite them.
Final ledger failure and a real oversized legacy-ID result both roll back episode
normalization and project touch, preserving the exact original call without a
success result. Both Chat Completions and Responses receive the committed impact
alongside the ordinary write receipt in continuation from one user message.

Initial focused run: 9 passed, 4 failed only because `toMatchObject({result:
undefined})` requires a present property, while unchanged ledger rows omit it.
The final tests instead assert equality of the complete original ledger row,
which also verifies no status, result, preview or timestamp changed. Production
code did not require a correction for those assertion failures.

Independent review and coordinated full quality/test/build remain the main
session's gates. No paid provider request or browser/device acceptance is
performed by this increment. This evidence does not establish semantic beat/shot
synchronization; successful results explicitly say `not_performed`.
