# 实施计划：模型库迁移到 Models.dev

## 前置条件

- 任务保持 `planning`，等待用户批准最终计划后才能 `task.py start`。
- 分支：当前分支 `codex/agent-experience-overhaul` 尚未合并到 `main`；实现前须由用户决定从哪里新建分支（见任务 `10-13-ui-error-handling` 同一注记）。两个任务互相独立，但若同时推进，应使用各自分支，避免 `main.tsx`、`connectors` 页面的相互冲突。
- 命令使用本地 Node：`PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH`，显式调用 `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`。**安装 `@opencode-ai/models` 需要联网，安装前须告知用户并确认。**
- 派发子代理时，提示词首行为 `Active task: .trellis/tasks/10-13-models-dev-catalog`。
- `state-management.md`、`shared-product-storage.md` 较大，实施/检查代理须显式读取相关小节，不能只靠被截断的注入。

## 有序清单

### 阶段 1：数据层与匹配（R1、R2、R4、R6）
1. 安装 `@opencode-ai/models`（用户已于 2026-10-13 批准；精确版本，devDependency；须在上一批 `deviceSettings` 提交之后再装，避免干扰其门禁）；核对其 `./snapshot` 的真实字段与"是否基于 `type=all`"，把"未验证项"变成实测结论写入任务。
2. `scripts/models-dev-baseline.mjs`（生成/校验）、`package.json` 的 `models-dev:baseline`、`models-dev:verify`；生成并提交 `baseline.generated.json`，实测压缩后体积，校准"常用范围"。
3. **新增 `deviceSettings` 表（单独提交）**：`schema.json`/`schema.ts`（逐字等价）、`tableTypes.ts`、`browserDatabase.ts` `version(25)`、`nativeOwnerAssertions.json`；把三处写死 49 的断言（`tests/helpers/sharedStorageCases.ts:15`、`registry.rs:38`、`full_product_store/tests.rs:122`）改为由 `schema.json` 推导（无法安全推导的保留并记录）；`src/db/deviceSettings.ts`。**先告知用户：升级后本机旧原生开发工作区需重建，建议先导出项目备份。** 跑 shared-storage 与 native parity 测试。
3b. `src/lib/ai/modelCatalog/`：`types.ts`、`store.ts`（`initModelCatalog`、内存快照、订阅）、`connectorProviders.ts`、`match.ts`（分层匹配与冲突合并）、`cost.ts`（`estimateRunCost`）、`storage.ts`（经 `deviceSettings` 读写、校验、体积上限、读取失败与损坏回退基线）。
4. 迁移五个消费者到新 API，保持事务内同步读取与事务前异步解析的顺序；`AgentRun.modelPricing` 在 `beginAgentRun` 写入；`AgentVisionCapability.source` 新增 `"models-dev"`。
5. 测试：匹配分层（同 provider/原厂/canonical/未知、`apimart` 与改 baseUrl 的 `openai-compatible`）、冲突合并、价格层级与"官方参考价"、`estimateRunCost`（缓存读写、缺失）、`storage`（损坏、超限、版本不符、读取失败回退基线）、`initModelCatalog` 空窗期查询、旧 `"model-bank"` 记录读取。运行 lint、定向测试、quality。

### 阶段 2：网络与界面（R3、R5）
6. 网络放行：`runtimeHttpPolicy.ts` 新增 purpose、`runtimeFetch.ts` 分派、体积/超时常量；测试：放行、拒绝其他路径/方法/鉴权头、体积超限、重定向复检、`AbortSignal`。**另加回归测试证明"用户配置的连接"路径不变**：openai-compatible 的 `https`、`http`、本机与局域网地址被已配置 origin 放行，未配置 origin 仍被拒，流式响应与取消、重定向每一跳复检仍成立（既有 `tests/runtimeFetch.test.ts` 相关断言保持不变，不得放宽）。更新 `native-product-runtime.md`。
7. `modelCatalog/sync.ts`：请求、zod 校验（条目级容错）、投影、写入、失败回退、取消；测试同步成功/失败/超大/格式不符/取消。
8. 界面：`/connectors` 「模型目录」导航与三个组件（同步卡片、选择对话框、只读定价表）、选择清单存储、虚拟化或分页；`ModelSelectTrigger` 详情栏价格行与文案改名。沿用项目现有 UI 规范，不新增依赖。测试：选择对话框（搜索、供应商筛选、全选/清空、已选数量、归一化合并）、价格显示与"价格未知"、来源文案。
9. 运行 lint、定向测试、全量测试、quality。

### 阶段 3：退役与清理（R7）
10. 删除 `vendor/lobehub`、`scripts/model-bank-snapshot.mjs`、`src/lib/ai/modelBank/`、`model-bank:*` 脚本、`ghcr.yml:44-45`、`knip.json:5` 条目；重写 `tests/modelBank.test.ts`、更新 `tests/agentReferences.test.ts:60-62` 与其他断言 LobeHub 行为的测试，**不得放宽无关断言**；更新 README 与 `ai-connectors.md` 等规范。
11. 全量门禁：`pnpm lint`、`test`、`quality`、`quality:self-test`、`models-dev:verify`、`build`、`pnpm --dir desktop/tauri types|lint|quality`。
12. 独立检查（trellis-check）：重点核对网络策略只新增一项且用户配置的连接路径不变、`deviceSettings` 的读写校验与回退、匹配价格层级、事务内同步读取、旧记录兼容。
13. 规范同步：`ai-connectors.md`、`native-product-runtime.md`、`directory-structure.md`、`quality-guidelines.md`。
14. **真实窗口检查（A10，需用户）**：浏览器与桌面各一次——联网同步成功与失败、取消、选择对话框性能、价格显示、离线回退、**打包版是否真能请求到 models.dev**。
15. 收尾：记录实际结果与限制；按阶段提交；经 Trellis 归档与 journal。不推送、不发布。

## 验证命令

```sh
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run <定向测试>
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm quality:self-test
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm models-dev:verify
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm build
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri types
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri lint
PATH=/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin:$PATH /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm --dir desktop/tauri quality
```

计划命令，尚未执行。

## 风险文件与检查点

- `src/lib/runtimeHttpPolicy.ts` / `runtimeFetch.ts`：网络放行；改动后单独提交并跑策略测试，是安全边界。
- `src/db/agentRuns.ts`：事务内同步读取 + 事务前异步解析的顺序不可破坏；改动前后都跑 `agentRuns` 相关测试。
- `schema.json` / `browserDatabase.ts` / 三处表数量断言：新增表是本任务唯一的 schema 变更，**单独提交**并先跑 shared-storage 与 native parity 测试；`modelCatalog/storage.ts` 在读取失败、损坏、超限、版本不符时必须回退基线而不抛错。
- 匹配规则：价格层级错误会展示错误价格，是用户可感知的风险，测试要含反例（跨 provider 冲突不出价）。
- 退役清理：最后做；删文件前先 grep 全部引用；`knip`/`quality` 会暴露遗漏。

## 回滚

三阶段独立提交，任一阶段可回退；`deviceSettings` 表的新增单独成一个提交，回滚它会使在新 schema 下创建的原生工作区无法被旧 schema 打开，所以该提交须在真实窗口验证后再继续后续阶段。
