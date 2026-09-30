# src 审查交付独立复核

日期：2026-09-30（Asia/Shanghai）。角色：trellis-check。基准：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。

## 最终结论

**复核通过，附证据范围澄清。** 指定的 PM-01/02、PU-01/02/03/04、SS-01/02、PD-02 及 ARCH-01 核心机制成立，未发现应撤销这些发现或改动产品源码的理由。SS-01 确认的对象是旧查询值被渲染、混合身份被用于导航；跨项目实际点击写入保留为未做浏览器验证的影响推演。AR-01 保持 P2 / risk，不能据异常数据库夹具升级为正常入口的权限故障。

主报告、六组覆盖、总覆盖和问题索引一致：392 个文件，389 reviewed / 3 generated-verified；51 项**模块发现**，24 confirmed-bug / 18 structural-debt / 9 risk；35 P2 / 9 P3 / 7 P1。**7 项 P1 中 6 项为 confirmed-bug，1 项为 risk（PU-05）**，不能简称“7 个已确认高危故障”。分类数量不是去重后的独立根因数量，也不是用户环境事故数。

八文件值环属于同一根因：AR-04 与 PD-04 是两个模块视角，ARCH-01 是跨模块分析。`findings.json` 没有额外添加 ARCH-01，现有 51 项未额外加成 52 项；汇总独立根因时三者只能计一次。

本角色只写本文件。没有重跑全量测试、构建或源码审查，没有修改 src/tests/产品配置/其他研究者文件，没有提交、推送或派代理。

## 上下文与覆盖检查

按顺序读取 check.jsonl 的四份规范、prd/design/implement；另核对状态管理、AI 接入相关契约和实际调用实现。最初聚焦 providers-media、production-ui、architecture、tool-analysis；按后续授权扩展 SS-01/02、AR-01 分类口径、PD-02 与最终汇总产物。未把早期其余报告尚未完成判作失败。

| 检查 | 独立结果 |
| --- | --- |
| 两组初始 coverage | providers-media 48/48（46 reviewed、2 generated-verified）；production-ui 36/36 reviewed；集合与各自 manifest 一致，无重复、blocked、空说明或未知 finding ID |
| 全部六组及合并 coverage | 392/392；`coverage.json.files` 的 path/status/note/findings/group/lines/sha256 与六组账本一致 |
| 固定来源 | `git ls-files src` 与 manifest 集合一致；392 个 SHA-256 全部匹配 |
| 主报告索引 | 51 个 ID 唯一；priority/classification 与 findings.json 一致；所有本地主报告链接存在；coverage 引用的 ID 均存在 |
| 源码位置 | 写入本检查文件前，178 处显式 `src/path:行号` 均存在且在文件行数内；该检查证明引用有效，不能替代每条发现的语义复核 |
| 生成路由 | route-regeneration.json 记录 3995 个非 trivia token 一致及 restoredBaseline=true；本次实测 routeTree 哈希与 manifest 一致，src 最终无 diff |
| 规范变更 | quality-guidelines.md 仅新增审查证据合同（21 行）；明确已有 gate 不变、建议不代表采用，与主报告“未接入 CI”一致 |

独立验证使用只读 Python；**没有直接运行 `tools/verify-audit.py`**，因为该脚本会重写其他人的 `audit-verification.json`。读取脚本及现有结果后，以内存断言重做清单、哈希、六组/合并一致性、分类及链接校验，结果同样为 392/392、178 行号（当时不含本检查文件的新引用；主会话收尾校验应包含它们）。未宣称再次人工完整阅读 392 个源文件。

## 指定发现与源码链

