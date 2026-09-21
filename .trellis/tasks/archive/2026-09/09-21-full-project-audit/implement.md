# Audit execution plan

## Current state

Execution authorized and first full audit completed on 2026-09-21. Results and remaining validation limits are recorded in report.md and coverage.md. Trellis-required specialist reviews were used; no new test framework or product fixes were introduced.

## Ordered work packages

- [x] A0: Capture commit, dirty files, actual Node/pnpm/browser versions. Expand file/route/table/test inventory. Run baseline commands and log outcomes. Perform isolated browser smoke. Reconcile HEAD changes since planning.
- [x] A1: Read relevant detailed specs; inspect historical tasks for contract conflicts. Map owners, dependencies, critical mutations and callers. Enumerate allowed/forbidden state transitions and expected error behavior.
- [x] A2: Trace every destructive/import/export operation and critical write transaction. Use legacy DB/package fixtures for supported migrations. Exercise failure rollback, concurrent writers, last-episode deletion, drafts, media references and normalized ZIP round trips.
- [x] A3: Trace registry → schema → permission → preview → decision → write → evidence → continuation. Inject deterministic transport/storage failures and crash windows; exercise duplicate callbacks, stale inputs, retry and cross-tab locks. Compare manual and Agent paths.
- [x] A4: Review remaining source systematically. Investigate suspicious search matches through reachability/callers. Compare shared asset forms, validation/defaults, filtering/reorder, state mapping and provider adapters. Inspect async effects, cleanup and CSS. Record refactor proposals without silently implementing them.
- [x] A5: Execute all browser journeys and failure states in design.md; inspect persisted records and exports alongside UI. Capture actionable screenshots, accessibility/mobile outcomes and measured scale behavior.
- [x] A6: Trace untrusted inputs and keys to rendering/network/log/export sinks. Review dependencies and generated data, nginx routing and release gates. Assess behavioral test assertions, negative cases and races; source-string tests alone do not prove behavior. Consult current primary docs/advisories for external claims.
- [x] A7: Reproduce/prove each P0/P1; recheck remaining findings against intended contracts and callers. Deduplicate causes, close inventory gaps, document unavailable scenarios. Deliver report.md and ordered repair backlog.

Rounds can revisit an earlier layer when new evidence requires it. Surface confirmed critical findings promptly. Keep repairs independently scoped instead of bundling them with the whole audit.

## Baseline commands

Run from the repository root with the intended Node directory first in PATH. Use the local package manager explicitly:

```sh
git rev-parse HEAD
git status --short
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node --version
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --version
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify
git diff --check
```

Capture exit codes, logs and environment; preserve pre-existing failures as evidence. Run file-generating commands sequentially and inspect generated changes. Do not reinstall or upgrade dependencies to obscure baseline issues.

Focused reproducers follow existing tests/*.test.ts conventions, for example:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test -- tests/repoReliability.test.ts tests/projectPackage.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test -- tests/agentGenerationRecovery.test.ts tests/agentGenerationBatchSafety.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm dev -- --host 127.0.0.1 --port 4173
```

Use an isolated browser context/origin with synthetic data; an alternate port alone does not prove an existing profile is disposable. Exercise production preview for built assets/routing, in addition to dev. Stop only servers started for this audit. Browser automation can collect evidence without adding a permanent E2E framework by default.

## Per-round evidence

Save round-Ax.md or an evidence directory containing baseline/environment, reviewed files/invariants, actual commands/scenarios, findings, unresolved hypotheses and next targets. Update coverage.md and findings.md before progressing. Keep keys/personal project content out of logs and screenshots. Mock success is not live-provider verification.

For new defects, add only meaningful reproducers that fail when the behavior is wrong. Prefer existing lib/repository harnesses; use browser evidence when the problem requires real rendering, events or browser APIs. Broadly repeat checks only after changes or failures justify it.

## Completion gate

- [x] Reconcile AC1–AC7 against evidence; explicitly identify blocked/deferred checks.
- [x] report.md includes health assessment, priority counts, defects, debt, contract questions, baseline results, coverage limitations and repair ordering.
- [x] Each repair candidate has a module boundary, dependencies, expected outcome and regression validation. Refine estimates after A0/A1 rather than guessing calendar dates now.
- [x] Distinguish planning complete, audit complete and repairs complete in the final status.

Completion is scoped to the documented first audit. The original scenario matrix is not exhaustively executed; report section 10 and coverage.md retain all unverified cases.
