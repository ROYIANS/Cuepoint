# Implementation: bounded desktop frontend build worker

## Change boundary

The original hosted macOS ARM64 and Intel logs reached 13,195 transformed
modules and then exhausted an approximately 2 GiB V8 heap during chunk
rendering. The shared frontend entry now launches the same build body in a
separate Node process with an explicit `--max-old-space-size=4096`. This applies
to the existing package, local app, release package and release-native-check
callers without changing their invocations or introducing global `NODE_OPTIONS`.

Only three product/test paths changed:

- `desktop/tauri/scripts/build-frontend.mjs`: shell-free launcher using the actual
  Node executable, inherited cwd/environment/stdio and unchanged script args.
  Child nonzero status, spawn error and signals remain failures. SIGINT/SIGTERM
  received by the launcher are forwarded to its worker before the launcher exits.
- `desktop/tauri/scripts/build-frontend-worker.mjs`: the original Vite build body,
  byte-identical to source 946664ab235e0996da138796bd7d364381dab6ab. SHA256 is
  `2c7c31fc20f3ea4ae4e9ffe547409073ceb9cfad80287492211e9026e5cf496a`.
- `desktop/tauri/scripts/build-frontend.test.mjs`: actual subprocess regressions
  run the real launcher bytes with a minimal temporary worker, without a
  production testing hook or expensive Vite build for each test.

The Node24 percentage heap option overrides a numeric budget. A conflicting
percentage option in `NODE_OPTIONS` is therefore explicitly rejected before
spawning rather than silently clearing or rewriting the environment. Smaller
numeric options remain unchanged in the environment and are overridden by the
explicit worker startup flag. Parent `execArgv` is not forwarded. The 4096 MiB
setting is a V8 old-space budget, not an aggregate RAM or RSS promise.

The worker retains all normal/acceptance roots, aliases, definitions, output
directories, plugins, inline limits and minification behavior. No route splitting,
dependency change, test/Rust budget change, installer rebuild or global memory
configuration is included. Desktop Knip found the literal worker entry without a
configuration edit.

## Local validation

Evidence is finite and retained in `logs/release-frontend-heap-implementation/`.
All commands use the approved local Node24.11.0 and pnpm10.15.0 executables.

| Check | Result |
| --- | --- |
| Actual launcher regressions | 8 passed; argv/cwd/env, explicit heap, output, exit37, actual spawn ENOENT, percentage conflict and both signal directions |
| Desktop types | Passed |
| Desktop lint | Passed |
| Desktop Knip | Passed, with existing configuration |
| Worker extraction | Byte-identical to the original builder |
| Single actual normal frontend build | Exit0; 31.01s wall; maximum RSS2,585,460,736 bytes, approximately2.41GiB |
| Single actual acceptance fixture build | Exit0; 3.53s wall; maximum RSS845,594,624 bytes, approximately0.79GiB |
| Actual normal build inputs | 526 hashes unchanged; 696 generated files /26,385,831 bytes |
| Actual acceptance build inputs | 543 hashes unchanged; 192 generated files /6,194,156 bytes |

The normal build transforms the same 13,195 modules. `/usr/bin/time -l` surrounds
the actual launcher; its maximum resident-set value is retained alongside all
build stdout/stderr, elapsed time, before/after input hashes and generated-file
hashes. The input scope covers root source/public/locks/direct build dependencies,
plus acceptance UI for that lane. Concurrent Rust changes are outside this
frontend input scope, so this is not a final whole-repository frozen checkpoint.
Acceptance compilation uses a synthetic loopback endpoint and fixture token;
it does not send provider/network requests. Existing large-chunk warnings remain
visible and unchanged.

Two first-attempt development failures are retained: the temporary cwd initially
used macOS `/var` instead of its canonical `/private/var` alias, and the test's
cleanup directly threw inside `finally`, which ESLint rejected. Canonicalizing
only the temporary fixture path and extracting its owned-worker cleanup repaired
those test issues; production build behavior did not change for either repair.

## Limits

Actual local ARM64 build success supports this bounded correction but is not a
new hosted ARM64/Intel result, cold hosted dependency proof or installer/runtime
acceptance. Four-host H1a and draft delivery H1b remain pending. No Git staging,
commit, push, tag, remote dispatch, Release mutation, spec edit or task archival
was performed by this implementer.
