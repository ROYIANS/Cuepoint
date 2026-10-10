# -*- coding: utf-8 -*-
from pathlib import Path
from collections import Counter
import json,re,sys
research=Path(__file__).resolve().parents[1]
task=research.parent
manifest=json.loads((research/'source-manifest.json').read_text())
missing=[name for group in manifest['groups'] for name in [group+'.md',group+'-coverage.json'] if not (research/name).exists()]
if missing:
 print('Not assembling incomplete audit:',missing);sys.exit(1)
files=[];findings=[];groups=[]
labels={'agent-runtime':'Agent 执行与工具机制','persistence-domain':'数据与领域规则','agent-ui':'Agent 与记忆 UI','production-ui':'创作 UI','providers-media':'模型、媒体、音频与参考接入','shell-shared':'路由、壳与共享能力'}
eslint={Path(r['filePath']).as_posix() for r in json.loads((research/'tools/eslint-results.json').read_text())}
ast={r['file'] for r in json.loads((research/'tools/ast-results.json').read_text())['metrics']}
root=Path(__file__).resolve().parents[5]
for group,entries in manifest['groups'].items():
 coverage=json.loads((research/(group+'-coverage.json')).read_text());by_path={e['path']:e for e in entries}
 for entry in coverage:
  original=by_path[entry['path']]
  files.append({**entry,'group':group,'lines':original['lines'],'sha256':original['sha256'],'toolCoverage':{'typescriptAst':'analyzed' if entry['path'] in ast else 'not-applicable','eslint':'analyzed' if (root/entry['path']).as_posix() in eslint else 'generated-excluded' if entry['path']=='src/routeTree.gen.ts' else 'not-applicable'}})
 text=(research/(group+'.md')).read_text()
 matches=list(re.finditer(r'^#{2,4}\s+(?:\*\*)?((?:AR|PD|AU|PU|PM|SS)-\d+)\b([^\n]*)',text,re.M))
 for i,m in enumerate(matches):
  body=text[m.start():matches[i+1].start() if i+1<len(matches) else len(text)]
  lead=body[:900]
  row=next((line for line in text.splitlines() if re.match(r'^\|\s*'+re.escape(m.group(1))+r'\s*\|',line)),lead)
  priority=re.search(r'\bP[0-3]\b',row)
  classification=re.search(r'\b(confirmed-bug|structural-debt|risk)\b',row)
  title=m.group(2).strip(' —–:：-*')
  title=re.sub(r'^P[0-3]\s*/\s*(?:confirmed-bug|structural-debt|risk)\s*[:：—-]\s*','',title)
  locations=list(dict.fromkeys(re.findall(r'(?<![A-Za-z0-9_/@.-])src/[A-Za-z0-9_./$-]+\.(?:tsx?|css|json):\d+',body)))
  findings.append({'id':m.group(1),'priority':priority.group() if priority else 'unclassified','classification':classification.group() if classification else 'unclassified','title':title,'group':group,'report':f'research/{group}.md','locations':locations})
 groups.append({'group':group,'label':labels[group],'files':len(coverage),'statuses':dict(Counter(e['status'] for e in coverage)),'report':f'research/{group}.md'})
summary={'baseRevision':manifest['baseRevision'],'fileCount':len(files),'statuses':dict(Counter(e['status'] for e in files)),'groups':groups,'moduleFindings':len(findings),'classificationCounts':dict(Counter(f['classification'] for f in findings)),'priorityCounts':dict(Counter(f['priority'] for f in findings)),'duplicateRootCauseNote':'Module findings can share root causes; counts are not independent bugs and raw tool diagnostics are excluded.'}
(research/'coverage.json').write_text(json.dumps({'summary':summary,'files':files},ensure_ascii=False,indent=2)+'\n')
(research/'findings.json').write_text(json.dumps({'summary':summary,'findings':findings},ensure_ascii=False,indent=2)+'\n')
coverage_md=['# src 审查覆盖清单','',f"基准：`{manifest['baseRevision']}`。{len(files)} 个跟踪文件；状态统计：`{summary['statuses']}`。普通文件逐文件阅读；生成文件验证来源/生成链。工具覆盖与阅读覆盖分别登记，CSS/JSON没有ESLint结果不表示阅读遗漏。",'']
for group in groups:
 coverage_md.extend([f"## {group['label']}",'','| 文件 | 阅读状态 | 结论 / 发现 |','|---|---|---|'])
 for f in files:
  if f['group']==group['group']:
   note=f['note'].replace('\n',' ').replace('|','/');ids=', '.join(f['findings']) or '未登记独立发现'
   coverage_md.append(f"| `{f['path']}` | {f['status']} | {note}；{ids} |")
 coverage_md.append('')
