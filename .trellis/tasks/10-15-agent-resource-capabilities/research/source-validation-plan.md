# Research: E06 source validation without emitted builds

- Query: 在本批结束前不 build / pack / install / full / native，如何验证新公共 core API、共享执行循环和实际独立 Todo SQLite 宿主，并为后续 Studio 测试保留可用入口？
- Scope: internal; configuration/test design only, no implementation or execution.
- Date: 2026-10-15

## Findings

### Existing owners and blocking behavior

| Source | Concrete responsibility / evidence |
| --- | --- |
| `vitest.config.ts:7-9,15-47` | 顶层无条件检查 reusable dist freshness；之后才声明 Studio aliases、历史比较/存储 fixture 插件和全局 IndexedDB setup。单纯追加 source alias 或 `mergeConfig(import(defaultConfig), …)` 无法绕过先执行的检查。 |
| `tooling/agent-package-inputs.ts:37-44` | 完整比较当前输入、输出和 dist receipt；core 源码修改后旧 receipt 必须失败。不能伪造 receipt、删门禁或将其改成默认跳过。 |
| `package.json:11-16,22-23` | `test`、`lint`、`quality` 会先 build reusable packages；example gate 另有构建/打包/安装。当前阶段不能借这些脚本启动必要检查。 |
| `tooling/agent-example-check.mjs:16-19,37-38,49-76,94-112` | Node >=24.11，真实 outside-workspace pack/install、严格 emitted types/runtime/public identity 和完整 conformance。保留原样，最终批次再执行。 |
| `examples/agent-todo/tsconfig.json:6-18`; `package.json:6-13` | strict NodeNext、`skipLibCheck=false`，全部 `src/**/*.ts` 会 emit；示例无 Vitest 依赖。其 `types` 脚本也会先 build。 |
| `examples/agent-todo/src/conformance.test.ts:1-24,32,50-56` | 既有 `node:test` 套件使用真实 TodoStore，但混合 actual SIGKILL 和通过 sibling `./cli.js` 启动的子进程；不是可直接导入 Vitest 的源码测试模块。 |
| `examples/agent-todo/src/store.ts:1,24-58,69-76,124-125,139-158` | 实际 `node:sqlite` 文件数据库、sidecar lifetime lease、owner/revision、精确审批及业务/receipt/completed 同事务；继续复用这些生产实现。 |
| `examples/agent-todo/src/host.ts:2-5,15-25,77-95` | 实际宿主通过公共 packages 调共享 `executeRun`，持有执行 ownership 并在 claim 内校验 metadata/approval。无需复制 loop 或引入 Studio。 |
| `tests/setup.ts:1-4,19-24` | 根 setup 会加载 Studio DB 并每例重置 IndexedDB；中立 core/Todo source suite 不应继承它。 |
| `quality/workspaces.json:55-87`; `tooling/workspace.mjs:47-49,65-82` | 已声明三个 exact public-source entry；analysis 可映射源码，但正常 runtime/packed consumption 仍走 emitted exports，私有跨包入口仍拒绝。 |

### Minimal E06 test lane

新增独立 `vitest.agent-source.config.ts`。**不导入默认 Vitest/Vite 配置**；只在此显式选择的测试配置中，把当前三个公开入口映射为绝对 source entry。推荐 alias 数组使用带首尾锚点的正则：

```ts
{find: /^@cuepoint\/agent-core$/, replacement: source('./packages/agent-core/src/index.ts')}
{find: /^@cuepoint\/agent-providers$/, replacement: source('./packages/agent-providers/src/index.ts')}
{find: /^@cuepoint\/agent-providers\/http$/, replacement: source('./packages/agent-providers/src/http/index.ts')}
```

`source` 用 `fileURLToPath(new URL(path, import.meta.url))`；不使用前缀/wildcard alias，不公开 `src/*` / `dist/*`。可以将这三个映射提取到仅供显式 test/dev profile 引用的 `tooling/agent-source-exports.ts`，避免后续 Studio profile 漂移；不得放进 package export map、正常 build config 或生产 consumer。精确映射也保证 provider 依赖的 core 与 fixture 直接导入的是同一 source module identity。

