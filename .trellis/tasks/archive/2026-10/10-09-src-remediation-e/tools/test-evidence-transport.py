from pathlib import Path
from hashlib import sha256
import tempfile,subprocess,json,shutil
root=Path.cwd();t=root/'.trellis/tasks/10-09-src-remediation-e';out=t/'research/E-evidence-transport-synthetic';out.mkdir(exist_ok=False);temp=Path(tempfile.mkdtemp(prefix='aifenjing-e-transport-'));task=temp/'.trellis/tasks/fixture';tools=task/'tools';tools.mkdir(parents=True);producer=t/'tools/evidence-pack.py';shutil.copy2(producer,tools/'evidence-pack.py');p=tools/'evidence-pack.py';pack=temp/'saved-pack';restore=temp/'restored';cases=[]
fixtures={'proof/a.txt':b'original evidence\n'*50,'proof/b.txt':b'original evidence\n'*50,'proof/dist/.vite/manifest.json':b'{"actualBuild":true}\n','proof/node_modules/exclude.js':b'installedcache','primary/node_modules/package.json':b'{"publisher":"actual"}\n'}
for name,data in fixtures.items():q=task/name;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(data)
def run(label,argv,expected):
 r=subprocess.run(['python3',str(p),*argv],cwd=temp,capture_output=True,text=True);cases.append({'name':label,'args':argv,'expected':expected,'actual':r.returncode,'stdout':r.stdout,'stderr':r.stderr});assert (r.returncode==0)==(expected==0),(label,r.stdout,r.stderr)
run('pack-positive',['--mode','pack','--output',str(pack),'--preserve-root','.trellis/tasks/fixture/primary/node_modules'],0)
m=json.loads((pack/'manifest.json').read_text());paths={r['path']:r for r in m['files']};assert '.trellis/tasks/fixture/proof/dist/.vite/manifest.json' in paths;assert '.trellis/tasks/fixture/primary/node_modules/package.json' in paths;assert '.trellis/tasks/fixture/proof/node_modules/exclude.js' not in paths;assert paths['.trellis/tasks/fixture/proof/a.txt']['sha256']==paths['.trellis/tasks/fixture/proof/b.txt']['sha256'];assert m['fileCount']>m['uniqueBlobs']
run('verify-positive',['--mode','verify','--output',str(pack)],0)
run('restore-positive',['--mode','restore','--output',str(pack),'--restore-root',str(restore)],0)
for r in m['files']:assert sha256((restore/r['path']).read_bytes()).hexdigest()==r['sha256']
run('existing-restore-root-rejected',['--mode','restore','--output',str(pack),'--restore-root',str(restore),'--receipt',str(temp/'second.json')],1)
run('existing-output-rejected',['--mode','pack','--output',str(pack)],1)
run('existing-receipt-rejected',['--mode','verify','--output',str(pack)],1)
blob=next((pack/'blobs').iterdir());blob.write_bytes(blob.read_bytes()+b'tamper');run('compressed-tamper-rejected',['--mode','verify','--output',str(pack),'--receipt',str(temp/'tamper.json')],1)
result={'status':'PASS','producerSHA256':sha256(producer.read_bytes()).hexdigest(),'actualCases':len(cases),'cases':cases,'verifiedDuplicateContentTransport':True,'sealedViteAndPrimarySourceRetained':True,'newDestinationRestoreExact':True,'originalEvidenceFilesRetained':True,'fixtureRoot':str(temp),'limits':'Finite transport producer contracts; does not verify the full actual finalpack or acceptedreportseal closure.'};(out/'report.json').write_text(json.dumps(result,indent=2)+'\n');print('7actualtransportcasesPASS;duplicate/.vite/primary/exclusion/restore/tampercontracts checked')
