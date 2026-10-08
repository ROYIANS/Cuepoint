# C01 implementation handoff — AR-01 / AR-02

日期：2026-09-30。基线：`028e60070c14552025a3493e65f032350fdba8b5`。
角色：trellis-implement，直接实现，未派代理、未提交、未归档，未修改父台账或规范。
状态：授权 C01 实现、控制流整理及本地/原生验证完成，交独立 check；无剩余实现阻碍，不据此关闭审计发现。

## 本实现所有权与所有改动文件

| 文件 | 改动 |
| --- | --- |
| `src/db/taskGenerationEvidence.ts`（新增） | 无 generationRuntime/businessStore 依赖的图片/视频证据 leaf；历史成功资格、任务归属、当前媒体有效性和当前合法槽位应用检查 |
| `src/db/agentTaskRecords.ts` | generation source/picker 共用 leaf；真实 `validateTaskSources → writeTaskRecord` 的图片/视频 tool 来源也检查当前输出；保持非生成 write 与 audio 原资格行为 |
| `src/lib/agent/wrapupEvidence.ts` | 每条图片/视频工具证据独立验证；去掉 jobs 遍历对任意关联 call 的升级；独立 generation 共用媒体检查；当前 availability 纳入 fingerprint；保持原文、截断预算与音频分支 |
| `tests/agentGenerationEvidence.test.ts`（新增） | 79 个真实数据库边界用例，覆盖 record-write、picker、wrapup schema/publish、历史账本不改写及快照 freshness |
| `tests/agentTaskWrapup.test.ts` | 原 applied 测试的非法 character `concept` 槽位改成合法 `front` |
| `tests/agentTaskOrchestrationReview.test.ts` | downloaded/applied 成功夹具补真实 owned job、本地媒体及 jobId，不再仅以成功 JSON 证明交付 |
| 本文件 | 语义、red→green、命令和验证限度 |

主代理拥有 `scripts/c01-browser-regression.mjs`、`tests/fixtures/c01/*`、reviews 浏览器记录及任务/台账/后续 research。本实现未编辑这些文件；最终控制流整理后仅执行主代理原生脚本验证。工作区既有和并发改动均未回滚。

## 语义决定

1. **媒体共享规则**：图片和视频使用同一 `inspectTaskGenerationOutput(job)`，按 `job.kind` 检查。必须是 image/video；`result.kind === job.kind`；状态在 downloaded/applied/conflict；mediaId 指向当前媒体；`media.projectId === job.projectId`；`job.target.projectId === job.projectId`；真实非空 Blob；MIME 以相应 `image/` 或 `video/` 开头且有 subtype。Blob.type 可为空（现有夹具及保存契约允许），不要求其与 mimeType 二次一致，不增加解码检查。
2. **文件与应用分开**：available/supportsResult 表示合法本地生成文件；applied 还要求当前项目、目标实体和槽位合法且 slot.result 的 mediaId/kind 都匹配。shot 明确检查 episode 存在、项目归属、shot.episodeId、firstFrame/lastFrame/clip 合法性及 image/video 目标兼容。资产槽位用 CHARACTER/SCENE/PROP/STYLE_SLOTS 目录，不认可原夹具的 `concept`。
3. **deleted-target 既有契约选择**：沿用原 `taskGenerationSource` 的“Downloaded output survives target deletion”和 batch 规范的“replaced candidates remain downloaded evidence”。合法文件在目标删除、实际实体换 owner、替换槽位、episode 删除/范围变化之后仍可作为独立 downloaded generation 事实，applied=false。不会补造当前槽位应用。原始 `job.projectId != target.projectId` 属于不合法 job 身份，available=false；这与合法 job 后续目标删除或变化分开。
4. **任务归属**：当前 task、job、owning run 的 thread/project/task 一致；batch job 还检查 batch 的 task/thread/project/run 一致。picker 保留 batch-only 契约，foreign batch/run 跳过，不使整个库存读取失败。wrapup 可以保留失效 job 的 unresolved 历史证据。
5. **工具成功资格独立**：仅 submit_generation/check_generation/apply_generation；call.status 必须 completed，call/error 或返回 error/ok:false/success:false 不合格。submit/check 的历史结果必须 downloaded/applied，apply 必须历史 applied 且 applied:true；conflict 或 failed 返回不合格。历史返回 jobId/result.mediaId/kind 必须对应真实 owned job；submit 必须 job.callId===call.id，check/apply 必须 arguments.jobId 匹配；batch job 不能借单次 apply 取得资格。再检查当前媒体。工具 body 和持久化账本不重写；当前 outcome 可以随合法文件/槽位变化而更新。
6. **旧调用不升级**：rejected/failed/unknown/pending/awaiting_approval/approved/running 不成为成功来源；任意非生成 read/network/bookkeeping 提及 jobId 或占用 job.callId 不获生成成果资格。真实 completed 非生成 write 仍保留既有业务事实（回归专门覆盖与旧 job 关联、媒体删除仍保留 fact）。合法独立 generation 来源不要求某个后续查询被接受。
7. **record-write 覆盖**：`validateTaskSources` 图片/视频 tool 分支使用 `taskGenerationToolSource`，不再仅信任旧 JSON。AI result 写入失败在真实 rw 事务中回滚；用户 proposal/历史备注仍可引用可识别 generation。音频 `taskAudioToolSource` 的调用条件与规则未更改。
8. **事务及 fingerprint**：新 leaf 只做 DB 读取、JSON/slot 解析和 Blob/MIME 属性检查，没有 fetch、arrayBuffer、decode、网络或异步 hash。新增 native helper 调用在 Dexie 消费处采用 `await Promise.resolve(helper(...))`，包含 early-return/tool-invalid 分支和库存循环；保留既有 entity/audio 的采用方式。leaf 不导入 generationRuntime，没有进行 D 模块拆分。ownership 改变也会改变当前 availability fingerprint，避免只看同一个 media 的 downloaded job 保持旧总结新鲜。

