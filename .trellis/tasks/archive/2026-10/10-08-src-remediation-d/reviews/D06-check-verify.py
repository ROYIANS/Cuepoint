import json,hashlib,pathlib,datetime,collections,re
root=pathlib.Path('.');task=pathlib.Path('.trellis/tasks/10-08-src-remediation-d')
load=lambda f:json.loads(pathlib.Path(f).read_text())
h=lambda f:hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest() if pathlib.Path(f).is_file() else None
writer=load(task/'reviews/D06-implement-snapshot.json');entry=load(task/'tools/d06/entry.json');check=load(task/'reviews/D06-check-entry.json');freeze=load(task/'reviews/D06-product-freeze.json');script=load(task/'reviews/D06-check-script-freeze.json')
allowed={r['path']:r['after'] for r in script['scripts']}
assert len(writer['scopePaths'])==len(writer['after'])==711
assert not check['writerAfterMismatches']
current={f:h(f) for f in writer['scopePaths']}
errors=[]
def verify_map(name,mapping):
 bad=[{'path':f,'expected':v,'actual':h(f)} for f,v in mapping.items() if h(f)!=v]
 if bad:errors.append({'check':name,'mismatches':bad})
 return {'count':len(mapping),'mismatches':bad}
copyRows=[]
for f,r in writer['originalCopies'].items():
 actual=h(f);actualEntry=entry['hashes'][r['originalPath']]
 assert actual==actualEntry==r['originalSha256']==r['copySha256']
 copyRows.append({'copy':f,'originalPath':r['originalPath'],'entry':actualEntry,'currentCopy':actual,'status':'PASS','coverage':'hash provenance only'})
assert len(copyRows)==621
beforeChecks=[]
for f in writer['productPaths']+writer['testFixturePaths']:
 assert writer['before'][f]==entry['hashes'].get(f)
 beforeChecks.append({'path':f,'before':writer['before'][f],'actualOriginalEntry':entry['hashes'].get(f)})
writerCheck=verify_map('writer final after with explicit checker overrides',{**writer['after'],**allowed})
freezeChecks=verify_map('writer tested freeze with explicit checker overrides',{**freeze['hashes'],**allowed})
sourceChecks=verify_map('all source freeze',freeze['source'])
assert len(freeze['hashes'])==632
sourceSet={str(f):h(f) for f in pathlib.Path('src').rglob('*') if f.is_file()}
assert sourceSet==freeze['source']
static=load(task/'reviews/D06-static-summary.json');staticChecks=verify_map('static current hashes',{f:v['after'] for f,v in static['hashes'].items()})
coordinator=verify_map('seven coordinator evidences',writer['coordinatorEvidenceHashes'])
gates=[]
for r in writer['gateResults']:
 assert r['exitCode']==0 and h(r['log'])==r['sha256']
 gates.append({**r,'independentlyHashVerified':True})
assert len(gates)==12
entryMetrics=load(task/'reviews/D06-entry-metrics.json')
entryProgram=[]
for f,v in entryMetrics['entryProgram']['sourceHashes'].items():
 assert entry['hashes'][f]==v==h(task/'tools/d06/before'/f)
 assert h(pathlib.Path(entryMetrics['entryProgram']['root'])/f)==v
 entryProgram.append({'path':f,'entry':v,'copiedProgram':v})
assert len(entryProgram)==436
prior={f'D0{i}':load(task/f'reviews/D0{i}-check-snapshot.json') for i in range(1,6)}
overlaps=[]
for unit,files in writer['priorDirectOverlaps'].items():
 for f,r in files.items():
  v=prior[unit]['after'][f];assert v==r['acceptedAfter']==entry['hashes'][f]
  overlaps.append({'path':f,'priorUnit':unit,'acceptedAfter':v,'entry':entry['hashes'][f]})
latest=[]
for f,r in writer['latestAcceptedOwnerProof'].items():
 v=prior[r['latestAcceptedUnit']]['after'][f];assert v==r['acceptedAfter']==entry['hashes'][f]
 assert h(f)==r['current']
 assert r['unchangedByD06']==(h(f)==v)
 latest.append({'path':f,'unit':r['latestAcceptedUnit'],'acceptedAfter':v,'entry':entry['hashes'][f],'current':h(f)})
