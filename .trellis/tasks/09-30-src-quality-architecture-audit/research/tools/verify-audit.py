# -*- coding: utf-8 -*-
"""Verify review coverage, source integrity and concrete report locations; never edits src."""
from pathlib import Path
from collections import Counter
import hashlib,json,re,subprocess,sys
root=Path(__file__).resolve().parents[5]
research=Path(__file__).resolve().parents[1]
manifest=json.loads((research/'source-manifest.json').read_text())
errors=[];covered=[];groups={};location_count=0
expected={entry['path']:entry for entries in manifest['groups'].values() for entry in entries}
actual=set(subprocess.check_output(['git','ls-files','src'],cwd=root,text=True).splitlines())
if actual!=set(expected):errors.append({'kind':'source-inventory-changed','added':sorted(actual-set(expected)),'removed':sorted(set(expected)-actual)})
for file,entry in expected.items():
 path=root/file
 if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:
  errors.append({'kind':'source-content-changed','file':file})
for group,entries in manifest['groups'].items():
 path=research/(group+'-coverage.json');report=research/(group+'.md');owned={e['path'] for e in entries}
 if not path.exists():errors.append({'kind':'coverage-missing','group':group});continue
 data=json.loads(path.read_text())
 if isinstance(data,dict):errors.append({'kind':'coverage-wrong-format','group':group});continue
 paths=[e.get('path') for e in data]
 if set(paths)!=owned:errors.append({'kind':'coverage-scope-mismatch','group':group,'missing':sorted(owned-set(paths)),'extra':sorted(set(paths)-owned)})
 for file,n in Counter(paths).items():
  if n!=1:errors.append({'kind':'duplicate-coverage','group':group,'file':file})
 report_text=report.read_text() if report.exists() else ''
 if not report_text:errors.append({'kind':'report-missing','group':group})
 for item in data:
  if item.get('status') not in ['reviewed','generated-verified','blocked']:errors.append({'kind':'invalid-status','item':item})
  if item.get('status')=='blocked':errors.append({'kind':'review-incomplete','group':group,'file':item['path']})
  if not item.get('note'):errors.append({'kind':'coverage-note-missing','group':group,'file':item['path']})
  if not isinstance(item.get('findings'),list):errors.append({'kind':'coverage-findings-invalid','group':group,'file':item['path']})
  else:
   for finding in item['findings']:
    if finding not in report_text:errors.append({'kind':'coverage-finding-undefined','group':group,'finding':finding})
 covered.extend(data);groups[group]={'files':len(data),'statuses':dict(Counter(e.get('status') for e in data))}
for report in research.glob('*.md'):
 for file,line in re.findall(r'(?<![A-Za-z0-9_/@.-])(src/[A-Za-z0-9_./$-]+\.(?:tsx?|css|json)):(\d+)',report.read_text()):
  location_count+=1;target=root/file
  if not target.exists():errors.append({'kind':'reference-file-missing','report':report.name,'file':file})
  elif not 1<=int(line)<=len(target.read_bytes().splitlines()):errors.append({'kind':'reference-line-out-of-range','report':report.name,'file':file,'line':int(line)})
result={'baseRevision':manifest['baseRevision'],'expectedFiles':len(expected),'coveredFiles':len(covered),'groups':groups,'sourceHashesUnchanged':not any(e['kind'].startswith('source-') for e in errors),'concreteLocationsChecked':location_count,'errors':errors,'passed':not errors}
(research/'audit-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(0 if result['passed'] else 1)