配置 `test.environment: 'node'`、`setupFiles: []`、`clearMocks: true`，限定 include 为 core 对应测试和新增 Todo fixture；用 `pool: 'forks'` 保持实际 Node builtins，必要时单 worker。显式 source lane 在配置加载时校验 Node >=24.11，缺少 SQLite/版本不符直接失败，不能整套 skip 后报告通过。首次必要范围是新注册/资源契约测试、`runtime.test.ts`、`tools.test.ts`、新增 Todo source fixture；未改 compaction/provider 算法不必顺带运行全部测试。

新增 **根目录** `tests/agentTodoSource.test.ts`，通过相对源码入口导入实际 example `store.ts` / `host.ts`（既有 `.js` ESM 写法由 Vitest/Vite 解析同名 TS），其中业务宿主仍保留 `@cuepoint/*` 公共导入。每例使用 `mkdtemp` + SQLite 文件 + `finally` 关闭/清理，调用 actual `TodoStore` / `execute` / `createHost` 和 host-issued authority；provider/model 使用既有确定性 scenario，不访问网络。

必须观察实际业务、evidence、call/result 行以及 dispatch/request 计数：有效显式授权在真实 loop 中完成一次 create；审批停驻后撤销/替换/修订或子范围放大不能 retarget；缺失/foreign/stale/revoked/widened/unsupported authority 零 mutation/effect；claim 与 atomic 内的晚期变化仍拒绝；unknown completion 不重放。可以同进程 close/reopen 文件验证授权/审批身份和数据保留，但注明它不证明 SIGKILL 后内核释放 lease。复用实际宿主与 store，不用平行的 fake SQL、第二 loop 或测试自己完成业务写入。

根默认 `tests/**/*.test.ts` 会发现此 fixture。若继续支持默认 Node22 test lane，在文件中使用具名 Node24 capability suite + 延迟导入 actual host/store，低版本明确 skip 该 SQLite suite；**专用 source 配置的前置版本断言必须保证本次实际执行**。这保持最终 Node24 默认测试可检查 emitted core，而不让 Node22 冒充 SQLite 证据。

不要把 Vitest fixture 放在 `examples/agent-todo/src`：其生产 tsconfig 和 outside gate 会编译/运行那里所有测试，且 outside consumer 没有 Vitest。也不要为规避这一点排除既有 `conformance.test.ts`；它的 emitted/进程验证必须保留。若 E06 向现有 conformance 增加少量 `node:test` 用例，当前只 typecheck；最终 gate 仍全部执行。

### Type checking and scoped quality

