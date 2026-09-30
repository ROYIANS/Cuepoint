# C02 AR-03 implement handoff

状态：实现及本角色验证完成，交主代理独立 check；未宣称独立检查 PASS。最终由实现角色负责 7 个源码、2 个聚焦测试（9 文件）；主代理另负责 3 个浏览器文件，总检查 scope 为 12 文件。本单元未编辑 specs、ledger、task 状态，未 commit、archive 或扩大到 C03/C04。

## 最终合同与实际消费者

- `domain/music.ts` 的 `MUSIC_DURATION_LIMITS` 是边界唯一来源：Flow Music 1..240、Suno 10..360。所有新设置时长必须是有限整数，字段仍可省略。只限制生成参数，作品解码时长 `durationSec` 仍可为小数。
- `db/music.ts` 的新增/编辑草稿、新增作品及 `db/audioGeneration.ts` 已有 `validateMusicSettings` 调用保持严格。非法时长事务回滚，项目时间、媒体、作品、草稿、job、调用结果、task record/version 快照不改变。空白/未完成文本草稿继续可保存，生成完整性仍由生成前边界检查。
- `music_save_draft` 的 JSON 广告为 optional integer + exact bounds；parse、prepare、execute 三个实际入口都重解析。非法参数不发生成功业务写入或成功账本。
- `music_reuse_work.prepare` 新增严格 `validateMusicSettings(work.settings)`；execute 重算预览，随后仍通过严格 `addMusicDraft`。旧小数作品可编辑元数据，但不能未经修复参数就复用为新草稿。测试覆盖合法预览之后执行时遇到小数历史行，拒绝且业务/账本快照不变。
- `audioGeneration/input.ts` 与 `ai/apimartAudio.ts` 复用同一边界，保留 strict/int/schema 和现有 wire 字段。小数诊断为“音乐时长必须为整数秒”。Suno simple 模式仍省略自定义 title/style/negative_tags/duration，但所存 settings 有非法时长则仍先拒绝。
- `validateLegacyMusicDraft` 仅在 ZIP 事务导入使用；`validateLegacyMusicWork` 仅在 ZIP 导入和已存在作品 title/notes/favorite patch 使用。兼容路径只放宽整数性，仍保留有限性、原范围、版本/BPM/文本长度、项目与媒体所有权、解码元数据等原验证。新增和草稿 patch 没有 opt-out 参数。
- 既有 fractional 草稿/作品仍可 `music_read` 和 UI 原样读取，不自动舍入。生成准备前明确失败，不写 job；合法完整 settings 替换可通过 CAS 修复。作品不可编辑 settings 原样保留；元数据通过直接 repo 和实际 Agent atomic tool 修改均有回归。
- `audioProjectPackage.ts` 只替换导入音乐 draft/work 的验证路径。实际 export→import→repair→re-export→second import 覆盖两引擎历史小数，媒体 ID 按原流程重映射。历史包的小数参数不成为新保存豁免；越界/BPM/文本超限在 draft/work 包导入均拒绝并回滚。包 job 输入/指纹路径保持原合同，不修改 C04。

已核对消费者：`MusicCreation` debounce→patch / generate→runtime；`MusicWorkspacePage` 默认/variant/复用→addMusicDraft；`draftVariants` 构建参数；`db/repo.ts` 创建项目只写无时长默认设置；`db/audioGeneration.ts` 严格验证新 job；runtime 保存结果→addMusicWork；`musicTools` 保存/整理/复用；`audioGenerationTools.musicArgs` 从真实 draft 读取→validateGenerationInput；生成 review snapshot/presentation→musicWireInput；audioProjectPackage snapshot/parse/import。检索输出保存为 `reviews/C02-consumers.log`。

兼容限度：ZIP 没有标记哪条 settings 来自旧版本，因此导入历史 draft/work 允许原范围内有限小数，保持 readable/repair 合同。这不允许新增 repo/tool 绕过整数规则。work 原始 settings 不可编辑，需要读取后修复参数并保存新草稿。媒体使用模拟非空 Blob，wire 使用 mock fetch；没有真实付费请求、声学/解码或浏览器交互证明。

## 真实 Simple UI 修复补充

`MusicCreation.tsx` 纳入 C02 是因为旧 Simple 草稿可能带 `durationSec=30.5`，原 UI 隐藏时长字段，切换 Custom 又切换到另一持久化草稿，原行无法修复。新增同文件的小型展示组件 `SimpleMusicDurationRepair`，仅 Suno Simple 含已存时长时显示原值与“清除历史时长”；Simple 不支持指定时长，因此合法整数历史值也可显式清除。没有时长的普通 Simple 与 Custom 布局保持原样。

