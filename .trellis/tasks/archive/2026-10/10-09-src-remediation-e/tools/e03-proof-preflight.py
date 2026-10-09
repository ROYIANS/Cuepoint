#!/usr/bin/env python3
"""Read-only exact CSS proof inspection; no producer overwrite or unit closure."""
from pathlib import Path
import json,hashlib,sys
r=Path(__file__).resolve().parents[1]
name=sys.argv[1]
if not name or '/' in name or '..' in name:raise SystemExit('Supply e03 output directory name')
p=r/'research/e03'/name/'observations.json';d=json.loads(p.read_text());captures=d.get('captures',[])
errors=[]
if d.get('failure'):errors.append({'runFailure':d['failure']})
if d.get('errors'):errors.append({'pageErrors':d['errors']})
if d.get('sourceChangesDuringRun'):errors.append({'sourceChanged':d['sourceChangesDuringRun']})
for c in captures:
 for suffix,key in [('.png','currentPngSha256'),('-original.png','originalPngSha256')]:
  f=p.parent/(c['name']+suffix);expected=c.get('samePageComparison',{}).get(key)
  if expected is None:errors.append({'missingPairedHash':c['name'],'key':key});continue
  if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=expected:errors.append({'imageMismatch':str(f)})
 pair=c.get('samePageComparison',{})
 if pair.get('originalStyleAndGeometrySha256')!=pair.get('currentStyleAndGeometrySha256') or not pair.get('everyPropertyAndGeometryEquivalent'):errors.append({'computedMismatch':c['name']})
 if c.get('pixelComparison',{}).get('differentPixels')!=0:errors.append({'pixelMismatch':c['name']})
 for row in pair.get('currentSheets',[]):
  f=Path(row['path'])
  if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=row['sha256']:errors.append({'currentStylesheetHashMismatch':str(f)})
print(json.dumps({'purpose':'Read-only completed/partial paired proof integrity only, not independent behavior acceptance','run':str(p),'captureCount':len(captures),'observedPageErrors':d.get('errors'), 'sourceChangesDuringRun':d.get('sourceChangesDuringRun'),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
