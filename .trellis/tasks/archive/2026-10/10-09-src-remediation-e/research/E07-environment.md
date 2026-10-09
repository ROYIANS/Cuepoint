# E07/QG01 local environment preparation

Captured 2026-10-09, Asia/Shanghai. This is a bounded **research sidecar**, not E07 implementation or cleanup. Only this file and `E07-environment.json` were created. No installation, download, broad lint/Knip/architecture scan, deletion, source/package/lock/CI/spec/status/ledger mutation, or task dispatch occurred. JSON contains actual command results, resolution paths, configuration evidence, input SHA-256 snapshots, candidates and outstanding proof.

## Concrete availability

| Component | Current evidence | Availability/limit |
| --- | --- | --- |
| Machine Node22 | `/Users/xiaomengdao/.nvm/versions/node/v22.21.1/bin/node --version` → `v22.21.1` | Actual executable; darwin-arm64. |
| Machine Node24 | `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node --version` → `v24.11.0` | Actual executable. |
| Allowed pnpm launcher | `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --version` → `10.15.0`, also with Node22 prepended to PATH | Repository `packageManager` is `pnpm@10.15.0`. Launcher resolves to global pnpm package **10.20.0**; managed `10.15.0` package exists in `~/Library/pnpm/.tools/pnpm/10.15.0/node_modules/pnpm/`. Installed pnpm code has package-manager-version delegation. Old instructions describing this path as 9.12.0 are not current version evidence. Only the explicitly allowed launcher was executed for pnpm probes. |
| ESLint / @eslint/js | **9.39.5 / 9.39.5**, restored cache | ESLint CLI starts on Node22; config resolves on Node22. Not resolvable from repository root. |
| typescript-eslint | **8.71.1**, restored cache | Bundle resolves its parser and plugin at **8.71.1**; they are not direct cache-root packages. Original audit snapshot was **8.71.0**. |
| React Hooks / SonarJS plugins | **7.1.1 / 3.0.7**, restored cache | Load through current flat config; SonarJS is local ESLint rules, not a SonarQube server. |
| TypeScript | Repository **5.9.3**; cache **5.9.2** | Repository `tsc --version` succeeds on Node22. Audit comparison must distinguish these runtimes. |
| Vite / Vitest | Repository **7.3.6 / 5.0.1** | Both actual CLI version commands succeed under Node22. Vite requires `^20.19.0 || >=22.12.0`; Vitest requires `^22.12.0 || ^24.0.0 || >=26.0.0`. Node22.21.1 satisfies them. These are startup checks, not test/build execution. |
| @types/node | Repository **22.20.3** | Read from package metadata; runtime `require.resolve('@types/node')` is not a valid availability test because this package has no executable entry. |
| Knip | Historical exact **5.88.1** | `MODULE_NOT_FOUND` at repository and restored-cache roots. Original runtime directory no longer exists. Archived lock declares Node `>=18.18.0`; actual current execution is unproven. |
| dependency-cruiser | Historical exact **17.4.3** | Same current resolution gap. Archived lock declares Node `^20.12||^22||>=24`; this is metadata compatibility only. |
| jscpd | Historical exact **4.3.0** | Same resolution gap; clone metrics are review signals and it is not needed for minimal required enforcement. |

Checked machine NVM directories contain v22.21.1 and v24.11.0. Managed pnpm directories include 9.12.0, 9.15.0, 10.12.4, 10.13.1, 10.15.0, 10.15.1, 10.33.0 and 11.x; their presence is not authorization to switch managers. No Codex-runtime pnpm was invoked. `~/Library/pnpm/store/v10` exists; existence does not prove a complete clean/offline installation.

## Repository and restored configuration

`package.json` has no ESLint/Knip/dependency-cruiser dependency or quality script. `lint` is `tsc -b --pretty false`. Root `pnpm-lock.yaml` is format **9.0**; all current dependency/devDependency importer specifiers match package.json. Installed `node_modules/.modules.yaml` records **pnpm@10.15.0**, isolated linker and store `~/Library/pnpm/store/v10`. Matching metadata is not a clean-install proof.

`.github/workflows/ghcr.yml` quality job uses pnpm/action-setup@v4, actions/setup-node@v4 with **node-version: 22**, `pnpm install --frozen-lockfile`, then lint/test/model verification/build. The separate `docker` job needs quality and excludes pull requests. Push/main and workflow_dispatch can run publication; do not trigger either for this evidence. Docker build uses `node:22-bookworm-slim`. No workflow or publication/permission change was made or executed.

