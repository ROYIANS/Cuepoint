"""Read-only final transport manifest/restoration/original/seal reconciliation."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime,timezone
from collections import Counter
import json,os,re
root=Path.cwd();task=root/'.trellis/tasks/10-09-src-remediation-e';out=Path(__file__).resolve().parent;pack=task/'evidence-pack';restored=Path('/private/tmp/aifenjing-e-evidence-restored-final-20261009')
load=lambda p:json.loads(p.read_text())
def hs(p):
    if not p.is_file() or p.is_symlink():return None
    d=sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):d.update(chunk)
    return d.hexdigest()
def receipt(p):return {'path':str(p.relative_to(root)) if p.is_relative_to(root) else str(p),'sha256':hs(p)}
def save(name,x):(out/name).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
manifest=load(pack/'manifest.json');blobs=load(pack/'blobs.json');rows=manifest['files'];lookup={r['path']:r for r in rows};index={r['sha256']:r for r in blobs['blobs']};checks=[]
def check(name,ok,detail=None):checks.append({'check':name,'passed':bool(ok),'detail':detail})
check('Exact frozen manifest/index hashes',hs(pack/'manifest.json')=='443c82ed6fe35e39d128b6e8b370050626035d5e46e6853304ed6d8f87ee0793' and hs(pack/'blobs.json')=='da10dc26c20050217372fe22fd463e4852b190d47cf271fbf74cc9016271b9bb')
check('Manifest paths unique sorted safe task-relative regular files',len(rows)==len(lookup)==manifest['fileCount']==41163 and [r['path'] for r in rows]==sorted(lookup) and all(not Path(r['path']).is_absolute() and '..' not in Path(r['path']).parts and r['path'].startswith(str(task.relative_to(root))+'/') and not r['path'].startswith(str(pack.relative_to(root))+'/') and re.fullmatch(r'[0-9a-f]{64}',r['sha256']) and isinstance(r['bytes'],int) and r['bytes']>=0 for r in rows))
sizebyhash={}
for r in rows:
    if r['sha256'] in sizebyhash:check('Duplicate hash size consistent '+r['sha256'],sizebyhash[r['sha256']]==r['bytes'])
    sizebyhash[r['sha256']]=r['bytes']
check('10117unique blob keys exactlyclosemanifest',len(index)==len(blobs['blobs'])==len(sizebyhash)==10117==manifest['uniqueBlobs'] and set(index)==set(sizebyhash))
check('Exact bytes/counts/index compressed maximum',sum(r['bytes'] for r in rows)==manifest['originalBytes']==2554126083 and sum(sizebyhash.values())==manifest['uniqueBytes']==1324594336 and sum(r['compressedBytes'] for r in index.values())==blobs['totalCompressedBytes']==232240383 and max(r['compressedBytes'] for r in index.values())==7096637)
originalbad=[];restorebad=[];obytes=0;rbytes=0;hasher=sha256()
for n,r in enumerate(rows,1):
    p=root/r['path'];q=restored/r['path'];oh=hs(p);rh=hs(q);osize=p.stat().st_size if p.is_file() else None;rsize=q.stat().st_size if q.is_file() else None
    if oh!=r['sha256'] or osize!=r['bytes']:originalbad.append({'path':r['path'],'expectedSHA256':r['sha256'],'actualSHA256':oh,'expectedBytes':r['bytes'],'actualBytes':osize})
    if rh!=r['sha256'] or rsize!=r['bytes'] or restored not in q.resolve().parents:restorebad.append({'path':r['path'],'expectedSHA256':r['sha256'],'actualSHA256':rh,'expectedBytes':r['bytes'],'actualBytes':rsize})
    obytes+=osize or 0;rbytes+=rsize or 0;hasher.update((r['path']+'\0'+str(oh)+'\0'+str(rh)+'\0'+str(r['bytes'])+'\n').encode())
    if n%10000==0:print('readback',n,'/',len(rows),flush=True)
check('Full41163actualoriginalpathhashbytes',not originalbad and obytes==manifest['originalBytes'],{'mismatches':originalbad,'bytes':obytes})
check('Full41163actualrestoredpathhashbytescontainment',not restorebad and rbytes==manifest['originalBytes'],{'mismatches':restorebad,'bytes':rbytes,'root':str(restored),'traversalSHA256':hasher.hexdigest()})
restorefiles={str(p.relative_to(restored)) for p in restored.rglob('*') if p.is_file() or p.is_symlink()}
check('Actualrestored treeexact41163pathsnoextra',restorefiles==set(lookup),{'extra':sorted(restorefiles-set(lookup)),'missing':sorted(set(lookup)-restorefiles)})

coverage=[];bad=[]
def add(owner,path,expected,kind='immutable accepted proof'):
    p=Path(path);p=p if p.is_absolute() else root/p;key=str(p.relative_to(root));r=lookup.get(key)
    if r and r['sha256']==expected:
        coverage.append({'owner':owner,'path':key,'expectedSHA256':expected,'representation':'exact-original-path-in-pack','kind':kind});return
    if not key.startswith(str(task.relative_to(root))+'/'):
        coverage.append({'owner':owner,'path':key,'expectedSHA256':expected,'representation':'normal readable current source/spec/config outside task pack; historical mutable evolution separately reconciled','kind':'outside task transport'});return
    # Later mutable task metadata/doc references must preserve original bytes at explicit before-copy paths.
    finalhistory=historicalLookup.get((owner,key,expected),[])
    if not finalhistory:
        finalhistory=copybyhash.get(expected,[])
    copies=[q for q in finalhistory if q in lookup and lookup[q]['sha256']==expected]
    if copies:
        coverage.append({'owner':owner,'path':key,'expectedSHA256':expected,'representation':'explicit accepted subsequent mutable evolution, old exactbytes preserved in pack','preservedCopies':copies,'kind':kind});return
    bad.append({'owner':owner,'path':key,'expectedSHA256':expected,'packedSHA256':r['sha256'] if r else None})
# All earlier maps have exact-source copies/evolution independently accepted and frozen by whole-E.
history=load(task/'reviews/E-final-independent/final-historical-evidence-integrity.json')
historicalLookup={(r['unit'],r['path'],r['expectedSHA256']):[v['path'] for v in r.get('verifiedExactOriginalByteCopies',[])] for r in history['rows']}
copybyhash={}
for r in history['rows']:
    for v in r.get('verifiedExactOriginalByteCopies',[]):copybyhash.setdefault(r['expectedSHA256'],[]).append(v['path'])
for n in range(1,8):
    unit=f'E{n:02}';s=load(task/'reviews'/f'{unit}-check-snapshot.json')
    for name in [f'reviews/{unit}-check-snapshot.json',f'reviews/{unit}-check.md']:
        p=task/name;add(unit,str(p),hs(p))
    if n<7:
        for k in ['evidenceHashes','independentEvidenceHashes','producerReportHashes','producerHashes']:
            maps=s.get(k,{})
            if isinstance(maps,dict):
                for p,v in maps.items():
                    if isinstance(v,str) and re.fullmatch('[0-9a-f]{64}',v):add(unit,p,v)
    else:
        sealp=root/s['artifactSeal']['manifest'];check('AcceptedE07sealmanifestexactsavedpack',lookup[str(sealp.relative_to(root))]['sha256']==s['artifactSeal']['manifestSHA256'])
        for p,v in load(sealp)['files'].items():add('E07artifactseal',p,v)
        add('E07',str(sealp),hs(sealp))
        for p,v in load(root/s['artifactSeal']['adoptedEvidenceManifest']).items():add('E07adopted',p,v,'adopted current source/evidence')
for r in history['expandedE06Rows']:add('E06expanded',r['path'],r['expectedSHA256'])
wholep=task/'reviews/E-final-independent/final-seal.json';whole=load(wholep)
for p,v in whole['files'].items():add('wholeEsource',p,v['sha256'])
add('wholeEsource',str(wholep),hs(wholep))
check('AcceptedE01-E07expandedE06andwholeEcoverage',not bad,{'references':len(coverage)+len(bad),'mismatches':bad})
check('WholeEsource727110reportab926sealremainexact',hs(task/'reviews/E-final-check.json')=='727110ce4c7309ae248fa18da6aa3e327bcbc1312aa3a2fea03fa044e37c077f' and hs(wholep)=='ab926cdf20ec15544e49432f5c1f81cdadcb21a4989a76a395f43741798f8229' and len(whole['files'])==184 and all(hs(root/p)==v['sha256'] for p,v in whole['files'].items()))

preserved=str((task/'research/e06/contract-primary-sources/node_modules').relative_to(root));primary=[r for r in rows if r['path'].startswith(preserved+'/')]
acceptedmissing=load(task/'reviews/E-final-independent/evidence-transport-inventory-preflight.json')['uniqueMissingPaths']
check('Explicit12publisherrootandnineacceptedvitemanifestspreserved',manifest['explicitPreservedEvidenceRoots']==[preserved] and len(primary)==12 and all(p in lookup for p in acceptedmissing) and sum('/.vite/' in p for p in acceptedmissing)==9)
check('Installationcacheexcludedandpacknonrecursive',all(Path(p).name in ['node_modules','.git','__pycache__'] for p in manifest['excludedDirectoryRoots']) and all(not any(r['path']==p or r['path'].startswith(p+'/') for r in rows) for p in manifest['excludedDirectoryRoots']) and not any(r['path'].startswith(str(pack.relative_to(root))+'/') for r in rows))
check('Noactualsymlinkrestoreclaim',manifest['symlinks']==[] and not any(p.is_symlink() for p in restored.rglob('*')))
producerp=task/'tools/evidence-pack.py';testp=task/'tools/test-evidence-transport.py';syntheticp=task/'research/E-evidence-transport-synthetic/report.json';synthetic=load(syntheticp)
check('Sevenfiniteactualproducercontractsatcurrentdigest',synthetic['status']=='PASS' and synthetic['producerSHA256']==hs(producerp) and synthetic['actualCases']==7 and len(synthetic['cases'])==7 and all(r['actual']==r['expected'] for r in synthetic['cases']) and all(synthetic[k] for k in ['verifiedDuplicateContentTransport','sealedViteAndPrimarySourceRetained','newDestinationRestoreExact','originalEvidenceFilesRetained']))
phasep=task/'research/E-final-main-source-acceptance.json';phase=load(phasep)
check('Metadataonlypostsourcephaseevolutionexactbeforecurrent',phase['actualAgentCompletionReceived'] and all(hs(root/r['beforeCopy'])==r['beforeSHA256'] and hs(root/r['path'])==r['afterSHA256'] for r in phase['phaseEvolution']))
source=load(task/'reviews/E07-check-snapshot.json');check('1022applicationinputsremainacceptedfrozen',len(source['currentInputs'])==1022 and all(hs(root/p)==v for p,v in source['currentInputs'].items()))
late=[];excluded=[root/p for p in manifest['excludedDirectoryRoots']]
for base,dirs,names in os.walk(task):
    dirs[:]=[name for name in dirs if Path(base)/name!=pack and Path(base)/name not in excluded and not (Path(base)/name).is_symlink()]
    for name in names:
        p=Path(base)/name
        if p.is_symlink():continue
        key=str(p.relative_to(root))
        if key not in lookup:late.append(receipt(p))
check('Latefilesonlyownedtransportreviewnormalfiles',all(r['path'].startswith(str(out.relative_to(root))+'/') for r in late),{'lateFiles':late})
save('accepted-seal-coverage.json',{'status':'PASS' if not bad else 'FAIL','manifest':receipt(pack/'manifest.json'),'checkedReferences':len(coverage)+len(bad),'representationCounts':dict(Counter(r['representation'] for r in coverage)),'missingOrMismatchedAcceptedReferences':bad,'references':coverage,'scope':'Exact accepted task evidence paths, expanded seals and whole-E source seal. Product/spec/config outside taskpack stay normal readable files; old mutable refs preserved through explicit old-byte copies, not rewritten original snapshots.'})
result={'status':'PASS' if all(r['passed'] for r in checks) else 'FAIL','capturedAt':datetime.now(timezone.utc).isoformat(),'checks':checks,'checkCount':len(checks),'failedChecks':[r for r in checks if not r['passed']],'manifest':receipt(pack/'manifest.json'),'blobIndex':receipt(pack/'blobs.json'),'fullReadback':{'paths':len(rows),'originalBytes':obytes,'restoredBytes':rbytes,'actualOriginalMismatches':originalbad,'actualRestoreMismatches':restorebad,'root':str(restored),'traversalSHA256':hasher.hexdigest()},'acceptedSealReferences':len(coverage)+len(bad),'producer':receipt(producerp),'syntheticProducerTests':receipt(testp),'sevenCaseReport':receipt(syntheticp),'phaseMetadata':receipt(phasep),'lateFilesAtReadback':late,'limits':['Independent actual verify uses modeverify withoutrestore-root and writes only a new ownedreceipt. Current producer permits verify+restore-root writes; this unused option combination is not accepted as read-only verification.','Manifest covers regular bytes/paths. Actual symlink count0; permissions/ownership/timestamps/runtime-install reproduction are not transport proof.','No packrecursiveupdate; late transport checks/receipts/seal remain readable normalcommitfiles and must be included in separate finalcommitlist.','No new source/gate/native/install/Git/task/spec/ledger edits.']}
save('full-original-restored-readback.json',result)
print(json.dumps({'status':result['status'],'checks':len(checks),'failed':result['failedChecks'],'originalPaths':len(rows),'restorePaths':len(restorefiles),'acceptedReferences':len(coverage)+len(bad),'lateFiles':len(late)},indent=2),flush=True)
raise SystemExit(0 if result['status']=='PASS' else 1)
