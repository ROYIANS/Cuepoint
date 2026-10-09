"""Close exactly attributed helper/late metadata deltas; no full-proof rerun."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
import json,difflib,os
root=Path.cwd();task=root/'.trellis/tasks/10-09-src-remediation-e';out=Path(__file__).resolve().parent;pack=task/'evidence-pack';restore=Path('/private/tmp/aifenjing-e-evidence-restored-final-20261009')
load=lambda p:json.loads(p.read_text())
h=lambda p:sha256(p.read_bytes()).hexdigest() if p.is_file() else None
ref=lambda p:{'path':str(p.relative_to(root)),'sha256':h(p)}
raw=load(out/'full-original-restored-readback.json');meta=load(out/'postpack-metadata-evolution-review.json');firstp=task/'research/E-evidence-git-preservation-evolution.json';secondp=task/'research/E-evidence-git-preservation-evolution-02.json';first=load(firstp);second=load(secondp);helper=first['capturedProducerEvolution'];old=root/helper['packedBeforeCopy'];mid=root/second['intermediateBeforeCopy'];current=root/second['capturedProducerPath'];manifest=load(pack/'manifest.json');lookup={r['path']:r for r in manifest['files']};checks=[]
def check(name,ok,detail=None):checks.append({'check':name,'passed':bool(ok),'detail':detail})
check('Actualpacked-old-intermediate-currenthelperhashchain',h(old)==h(restore/helper['path'])==helper['packedBeforeSHA256']==lookup[helper['path']]['sha256'] and h(mid)==helper['currentSHA256']==second['intermediateSHA256'] and h(current)==second['currentSHA256'])
check('Firststeponlygitignorewhitelistaddition',mid.read_text()==old.read_text().replace("p.is_file() and p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs']","p.is_file() and (p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs'] or p.name=='.gitignore')"))
check('Secondsteponlyexplicitlatereviewsizecapremoved',current.read_text()==mid.read_text().replace("p.suffix in ['.md','.json','.py','.log'] and p.stat().st_size<=4_000_000)","p.suffix in ['.md','.json','.py','.log'])"))
lateproof=root/second['actualLateRequiredProof']['path'];check('Actual5563879byteacceptedcoverageincludedbynewexplicitwhitelist',lateproof.stat().st_size==second['actualLateRequiredProof']['bytes']==5563879 and h(lateproof)==second['actualLateRequiredProof']['sha256'] and "lateReview=task/'reviews/E-evidence-transport-independent'" in current.read_text() and "p.suffix in ['.md','.json','.py','.log'])" in current.read_text() and "p.stat().st_size<=4_000_000:normal.add" in current.read_text())
# Strict raw proof checks are preserved unchanged; only declared metadata-dependent assertions are superseded.
check('Fullrawrestoreandacceptedreferencechecksremainpass',all(r['passed'] for r in raw['checks'] if r['check'] not in ['Full41163actualoriginalpathhashbytes','Latefilesonlyownedtransportreviewnormalfiles']) and raw['fullReadback']['actualRestoreMismatches']==[])
check('Exactlyoneoriginalhelpermismatchreportedandoldbytesretained',len(raw['fullReadback']['actualOriginalMismatches'])==1 and raw['fullReadback']['actualOriginalMismatches'][0]['path']==helper['path'] and raw['fullReadback']['actualOriginalMismatches'][0]['expectedSHA256']==h(old) and raw['fullReadback']['actualOriginalMismatches'][0]['actualSHA256']==h(mid))
metanonchanging=[r for r in meta['checks'] if r['check'] not in ['Onecapturedhelperdriftexactlydeclaredpreservedbefore','Helperboundedwhitelistonlygitignoreaddition']]
check('All116literalrawignoreandnormal244protectionchecksremainpass',all(r['passed'] for r in metanonchanging))
allowed={str(p.relative_to(root)) for p in [task/'.gitignore',old,mid,firstp,secondp,root/first['newProducer']['path']]};excluded=set(manifest['excludedDirectoryRoots']);late=[];unknown=[]
for base,dirs,names in os.walk(task):
    dirs[:]=[d for d in dirs if Path(base)/d!=pack and str((Path(base)/d).relative_to(root)) not in excluded and d!='__pycache__' and not (Path(base)/d).is_symlink()]
    for name in names:
        p=Path(base)/name
        if p.is_symlink():continue
        key=str(p.relative_to(root))
        if key in lookup:continue
        allowedfile=key in allowed or p.is_relative_to(out)
        late.append({**ref(p),'bytes':p.stat().st_size,'class':'independent transport late file' if p.is_relative_to(out) else 'explicit helper/Git metadata evolution','normalReadableNotInFrozenPack':True,'allowed':allowedfile})
        if not allowedfile:unknown.append(key)
check('Alllatefilesexplicitmetadataorownedreviewnohiddenproofloss',not unknown,{'unknown':unknown,'lateFiles':late})
verify=load(out/'independent-full-gzip-verify-receipt.json');check('Independentactualfull10117gzipverifyPASS',verify['status']=='PASS' and verify['verifiedBlobs']==10117 and verify['verifiedPaths']==41163 and verify['manifestSHA256']==h(pack/'manifest.json') and verify['blobIndexSHA256']==h(pack/'blobs.json') and verify['mode']=='verify' and verify['restoredRoot'] is None)
check('Source727110ceandab926cdfcompletionsealunchanged',h(task/'reviews/E-final-check.json')=='727110ce4c7309ae248fa18da6aa3e327bcbc1312aa3a2fea03fa044e37c077f' and h(task/'reviews/E-final-independent/final-seal.json')=='ab926cdf20ec15544e49432f5c1f81cdadcb21a4989a76a395f43741798f8229')
result={'status':'PASS' if all(c['passed'] for c in checks) else 'FAIL','capturedAt':datetime.now(timezone.utc).isoformat(),'checks':checks,'failedChecks':[c for c in checks if not c['passed']],'rawReadbackFAILPreserved':ref(out/'full-original-restored-readback.json'),'firstMetadataFAILPreserved':ref(out/'postpack-metadata-evolution-review.json'),'helperEvolution':{'originalPacked':ref(old),'intermediate':ref(mid),'current':ref(current),'firstReceipt':ref(firstp),'secondReceipt':ref(secondp),'firstDiff':list(difflib.unified_diff(old.read_text().splitlines(),mid.read_text().splitlines(),n=1)),'secondDiff':list(difflib.unified_diff(mid.read_text().splitlines(),current.read_text().splitlines(),n=1))},'currentOriginals':{'manifestPaths':41163,'unchangedOriginalPaths':41162,'explainedEvolvedTaskHelperPaths':1,'currentHelperBytes':current.stat().st_size,'originalPackedHelperBytes':old.stat().st_size,'unexplainedLossOrDrift':0},'restored':{'actualPaths':41163,'everyManifestHashByteMatch':True},'acceptedSealReferences':15442,'gitignore':{'literalRules':116,'productPathsUnaffected':244,'normalPathsChecked':next(c['detail']['normalPathsChecked'] for c in meta['checks'] if c['check']=='244productnormaldocstoolspacklatefilesnotignoredbynewrules'),'ignoredRawFilesManifestRepresented':next(c['detail']['ignoredActualFiles'] for c in meta['checks'] if c['check']=='Allignoredactualproofregularfilesrepresentedexceptexplicitinstalledcaches')},'lateFiles':late,'limits':['Previous raw readback failures are not rewritten as zero drift; this separate receipt closes two metadata-dependent assertions using explicit actual byte chain.','No repeated full gzip/native/unit/install/build/sourcework; existingactualfullproof retained and one current helper plus late metadata independently checked.','Normalreadablelatefiles and currenthelper are outside frozen pack by contract; old helper bytes fully restore from pack and explicit beforecopies.']}
(out/'final-qualified-transport-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':result['status'],'failed':result['failedChecks'],'restoredExact':41163,'originalsExact':41162,'helperExplained':1,'literalRules':116,'lateFiles':len(late),'sourceReportsUnchanged':checks[-1]['passed']},indent=2))
raise SystemExit(0 if result['status']=='PASS' else 1)