按钮 busy/switching 时禁用，点击通过现有 `update({durationSec: undefined})` 合并当前本地草稿，然后走真实 `useDebouncedDraft` 与既有 persist/CAS。原值保留到用户动作，不自动 drop/round，不豁免新参数保存。清除仅改变时长，保留 dirty prompt/title 等字段。写入失败保留清除后的本地草稿与文字，可重试；外来并发写入则显示冲突并保留 dirty 内容，不能覆盖新行，可显式采用最新内容。若同时存在其他非法字段，清除时长不会绕过它们的验证。

`tests/musicLegacyDurationRepair.test.ts` 的 8 项使用实际组件、展示叶子、点击回调、生产 `useDebouncedDraft` effects/controller 和真实 Dexie/repo；推进真实 400ms debounce，覆盖原值无自动修改、历史整数/小数/越界显示、normal/custom 不显示、busy/switching 禁用、dirty 文字保留、保存失败/重试和 CAS 冲突。Hook/JSX host 不等同于 ReactDOM/Radix 或浏览器调度；主代理原生浏览器另覆盖实际组件、React/Radix/IndexedDB。

## 最终验证与 red/green

所有 pnpm 命令均使用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`。

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/musicDurationContract.test.ts tests/musicLegacyDurationRepair.test.ts tests/musicDraftVariants.test.ts tests/audioMusicAgentTools.test.ts tests/musicGenerationReview.test.ts tests/musicReviewPresentation.test.ts tests/audioFoundation.test.ts tests/audioGenerationRuntime.test.ts tests/audioGenerationRecoveryAudit.test.ts tests/audioGenerationAgent.test.ts tests/apimartAudio.test.ts tests/projectPackage.test.ts
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
node .trellis/tasks/09-30-src-remediation-c/reviews/C02-static.mjs
```

- 最终 green：`reviews/C02-vitest-final.log`，exit 0，12 test files / **248 tests PASS**；新增两聚焦文件分别 **38 + 8 cases**。
- 最终 red：`reviews/C02-isolated-red.log`，exit 1，1 file / **13 failed, 25 passed, 38 cases**。当前完整 src 复制到临时隔离 root，只有 6 个 C02 生产文件用 `git show HEAD:<path>` 旧源码替换；运行最终 38-case 测试，未覆盖共享源。精确 root/command 在 `reviews/C02-isolated-red-command.log`，node_modules/vendor 只读使用。失败覆盖广告、两引擎 fractional repo、两引擎 parse/prepare/execute、reuse 执行重检和历史 reuse prepare。
- lint：`reviews/C02-lint-final.log`，exit 0，TypeScript `tsc -b --pretty false`。最终源码验证后未再变化；项目 app tsconfig 不包含 tests。
- static：`reviews/C02-static-final.log` + `C02-static-current.json` / `C02-static-baseline.json`，exit 0，**0 added diagnostics**。domain/music、db/music、musicTools、generation/input 各 0；APIMart 原 3/现 3，audioProjectPackage 原 6/现 6，MusicCreation 原 2/现 2。展示条件移到同文件的小型组件后，原主组件复杂度诊断不增加。保留 `C02-eslint.config.mjs`；无新增 nested ternary，无 suppression。
- whitespace：`reviews/C02-whitespace.log`，指定七个源码的 `git diff --check` exit 0；两个新增测试和全部源码均无行末空白。
- C01：`reviews/C02-implement-snapshot.json` 对比独立 check 留存的九个 final hashes，**9/9 match**。C02 无共享已检查文件的重叠。

日志版本说明（不是最终验收数字）：`C02-red.log` 为第一次 `pnpm test -- ...` 意外全套运行的 26-case 初稿：136 files，5 failed / 2201 passed；`C02-focused-red.log` 同 26-case 初稿聚焦 red 5 failed / 21 passed；`C02-focused-green.log` 是初稿 26 PASS。`C02-isolated-bootstrap.log` 仅缺 vendor 依赖导致 **0 tests**，不算产品 red；`C02-isolated-red-36.log` 是上一版 36 cases、11 failed / 25 passed。最终验收使用上述 38-case red、下述 8-case UI red、248-test green 和原生浏览器证据；`C02-vitest-green.log` 的 240 PASS 是 UI 补充前的中间版本。批末 full suite/build/model 留给 C 整批门禁，不据初稿意外全套 red 宣称最终全套 PASS。


