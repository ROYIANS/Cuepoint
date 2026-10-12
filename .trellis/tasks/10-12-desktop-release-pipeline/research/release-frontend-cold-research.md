# Research: corresponding-host cold desktop frontend failures

- Query: Inspect fresh macOS desktop frontend dependency/path/build assumptions after `release-native-checks.mjs` fails at `normal-frontend.log` on both actual macOS jobs.
- Scope: mixed; actual hosted diagnostics, internal caller analysis, pinned official Node/GitHub documentation
- Date: 2026-10-12

## Findings

### Evidence and current certainty

The owner supplied wrapper exceptions naming `normal-frontend.log` for macOS ARM64/x64 and `native-3.log` for Windows x64. Root acquired the original artifacts for actual run38208372156/source946664ab. Both macOS logfiles establish V8 heap exhaustion during chunk rendering; dependency loading succeeded. Windows is a separate failure investigated by another owner. The following initial entry/lock checks preceded the diagnostics and remain observations rather than proposed root causes.

### Files found

- `desktop/tauri/scripts/build-frontend.mjs`: builds shared React product from root, or the historical isolated acceptance frontend.
- `desktop/tauri/scripts/release-native-checks.mjs`: runs frontend followed by six mandatory native commands and complete shared storage checks, redirecting child output to exclusive fresh evidence files.
- `desktop/tauri/scripts/build-release.mjs`: repeats the same normal frontend before real product packaging.
- `.github/workflows/desktop-release.yml`: four corresponding-host matrix jobs with frozen root/desktop JavaScript installs, pinned Node24.11.0 and retained failure artifacts.
- `pnpm-lock.yaml`: frozen root Vite7.3.6, @vitejs/plugin-react5.2.0, @tailwindcss/vite4.3.3 and platform-specific optional package records.
- `desktop/tauri/pnpm-lock.yaml`: independent TauriCLI2.12.1 dependencies.
- `vite.config.ts`: ordinary browser frontend includes TanStack routing/code-splitting plugin; desktop direct build uses React and Tailwind only.
- `src/routeTree.gen.ts`: checked-in generated route graph used by product source.

### Code patterns and exact observations

- `release-native-checks.mjs:15-23` uses `spawn(process.execPath, args)` with `shell:false`, sends stdout/stderr to a fresh logfile, then emits only the logfile name on nonzero exit. `:33` identifies `normal-frontend.log` as `build-frontend.mjs`; `:34` maps `native-3.log` to the fourth command, `cargo test --locked --all-targets --features test-hooks`.
- `build-frontend.mjs:1-3` uses direct root-node_modules files rather than bare package names. Current local package exports confirm the files are the exported entrypoints: `vite/dist/node/index.js`, `@vitejs/plugin-react/dist/index.js`, `@tailwindcss/vite/dist/index.mjs`. All three physically exist. This does not establish what was installed on the hosted Mac.
- The root lock includes darwin-arm64 and darwin-x64 variants for @tailwindcss/oxide4.3.3, Rollup4.63.3 and esbuild0.28.2. No missing architecture is evident from lock structure alone. Corresponding optional packages can still fail installation/loading at runtime; only original diagnostics can distinguish this.
- `build-frontend.mjs:16-20` sets the project root explicitly, disables external Vite config, adds `@` alias and retains the complete shared product frontend with output in `desktop/tauri/dist/normal`. It does not run TanStack route generation, whereas `vite.config.ts:8-12` adds that plugin. The existing checked-in `src/routeTree.gen.ts` exists, so missing route generation is not currently supported as the actual root cause.
- `.github/workflows/desktop-release.yml:120-130` installs both frozen package roots using the reviewed tool wrapper before the frontend/native checks. Windows reaching `native-3.log` shows its frontend child exited successfully. It does not establish success for either Mac or Linux.
- No dependency install, product build, global setting, Git mutation or source/spec edit has been performed in this research.
- A read-only warm local Node24.11.0/darwin-arm64 import of the exact three script entrypoints succeeded (all exported functions loaded and React/Tailwind plugin constructors returned expected plugin lists). Finite command, input hashes and stdout are retained in `research/logs/release-frontend-cold-research/entry-load.json` and `entry-load.log`. This is not cold dependency or actual hosted build proof.

