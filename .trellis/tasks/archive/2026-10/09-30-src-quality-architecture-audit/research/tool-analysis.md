# 工具分析、基线与局限

日期：2026-09-30；基准：`2fc0e9523e62a5258a488cc3d0274d24c8967c6f`。
所有扫描本地运行，分析工具安装在独立临时目录，产品package.json、lockfile和node_modules未通过安装命令变更。命令一律使用本机显式pnpm路径，不使用Codex Runtime pnpm。

## 实际执行结果

| 工具/检查 | 配置与版本 | 结果 | 解读 |
|---|---|---|---|
| TypeScript AST | 项目TS解析器；369个TS/TSX文件，含生成路由 | 0解析失败；2178条内部/外部导入、重导出及字面量动态导入边；一个8文件值强连通分量 | 类型边与值边分开；不解析运行时计算路径，不证明行为正确 |
| 类型感知ESLint | ESLint9.39.5 / typescript-eslint8.71.0 / TypeScript5.9.2；368个TS/TSX文件，排除生成路由 | 248 error +544 warning；0 fatal | 本次审查规则的等级，不等于业务严重程度或缺陷数量；不含CSS/JSON |
| React规则 | eslint-plugin-react-hooks7.1.1 | 7条hooks命名相关告警，18条Effect依赖告警 | `useMaterialInProject`等可能是普通业务函数；要核实实际调用的React Hook，不能把名字匹配当运行时违规 |
| SonarJS | eslint-plugin-sonarjs3.0.7，认知复杂度阈值20 | 92条认知复杂度告警 | 这是本地规则集，不是SonarQube服务端分析，也不包含完整安全热点/质量门/覆盖率 |
| dependency-cruiser |17.4.3，TS别名配置；另跑移除类型边的版本|值图391模块/1419边，6条cycle告警，组成同一个8文件环| JSON reporter进程exit0不代表无违规；应读summary.error=6；含类型图的原始告警另存，不能混计 |
| Knip |5.88.1，显式路由/入口/别名，分别含tests和production| 含测试：3个unused-file候选，86个导出、71个类型候选；生产：5个文件、137导出、79类型候选 | 这些是候选；生成入口、ambient declaration、CSS依赖、测试专用导出及已规划功能都要人工核实 |
| jscpd |4.3.0，minLines10/minTokens80，weak模式，排除生成文件 | 原始5个exact clone候选；354个唯一文件被token化 | TSX可能多格式重复计数，source=490不是490个物理文件；短文件低于阈值不计入；一条TSX记录end<start，舍弃坐标，不能使用原始百分比证明仓库无重复业务规则 |
| model-bank:verify |现有项目脚本|197个供应源文件、85providers、1855models，精确生成结果验证通过|只验证生成链与输出一致，不做vendor逐文件审查，不评估每条模型事实的新旧 |
| pnpm lint |项目现有tsc -b |通过|并未执行ESLint|
| pnpm test |Vitest5.0.1 |125文件/1559测试通过|测试未逐文件审查，不等于确认所有业务边界正确|
| pnpm build |现有Vite生产构建 |通过，存在大chunk告警| _studio.agent约1624KB、MessageList约3674KB、ModelIconCatalog约3034KB，gzip约520/957/580KB；未做网络/设备实际延迟测试 |
| SonarQube服务端 |本机docker info探测 |未运行：Docker daemon socket不存在 |明确工具缺口，本轮未启动服务或上传到云端；采用以上本地分析和代码阅读 |

## 原始告警分布

ESLint：no-nested-ternary305、complexity126、sonarjs/cognitive-complexity92、no-base-to-string77、no-unsafe-member-access54、no-unnecessary-type-assertion49、exhaustive-deps18，其余见`tools/eslint-results.json`。阈值是审查筛选规则，不能通过抽出无意义函数“刷分”获得合理结构。

AST另外索引46处any关键词、461处类型断言、208处非空断言、450个含嵌套条件的表达式节点、18个空catch、8处动态import。语法计数与ESLint按父节点告警计数不同；类型断言、catch或三元表达式本身不是缺陷。

## 误报与运行修正

- Knip首次production运行没有给entry/project加生产入口标记`!`，结果失效并被修正运行替代。有效结果是`knip-production-stdout.txt`，首次运行记录是`knip-production-initial-run.json`。
- jscpd首次以配置目录为路径基准查找src失败，改用绝对源码路径后成功；初次输出保留，不作为结果。
- dependency-cruiser开启tsPreCompilationDeps的图包含类型导入，cycle规则只过滤首边仍可能显示含类型路径。结论以`dependency-cruiser-values-stdout.txt`与AST纯值图相互核实。
- `mammoth.d.ts`是环境模块声明，不因为Knip没有普通import边就删除；CSS中的`tw-animate-css`及Tailwind接入也不能按依赖候选删除。
- 短源码没有token clone不表示未读；人工覆盖以独立覆盖清单为准。

## 建议的持续质量门禁（尚未接入CI）

独立安装时registry对ESLint9.39.5输出deprecated提示。本轮保留该版本用于已验证的规则包兼容和结果复现，不把它推荐为未来CI的长期版本；接入时需另行选择仍受支持的版本并验证插件/项目TypeScript兼容。实际项目运行的TypeScript是5.9.3，独立工具使用5.9.2，二者版本分别记录，不能混称同一个执行环境。

1. 保留类型、测试和构建检查，新增类型感知ESLint；错误选择以不安全边界、Promise与实际Hook规则为主，复杂度/嵌套三元先以改动不增加债务为门禁。
2. 用dependency-cruiser的纯值图禁止新增环，将当前8文件环列入待修基线；修复后删除豁免，不用永久ignore掩盖新回归。
3. Knip核验候选后建立显式入口和必要豁免。无引用的业务功能先作删除/接入决策，测试专用type/export不能按生产扫描直接删。
4. 对权限、所属、版本CAS、任务完成证据、生成结果应用等业务规则建立明确所有者；对真实边界写行为测试。jscpd只做查找线索，不能作为唯一重复实现门禁。
5. SonarQube可后续在本地/团队服务接入完整扫描，测试覆盖率由测试工具生成后导入。当前报告不冒充已有Sonar质量门。

## 复现材料

`tools/tool-versions.json`固定实际版本；`tools/analysis-package.json`和`analysis-pnpm-lock.yaml`提供独立工具依赖快照；`eslint.config.mjs`、`knip*.json`、`dependency-cruiser*.json`、`jscpd.json`提供规则；所有`*-run.json`保存完整命令、退出码和耗时，stdout/stderr单独存放。临时目录路径保存在`runtime-path.txt`，如目录被系统清理，应在新的独立目录重建工具，调整命令中的工具路径与ESLint tsconfigRootDir，不在产品根目录安装分析依赖。

## 官方资料

- typescript-eslint类型感知配置：https://typescript-eslint.io/getting-started/typed-linting/
- Knip入口和配置：https://knip.dev/reference/configuration
- dependency-cruiser选项：https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md
- jscpd v4参数与报告：https://github.com/kucherenko/jscpd/blob/master/README-v4.md
- SonarQube本地运行：https://docs.sonarsource.com/sonarqube-community-build/try-out-sonarqube

这些资料用于配置核对；工具实际能力和结论以上述保存的版本、执行结果与人工验证为准。