| 发现 | 判定 / 严重度 | 核实依据与边界 |
| --- | --- | --- |
| PM-01 | 通过；P1 confirmed-bug | `src/lib/ai/responsesStream.ts:165`–`:170` 对 JSON 失败结果的 error.message 做 redact，却原样返回任意字符串 status；`src/lib/agent/runChat.ts:261` 选择 Responses transport，`:286` 传递 finishReason；`src/db/agentRuns.ts:231` 原样持久化。假密钥输入输出中 message 被隐藏而 finishReason 保留密钥。只有远端 status 含密钥才触发；不推断正常状态会泄漏、ZIP 外传或真实供应商曾回显。SSE 范围见下节更正。 |
| PM-02 | 通过；P2 confirmed-bug | `src/lib/ai/openaiCompatible.ts:73`–`:87` 解析失败/缺 data 转成空数组成功；`:113`–`:116` 不检查成功 envelope；`:143` 的 fallback 只检查 HTTP。`src/lib/ai/connectors.ts:148` 接入通用探测。HTML、200 error、404 后 chat error200 均误报成功；合法 `{data:[]}` 成功是正确对照。fallback 不应因任意 protocol 错误扩展为新付费 POST。 |
| PU-01 | 通过；P1 confirmed-bug | `src/components/shots/ShotEditorPage.tsx:607`–`:631` 捕获旧值并使用 Promise.all(patchShot) 撤销；`src/db/repo.ts:1452` 每行独立事务，无 before/after 比较。真实仓库复现 9→0，以及一条恢复 fulfilled、已删兄弟 rejected 后留下部分提交。`src/lib/undo.tsx:40` 先 clear，`:76` 没有异常出口；这是附加恢复影响，不能与 SS-05 再算独立 undo 根因。 |
| PU-02 | 通过；P1 confirmed-bug | `src/components/slots/GenerationSlotCard.tsx:179` 初始化整槽 draft，`:307` 只交 draft；镜头调用点 `src/components/shots/ShotEditorPage.tsx:1717` 等没有 baseline。`src/db/repo.ts:1591` / `:887` 检查存在与媒体归属后直接替换目标槽，保护其他字段不能保护同槽更新。实际 prompt 被旧 draft 覆盖；媒体回收影响通过 recycleSlotMedia/deleteMediaIfOrphan 链核对，但本项 prompt 复现未单独验证每种媒体保留分支。 |
| PU-03 | 通过；P2 confirmed-bug | `src/components/shots/DurationInput.tsx:13` 单参数 persist 丢弃 hook 的 baseline；`src/lib/debouncedDraft.ts:69` 保留脏标量基线，`:237`/`:274` 向 persist 提供基线。真实 controller + repo 复现 external=9 被 pending=2 覆盖。序列化仅管本控制器，不等于跨写者 CAS。 |
| PU-04 | 通过；P2 confirmed-bug | `src/components/shots/ShotEditorPage.tsx:1833`–`:1840` 从同一 render 的 characterIds 构造整数组，菜单保持打开；真实 patchShot 对 []→[A] 与 []→[B] 串行落盘后仅剩 B。证明同一快照窗口，不声称测过点击频率、所有快速点击必现或其他列表已全部复现。 |
| SS-01 | 有条件通过；P1 confirmed-bug | `src/routes/p.$projectId.tsx:10` 无项目挂载 key；`src/components/workspace/WorkspaceChrome.tsx:50` / `:81` 仅检加载/缺失，未比 project.id；home `src/routes/p.$projectId.index.tsx:18` / `:58` 会将新 projectId 与旧 episode.id 组合。安装库 useObservable 保留 result，MatchInner 未配置 remountDeps 时无参数挂载 key，src 没有 remount 配置。已核对报告的两项 SSR 断言；本角色未重跑 SSR 或浏览器 E2E。confirmed-bug 限定为允许输入下的错误渲染/参数构造；设置写回 A 是源码影响链，不能说实际点击写入已复现。 |
| SS-02 | 通过；P1 confirmed-bug | `src/components/assets/AssetTextField.tsx:13` 声明 baseline，但 `src/components/workspace/ProjectSettingsPanel.tsx:81` / `:85` / `:100` 丢弃；`src/db/repo.ts:242` 无 CAS。独立复现 baseline=original、外部=other-tab 后 flushOrThrow 成功覆盖成 my-draft。P1 对应已保存项目创作设定丢失，不能升级为项目全部数据丢失。输出配置同类机制成立，本次运行证明的是 name 单字段。 |
| PD-02 | 通过；P1 confirmed-bug | UI `src/components/shots/ShotEditorPage.tsx:589`–`:602` 在删除前从 render 取旧 shot，再异步取媒体；`src/db/repo.ts:1631` 在事务内校验当前记录，但不返回当前快照；`:1607` 删除当前镜头/回收当前媒体；`:1559` 按旧 snapshot 恢复。独立复现只用公开仓库写操作：删除前新文本/新图片已成功提交；撤销恢复 old text/old-image，new-image 记录消失。该触发不需要异常持久化夹具，因此 confirmed-bug 与 P1 合理。 |
| ARCH-01 | 通过；P2 structural-debt | 独立 AST 从八个实际文件抽取 13 条内部值 import，各节点均可到达全部八个节点；保存的纯值 dependency-cruiser 有 6 条 cycle 违规，均落在同一八文件分量，不含 type-only。没有证据支持初始化崩溃、TDZ 或环导致的当前运行时故障。 |