Restored cache: `~/.cache/cuepoint-source-quality-tools`. It contains only the typed ESLint stack, its manifest/lock/config and baseline source copies. Manifest uses ranges for tool packages, exact TS5.9.2; lock resolves the versions above. Its flat config has absolute `tsconfigRootDir` pointing at this repository and is not portable. It applies to `src/**/*.{ts,tsx}`, excludes `src/routeTree.gen.ts` and node_modules, merges JS recommended plus typescript-eslint recommendedTypeChecked rules, adds switch exhaustiveness, Hooks rules and three SonarJS warning rules. It disables no-undef and both unused-vars rules, and uses warning metrics/ternaries. Those temporary choices require explicit final review, not automatic copying into the permanent gate.

Node22 configuration calculation for `src/main.tsx` succeeded with **124 rules**, project `./tsconfig.app.json`, parser8.71.1. Verified enabled typed rules include no-floating-promises, no-misused-promises, no-unsafe-assignment and switch-exhaustiveness-check. SonarJS settings are cognitive-complexity warning20, no-identical-functions warning3 and no-duplicated-branches warning. Generated-route and sample vendor paths are ignored by this config calculation; vendor is outside its source glob. Final exclusions must be explicit and tested. Configuration calculation does **not** execute a typed lint program.

The archived audit lock records ESLint9.39.5 as deprecated/no longer supported. This is a concrete local warning relevant to final version selection; no online maintenance-status check was requested. Installed availability/peer compatibility does not settle support policy. SonarJS3.0.7 declares ESLint `^8 || ^9`; do not assume a newer major is compatible. typescript-eslint8.71.1 permits TS `>=4.8.4 <6.1.0`, including repository5.9.3.

## Existing unused/architecture evidence and gaps

Read archived controls under `.trellis/tasks/09-30-src-quality-architecture-audit/research/tools/`; did not rerun them. `runtime-path.txt` points to `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/cuepoint-source-audit-n21f357d`, which is absent.

- `knip.json`: explicit main/routes/Vite/Vitest/test entries, src/tests/config projects, @ alias, generated-route ignore, vendor workspace ignore. `knip-production.json`: main/routes and src projects marked **`!`**, invoked with `--production`. Historical first production run without the `!` patterns is explicitly invalid; do not use it as a baseline.
- Full/test interpretation needs refreshed actual roots: `tests/setup.ts`, native browser runner scripts, fixture HTML/harness TS/TSX, package scripts, config/plugin/generated entry uses. Vitest currently includes `tests/**/*.test.ts` and setupFiles `./tests/setup.ts`. Historical config alone does not prove these other live roots are covered. Runtime-computed imports, ambient declarations, CSS `tw-animate-css`, Tailwind plugins and model generator/vendor usage need explicit evidence. Production-only findings may be valid test-only contracts; no automatic deletion.
- `dependency-cruiser-values.json` has `tsPreCompilationDeps:false`, @ resolution through tsconfig.app and a no-circular-values error rule. The earlier `true` configuration with type filtering only on the first edge could still produce mixed-type cycles. Historical JSON reporter returned **exit0 with summary.error=6**; a quality wrapper must fail on actual diagnostics, not blindly trust that exit status.
- Existing E `tools/current-source-ast.cjs` can use already installed TS5.9.3 and distinguishes import type, all-type named imports/reexports and literal dynamic imports. It is a **report producer**, tied to task/ledger/artifact paths, not a portable fail gate. Hard-coded alias/TS/index/JSON resolution is incomplete, unresolved imports do not fail, computed imports are not resolved, Tarjan emits only SCC size>1 (misses self-loops), and no owner-boundary rule or failure exit is implemented. It cannot simply be renamed into the gate.

Main-session `research/E-entry-ast-summary.json` reports 419 TS files, 2492 edges, zero parse errors and no static value cycles for the immutable entry snapshot. This does not establish final post-E boundary coverage or synthetic-failure behavior.

## The measured lint entry is not accepted debt

Main already measured complete immutable **1ecaf5ceec92e022c2b2b8d662e2a92e8eee36c7** source with restored identical versions: `research/E-entry-static-summary.json` and `research/E-entry-static-results.json`, **418 nongenerated TS files, 240 errors and 530 warnings**. This sidecar reads and hashes that evidence; no duplicate scan occurred. The summary explicitly says entry-only measurement, no post-E gate or debt acceptance.

