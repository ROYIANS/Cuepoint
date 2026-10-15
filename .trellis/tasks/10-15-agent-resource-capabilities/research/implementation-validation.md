# E06 explicit source-validation profiles

Implemented on 2026-10-15. This report covers the neutral source-validation plumbing, not the capability or Todo delivery acceptance.

## Delivered boundary

- `vitest.agent-source.config.ts` is independent of the default Vitest and Vite configurations. It asserts Node >=24.11 and loads the actual `node:sqlite` builtin before test discovery. It selects Node, forks, one worker, no setup files and automatic mock clearing. Its finite include list is core `resourceCapabilities.test.ts`, `runtime.test.ts`, `tools.test.ts`, `compaction.test.ts`, and root `tests/agentTodoSource.test.ts`.
- `tooling/agent-source-exports.ts` creates fresh alias arrays for explicitly selected source profiles only. The three anchored regular expressions map exactly `@cuepoint/agent-core`, `@cuepoint/agent-providers` and `@cuepoint/agent-providers/http` to their existing public source entries. Private paths, package-name prefixes and arbitrary subpaths receive no source mapping.
- `tests/typecheck/tsconfig.agent-source.json` extends the existing Todo strict NodeNext configuration, retains `skipLibCheck: false`, and sets `noEmit: true`, `incremental: false`, repository `rootDir`/`baseUrl` and the same three exact public paths. It includes core/provider production source, all Todo source including its existing `node:test` conformance, the root Todo fixture and the public-contract compiler witness. Core/provider Vitest tests stay excluded from this production/type-witness project.
- `tsconfig.node.json` includes precisely the new source Vitest configuration and helper, alongside its existing entries.

No default configuration, package export map, production consumer resolution, freshness assertion, receipt, package script, dependency or lockfile was changed in this scope. No Studio source test/dev profile was added. The root fixture and compiler witness are owned by the Todo/core implementers respectively; their paths are admitted without relocating them into the example production emit tree.

## Actual checks

All execution used `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node` directly. No root wrapper or package lifecycle script was invoked.

1. `node node_modules/vitest/vitest.mjs run --config vitest.agent-source.config.ts packages/agent-core/src/runtime.test.ts packages/agent-core/src/tools.test.ts`: **2 suites / 13 tests passed**, 250ms, at 20:19 local time. These are the existing runtime/tool suites available when the entry was handed to both implementation owners; this is not a final result for their subsequently edited sources.
2. `node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.agent-source.json --noEmit --pretty false`: **exit 0** at the same handoff checkpoint. This verifies actual source resolution for the then-current production sources and existing Todo conformance. The future fixture/witness were not yet present and are not claimed as checked by that invocation.
3. `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit --pretty false`: **exit 0**, including the new configuration/helper. This is configuration type checking, not formal typed ESLint proof; root configuration/test files are outside the current typed source lint patterns.
4. `node node_modules/vitest/vitest.mjs list --config vitest.agent-source.config.ts --filesOnly`: listed only the then-existing core runtime/tool suites. No Studio suite, global setup, example `node:test` conformance or process-kill suite was discovered.
5. Direct Node assertions imported the actual helper/configuration and checked all three exact absolute paths, fresh alias arrays, seven private/prefix/subpath negatives, Node/forks/setup/include shape and single-worker selection: **passed**.
6. Separate Node24 subprocesses replaced only their reported `process.versions.node` to exercise the actual configuration guard: 22.22.0 and 24.10.9 rejected with the required-version error; 24.11.0 and 25.0.0 admitted. This tests the guard boundary, not runtime compatibility on those other Node versions. An actual Node module-resolution hook made `node:sqlite` unavailable; loading the profile rejected before discovery rather than skipping its suites: **passed**.
7. Installed TypeScript parsed the actual extended source project. Assertions verified strict/NodeNext/noEmit/nonincremental/root/base/Node ambient settings, `skipLibCheck: false`, exact three paths, retained example conformance and excluded core/provider tests: **passed**. The helper mappings and type paths also matched all three entries returned by the existing authoritative `workspacePolicy` / `publicSourcePaths`: **passed**.

Node24 prints its standard experimental SQLite warning when the builtin is loaded. It does not skip or weaken the source lane.

## Entry points for the remaining implementation

From repository root, use the exact machine executable:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/vitest/vitest.mjs run --config vitest.agent-source.config.ts packages/agent-core/src/resourceCapabilities.test.ts packages/agent-core/src/runtime.test.ts packages/agent-core/src/tools.test.ts packages/agent-core/src/compaction.test.ts tests/agentTodoSource.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p packages/agent-core/tsconfig.json --noEmit --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.agent-source.json --noEmit --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit --pretty false
```

The combined project's Node ambient cannot replace the core project's separate `types: []` noEmit check. Scoped source lint may explicitly select the new source type project to resolve changed public APIs. Main owns precise Knip/root-config inventory registration and the final bounded architecture check; this validation scope did not broaden their entry roots or run global gates.

## Static discovery adopted by main

Main registered `vitest.agent-source.config.ts` in the exact quality root-configuration inventory. Existing recursive `tooling`/`tests` inventory already captures the helper and source type project; existing root test discovery captures the Todo fixture. Knip's root TypeScript configuration list now explicitly contains both its existing `tsconfig.json` and `tests/typecheck/tsconfig.agent-source.json`; the actual compiler witness is a precise root entry.

For the manually selected source test configuration, main uses `vitest.entry: ["vitest.agent-source.config.ts"]`, rather than adding it to user entries or dynamically loaded Vitest configs. This choice was checked against the installed Knip 6.40 implementation: `WorkspaceWorker.js` converts plugin `entry` into a static entry input without loading that file as configuration; `graph/build.js` treats plugin entries as external-consumer entries with export analysis skipped. This avoids reporting a runner-consumed default export as unused while still following its actual imports into the helper. The helper remains an ordinary analyzed module and is not made an entry. Default `vitest.config.ts` remains the dynamically discovered configuration with its original test includes and setup.

Consequently normal Node22 quality does not execute the new Node24 source-profile guard. This is a source-backed discovery conclusion, not a claimed full Knip or Node22 quality run. Global entry-export checks, original test entries, public package/import boundaries and freshness behavior remain intact. No full Knip/freshness gate was run in this scope.

## Acceptance limits

The source lane allows the current implementation owners to exercise new public contracts, the actual shared loop and Todo SQLite without building emitted packages. It does not prove emitted declarations/export closure, outside-workspace dependency identity, packing/offline installation, full example conformance, actual CLI/SIGKILL/restart ownership release, browser/desktop/native behavior, running Vite source consumption or live providers.

Default freshness assertions and emitted/packed/process gates remain required for the final batch acceptance. No build, pack, install, full suite, native runner, development server, paid request or Git operation was executed by this scope. Implementation owners/main must record their later frozen-source suite/type/quality results separately; baseline results here do not certify later edits.

Main subsequently added the exact existing `compaction.test.ts` source-suite entry because it owns the two-group/36-tool/pending-name-pinning invariants affected by extensible registration. The core owner executed this final four-suite scope (36 tests); the earlier two-suite baseline above remains only handoff evidence. Final configuration identity is captured by the whole-scope review ledger.