### Input hashes (initial read-only checkpoint)

| Input | Bytes | SHA256 |
| --- | ---: | --- |
| build-frontend.mjs | 1522 | 2c7c31fc20f3ea4ae4e9ffe547409073ceb9cfad80287492211e9026e5cf496a |
| root pnpm-lock.yaml | 332035 | 1f9a38564ee01d35a32fc4fa15dc49ca816405c15a0a55e7d8376028408843f3 |
| src/routeTree.gen.ts | 41198 | 0df423ad2603ed30010d0c28c127b7b7d5a59c3bb0a1c24ddc39f55933cd4efd |
| vite.config.ts | 501 | c6def92021debbfe5eb29f89bc106d0df2fdc21061716624251cbe8ba4b1a5f4 |

### Related specs

- `.trellis/spec/frontend/desktop-distribution.md:33-53`: closed corresponding-host tools and cold prerequisite checks.
- `desktop-distribution.md:66-70,127-143`: fresh clean source/evidence and retained failed gates; local proof does not establish corresponding-host success.
- `.trellis/spec/frontend/native-product-runtime.md:5-25`: shared product/UI/business/Agent reuse and honestly labeled actual outcomes.
- `.trellis/spec/frontend/quality-guidelines.md`: retain existing complete gate scope; do not suppress failures or substitute warm output.
- `.trellis/spec/frontend/type-safety.md`: strict typed product boundaries remain unchanged by packaging research.

### Actual hosted root cause

Both original logfiles begin with Vite7.3.6 and `13195 modules transformed`, then `rendering chunks...`; their GC/fatal output shows approximately2GiB old-heap exhaustion. ARM64 reports `Reached heap limit` with2026.2MiB retained at47801ms. Intel reports `Ineffective mark-compacts near heap limit` after GC around2025.1MiB at98571ms. This is evidence of the JavaScript build process exhausting its effective heap, rather than missing dependencies or a compiler/test failure. It does not imply why the desktop graph is large or that all macOS build resource problems are solved.

| Original retained log | Bytes | SHA256 |
| --- | ---: | --- |
| `research/logs/release-hosted-original/desktop-diagnostics-macos-arm64-38208372156-1/_temp/native-checks/normal-frontend.log` |5585|5d9d49328afc209d10f512e170bf662d2840eb5210597ed3a8ab92ed52c8a92d|
| `research/logs/release-hosted-original/desktop-diagnostics-macos-x64-38208372156-1/_temp/native-checks/normal-frontend.log` |3921|ca76cd2a564bc9aac85e1b7c97524844ed2e4cf90cbba7aa40bd68a808545b9c|

### Complete frontend invocation closure

| Caller | Invocation | Heap argument behavior |
| --- | --- | --- |
| `desktop/tauri/package.json:22` |`node scripts/build-frontend.mjs`|Direct entry, Node startup defaults|
| `desktop/tauri/scripts/build-app.mjs:24-28` |`spawn(process.execPath, [build-frontend.mjs, --acceptance?])`|Explicit args exclude parent `process.execArgv`|
| `desktop/tauri/scripts/build-release.mjs:27-35,62` |`spawn(process.execPath, [build-frontend.mjs])`|Explicit args exclude parent `process.execArgv`|
| `desktop/tauri/scripts/release-native-checks.mjs:15-23,33` |`spawn(process.execPath, [build-frontend.mjs])`|Explicit args exclude parent `process.execArgv`|

Consequently adding a heap flag only to `node release-native-checks.mjs` does not change its frontend child. A broad job-level `NODE_OPTIONS` reaches unrelated pnpm/Node/Vitest descendants. All callers already share the frontend entrypoint, so that entrypoint is the narrow budget owner.

A tiny actual Node24.11.0/darwin-arm64 subprocess probe confirms the parent startup flag is absent from an explicit `spawn` child, while an explicitly supplied child flag appears. Parent3072MiB old-space probe reports heap limit3422552064bytes; default local child reports4496293888bytes and no execArgs, explicit frontend4096MiB child reports4496293888bytes and exactly its flag. This confirms parameter propagation mechanics; the warm local machine already has a higher default heap than the two actual hosted Macs. See finite `spawn-budget-probe.{json,log}`. V8 old-space size is not total heap or peak RSS.