(research/'coverage.md').write_text('\n'.join(coverage_md)+'\n')
report=['# src 全量代码质量与架构审查','',f"审查日期：2026-09-30；基准提交：`{manifest['baseRevision']}`。",'',
'## 结论与范围','',
'主要结构问题是业务职责横跨技术目录、执行编排与持久化相互调用、部分UI自行持有数据修改/逆操作协议。修复应先恢复业务边界和数据一致性，再迁移目录；单纯改名、减少文件行数或加策略层不足以解决。','',
f"范围内 {len(files)} 个 src 跟踪文件均有覆盖记录：{summary['statuses'].get('reviewed',0)}个普通文件阅读、{summary['statuses'].get('generated-verified',0)}个生成文件验证。389 个 TS/TSX/CSS 代码文件（含1个生成路由），2份生成模型JSON，1份生成链README。vendor不纳入人工审查；tests仅作为行为证据和回归基线。非生成代码完整阅读，生成JSON用结构与精确再生成验证，不宣称人工逐行阅读。",'',
f"共登记 {len(findings)} 项模块级发现：{summary['classificationCounts'].get('confirmed-bug',0)}项确认缺陷、{summary['classificationCounts'].get('structural-debt',0)}项结构债务、{summary['classificationCounts'].get('risk',0)}项待验证风险；P1 {summary['priorityCounts'].get('P1',0)}项、P2 {summary['priorityCounts'].get('P2',0)}项、P3 {summary['priorityCounts'].get('P3',0)}项。P1中6项是确认缺陷、1项是待验证风险（PU-05）。不同模块发现可能共享根因，不把这些数量当作互不相关的缺陷数。ARCH-01是AR-04与PD-04的跨模块汇总，指向同一个8文件依赖环，不增加独立问题计数。原始工具告警不计入已确认发现。",'',
'## 优先处理的已确认路径','',
'1. **批量撤销和编辑覆盖**：PU-01/02/03/04。逆操作携带before/after基线，在同一事务内先验证全部目标；槽、单字段和集合编辑使用各自真实意图，保留冲突草稿。',
'2. **诊断字段与远端协议**：PM-01/02/03/04/06。所有会持久化的错误字段都需脱敏/限定；拒绝成功HTTP中的坏协议；音乐任务ID在提交、查询和保存边界保持一致，不以重发付费POST修复恢复失败。',
'3. **8文件值循环与职责交叉**：ARCH-01。先拆工具策略纯逻辑、目标读取和任务证据，再分解综合repo和页面。',
'4. **删除、项目身份与设定**：PD-02、SS-01/02。删除快照必须对应实际删除时刻；query结果与当前project/episode身份匹配；项目文字编辑传递字段baseline。其余按下表触发条件落实，风险项保留验证限度。','',
'## 覆盖与模块报告','',
'| 模块 | 文件数 | 状态 | 详细报告 |','|---|---:|---|---|']
for g in groups:report.append(f"| {g['label']} | {g['files']} | 阅读 {g['statuses'].get('reviewed',0)} / 生成验证 {g['statuses'].get('generated-verified',0)} | [{g['group']}]({g['report']}) |")
report.extend(['','[完整逐文件清单](research/coverage.md) · [机器可读覆盖](research/coverage.json) · [问题索引](research/findings.json)','',
'## 所有模块级发现索引','',
'每项详细报告包含位置、触发机制、影响、建议及验证方式。confirmed-bug基于源码/隔离输入的证明，不表示全部异常已在真实用户环境或付费供应商上发生；risk保留未验证限度。','',
'| ID | 优先级 | 分类 | 结论 | 证据报告 |','|---|---|---|---|---|'])
for f in findings:report.append(f"| {f['id']} | {f['priority']} | {f['classification']} | {f['title'].replace('|','/')} | [{f['group']}]({f['report']}) |")
report.extend(['','## 目录与依赖整改','',
'[根因整改计划](research/remediation-plan.md)将51项发现归组并安排A–E批次；[架构报告](research/architecture.md)包含现状职责、8文件依赖环、目标结构和迁移顺序。重点归属为Agent核心及业务工具适配器、项目/故事分镜/资产/素材、音频/音乐、记忆/参考、项目传输、共享UI和基础设施。保留TanStack文件路由与集中Dexie schema；不要把全部UI读repository判为违规，也不要为一次调用添加工厂/注册系统。','',
'建议顺序：确认行为缺陷与回归 → 拆值循环中的规则/读取边界 → 按业务分解repo → 拆页面控制/视图/业务操作 → 按职责迁移目录和移除已确认遗留出口。冻结快照、所有权、审批账本、CAS、短事务和跨域原子删除/导入必须逐步验证。','',
'## 工具与现有质量基线','',
'[工具分析](research/tool-analysis.md)记录版本、配置、原始结果、误报及重跑修正。实际使用TypeScript AST、类型感知ESLint、React Hooks规则、SonarJS、dependency-cruiser、Knip及jscpd。ESLint在368个非生成TS文件给出248 error/544 warning，0解析失败；这是本次规则集的诊断等级，不是业务缺陷数量。','',
'类型检查、125文件/1559测试及生产构建通过。构建有大chunk告警，未测实际设备/网络加载时延。Docker服务未运行，因此**没有SonarQube服务端扫描**；本地SonarJS不能冒充完整Sonar质量门。分析依赖只安装在独立临时目录，产品依赖未通过安装命令变更。','',
'现有lint只执行tsc；ESLint、Knip、依赖规则本轮只用于审查，**尚未接入CI**。建议先建立已核验债务基线，禁止新增同类问题，随后逐步清除基线，不一次把全部原始警告设为阻断。','',
'## 用户示例与误报处理','',
'记忆信封的source白名单是必要的数据边界，不建议直接删除。嵌套条件可用提前返回及穷尽分支表达；外层展开的将来字段增长属于契约风险，不宣称当前已经泄露数据。','',
'ambient mammoth声明、CSS依赖、普通业务useX命名、不同业务的相同CRUD形状和生成数据大文件均已核实，未仅凭工具名字判错。工具发现仅被测试使用的实现，需要判断删除还是接入，不把测试专用导出全删。','',
'## 验证及交付状态','',
'见 [覆盖/内容/位置校验](research/audit-verification.json) 与[独立复核](research/check-final.md)。指定高优先级机制复核通过；PM-01已明确JSON泄漏与SSE拒绝未知状态的不同路径，SS-01未宣称实际跨项目点击写入已做浏览器复现。检查所有文件只出现一次、没有blocked、源码哈希与基准一致、具体报告位置有效。Vite构建重新生成routeTree的格式变化经3995个非trivia token一致校验后恢复基准，见research/tools/route-regeneration.json。','',
'本轮修改仅限审查任务产物和质量规范中的审查证据合同；未实施产品修复、未改动src最终内容、未提交或推送。所有建议属于后续整改，不代表现有缺陷已消除。浏览器时序、麦克风/WebAudio/PDF和真实付费API的验证限度分别保留在模块报告中。',''])
(task/'audit-report.md').write_text('\n'.join(report)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
if any(f['classification']=='unclassified' or f['priority']=='unclassified' for f in findings):
 print('UNCLASSIFIED',[(f['id'],f['title']) for f in findings if f['classification']=='unclassified' or f['priority']=='unclassified']);sys.exit(1)