## 真实回归范围

- image/video 各自：合法 applied；媒体删除、空 Blob、foreign media owner、audio MIME、缺失 MIME subtype、非 Blob 对象、错 result.kind、target owner 不一致、无 result、failed/unknown/running/downloading/remote_completed。
- current target：替换/删除、foreign entity、episode 删除/错范围、非法资产槽位、slot result 错 kind；合法 downloaded/conflict 文件。
- 7 个非 completed 调用状态 × applied/downloaded/missing 文件，失败调用不升级，独立有效文件仍可发布。
- completed 调用：任意 read 工具、远端 failed、apply conflict、错 job/media/kind/arguments、无结果、foreign job、ok:false、success:false；schema 和真实 publish 拒绝。
- completed submit 自身归属、无关 submit 不能借旧 job；image/video 单次 apply；非生成 write fact 不变；batch/run owner 不合法；freshness随owner失效。
- 每个无效媒体用例通过真实 `writeTaskRecord` 的 AI result 工具/生成来源验证与真实 schema/publish；assert job/call 持久化历史未变化；历史用户 proposal 能保存。

## Red → green 实证

最终同一份 **79 测试**在隔离 B 源码副本运行。副本由 `git archive 028e600 | tar -x -C <tmp>` 创建，软链当前 node_modules，只拷入新测试；未覆盖共享工作区源码。

隔离目录：`/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/c01-baseline-phz_tbxx`。
最终 red 原始日志：`/tmp/c01-baseline-red-final.log`；exit **1**。

```text
Test Files  1 failed (1)
     Tests  61 failed | 18 passed (79)
Start at  19:41:43
Duration  2.44s
```

其中旧源码确实接受删除媒体后的 tool AI record（promise resolved instead of rejecting），错 result.kind/target owner 的当前 source 仍 available，拒绝等旧调用仍 supportsResult，非法槽位仍被判 applied；不是以 grep 或纯 helper stub 代替真实边界。foreign batch、非生成 write 与 ownership freshness 也有真实 source/inventory/snapshot 反例。

开发中最初的 65 用例运行存在未 addShot 和 cancelTaskWrapup 参数遗漏等夹具失败；这些已修正，早期数字**不作为最终 product red**。最终 red 执行在生产源码变化之后用原 B 副本重跑，以上最终日志才是验收证据。先前 66/78 中间结果均被最终 79 替代。

最终 green：下方完整相关命令包含新测试；79/79 新回归通过，整个相关集合 **14 files / 260 tests passed**，exit **0**。原始日志 `/tmp/c01-related-final.log`。

```text
Test Files  14 passed (14)
     Tests  260 passed (260)
Start at  19:47:21
Duration  3.45s
```

## 验证命令和数字

所有 pnpm 显式使用用户机器路径，没有 bare pnpm/runtime pnpm；未安装或变更依赖。

```sh
# B 隔离目录中的 red：同一份最终新回归
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/agentGenerationEvidence.test.ts

# 当前源码 green，14 files / 260 tests
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/agentGeneration*.test.ts tests/agentTask*.test.ts tests/audioGenerationAgent.test.ts tests/audioAgentExecution.test.ts tests/audioMusicAgentTools.test.ts

# 类型检查，exit 0
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint

# whitespace，exit 0
git diff --check -- src/db/agentTaskRecords.ts src/lib/agent/wrapupEvidence.ts tests/agentTaskWrapup.test.ts tests/agentTaskOrchestrationReview.test.ts
```

