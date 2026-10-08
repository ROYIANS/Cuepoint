# C01 independent check — PASS

2026-09-30。角色 trellis-check，直接独立检查，未派代理。基线 `028e60070c14552025a3493e65f032350fdba8b5`。**最终 PASS，无 remaining actual blockers。** 本结论仅覆盖 C01；不关闭父台账发现，不修改规范，不提交、推送或归档，不验证 C02。

## 范围、读取与哈希

读取 check.jsonl 指定上下文、prd/design/implement、C01 contract、implementation/native handoff 和 check-scope；逐项追踪真实实现及其调用边界。覆盖完整 9 文件（6 implementation source/test + 3 main browser 文件），开始时固定 before SHA-256，所有最终门禁后固定 after SHA-256。完整 64 位值见 `C01-check-snapshot.json` 的 `before` / `after` 映射及 `files`（每项 `sha256` 等于最终 afterSha256），`schemaFiles` 同样列出全部 9 文件；`nativeBrowserHandoff.files` 对主代理 3 个 browser SHA 独立比较全部 match。

| 文件 | checker 前后变化 |
| --- | --- |
| `src/db/taskGenerationEvidence.ts` | checker correction |
| `src/db/agentTaskRecords.ts` | unchanged |
| `src/lib/agent/wrapupEvidence.ts` | unchanged |
| `tests/agentGenerationEvidence.test.ts` | checker correction |
| `tests/agentTaskWrapup.test.ts` | unchanged |
| `tests/agentTaskOrchestrationReview.test.ts` | unchanged |
| `scripts/c01-browser-regression.mjs` | unchanged |
| `tests/fixtures/c01/harness.ts` | unchanged |
| `tests/fixtures/c01/index.html` | unchanged |

## 实际发现与 checker correction

独立追踪 `submitAgentGeneration`：已有 job 的重用会要求 `saved.runId === context.runId`，新 job 同时保存 `runId/context.callId`。新证据 leaf 原先对 submit 只要求 `job.callId === call.id`，且仅分别检查两条 run 均属同任务，未要求两者是同一轮 run。异常持久化的同任务另一轮 submit 因此会被错误认证为旧 job 的实际起源。这是 C01 provenance 防御缺口，不是正常产品 UI 可形成该状态的证明。

增加真实数据库回归后，修复前 `C01-check-origin-run-red.log`：1 failed / 1 passed / 79 skipped（81），失败为 submit supportsResult 原为 true；合法后续 run 的 check 已通过。补修 `taskGenerationToolSource` 的 submit 分支，同时要求 callId 与 runId 匹配。check/apply 的后续 owned run 查询能力保留。

新增 2 例分别覆盖错误 submit 起源和合法后续 check，调用真实 start/publish/record-write：错误 submit 的 publish 拒绝、真实 rw record-write 拒绝，record/recordVersion 无新增，wrapup row/version 不变；独立 generation 文件事实仍 supportsResult；call/job rows 精确相等。最终 14 files / **262 tests** 全通过（实施者原 260 + checker 2）。未改变 generation/tool ledger 历史事实。

## 独立追踪结论

1. **来源成功资格分别判断。** `provesCompletedGeneration → taskGenerationToolSource` 要求白名单 submit/check/apply、completed、无 call/result error 或 ok:false/success:false、真实 image/video 返回，submit/check 历史 downloaded/applied、apply 历史 applied 且 applied:true。拒绝、失败、unknown、pending 等旧调用均不被关联 job 升级。非生成 read/network/bookkeeping 的 jobId 不赋予生成资格；原 completed 非生成 write 事实保留。已去掉 job 遍历回写任何相关 tool source 的旧路径。
2. **task/run/job/batch/project/thread 归属。** 当前 task 记录、job、job owning run、batch 必须吻合；tool owning run 也必须属当前 task/thread/project；submit 还匹配确切 origin run/call。check/apply 的 arguments.jobId 必须对应 result.jobId 及实际 job；历史 result mediaId/kind 必须等于真实 job 输出。batch job 不能借单次 apply 来源获取资格。picker 保持 batch-only，外来 batch/run 跳过，wrapup 独立非 batch job 可以保留合法文件事实。
3. **当前媒体资格。** shared leaf 要求 job.target.projectId 与 job.projectId 一致，job.result.kind 与 job.kind 一致，生命周期仅 downloaded/applied/conflict；当前媒体必须同 owner、真实非空 Blob、对应 image/video MIME 前缀且 subtype 非空。非空假字节只证明结构条件，不证明图像/视频可解码。Blob.type 为空仍符合既有保存契约。
4. **文件和应用区分。** 已删除/被替换/换 owner 的目标、删除/外来 episode、非法 slot 或当前 slot result.kind 不符都不能 applied。shot 对 episode 存在、project、shot episodeId 与 firstFrame/lastFrame/clip 的类型校验，资产按真实 slot catalog。合法下载在历史目标删除后仍可 downloaded；不存在的文件及错 owner/MIME/kind/lifecycle 不能交付。applied 必须当前合法 slot 的 mediaId/kind 同时匹配，不能仅信 job.status。
5. **真实 rw/schema/publish。** `writeTaskRecord → validateTaskSources` 使用当前工具/生成证据；AI claim=result 需要实际成功来源，用户 proposal 保留历史事实能力。`start/publishTaskWrapup` 在真实 db.tables rw 内重新 collect fingerprint；publish 校验 freshness 与 schema，不能用 rejected/unavailable source 声称交付。新增回归明确核对 rejection 后无 row/version 提交。既有 79 例也覆盖 schema/publish/current-source、ownership freshness 与当前媒体失效。
6. **fingerprint 与 immutable ledger。** tool fingerprint 包含原 call + 当前 job/output eligibility；generation fingerprint 包含原 job、当前 media owner/MIME/size、currentAvailable/currentApplied。owner 失效（无 tool evidence 时也包括）及 media/slot 变更可使旧总结 stale。collect/inspect 函数仅读取 IndexedDB，body 保留原返回并附当前说明，不回写 call/job；测试逐值断言 ledger 不变。没有下载、网络、decode 或付费重试逻辑。
7. **Browser 三文件。** 完整读取 runner、harness、HTML；runner 通过 Vite 仅本地加载 harness，使用指定已安装 Chromium 与 Playwright，拦截非本地请求并断言 0 外部请求/0 pageerrors。harness 经真实 createProject/createAgentTask/beginRun/putMedia/setCharacterSlot、native bulkAdd、start/publish/cancel 路径操作 160 jobs/161 calls，包含重复媒体/实体与 missing targets。原 B source red 使用 readonly transform；baseline 两源 SHA 独立与 git show 比较匹配。旧 bootstrap slot 缺 referenceImages 的失败未计 product red。

