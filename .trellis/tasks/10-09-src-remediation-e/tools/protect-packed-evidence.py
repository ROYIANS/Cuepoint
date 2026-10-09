from pathlib import Path
import json
root=Path.cwd();task=root/'.trellis/tasks/10-09-src-remediation-e';manifest=json.loads((task/'evidence-pack/manifest.json').read_text());normal=set()
for folder in [task,task/'research',task/'reviews',task/'tools']:
 for p in folder.iterdir():
  if p.is_file() and p.suffix in ['.md','.json','.jsonl','.py','.mjs','.cjs'] and p.stat().st_size<=4_000_000:normal.add(p.relative_to(task).as_posix())
# Packed blobs and the exact new read-only transport review remain readable/
# explicitly staged. Completed raw proof directories are represented inpack.
normal.update(['.gitignore','commit-plan.json','commit-plan.md','evidence-pack/','reviews/E-evidence-transport-independent/'])
ignored=set()
for row in manifest['files']:
 rel=Path(row['path']).relative_to(task.relative_to(root)).as_posix()
 if rel in normal:continue
 parts=rel.split('/');chosen=rel
 for n in range(1,len(parts)):
  prefix='/'.join(parts[:n])+'/'
  if not any(k.startswith(prefix) or prefix.startswith(k) for k in normal):chosen=prefix;break
 ignored.add(chosen)
# Only literal task proof paths, no blanket task/source/test/vendor patterns.
# These relative rules follow an eventual archive move and stop auto-bookkeeping
# from readding >2GB raw duplicates after the approved lossless transportcommit.
def escape(value):return ''.join('\\'+c if c in '*?[!#\\ ' else c for c in value)
lines=['# Raw E evidence remains local and is preserved exactly in evidence-pack/.','# Literal proof paths only; current docs/tools/transport and all product files remain trackable.']
lines.extend('/'+escape(k) for k in sorted(ignored));p=task/'.gitignore';assert not p.exists();p.write_text('\n'.join(lines)+'\n')
# Current small normal files cannot intersect a suppressed prefix.
for k in normal:
 assert not any(k==v or (v.endswith('/') and k.startswith(v)) for v in ignored),k
print('LiteralrawproofGitignorepaths',len(ignored),'allcurrentnormalpathsprotected',len(normal))
