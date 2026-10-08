"""Read-only frozen D08 provenance verification; writes checker proof only."""
from pathlib import Path
import hashlib,json,re,subprocess,collections,datetime
ROOT=Path.cwd(); TASK=Path('.trellis/tasks/10-08-src-remediation-d')
def load(p): return json.loads(Path(p).read_text())
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def verify(values):
    bad=[]
    for p,h in values.items():
        actual=sha(p) if Path(p).is_file() else None
        if actual!=h: bad.append({'path':p,'expected':h,'actual':actual})
    return bad
s=load(TASK/'reviews/D08-implement-snapshot.json'); freeze=load(TASK/'reviews/D08-product-freeze.json'); entry=load(TASK/'reviews/D08-entry.json')
static=load(TASK/'reviews/D08-static-summary.json'); raw=load(TASK/'reviews/D08-static-results.json'); ast=load(TASK/'research/D08-current-ast-results.json'); astsum=load(TASK/'research/D08-current-ast-summary.json')
checks={}
def check(name,ok,details):
    checks[name]={'pass':bool(ok),'details':details}
    assert ok,(name,details)
check('writerOwnedAfter',len(s['after'])==58 and not verify(s['after']),{'count':len(s['after']),'mismatches':verify(s['after'])})
check('frozenTestInputs',len(freeze['testedInputs'])==704 and not verify(freeze['testedInputs']),{'count':len(freeze['testedInputs']),'mismatches':verify(freeze['testedInputs'])})
check('staticCurrentInputs',len(static['hashes'])==123 and not verify({p:v['after'] for p,v in static['hashes'].items()}),{'count':len(static['hashes']),'mismatches':verify({p:v['after'] for p,v in static['hashes'].items()})})
check('immutableMainStaticASTArtifacts',not verify(s['coordinatorEvidenceHashes']),{'count':len(s['coordinatorEvidenceHashes']),'mismatches':verify(s['coordinatorEvidenceHashes'])})
originals=s['originalCopies']; manifest=load(TASK/'research/D08-originals/entry-hashes.json')
originalbad=[p for p,v in originals.items() if sha(p)!=manifest.get(v['entryPath'])]
check('actualPreeditOriginals',len(originals)==8 and not originalbad and sha(entry['manifest'])==entry['manifestSHA256'],{'copies':len(originals),'manifestCount':len(manifest),'mismatches':originalbad})
basebad=[]
for p,v in static['hashes'].items():
    out=subprocess.run(['git','show',s['baselineRevision']+':'+p],capture_output=True)
    h=hashlib.sha256(out.stdout).hexdigest() if out.returncode==0 and out.stdout else None
    if h!=v['before']:basebad.append(p)
check('staticBaselineBytes',not basebad,{'ref':s['baselineRevision'],'count':len(static['hashes']),'mismatches':basebad})
counts={key:[sum(r['errorCount'] for r in raw[key]),sum(r['warningCount'] for r in raw[key])] for key in ('baseline','current')}
def signature(m):return (m['ruleId'],m['severity'],re.sub(r'\bline \d+\b','line N',m['message']))
before=collections.Counter(signature(m) for r in raw['baseline'] for m in r['messages']); after=collections.Counter(signature(m) for r in raw['current'] for m in r['messages'])
added=after-before; newnon=[{'rule':k[0],'severity':k[1],'message':k[2],'count':n} for k,n in added.items() if k[0] not in ('complexity','sonarjs/cognitive-complexity')]
check('staticRawDifferential',counts=={'baseline':[142,286],'current':[128,273]} and not newnon,{'counts':counts,'newNoncomplexity':newnon,'newComplexityCount':sum(added.values()),'policy':'Same-signature relocation accounting, not clean lint.'})
leaves=[p for p in s['productPaths'] if s['unitBefore'][p] is None]
leafdiag=[{'path':r['filePath'],'messages':r['messages']} for r in raw['current'] if str(Path(r['filePath']).relative_to(ROOT)) in leaves and r['messages']]
first=load(TASK/'reviews/D08-first-static-summary.json')
check('memoWarningGenuinelyRemoved',not leafdiag and any('revision' in x['message'] and x['ruleId']=='react-hooks/exhaustive-deps' for x in first['addedNoncomplexity']),{'newD08Leaves':leaves,'currentDiagnostics':leafdiag,'stateConsumedByMemo':'pendingIds.has(row.id); [loadedRows,pendingIds]','immediateRef':'statuses.current updated synchronously before setPendingIds'})
metrics={k:sum(len(m[k]) for m in ast['metrics']) for k in astsum['totals']}
check('astRawSummary',ast['fileCount']==419 and len(ast['edges'])==2492 and not ast['parseErrors'] and not ast['staticValueCycles'] and metrics==astsum['totals'],{'files':ast['fileCount'],'edges':len(ast['edges']),'parseErrors':len(ast['parseErrors']),'valueSCCs':ast['staticValueCycles'],'totals':metrics})
prior={}; overlap={}
for unit,info in s['priorUnitSnapshots'].items():
    check('priorSnapshot'+unit,sha(info['path'])==info['sha256'],{'path':info['path'],'sha256':info['sha256']})
    snap=load(info['path'])
    for p,h in snap['after'].items():
        if p.startswith('src/'): prior[p]=(unit,h)
