from pathlib import Path
from hashlib import sha256
import json,subprocess
root=Path.cwd();task=root/'.trellis/tasks/10-09-src-remediation-e';parent=root/'.trellis/tasks/09-30-src-quality-remediation';h=lambda p:sha256(p.read_bytes()).hexdigest()
source=task/'reviews/E-final-check.json';transport=task/'reviews/E-evidence-transport-check.json';assert source.exists() and transport.exists(),'Completed independent source and transport reports required'
proposal=json.loads((task/'research/E-commit-grouping-proposal-chinese.json').read_text());groups=proposal['groups'];head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();assert head==proposal['HEAD']
for group in groups[:2]:
 for row in group['paths']:
  p=root/row['path'];assert (h(p) if p.is_file() else None)==row['currentSHA256'],row['path']
tracked=subprocess.check_output(['git','diff','--name-only','HEAD'],text=True).splitlines();untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines();dirty=set(tracked+untracked);normal=set();plan=task/'commit-plan.json';md=task/'commit-plan.md'
normal.update(k for k in dirty if k.startswith('.trellis/spec/') or k.startswith(str(parent.relative_to(root))+'/'))
# Only curated present-day task roots, direct review reports and owned tools are
# normal files. Full source snapshots/builds/native body/image evidence remain
# exact manifest-backed gzip blobs; originals are retained in the local task.
for folder in [task,task/'research',task/'reviews',task/'tools']:
 for p in folder.iterdir():
  if p.is_file() and (p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs'] or p.name=='.gitignore') and p.stat().st_size<=4_000_000:normal.add(str(p.relative_to(root)))
lateReview=task/'reviews/E-evidence-transport-independent'
if lateReview.exists():
 normal.update(str(p.relative_to(root)) for p in lateReview.rglob('*') if p.is_file() and p.suffix in ['.md','.json','.py','.log'] and p.stat().st_size<=4_000_000)
pack=task/'evidence-pack';assert (pack/'manifest.json').exists() and (pack/'blobs.json').exists()
normal.update(str(p.relative_to(root)) for p in pack.rglob('*') if p.is_file());normal.update([str(plan.relative_to(root)),str(md.relative_to(root))])
product={row['path'] for group in groups[:2] for row in group['paths']};assert not (product&normal)
paths=sorted(normal);groups[2]['paths']=[{'path':k,'currentSHA256':None if k in [str(plan.relative_to(root)),str(md.relative_to(root))] else h(root/k),'kind':'modified' if k in tracked else 'new','selfHashPolicy':'Plan files excluded from own hash; final independent exactplan review receipt supplies their hashes.'} if k in [str(plan.relative_to(root)),str(md.relative_to(root))] else {'path':k,'currentSHA256':h(root/k),'kind':'modified' if k in tracked else 'new'} for k in paths];groups[2]['count']=len(paths)
manifest=json.loads((pack/'manifest.json').read_text());represented={row['path'] for row in manifest['files']};outside=sorted(dirty-product-normal);rawRepresented=[k for k in outside if k in represented];excluded=[k for k in outside if k not in represented]
# Truly installed and Python runtime cache bytes have no proof assertion. Any
# new late owned raw report absent from the pack is a blocker until classified.
unknown=[k for k in excluded if not any(part in ['node_modules','__pycache__'] for part in Path(k).parts)]
assert not unknown,unknown[:20]
result={'status':'READY_FOR_ONE_HUMAN_CONFIRMATION_NOT_APPROVED','baselineRevision':head,'sourceReport':{'path':str(source.relative_to(root)),'sha256':h(source)},'transportReport':{'path':str(transport.relative_to(root)),'sha256':h(transport)},'transportManifest':{'path':str((pack/'manifest.json').relative_to(root)),'sha256':h(pack/'manifest.json'),'rawPaths':manifest['fileCount'],'bytes':manifest['originalBytes'],'uniqueBlobs':manifest['uniqueBlobs']},'groups':groups,'outsideDirectStaging':{'manifestRepresentedRawEvidence':rawRepresented,'installedOrPythonRuntimeCaches':excluded,'unrecognizedDirtyPaths':unknown},'all244ProductPathsCovered':len(product)==244,'noPriorStagingCommitPushArchive':True,'execution':'On one explicit human confirmation, stage only exact group paths and commit sequentially, no amend/push. Deletions use git add exact retired path. Raw evidence remains locally accessible and restores frompack. Archive/journal remain later bookkeeping.'}
plan.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
lines=['# E批具体提交计划','', '整批源码与证据保存已独立验收，等待一次人类确认；尚未暂存、提交、推送或归档。','',f'起点：`{head}`。全部244个产品/配置/测试/工具路径被以下两组覆盖，规范及证据单列。','']
for group in groups:
 lines.extend([f"## {group['number']}. {group['title']}",'',f"{group['count']}个文件。{group['reason']}",''])
 if group['number']<3:lines.extend('- '+row['path'] for row in group['paths'])
 else:
  lines.extend(['- 更新的英文规范、父任务台账与任务文档。','- 所有直接可读的最终审查报告、研究契约和证据保存/还原工具。',f"- 无损去重证据包：{manifest['fileCount']}个原始路径，{manifest['uniqueBlobs']}个SHA256内容块；逐文件完整清单和哈希见commit-plan.json。",'- 安装依赖及Python缓存不进入提交；本地原始证据保留，重复的大型证据通过清单完整还原。'])
 lines.append('')
lines.extend(['未识别用户WIP：无。原始未直接暂存的证据路径均在无损包清单内；所有依赖/缓存排除均显式列在JSON。','', '回复ok/行，执行以上三笔顺序本地工作提交；不推送。归档与journal另行收尾。',''])
md.write_text('\n'.join(lines));print('Concretegroupcounts',[(g['number'],g['count']) for g in groups]);print('nonstagedrawrepresented',len(rawRepresented),'runtimecaches',len(excluded),'unknown',len(unknown))