AR-01 当前报告明确“异常持久化状态复现，普通 UI/合法导入/下载如何形成未证明”，与总索引中的 P2 risk 一致。这个调整合理；本轮只复核分类和描述，不重复其三种异常媒体夹具执行。

## 应更正或明确的口径

1. **PM-01 的 SSE 验证不得与 JSON 泄漏混称。** providers-media 的复现事实限定 JSON，原结论成立。其“JSON 与 SSE terminal 各注入含假密钥 status”回归建议需说明 SSE 的预期：`src/lib/ai/responsesStream.ts:240`–`:242` 只接受三个终止事件并要求 event type 与 status 一致。给 response.failed 注入 `status='failed invalid key sk-audit-fixture'`，实际返回 `Responses 结束事件状态不一致`，无 finishReason，未泄漏。合法 SSE 状态只能是 completed/failed/incomplete；未知状态必须在 finish 之前拒绝。保留 JSON 字段脱敏修复，SSE 用拒绝和整体结果无密钥作为对照，而非声称同一未知状态已通过 SSE。
2. **P1 摘要建议明确“6 项确认 + 1 项风险”。** 当前主报告分类表正确，风险并未改为 confirmed-bug；改写这一句可避免读者仅见 7P1 就把 PU-05 当成已复现故障。SS-01 的旧标题/混合导航是隔离证明，实际跨项目写回仍须浏览器验证；保持模块报告的限度说明。
3. **依赖环只作一个整改对象（主会话已澄清）。** 收尾重读主报告，已明确 ARCH-01 汇总 AR-04/PD-04 同一根因，不增加独立计数；remediation-plan 第 6 组也明确只计一个结构问题。现有机器索引没有额外计 ARCH-01，51 模块发现数本身正确；不要将 18 debt 解读为 18 个互不重叠的根因。

4. **整改计划的两项 ID 映射需补齐。** 只读展开 remediation-plan 中 `PU-01/02/...` 等简写后，49/51 个 finding ID 有明确关联，未显式关联 PD-08、SS-10；两者均为 P3 清理项。建议在第 8/9 组或 E 批次的“未使用出口/CSS”处明确补入这两个 ID。现有 9 组职责方向及 A–E 顺序合理，不需要新增抽象层或新验证阶段，也不需要将这两项升级成故障。

以上是交付描述/回归口径的澄清，未推翻指定发现，没有在其他研究者文件中擅自更正。主报告现已加入 PD-02/SS-01/02 的优先路径，符合本次核实的高影响机制。

## 架构与工具结论

architecture.md 明确目标树只是职责方向、不要求创建全部目录，先拆真实值环，再按业务分解 repo/页面，最后搬目录；不以行数判错，不为 UI 读仓库套通用 service。拆 getOfferedToolNames/toolNamesForCall 纯规则、readGenerationTarget 查询与执行编排，均有实际反向调用边支持。维护唯一跨域导入/删除事务及历史迁移的要求合理，没有过度抽象。落地时先拆这些具体边；不要按示意树一次移动全 src，也不要把准备 Blob 哈希/flush/网络输入编码塞进 DB 写事务。

tool-analysis.md 没有把原始候选直接计成缺陷。本角色从原始 ESLint JSON 重算：368 文件、248 severity2、544 severity1、0 fatal；规则前几项与报告一致。纯值 dependency-cruiser 的进程 exit0 与 summary.error=6 已被区分；Knip 有效含测试/production 结果分别是 3/5 个 unused-file 候选，报告明确 ambient/CSS/测试入口等误报；clone 坐标问题和认知复杂度均只是定位信号。SonarJS 没冒充 SonarQube，SonarQube/Docker 缺口明确。

现有 lint/test/build 的保存命令退出均为 0，本角色读取原始记录和摘要，没有再次运行这些 gate。quality-guidelines 的新增合同正确区分 generated-verified、confirmed/risk/debt、值/类型边、误报及运行工具与接入 CI，未加入新产品行为或CI门禁。