for p in s['implementationPaths']:
    if p in prior:
        unit,h=prior[p];overlap[p]={'unit':unit,'acceptedHash':h,'entryHash':s['unitBefore'][p],'matches':h==s['unitBefore'][p]}
check('acceptedDirectOwnerOverlaps',len(overlap)==4 and all(v['matches'] for v in overlap.values()),overlap)
cor=s['excludedConcurrentCorrection']; cs=load(cor['snapshot']);cbad=verify(cs['after'])
check('disjointFixtureCorrection',sha(cor['snapshot'])==cor['sha256'] and len(cs['after'])==72 and not cbad and not (set(cs['after'])&set(s['implementationPaths'])),{'paths':len(cs['after']),'mismatches':cbad,'implementationOverlap':sorted(set(cs['after'])&set(s['implementationPaths']))})
records=load(TASK/'research/D08-affected-gate-records.json')
check('postMemoCurrentGates',len(records)==3 and all(r['exitCode']==0 and sha(r['log'])==r['logSHA256'] for r in records),[{'name':r['name'],'exitCode':r['exitCode'],'startedAt':r['startedAt'],'logSHA256':r['logSHA256']} for r in records])
native=load(TASK/'research/D08-native-current.json')
check('postMemoNative',native['status']=='PASS' and len(native['checks'])==13 and not native['errors'] and native['externalRequests']==0,{'checks':len(native['checks']),'errors':native['errors'],'externalRequests':native['externalRequests'],'limits':native['limits']})
# Route build normalization is checked on actual tokens, without generating routes.
node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
tokenjs="""const fs=require('fs'),ts=require('./node_modules/typescript');function tokens(p){const s=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,fs.readFileSync(p,'utf8'));const a=[];let k;while((k=s.scan())!==ts.SyntaxKind.EndOfFileToken)a.push([k,s.getTokenText()]);return a;}const a=tokens(process.argv[1]),b=tokens(process.argv[2]);console.log(JSON.stringify({equal:JSON.stringify(a)===JSON.stringify(b),entryTokens:a.length,builtTokens:b.length}));"""
tokens=json.loads(subprocess.check_output([node,'-e',tokenjs,str(TASK/'research/D08-originals/src/routeTree.gen.ts'),str(TASK/'research/D08-routeTree-built.ts')],text=True))
check('generatedRouteRestored',tokens['equal'] and tokens['entryTokens']==3995 and sha('src/routeTree.gen.ts')==manifest['src/routeTree.gen.ts'],tokens)
# Gate/environment producers are evidence; no commands are rerun or reports overwritten.
report={'status':'PASS','role':'independent trellis-check','capturedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'scope':'All14 implementation paths and all58 writer-owned after paths. Remaining704 inputs hash-only. No product mutation/heavy gate rerun.','checks':checks,'gateCurrency':s['gateResults'],'sourceSetSHA256':freeze['sourceSetSHA256'],'inputSetSHA256':freeze['inputSetSHA256'],'noProductFixRequired':True}
(TASK/'reviews/D08-check-provenance.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'status':'PASS','checks':len(checks),'writerAfter':58,'frozenInputs':704,'staticFiles':123,'originalCopies':8,'directOverlaps':4,'fixtureExcluded':72,'proofSHA256':sha(TASK/'reviews/D08-check-provenance.json')},indent=2))