### Recommended minimal correction for implementation owner

Put a single bounded budget at the existing frontend entrypoint, with a small launcher that starts the unchanged frontend build body in a worker Node process using explicit `--max-old-space-size=4096`. A separate worker module avoids recursive re-execution and ensures heavy Vite/plugin imports occur only in the budgeted child. All four callers retain current command/argument/environment/logfile contracts; complete product source, minification/chunk behavior, roots, aliases and normal/acceptance separation remain unchanged.

The launcher must use `process.execPath`, an argument array, `shell:false`, inherited stdio and the actual environment, preserving acceptance arguments and endpoint/token inputs without logging their values. It must propagate nonzero status/spawn errors/signals into the parent failure so required release checks continue to fail closed. The heap setting belongs to the short-lived frontend worker only. Do not put it into hosted-tools environment, whole job `NODE_OPTIONS`, Vitest, Rust, normal application runtime or permanent system state.

FourGiB old-space is a proposed finite build budget, not an allocation or total-memory promise. The smallest Mac ARM64 runner has7GB total RAM, so6/8GB old-space would leave inadequate native/system headroom. Before finalizing, run the real full frontend at the budget, retain maximum RSS/effective heap/input identities/output proof, and inspect the narrower original2GiB case for red/green causality if safe. Verify an existing smaller `NODE_OPTIONS` heap flag is overridden by the explicit startup option, and detect/reject or deliberately handle a percentage option because pinned Node documents its precedence over the numeric flag. Do not erase unrelated user options silently.

An alternative shared argument helper used by all three wrapper callers plus the package script can also work, but creates a fourth separate startup contract and leaves direct script invocation unbudgeted. A broad job memory increase or a self-relaunch guard that imports the entire build before checking the budget has weaker scope/initialization clarity.

### Meaningful focused verification recommendations

1. Real worker startup receives the explicit finite heap option, existing normal/acceptance args and exact environment; parent has no global memory mutation.
2. Fake/injected worker can exit nonzero and throw a spawn error; launcher must retain corresponding failure, not normalize into a pass. Explicit signal behavior is covered.
3. Existing frontend configuration/body remains unchanged across extraction; normal still ships root product and acceptance still requires exact authorized loopback inputs.
4. Actual full Node24 frontend at the chosen budget completes with retained RSS and generated asset proof; local ARM64 evidence is not hosted Intel success.
5. Native/check/package caller scope stays identical and corresponding-host workflow requires another owner-activated run.

### External primary references (checked2026-10-12)

- [Node24.11.0 CLI old-space and NODE_OPTIONS](https://nodejs.org/download/release/v24.11.0/docs/api/cli.html#--max-old-space-sizesize-in-mib): numeric old-space budget, GC cost near limit, command-line singleton precedence over environment, and percentage-flag precedence. Leave nonheap memory headroom.
- [Node24.11.0 child process](https://nodejs.org/download/release/v24.11.0/docs/api/child_process.html#child_processspawncommand-args-options): `spawn` explicit command/args; unlike `fork`, it does not automatically forward parent execArgs.
- [Node24.11.0 process.execArgv](https://nodejs.org/download/release/v24.11.0/docs/api/process.html#processexecargv): startup Node options are separate from script arguments, useful for deliberate forwarding.
- [GitHub hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners): current standard macOS14ARM64 runner7GB RAM, macOS15Intel14GB RAM. These are documented host capacities, not measurements from this run.

Current package metadata is the directly installed/frozen primary source for the earlier entrypoint observation.

## Caveats / Not Found

- Original macOS logs now establish build heap exhaustion. The proposed finite correction has not been implemented or measured by this researcher; actual subsequent macOS hosted success is pending.
- Local full Node24 build/profiling is intentionally deferred until root coordinates a dedicated implementation/measurement owner. The tiny module/spawn probes do not replace full frontend or corresponding-host evidence.
- Complete `research.jsonl` does not exist in this task; role isolation prohibits loading `implement.jsonl`/`check.jsonl`. Read supplied task PRD/design/implementation and affected specs directly instead.