lint 原始日志：`/tmp/c01-lint-final.log`，实际脚本 `tsc -b --pretty false`，exit 0；最终源码后运行。控制流整理后重新运行，源代码类型检查通过。leaf、测试、handoff 的新增文本也检查行尾空白。

14 个测试文件：agentGeneration、agentGenerationBatch、agentGenerationBatchSafety、agentGenerationEvidence、agentGenerationRecovery、agentGenerationReview、agentGenerationReviewTransactions、agentTaskOrchestration、agentTaskOrchestrationReview、agentTaskWrapup、agentTasks、audioGenerationAgent、audioAgentExecution、audioMusicAgentTools。

## 新控制流整理与静态实证

按主代理扫描反馈，将原新 leaf 大函数拆成真实业务判定：历史返回 `isGenerationResult`、生命周期 `hasDownloadedGenerationResult`、媒体 `hasAvailableGenerationMedia`、shot 范围 `readCurrentShotSlot`、资产合法槽位 `currentAssetSlot`、目标类型 `readCurrentGenerationSlot`。目标按明确 switch 分支调用实际 DB 表；无 ignore、新注册系统或 D 模块迁移。wrapup 新增的 outcome 嵌套三元改为 early/default assignment + if。

相同审计 ESLint 配置扫描三份生产文件：`/tmp/c01-static-refactor.json`。新 `taskGenerationEvidence.ts` **0 diagnostics**；整体 exit 1 来自已有 wrapup JSON any 等规则，不声称整个 scope 静态零告警。wrapup 的 nested ternary 总数回到基线，未新增这类告警。原 `validateTaskSources` 41/28 与 `collectWrapupSnapshot` 91/139 等旧大函数复杂度仍需后续 D 范围整理，不以此豁免新 leaf。

另用同配置仅对 leaf 将 complexity/cognitive 阈值临时设 0，取真实数字（不写入项目配置，不作为违反门禁）；输出 `/tmp/c01-leaf-complexity.json`：

| 新业务函数 | cyclomatic / cognitive |
| --- | --- |
| inspectTaskGenerationOutput | **7 / 4**（原 45 / 62） |
| taskGenerationToolSource | 16 / 11（leaf 最高） |
| hasDownloadedGenerationResult | 4 / 2 |
| hasAvailableGenerationMedia | 7 / 4 |
| readCurrentShotSlot | 10 / 5 |
| currentAssetSlot | 7 / 3 |
| readCurrentGenerationSlot | 10 / 4 |

最终 lint/test 都在此次整理后重跑，以上 260/260 是最终整理后的数字。

## 原生 IndexedDB 最终 green

主代理报告原生 green 后，本实现于控制流整理完成再次运行其原脚本，未编辑浏览器文件；exit 0。原始日志 `/tmp/c01-browser-refactor-green.log`：

```json
{"checks":6,"generations":160,"calls":161,"nativeIndexedDB":true,"provenanceRefused":true,"externalRequests":0,"browser":"Chromium native IndexedDB","limitation":"Synthetic nonempty media metadata, no pixel decode, external provider or full product UI"}
```

执行命令：

```sh
C01_PLAYWRIGHT_PATH='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' C01_CHROMIUM_PATH='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/c01-browser-regression.mjs
```

此运行验证 native IndexedDB 下真实 collection 的大量重复/缺失目标历史、snapshot→publish 的事务、工具出处拒绝，无外部请求；不等同正常产品 UI 端到端或真实媒体播放验证。

## 实际未验证限度与独立 check 接口

- AR-01 仍是**异常持久化状态的防御风险**。直接置入不合法媒体/job/slot 的 IndexedDB 夹具，不证明正常 UI、合法 ZIP 或正常下载会形成该状态，不升级为已证明 UI 异常或 P1。
- 本实现 Vitest 使用 fake-indexeddb；另有上节原生 Chromium IndexedDB 事务实证。无网络/解码由源码及 0 external 运行确认，未覆盖其他浏览器。
- 主代理报告 `reviews/C01-browser-red.log` 中原 B source 的原生 160 generations + 161 calls 读事务完成后，rejected query became result source 断言失败；初次未用 emptySlot 的 bootstrap 失败另存，不计 product red。本实现未修改主代理浏览器脚本，整理后 green 已按上节再次执行；checker 应完整读取 scripts/fixture/reviews，并按最终源码独立复核。
- 未解码媒体、未请求供应商、未评判图像/视频质量；MIME/Blob/owner 的结构检查不等于媒体可播放实证。
- 未跑整个仓库全测试、model gate、build；这属于 C 批末门禁。独立 check 尚未进行，本实现未关闭发现或修改规范。
- 仅 C01。C02、现代包/hasEpisodes兼容、D 模块迁移均未实施。
