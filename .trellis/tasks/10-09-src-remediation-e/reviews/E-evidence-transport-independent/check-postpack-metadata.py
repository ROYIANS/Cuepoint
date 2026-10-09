"""Read-only literal ignore/attributed post-pack helper evolution closure."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
import difflib,json,os
root=Path.cwd();task=root/'.trellis/tasks/10-09-src-remediation-e';out=Path(__file__).resolve().parent;pack=task/'evidence-pack';restored=Path('/private/tmp/aifenjing-e-evidence-restored-final-20261009')
load=lambda p:json.loads(p.read_text())
def h(p):return sha256(p.read_bytes()).hexdigest() if p.is_file() else None
receipt=lambda p:{'path':str(p.relative_to(root)),'sha256':h(p)}
manifest=load(pack/'manifest.json');lookup={r['path']:r for r in manifest['files']};readback=load(out/'full-original-restored-readback.json');ep=task/'research/E-evidence-git-preservation-evolution.json';e=load(ep);helper=e['capturedProducerEvolution'];old=root/helper['packedBeforeCopy'];current=root/helper['path'];restoredold=restored/helper['path'];before=old.read_text();after=current.read_text();checks=[]
def check(name,passed,detail=None):checks.append({'check':name,'passed':bool(passed),'detail':detail})
check('Onecapturedhelperdriftexactlydeclaredpreservedbefore',h(old)==h(restoredold)==helper['packedBeforeSHA256']==helper['packedBeforeCopySHA256']==lookup[helper['path']]['sha256'] and h(current)==helper['currentSHA256'] and readback['fullReadback']['actualOriginalMismatches']==[{'path':helper['path'],'expectedSHA256':helper['packedBeforeSHA256'],'actualSHA256':helper['currentSHA256'],'expectedBytes':len(old.read_bytes()),'actualBytes':len(current.read_bytes())}])
check('Helperboundedwhitelistonlygitignoreaddition',after==before.replace("p.is_file() and p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs']","p.is_file() and (p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs'] or p.name=='.gitignore')"),{'diff':list(difflib.unified_diff(before.splitlines(),after.splitlines(),n=1))})
p=root/e['newTaskGitignore']['path'];text=p.read_text();lines=[v for v in text.splitlines() if v and not v.startswith('#')];rules=[];errors=[]
for line in lines:
    if not line.startswith('/') or line.startswith('!'):errors.append(line);continue
    s=line[1:];literal='';i=0
    while i<len(s):
        c=s[i]
        if c=='\\':
            i+=1
            if i==len(s):errors.append(line);break
            literal+=s[i]
        elif c in '*?[':errors.append(line);literal+=c
        else:literal+=c
        i+=1
    if literal.startswith('/') or '..' in Path(literal).parts or not literal:errors.append(line)
    rules.append(literal)
check('116literalanchoredtaskrulesnoarbitraryglobs',len(lines)==len(rules)==len(set(rules))==116 and not errors and h(p)==e['newTaskGitignore']['sha256'],{'unrecognized':errors,'rules':rules})
def ignored(k):
    return any(k==v or (v.endswith('/') and k.startswith(v)) for v in rules)
normal=set()
for folder in [task,task/'research',task/'reviews',task/'tools']:
    for p in folder.iterdir():
        if p.is_file() and p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs'] and p.stat().st_size<=4_000_000:normal.add(p.relative_to(task).as_posix())
normal.update(['.gitignore','commit-plan.json','commit-plan.md','evidence-pack/','reviews/E-evidence-transport-independent/'])
ignorednormal=[k for k in normal if ignored(k)]
product=load(task/'research/E-final-head-changed-scope.json')['rows'];ignoredproduct=[]
for r in product:
    path=root/r['path']
    if path.is_relative_to(task) and ignored(path.relative_to(task).as_posix()):ignoredproduct.append(r['path'])
check('244productnormaldocstoolspacklatefilesnotignoredbynewrules',len(product)==244 and not ignoredproduct and not ignorednormal,{'productCount':len(product),'normalPathsChecked':len(normal),'ignoredProduct':ignoredproduct,'ignoredNormal':ignorednormal})
rulecoverage=[]
for rule in rules:
    matches=[r for r in manifest['files'] if (r['path'][len(str(task.relative_to(root)))+1:]==rule or (rule.endswith('/') and r['path'][len(str(task.relative_to(root)))+1:].startswith(rule)))]
    rulecoverage.append({'literalRule':rule,'capturedPaths':len(matches),'capturedBytes':sum(r['bytes'] for r in matches)})
check('Eachliteralruleprotectsactualcapturedproofpaths',all(r['capturedPaths']>0 for r in rulecoverage))
ignoredactual=[];uncaptured=[];runtime=[];excluded=set(manifest['excludedDirectoryRoots'])
for base,dirs,names in os.walk(task):
    dirs[:]=[d for d in dirs if Path(base)/d!=pack and str((Path(base)/d).relative_to(root)) not in excluded and d!='__pycache__' and not (Path(base)/d).is_symlink()]
    for name in names:
        p=Path(base)/name
        if p.is_symlink():continue
        k=p.relative_to(task).as_posix()
        if not ignored(k):continue
        key=str(p.relative_to(root));ignoredactual.append(key)
        if key not in lookup:
            if any(key.startswith(v+'/') for v in excluded) or '__pycache__' in p.parts:runtime.append(key)
            else:uncaptured.append(key)
check('Allignoredactualproofregularfilesrepresentedexceptexplicitinstalledcaches',not uncaptured,{'ignoredActualFiles':len(ignoredactual),'uncapturedProofPaths':uncaptured,'explicitRuntimeExclusions':len(runtime)})
allowedlate={str(p.relative_to(root)) for p in [task/'.gitignore',old,ep,root/e['newProducer']['path']]}
late=[];unexpected=[]
for r in readback['lateFilesAtReadback']:
    key=r['path'];allowed=key in allowedlate or key.startswith(str(out.relative_to(root))+'/')
    late.append({**r,'normalReadableNotInFrozenPack':True,'explicitClass':'metadata evolution' if key in allowedlate else 'independent transport review','allowed':allowed})
    if not allowed:unexpected.append(key)
check('Newlatefilesexplicitmetadataorreviewnormalnonrecursive',not unexpected,{'unexpected':unexpected,'lateFiles':late})
check('Evolutionproducercurrenthashmatchesreceipt',h(root/e['newProducer']['path'])==e['newProducer']['sha256'] and not e['originalsDeleted'] and not e['historicalReportsRewritten'])
# Previous raw readback rejected the declared metadata evolution and late metadata; all other checks passed.
nonmetafails=[c for c in readback['failedChecks'] if c['check'] not in ['Full41163actualoriginalpathhashbytes','Latefilesonlyownedtransportreviewnormalfiles']]
check('Nootherrawreadbackfailures',not nonmetafails,{'unexpected':nonmetafails})
result={'status':'PASS' if all(c['passed'] for c in checks) else 'FAIL','capturedAt':datetime.now(timezone.utc).isoformat(),'checks':checks,'failedChecks':[c for c in checks if not c['passed']],'rawReadbackPreserved':receipt(out/'full-original-restored-readback.json'),'metadataEvolution':receipt(ep),'currentHelper':receipt(current),'exactPackedOldHelper':receipt(old),'restoredOldHelper':{'path':str(restoredold),'sha256':h(restoredold)},'newTaskGitignore':receipt(task/'.gitignore'),'newProducer':receipt(root/e['newProducer']['path']),'literalIgnoreCoverage':rulecoverage,'currentOriginalsQualification':{'capturedPaths':41163,'exactCurrentOriginals':41162,'explainedChangedTaskHelpers':1,'unexplained':0,'restoredAll41163Exact':True},'limits':['Rules are validated as anchored literals in this task-local .gitignore; no Git staging/index operation executed. Parent repository ignore policies are outside this metadata delta.','Ignored installed/Python cache bytes are explicit non-proof runtime exclusions; every remaining ignored regular rawproofpath is manifest-represented.','Late metadata/helperoldcopy/currenthelper/transportreview remain normalreadablecommitpaths, no recursive pack update.']}
(out/'postpack-metadata-evolution-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':result['status'],'failed':result['failedChecks'],'rules':len(rules),'ignoredActual':len(ignoredactual),'runtimeExcluded':len(runtime),'unrepresentedProof':len(uncaptured),'normalPaths':len(normal)},ensure_ascii=False,indent=2))
raise SystemExit(0 if result['status']=='PASS' else 1)
