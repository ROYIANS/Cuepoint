from pathlib import Path
import json,hashlib
root=Path.cwd();t=root/'.trellis/tasks/10-09-src-remediation-e';r=t/'reviews';h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda n:json.loads((r/n).read_text())
packet=read('E07-final-review-input.json');maps={}
def add(k,report,expected,detail):
 maps.setdefault(k,[]).append({'report':str((r/report).relative_to(root)),'reportSHA256':h(r/report),'reviewedSHA256':expected,'matchesFinal':expected==packet['after'].get(k),'assessment':detail})
for row in read('E07-coercion-sidecar-check.json')['sources']:add(row['path'],'E07-coercion-sidecar-check.json',row['afterSha256'],'Exact legacy conversion/source contracts independently checked')
b=read('E07-typed-sidecar-check.json');inputs={f['path']:f['reviewFinalSHA256'] for f in json.loads((root/b['finalInputs']).read_text())['files']}
for row in b['coverage']:add(row['path'],'E07-typed-sidecar-check.json',row['reviewFinalSHA256'],row['note'])
for k in packet['changedFiles']:
 if k.startswith('tests/e07TypedBoundaries'):add(k,'E07-typed-sidecar-check.json',inputs[k],'Typed-boundary regression independently rerun and frozen')
for row in read('E07-hooks-sidecar-check.json')['sourceCoverage']:add(row['file'],'E07-hooks-sidecar-check.json',row['checkFinalSha256'],row.get('reason','Hook contract/current typed predicates independently inspected'))
c=read('E07-hooks-sidecar-followup.json')
for row in c['newFileCoverage']:add(row['file'],'E07-hooks-sidecar-followup.json',row['sha256'],row['reason'])
add('src/lib/debouncedDraft.ts','E07-hooks-sidecar-followup.json',c['currentHookSha256'],'Actual primitive/memo red-green rebase regression; guarded every-render fix independently accepted')
for row in read('E07-coordinator-sidecar-check.json')['coverage']:
 if row['category']=='independently-reviewed-main':add(row['path'],'E07-coordinator-sidecar-check.json',row['after']['sha256'] if row.get('after') else None,row['reviewConclusion'])
 if row['category']=='excluded-gate-producer-review':add(row['path'],'E07-gate-sidecar-check.json',None,'Initial producer review plus concrete defect followups; final correction check pending. No current hash acceptance claimed.')
rows=[{'path':k,'before':packet['before'][k],'after':packet['after'][k],'independentAssessments':maps.get(k,[])} for k in packet['changedFiles']]
missing=[row['path'] for row in rows if not row['independentAssessments']];assert not missing,missing
pending=[row['path'] for row in rows if not any(a['matchesFinal'] for a in row['independentAssessments'])]
p=t/'research/E07-final-independent-coverage-adoption.json';assert not p.exists();p.write_text(json.dumps({'purpose':'Actual completed independent per-file coverage attribution. Gate final producer and wholeintegration remain required; no automatic acceptance.','paths':len(rows),'sourcePaths':packet['changedSourceCount'],'uncovered':missing,'reviewedEarlierHashesNeedingFinalEvolution':pending,'rows':rows},indent=2)+'\n');print('155 paths covered; final evolution needs',pending)