**D delta-only “0 new” cannot establish clean lint.** Final E07 must refresh the complete final typed program with the chosen final versions/config and individually review diagnostics and rule policy. Resolve each confirmed problem or record an individually justified narrow rule+file+stable semantic signature+count+reason+owner entry. Do not baseline all 240/530 findings, disable rules broadly, add broad ignores or infer acceptance from metric thresholds. Existing delta producer compares normalized message multisets and fails added noncomplexity findings; it is useful interim evidence, not proof of semantic signature identity, stale-debt rejection or whole-source cleanliness.

## Minimal later integration candidates

1. Pin the currently proven ESLint9.39.5, @eslint/js9.39.5, typescript-eslint8.71.1, SonarJS3.0.7 and Hooks7.1.1 only if final maintenance review chooses that stack. Use repository-owned relative flat configuration and one documented quality command. Reuse root TS5.9.3 or deliberately preserve auditTS5.9.2; state the choice and recompute comparisons with identical final versions/config, rather than mixing them. No additional SonarQube/container or clone tool is required.
2. Choose a proven value graph: either pinned dependency-cruiser17.4.3 (currently missing), or a small portable TS-based implementation using existing TS5.9.3 after addressing the producer limitations above. Enforce reviewed legitimate owner boundaries; direct scoped DB UI reads are not inherently forbidden. Exclude type-only edges before cycle/boundary analysis and define static versus dynamic-edge semantics explicitly.
3. Pin Knip5.88.1 if restoring the audited unused-analysis route; it is a known historical version/config candidate, not currently runnable. Maintain production and full-entry views and scoped retain/retire evidence. A single wrapper may aggregate these checks, but installation/pinning/CI wiring occurs only in E07.

## Actual Node22/locked-install proof later, without publication

Use a separate disposable checkout/copy of the **final frozen inputs**, with no existing node_modules. Record exact source/config/package/lock hashes. From that checkout, prefix commands with the installed Node22 bin so the allowed pnpm launcher and all child `node` processes select Node22. Example command shape (documented only; install/gate was not run here):

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v22.21.1/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --version
PATH=/Users/xiaomengdao/.nvm/versions/node/v22.21.1/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm install --frozen-lockfile
```

Also record Node version and `process.execPath` in that environment, effective pnpm10.15.0 and installed module versions. An optional offline frozen attempt only proves store completeness if it succeeds; missing cache is not a product defect and must not lead to relaxing frozen lock. Keep install exit/stdout/stderr and package/lock pre/post hashes; native/lifecycle dependency completion must be actual evidence, not metadata. Run the final quality command/self-tests, typecheck, tests, model verification and build in the same Node22 environment. Record tool/TS parity and generated-route/build mutations.

Run these local commands directly; do not trigger workflow_dispatch/push, a Docker publication job or GHCR. Local Node22 success is distinct from a GitHub ubuntu-latest job result; YAML inspection is CI wiring evidence only. Major-only setup-node22 and mutable Docker node22 tags do not specify an exact future patch. This sidecar verified Node22 startup/config availability only, and did not prove a clean install, final gate, tests or build under Node22.

## Required failure/repair and debt-shrink evidence

Use isolated synthetic fixtures and the same actual gate command; preserve inputs, raw diagnostics and exit codes:

- Passing fixture → new typed lint violation fails → repair passes. SonarJS violation must fail according to reviewed warning/error policy; ESLint warnings ordinarily return exit0. Parser/config errors and unknown tool failures must also fail.
- New value cycle and forbidden owner boundary fail; pure type/all-type named-reexport cycle passes. Exercise mixed value/type edges, aliases, side effects, literal dynamic imports and self-loops. A graph JSON error cannot be ignored because the producer returned0.
- Synthetic truly unused export/dependency fails and repair passes. Demonstrate a legitimate production-unused/full-entry-used contract is retained and interpreted correctly, with actual tests/setup/native/config/generator roots.
- Unknown/new signature, increased count and semantic replacement with an identical message in the same file fail. Line movement preserves an existing identity, not permission for a new violation. Stale, deleted or reduced entries must fail until the reviewed baseline is explicitly shrunk; preserve that count/removal diff, then show the repaired gate passes.
- Every retained entry includes rule, file, stable semantic signature, count, reason and owner. Final diagnostic review remains required. Clone/complexity metrics are review signals unless a reliable behavioral enforcement policy is demonstrated. Generated/vendor exclusions must be explicit and testable.

Current genuine gaps: no runnable Knip/dependency-cruiser at the checked roots; no clean final locked-install proof; no final Node22 gate/test/build proof; no individually approved final rule/debt inventory; no synthetic failure/shrink proof or Linux/GitHub execution. Node22 itself is **available**, not a blocker. Global absence beyond the explicitly inspected locations and cache/store completeness were not presumed.
