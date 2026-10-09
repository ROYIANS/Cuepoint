# Portable source quality gate

Run `node scripts/quality-check.mjs` from the project root (the package command is `quality`). This runs actual root-configured ESLint, TypeScript-resolved architecture, and both production/full Knip analyses. Warnings are individually available in JSON and summarized by rule as review signals. Unallowed ESLint errors, forbidden values-only layer edges, static value cycles, and full-scope owned unused candidates fail.

- `--report path.json`: complete report, source/config/vendor input hashes, installed tool versions, all diagnostics, graph edges, raw Knip command/output/exit, contracts and failures.
- `--describe path.json`: diagnostic identities for individual review. This does not create or accept allowances.
- `--root path`: explicit project/fixture root; no machine cache or task directory dependency.
- `--only lint|architecture|unused`: bounded diagnostic/self-test mode. CI's `quality` command must use the default complete mode.
- Exit 0 means pass, 1 means blocking findings/changed inputs, 2 means invalid config/schema or producer/tool failure.

Inline ESLint configuration is disabled; reviewed policy lives in root `eslint.config.mjs`. Missing allowance files mean empty allowances. The gate never writes allowance files.

`quality/debt.json` uses exactly:

```json
{
  "schemaVersion": 1,
  "identityVersion": "ts-ast-tokens-v1",
  "identityProducer": { "sha256": "<identity.mjs SHA256>", "typescript": "<installed version>" },
  "allowances": [{
    "rule": "actual/rule", "file": "src/actual.ts", "signature": "<diagnostic signature>",
    "count": 1, "reason": "Concrete reviewed contract and evidence", "owner": "Responsible team"
  }]
}
```

The lint report supplies `identityProducer`. `describeDiagnostic(file, sourceText, eslintMessage)` and `identityProducer()` are exported by `identity.mjs` and used by production lint. The semantic key combines exact rule/file with named structural ownership, AST kind, normalized parser tokens and multiplicity. Location/message changes do not authorize new nodes. Producer hash and TypeScript version changes require review. Error repairs/decreases leave stale allowances until explicitly shrunk. Warnings cannot be baselined.

`quality/unused-contracts.json` uses exactly:

```json
{
  "schemaVersion": 1,
  "contracts": [{
    "issue": "unlisted", "file": "scripts/actual.mjs", "symbol": "playwright", "count": 1,
    "reason": "Concrete reviewed external native runtime contract", "owner": "Responsible team",
    "evidence": [{ "file": "scripts/actual.mjs", "sha256": "<reviewed source SHA256>" }]
  }]
}
```

File issues use an empty `symbol`. Src/scripts contracts must bind the finding source file. Dependency contracts bind the actual CSS/config import sources that justify retention. No glob keys or bulk baseline creation exists. Exact counts, duplicate JSON properties/contract keys, schema, evidence hashes and stale entries are enforced. Test-root entry exports are reported outside the owned candidate scope; full scope includes source/scripts/package. Production-only findings are reported for test-only/entry interpretation and cannot suppress a full-scope finding.

The architecture uses `tsconfig.app.json` and the installed TypeScript resolver. Owned non-declaration src TS/TSX files, including generated routes, form the graph; imported vendor/JSON/declarations remain compiler inputs. All-type named imports/exports are type-only; mixed clauses are value edges. Domain→DB/UI and DB→UI value edges fail, including literal dynamic imports. Static SCCs exclude dynamic edges. Computed imports/requires and shadowed requires are visible limits, not runtime reachability claims.

Run `node scripts/quality/self-test.mjs` (package command `quality:self-test`) to exercise the production CLI using a temporary TS project, copied current root ESLint/Knip configs and the installed dependency closure. `--output <new-directory>` preserves per-case input/producer source/hash, command/stdout/stderr/exit and complete reports. Existing output directories are rejected. Temporary project files are removed after evidence capture. The summary and any failed attempt are retained. These fixtures do not replace whole-product tests, build/model checks, native regressions or Node22 clean-install verification.