## 实际执行与原始结果

| 命令/方法 | 工具版本 | 退出 / 结果 |
| --- | --- | --- |
| `cat` / `sed` / `nl` / `rg`、git status/diff | 本机工具 | 读取上下文、报告、实际 source/callers 和已安装库；少数猜测路径不存在导致 rg/cat exit2/1，随后使用真实路径，无产品缺失结论 |
| 本机绝对 node 路径，内存执行 provider-repro.cjs | Node v24.11.0 / 项目 TypeScript 5.9.3 | 0；禁用唯一 fs.writeFileSync，不改 results；四个既有 checks 全 true |
| 同一 provider 内存脚本增加对照 | 同上 | 0；JSON key 泄漏成立；SSE 未知状态拒绝；HTML/error200 成功误报；合法空目录成功；404 后 fallback error200 via=chat |
| 内存加载真实 repo/controller 的 ESM 复现 | 同上 / fake-indexeddb | 0；PU 两个撤销用例、槽覆盖、Duration 覆盖、角色数组丢项；SS-02 覆盖；PD-02 新文本/媒体丢失 |
| 复现加载器早期三次尝试 | 同上 | 各 exit1；一次 CommonJS 循环初始化与两次 Node JSON import attribute 缺失。改 ESM 保留循环语义、将 JSON 内容作为同值默认导出后通过；不把加载器异常当产品缺陷 |
| 八文件值边 AST + 原始 cruiser 结果断言 | TypeScript 5.9.3 | 0；8 members / 13 value edges / mutual reachability / 6 cruiser cycle diagnostics |
| Python 内存验证 coverage/hash/index/link/location | Python 3.9.6 | 0；392/392、178 具体位置、51唯一ID、合并账本一致；不写 audit-verification.json |

关键原始输出：

```text
responseMessageRedacted=true
responseFinishReasonLeaksFixtureKey=true
invalidHtmlDiscoveryAccepted=true
invalidHtmlProbeAccepted=true
SSE unknown status: ok=false, message="Responses 结束事件状态不一致", no finishReason
error200: list={ok:true,models:[]}, probe={ok:true,via:"models"}
valid empty: {ok:true,models:[]}
fallback error200: {ok:true,via:"chat"}
PU-01 newer=9 -> undone=0
PU-01 inverse statuses=fulfilled,rejected
PU-02 newer-agent-edit -> stale-dialog-edit
PU-03 external=9 -> pending-draft=2
PU-04 two choices -> only second retained
SS-02 other-tab -> my-draft; baseline=original; flushOrThrow resolved
PD-02 restoredContent=old text, restoredMedia=old-image, newMediaExists=false
ARCH-01 members=8, internalValueEdges=13, each reaches all 8
coverage=392, reviewed=389, generated-verified=3, hash mismatch=0
findings=51, confirmed=24, debt=18, risk=9, P1 confirmed=6/risk=1
```

Provider 复跑的实际命令形式：从项目根执行下列只读 wrapper，不直接运行会写 results 的 cjs：

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node <<'JS'
const fs=require('node:fs');
const source=fs.readFileSync('.trellis/tasks/09-30-src-quality-architecture-audit/research/tools/provider-repro.cjs','utf8');
const writer="fs.writeFileSync(dest,JSON.stringify(output,null,2)+'\\n');";
if(source.split(writer).length!==2)throw new Error('Unexpected output writer');
new Function('require','process',source.replace(writer,'/* no output-file writing */'))(require,process);
JS
```

## 限度

本轮是交付复核而非第二次完整源码审查：新增组仅核验指定发现及最终覆盖/索引。没有真实浏览器 E2E、跨标签页操作频率、真实付费 API、浏览器 IndexedDB、媒体解码或网络性能测量。内存 fake-indexeddb 使用独立进程内的库，未触碰用户浏览器数据库；只读复现证明具体控制流与仓库行为，不证明实际用户已遭遇故障。178 行号校验不覆盖所有简写 `:行号` 或范围引用的语义；独立源码链复核覆盖上表指定发现。未量化拆环性能收益，也没有将 AR-01/PU-05 等风险提升成事故。

最终 src 内容与固定清单一致；规范的已有 21 行变更由主会话提供并保留，本角色没有编辑。任务产物保持未提交，产品修复另行安排。