## 命令与最终验证

命令、绝对 pnpm/node 路径、原生 env、stdout/stderr、exit 均保存在 reviews 日志；未安装或改变依赖。

| 检查 | 最终结果 | 日志 |
| --- | --- | --- |
| 原相关测试集，修复前 | 14 files / 260 tests，exit 0 | C01-check-vitest.log |
| checker 起源 run red | 1 failed / 1 passed / 79 skipped，exit 1 | C01-check-origin-run-red.log |
| 同 14 测试文件，修复后 | **14 files / 262 tests**，exit 0 | C01-check-vitest-final.log |
| lint / tsc -b | exit 0 | C01-check-lint-final.log |
| native Chromium IndexedDB | 6 checks，160 generations / 161 calls，provenanceRefused=true，externalRequests=0，exit 0 | C01-check-native-browser-final.log |
| 新 leaf 审计静态 | **0 errors / 0 warnings / 0 diagnostics** | C01-check-static-final.json |
| 全 9 文件 whitespace、runner syntax、B red 源哈希 | PASS | C01-check-extra.log |

原生环境严格使用 check-scope 的 `C01_PLAYWRIGHT_PATH` 与 headless-shell `C01_CHROMIUM_PATH`，未 install，未设置 baseline root 的最终 green。独立重跑 native 前后两次都 green；没有将旧 red 视作最终独立运行。

### 静态保留项

独立用原审计 ESLint 配置扫描 3 生产文件，并从 committed B 做 lintText baseline 对比；配置副本 `C01-check-eslint.config.mjs`，执行脚本 `C01-check-static.mjs`，原日志 `C01-check-static-final.log`，当前 JSON / baseline JSON 均保留。初次 CLI scan 整体 exit 1 由已有诊断导致（C01-check-static.log）；最终脚本 exit 0 仅表示要求的新 leaf 无诊断，**不是整个 source scope 0diag**。

当前 `agentTaskRecords`：0 error / 3 warnings；`wrapupEvidence`：3 errors / 12 warnings；旧源码总共仍 3 errors / 15 warnings。既有 JSON unsafe assignment/return、无必要 assertion、nested ternary 均保留，wrapup nested ternary 数量与 B 相同，未加 suppression。

| 旧函数 | B cyclomatic / cognitive | 当前 cyclomatic / cognitive |
| --- | --- | --- |
| validateTaskSources | 38 / 27 | 41 / 28 |
| writeTaskRecord | 28 / 阈值内 | 28 / 阈值内 |
| collectWrapupSnapshot | 87 / 136 | 91 / 139 |

不是宣称旧函数复杂度完全不变；新增验证路径增加少量分支，已有大型函数告警继续由 D 范围整理。B taskGenerationSource complexity 22 的告警随着共享 leaf 消失。新 leaf 每函数都在 20/20 门槛内，metric-only 临时阈值 0 结果保存在 `C01-check-leaf-complexity.json`：taskGenerationToolSource 最大 **17 / 11**，inspectTaskGenerationOutput **7 / 4**。临时测量配置不写项目、不用作门禁豁免。

## 限度与交接

无 C01 remaining actual blockers。AR-01 异常 IndexedDB 防御风险未升级为正常 UI 实证。fake-indexeddb 回归加 Chromium native transaction，不等同其他浏览器、真实图片/视频解码、供应商调用、完整产品 UI 或媒体质量验收。全仓 test/model/build、其他 C 单元与批末全 scope 检查留给主代理既定流程；本次没有扩大到 C02。

只补修 C01 leaf 与其回归，其他 7 个 scope 文件 checker 前后 SHA 不变，3 browser 文件与 native handoff SHA 全匹配。没有修改 ledger/spec/任务完成状态，没有 commit/archive。主代理更新 C01 后续证据时应采用最终 **262/262、81 个 evidence tests** 与 checker correction，而非原 260/79 数字。

最终交接兼容校验：`python3 .trellis/tasks/09-30-src-remediation-c/tools/verify-reviewed-files.py` exit 0，changedFiles=9，missingOrChanged=[]；命令日志 `C01-check-reviewed-files.log`。