- UI 最终 red：`reviews/C02-simple-ui-red.log`，exit 1，**8 cases / 8 failed**，在仅 MusicCreation 回退为 HEAD 的隔离副本运行最终 callback tests，失败为实际按钮缺失。精确命令在 `C02-simple-ui-red-command.log`。`C02-simple-ui-bootstrap.log` 的 React-undefined 来自隔离副本缺 JSX tsconfig，不计产品 red；初稿 `C02-simple-ui-initial-red.log` 也不作最终验收。
- UI 聚焦 green：`reviews/C02-simple-ui-green.log`，**8/8 PASS**，已被最终 248 项整合运行再次覆盖。
- 原生浏览器：主代理 `research/C02-native-browser-handoff.json` 引用 `reviews/C02-browser-green.log`，**3 cases PASS / 0 external requests**；本角色在最终展示叶子版本再次运行原 runner，`reviews/C02-browser-implement-final.log` 同样 **3 PASS / 0 external**，三个场景均断言 page errors 为空。包含非法保存后显式清除保留文字、外来合法 duration60 + prompt 写入后的清除/CAS 冲突保留本地文字、switching 禁用。未发 provider 请求，未验证完整生产 workspace route。初次浏览器 green 尝试的 fixture 假设问题见 `reviews/C02-browser-fixture-note.md` 与保留的日志，不计产品 bug。

```sh
C02_PLAYWRIGHT_PATH=/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs C02_CHROMIUM_PATH=/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell node scripts/c02-browser-regression.mjs
```

## 最终文件与 SHA-256

Before/after 所有值及 C01 比较在 `reviews/C02-implement-snapshot.json`。Before 源自本单元开始时已确认干净的 HEAD 文件；新增测试 before 为 null。

| 实现角色文件 | 最终 SHA-256 |
| --- | --- |
| `src/domain/music.ts` | `e4aa833ff90eb581b77f30f88a48784ec57b3d9d7adb2a933b65db0fc65c47da` |
| `src/db/music.ts` | `bc50aceb5d623a15a0f806d26e2ebe11e5a18d202a50d997d58e2082ab1a1f54` |
| `src/lib/agent/musicTools.ts` | `b08173c67264a6383d0469fee66d8eae2fdacb1f8b4063410bf3d9a9516c4d87` |
| `src/lib/audioGeneration/input.ts` | `bfe29b5ed9f81ec76987fdf417fd68f85bb3224cdbfe6423e83300792c50af62` |
| `src/lib/ai/apimartAudio.ts` | `8cb50863b0aab40e1ddfe9b956b938125eba4f170bcd463f2cce24e7e5eb2c59` |
| `src/lib/audioProjectPackage.ts` | `12a0c856dceccf6ce249c1b367e4b3ea0d4f67d315427adfcd57bd1e0d1691bc` |
| `src/components/music/MusicCreation.tsx` | `c61c3efe64eec1bf1b6957557517affff1fbec4833a7571dc6a694879796ec6c` |
| `tests/musicDurationContract.test.ts` | `529c94b973c0e417cd8d5aeb4a545f3baffc1a492ba663badaf921fa99f0a399` |
| `tests/musicLegacyDurationRepair.test.ts` | `ad5b464f1a78b1ea62414af1935fbb86198d17d77a94c6f43bff414e0200cd1e` |

主代理浏览器文件只读取和运行，未编辑。以下 3/3 与 `research/C02-native-browser-handoff.json` final hashes 一致。

| 主代理文件 | 最终 SHA-256 |
| --- | --- |
| `scripts/c02-browser-regression.mjs` | `4a11ac2dd4a34e2e22fbd459c9c7d7095c2768a668473ea8723ea2358c95de84` |
| `tests/fixtures/c02/harness.tsx` | `10bff4b31b13f24d2a5c68e4e5cf141cc0eb4f3591c154957d9feb0018b56a22` |
| `tests/fixtures/c02/index.html` | `f8e7f43063caa78f94c1735f3f1a6dd6ef9783650f40d0a8ef19bf5f1c65efe8` |

## 独立 check 交接

实现工作完成，请按主代理 `research/C02-check-scope.md` 开始独立 check，覆盖上述总计 12 文件、最终 hashes/实际边界、历史兼容限度、真实 Simple 修复入口与 callback/CAS、事务与 ledger 原子性、wire 合同及 C01 九文件无漂移。`reviews/C02-implement-snapshot.json` 已记录实现角色 9 文件 before/after、主代理 3 文件一致性和 C01 9/9 一致性。本角色不另派代理，不宣称独立 check 已 PASS。