1. core 自身直接 `tsc -p packages/agent-core/tsconfig.json --noEmit` 可行，不经脚本、不生成 dist，保留 `types: []` 中立 ambient 边界（`packages/agent-core/tsconfig.json:9-27`）。
2. provider/Todo 直接原 `-p --noEmit` 仍会解析陈旧 core declarations，不能证明新 exports。新增 `tests/typecheck/tsconfig.agent-source.json`，extends Todo 的 strict NodeNext config，显式 `noEmit:true`、`incremental:false`、`rootDir:'../..'`、`baseUrl:'../..'`，paths 只列上述三个公开 entry。必须扩大 rootDir：沿用 package 的 `rootDir:src` 后 paths 引入 sibling source 会触发 TS6059。
3. source type project include core/provider production source（exclude 它们原本排除的 `*.test.ts`）、Todo `src/**/*.ts`、新的根 Todo fixture、`tests/typecheck/agentResourceContracts.ts`；后者从公共 root 导入类型，用必要的 `@ts-expect-error` 证明参数/preview/资源契约，不把它放进示例生产 src。保留 Todo 原有 NodeNext/strict/skipLibCheck=false；combined project 的 Node ambient 不替代第 1 项 core 无 Node ambient 检查。
4. 新 source 配置要加入 `tsconfig.node.json` 的精确 include，必要的 source config/helper 和 type witness 加入 Knip 真实入口/依赖发现及 `tooling/quality-check.mjs:21` 的精确 root-config inventory。不要扩大到 every-file-as-entry。既有 typecheck witness 模式见 `tests/typecheck/tsconfig.agent-tools.json:1-9`。
5. 默认 quality 的 lint/unused 也有 freshness barrier（`tooling/quality-check.mjs:36-39`）。必要的 scoped ESLint 可直接选 changed production files，并用 CLI `--parser-options` 指向新 source type project，避免新 public API 被陈旧声明判为 error/any；保留原规则与 inline-config 禁止。CLI 支持该选项见 installed `node_modules/eslint/lib/options.js:124`。根 tests/config 目前不在 typed source lint 匹配范围（`eslint.config.mjs:9-12`），不能把 ignored files 报成 lint 证明。
6. 既有 `quality-check.mjs --only architecture` **本就允许无 freshness**，且 architecture 在 source resolution 中使用 exact `publicSourcePaths`（`tooling/quality/architecture.mjs:51-60`）；必要 package-neutral/import graph 回归可直接运行。不是执行 default `quality` 或重跑全套 quality self-test。

建议实施后的必要命令，均在仓库根执行；以下只是计划，本研究未执行：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/vitest/vitest.mjs run --config vitest.agent-source.config.ts packages/agent-core/src/resourceCapabilities.test.ts packages/agent-core/src/runtime.test.ts packages/agent-core/src/tools.test.ts tests/agentTodoSource.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p packages/agent-core/tsconfig.json --noEmit --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p tests/typecheck/tsconfig.agent-source.json --noEmit --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit --pretty false
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node tooling/quality-check.mjs --only architecture
```

新 core 用例文件名按最终实现替换；其余命令不经任何 auto-build script。直接 Node 保证 forks 使用同一 Node24 executable。若使用包管理器，仅用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`，不 install、不改 lockfile；不要用默认 `pnpm test/lint/quality` 或 `tsc -b`。

### Subsequent Studio suites and running Vite

当前 E06 不迁移 Studio static bindings，不需要新增 UI consumer；但 core source 修改后，**本批后续任务不能继续假设默认 Studio suite 或 dev 能检查新实现**。

- 默认 root Vitest 即使只选一个 Studio 文件也会在 config load 阶段因 stale dist 拒绝。不能删 freshness/自动 build；需要后续 Studio 必要 suite 时，提供显式 `vitest.studio-source.config.ts`。
- 最小受控复用方案：把默认 root Vitest **配置体**（现有 fixture plugins、Studio alias、setupFiles、includes）抽成 `tooling/vitest.studio.ts` 的工厂；默认 `vitest.config.ts` 保留现有顶层 freshness，再调用工厂。source profile 直接调用工厂并附加 exact 三公开 entry mapping，按实际受影响文件运行。不能 import 默认 config 来获得 body；不能漏掉存储/历史 fixture 或无意把 Studio setup 加回 neutral source lane。source profile 的命令必须显式 `--config …`，不能改变默认 runner。
- 需要 Studio 编译回归时新增 `tests/typecheck/tsconfig.agent-source-studio.json` extends `tsconfig.app.json`，`noEmit`/`incremental:false`，保留原 `@/*` 映射并追加 exact 三公开 paths，仅 include 实际 Studio source/必要 type fixtures；这样检查真实新 core types。普通 Studio `-p`、根 app project 都没有这些 paths，可能只看 stale declarations。
- 默认 `apps/web/vite.config.ts:8-10` 和 root integration `vite.config.ts:8-10` 都有 freshness；全新正常 dev 启动应拒绝陈旧产物。已在运行的 Vite 则不能证明重新检查 freshness/加载新 core：顶层 gate 不是每次业务请求检查；exports 正常仍指 dist，源码变动不等于 dist 已变化。后续 Studio 新增 public export 时，可能在加载路由/预构建模块时才暴露缺失导出，不能让其成为未知现场状态。
- 如本批确需浏览器源码开发，新增单独 `apps/web/vite.agent-source.config.ts`，复用一个无副作用 web-config 工厂保留 Router/React/Tailwind、envDir、publicDir/version/root；只在 `command==='serve'` 且 `mode==='agent-source'` 接受 exact 三公开 alias，其他 command/mode 直接拒绝。默认 web config 继续 gate 后调用普通工厂，生产/build/desktop worker 不引用 source profile。启动命令用本机 Node 的 Vite `--config apps/web/vite.agent-source.config.ts --mode agent-source` 并传 `apps/web` root；切换 profile 后重启 server 并使用独立 Vite cacheDir，避免沿用 emitted-package optimizeDeps。仅选公开 package root/`http` 的优化排除或显式 prebundle 配置也应限定在此 profile，不能 wildcard 暴露私有入口。
- 这个 web profile 是后续需要时的明确配置变更，不是现存可用功能；本研究未运行 Vite，不能宣称 HMR、冷启动、浏览器显示或 source dev profile 已通过。E06 当前的 Node source suite 不依赖任何运行中 Vite，也无需启用它。Desktop 使用独立 build worker（`apps/desktop/scripts/build-frontend-worker.mjs:19-21`），仍是最终 emitted/native 边界。