assert len(latest)==104
historical=verify_map('accepted D05 compiler/catalog',{f:r['accepted'] for f,r in writer['acceptedD05EvidencePreserved'].items()})
for f in ['D06-native.json','D06-native-original.json','D06-compiler-negatives.json']:
 assert h(task/'reviews'/f)==check['checkEntry'][str(task/'reviews'/f)]
for currentReport,oldReport in [('D06-check-native.json','D06-native.json'),('D06-check-compiler-negatives.json','D06-compiler-negatives.json')]:
 assert h(task/'reviews'/currentReport)==h(task/'reviews'/oldReport)
for r in entryMetrics['rows']:
 assert r['beforeSha256']==entry['hashes'][r['path']] and r['afterSha256']==h(r['path'])
 if r['sameBytes']:assert r['entryMetrics']==r['currentMetrics']
ast=load(task/'research/D06-current-ast-results.json');summary=load(task/'research/D06-current-ast-summary.json')
assert ast['fileCount']==len(ast['metrics'])==413 and len(ast['edges'])==2454
assert not ast['parseErrors'] and not ast['staticValueCycles']
totals={k:sum(len(r[k]) for r in ast['metrics']) for k in summary['totals']};assert totals==summary['totals']
# Independently traverse the frozen static value graph, excluding type and dynamic edges.
graph={r['file']:[] for r in ast['metrics']}
for r in ast['edges']:
 if r['internal'] and not r['typeOnly'] and r['kind']!='dynamic-import':graph[r['from']].append(r['to'])
seen=set();active=set()
def visit(v):
 if v in active:raise AssertionError('Value graph cycle '+v)
 if v in seen:return
 active.add(v)
 for t in graph.get(v,[]):visit(t)
 active.remove(v);seen.add(v)
for v in graph:visit(v)
rawStatic=load(task/'reviews/D06-static-results.json')
for side in ['baseline','current']:
 rows=rawStatic[side];assert len(rows)==108
 counts=collections.Counter(m['severity'] for r in rows for m in r['messages'])
 assert counts[2]==static[side+'Errors'] and counts[1]==static[side+'Warnings']
noncomplex=lambda rows:collections.Counter((m['ruleId'],m['severity'],re.sub(r'\bline \d+\b','line N',m['message'])) for r in rows for m in r['messages'] if m['ruleId'] not in ['complexity','sonarjs/cognitive-complexity'])
assert not noncomplex(rawStatic['current'])-noncomplex(rawStatic['baseline'])
assert not static['addedNoncomplexity']
assert all(not r['messages'] for r in rawStatic['current'] if r['filePath'].endswith('/src/domain/generationCapabilities.ts'))
assert not errors,errors
report={'status':'PASS','at':datetime.datetime.now().astimezone().isoformat(),'writerAfterVerification':writerCheck,'testedFreezeVerification':freezeChecks,'sourceFreezeVerification':sourceChecks,'originalCopyCoverage':copyRows,'productTestBeforeChecks':beforeChecks,'completeOriginalMetricsProgram':entryProgram,'priorDirectOverlaps':overlaps,'latestAcceptedOwners':latest,'staticCurrentVerification':staticChecks,'coordinatorEvidenceVerification':coordinator,'acceptedD05Verification':historical,'historicalD06ReportsPreserved':True,'newReportsByteIdentical':True,'gates':gates,'staticCounts':{k:static[k] for k in ['files','baselineErrors','baselineWarnings','currentErrors','currentWarnings','versions']},'ast':summary,'independentStaticValueGraphAcyclic':True,'unchangedConsumersHaveIdenticalMetrics':True,'actualEntryMetrics':entryMetrics['rows'],'writerObservedDifferences':[{ 'path':f,'writerAfter':writer['after'][f],'checkEntry':check['checkEntry'][f],'current':v,'authorizedCheckerRunnerFix':True} for f,v in current.items() if writer['after'][f]!=v],'errors':errors}
(task/'reviews/D06-check-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':'PASS','writerPaths':711,'originalCopies':621,'testedInputs':632,'sourceInputs':436,'staticInputs':108,'coordinatorEvidence':7,'gateLogs':12,'latestPriorOwners':104,'writerDifferences':len(report['writerObservedDifferences'])}))
