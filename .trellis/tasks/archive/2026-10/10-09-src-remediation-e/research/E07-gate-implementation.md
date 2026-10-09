# E07 portable gate implementation

Implementation complete; root enforcement correctly remains blocking until main-session source repairs and individually reviewed contracts are supplied. Owned paths: `scripts/quality-check.mjs`, `scripts/quality/**`, and this report/evidence directory. No root configurations or allowances are written by this worker.

## Integration contract (schema v1)

`node scripts/quality-check.mjs` runs ESLint, TypeScript-resolved values-only architecture, and Knip production/full in the current working directory. Exit 1 means blocking findings or invalid/stale allowances; exit 2 means tool/config failure. `--report <path>` writes the complete machine report. `--describe <path>` emits every diagnostic's semantic identity for individual review; it does not write allowances or change exit behavior. `--root <path>` supports bounded fixtures and project mirrors. `--only lint|architecture|unused` is diagnostic/self-test mode; the default always runs all three. `node scripts/quality/self-test.mjs` exercises the production CLI with isolated temporary fixtures and the installed project tools.

Optional `quality/debt.json`:

```json
{"schemaVersion":1,"identityVersion":"ts-ast-tokens-v1","identityProducer":{"sha256":"<SHA256 of scripts/quality/identity.mjs>","typescript":"<installed TypeScript version from lint report>"},"allowances":[{"rule":"@typescript-eslint/only-throw-error","file":"src/example.ts","signature":"<64 lowercase sha256 hex from describe>","count":1,"reason":"Concrete reviewed compatibility contract and evidence","owner":"Named responsible owner"}]}
```

The producer SHA256 and TypeScript version must equal the actual implementation and installed parser; a changed identity producer requires explicit review. Only ERROR diagnostics can be allowed. Signature includes enclosing semantic owner, AST node kind and normalized leaf tokens. Line/column and diagnostic text are reported but excluded from identity. Every key is exact; duplicates, unknown/missing fields, invalid count/reason/owner, unmatched identities and repaired/decreased counts fail. An absent file means no allowances. Warnings are reported individually and summarized by rule, never baselined.

Optional `quality/unused-contracts.json`:

```json
{"schemaVersion":1,"contracts":[{"issue":"unlisted","file":"scripts/example.mjs","symbol":"playwright","count":1,"reason":"Concrete reviewed native runtime dependency contract","owner":"Named responsible owner","evidence":[{"file":"scripts/example.mjs","sha256":"<64 lowercase sha256 of reviewed source>"}]}]}
```

Keys are exact issue + file + symbol (empty string for a file issue). Every unused contract requires one or more exact source SHA256 evidence inputs, validated against the current files. Contracts for src/scripts findings must include the finding file itself; package dependency contracts should bind the actual import/config sources that justify retention. Count is exact; additions, decreases, stale keys and invalid schema fail. Issues are full-scope Knip findings in authored `src/`, `scripts/`, or `package.json`; test-root exports are reported outside this owned candidate scope. Production findings absent from full scope are reported as production-only review signals. No automatic adoption. `--report` includes normalized candidates so the main session can populate a small individually reviewed contract list.

Root Knip configuration must include the quality script closure in its authored script project/entries. Root config and allowance policy remain main-session responsibility.


## Frozen implementation evidence

The final persistent producer is captured in `E07-gate-implementation.json`. All scripts are new; existing root source/configuration/allowances and other workers' edits were not modified. `scripts/quality/README.md` is the portable user-facing command/policy reference, with machine schemas alongside it.

`e07-gate-implementation/self-test-08/summary.json` is PASS: 56 public-CLI cases, with the same producer hashes before and throughout every case. Each case retains input source/config, producer source, SHA256, exact command/stdout/stderr/exit and complete report. Cases cover real typed lint, selected Sonar/Hooks failures and repairs; warning visibility/nonblocking behavior and rejection of warning debt; owner relocation versus mutation/multiplicity; schema/JSON duplicate keys/invalid reason-owner/producer version/staleness/shrink; contextual regex/template AST tokens; boundary/import/export/mixed/type-only/require/dynamic distinctions and value SCC failure/repair; real unused file/export/consumer/test-only interpretation; exact unused evidence/count/schema and stale repair. Output folders are never reused. Temporary projects are cleaned after evidence capture.

The latest actual root run (`gate-final-02.json`, full command output in `gate-command-final-02.json`) exits 1: 10 unallowed errors, 512 individually reported review warnings, 39 full-owned unused candidates, no populated allowance/contracts. Architecture passes: 419 owned files, 1,644 static value edges, six literal dynamic edges, zero cycles/forbidden edges. Production-only unused findings remain separate review signals. This is expected failure authority on the still-active shared source, not a claim that source quality is green or that every remaining candidate is legitimately dead. Main owns the final disposition.

Original failed execution/fixture attempts remain under `architecture-01`, `unused-01`, and self-test runs01–04. Corrected complete runs05–08 remain separately, including the final frozen56-case proof. No source diagnostic was automatically baselined. No paid/native/time/performance claims were made.

## Remaining integration and limits

Main must provide individually reviewed exact allowances and unused evidence, adopt the package command/CI step and recursive authored script project coverage, independently review the final producer and perform the real Node22 clean locked install plus whole-project acceptance. No root full-suite/model/build repeat, browser execution, installation, commits/pushes or status/spec/ledger changes were performed here. Final root acceptance must use frozen inputs; the gate reports concurrent input changes as failures. The implementation is portable and has no task-directory/cache/machine-path dependency.