### Deferred boundaries and implementation order

先落 source aliases/独立 Vitest config + source noEmit config，随后新增必要 core / actual Todo SQLite fixtures、再改公共 contracts/runtime/宿主；最后运行上列 bounded source checks。后续 Studio source profiles 只在对应任务实际需要其 suite/dev 时落地，并记录默认 gates 因陈旧产物暂不可运行的事实。无需用户决定常规验证入口。

源码测试可证明新实现通过实际宿主和 SQLite 的本次行为；**不能证明** emitted exports/declaration closure、outside package dependency identity、offline installation、完整 conformance、actual CLI/SIGKILL/restart/OS lease release、产品原生或浏览器 acceptance。`node --test examples/agent-todo/src/conformance.test.ts` 的原生 TS stripping 既不会重写 sibling `.js`→`.ts`，也不会让 spawn 继承 Vitest alias；无需为本阶段增加通用 Node loader。要提前做源码子进程验证，必须另建明确 `--import` loader、精确公开映射与 owned-root `.js` resolution，并对子进程显式传入；其复杂度不属于当前必要方案。保留 existing emitted/packed/kill-restart 最终验收，不以同进程 reopen 替代它。

## Related specs / External references

- `.trellis/spec/agent-core/library/index.md:37-52`：中立依赖、valid `.js`、公共产物与实际独立宿主验证。
- `.trellis/spec/agent-todo/cli/durable-host.md:63-67,92-106`：严格 packed public identity、actual process death 与完整 emitted conformance。
- `.trellis/spec/frontend/monorepo-boundaries.md:25-55`：receipt/freshness、source analysis 与生产消费边界。显式 development-only profile 是需记录的受控新增入口，不能默认改生产解析。
- `.trellis/spec/frontend/quality-guidelines.md`、`.trellis/workflow.md`、本任务 PRD：必要每阶段 source checks，完整/build/native 验收按 owner 当前指令延后。
- External references: none; investigated installed TypeScript/Vitest/Vite/ESLint source/config and repository owners only. Node24/pnpm machine paths exist; no dependency/tool version installation or execution performed.

## Caveats / Not Found

此文是源码依据的实施方案；当前尚无独立 source test/dev profile，也未运行任何测试、编译、server、build/install/pack/native/Git 操作。真正执行后才可报告 source checks 通过；最终 public emitted/kill-restart gate 仍未完成。直接使用 SQLite built-in 是 independent Todo 宿主的必要本地验证，不代表执行 Tauri/Rust/native acceptance。
