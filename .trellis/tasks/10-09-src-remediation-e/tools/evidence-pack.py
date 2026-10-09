#!/usr/bin/env python3
"""Lossless content-addressed evidence transport; never deletes original evidence."""
import argparse, gzip, hashlib, json, os, sys
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['inventory','pack','verify','restore'],required=True);parser.add_argument('--output',required=True);parser.add_argument('--restore-root');parser.add_argument('--receipt');parser.add_argument('--preserve-root',action='append',default=[]);args=parser.parse_args()
root=Path.cwd();task=Path(__file__).resolve().parents[1];out=Path(args.output).resolve()
preservedRoots=[]
for value in args.preserve_root:
 p=(root/value).resolve()
 if task not in p.parents or not p.is_dir():raise SystemExit('Preserved evidence root must be an existing directory inside the task')
 preservedRoots.append(p)
h=lambda data:hashlib.sha256(data).hexdigest()
if args.mode in ['inventory','pack']:
 if out.exists():raise SystemExit('Refusing existing output '+str(out))
 out.mkdir(parents=True);files=[];links=[];blobs={};excluded=[]
 for directory,dirs,names in os.walk(task):
  base=Path(directory)
  kept=[]
  for name in dirs:
   p=base/name
   if p==out or out in p.parents:continue
   if name in ['node_modules','.git','__pycache__'] and not any(p==saved or saved in p.parents for saved in preservedRoots):
    excluded.append(str(p.relative_to(root)));continue
   if p.is_symlink():links.append({'path':str(p.relative_to(root)),'target':os.readlink(p)});continue
   kept.append(name)
  dirs[:]=kept
  for name in sorted(names):
   p=base/name
   if p==out or out in p.parents:continue
   if p.is_symlink():links.append({'path':str(p.relative_to(root)),'target':os.readlink(p)});continue
   data=p.read_bytes();digest=h(data);row={'path':str(p.relative_to(root)),'sha256':digest,'bytes':len(data)};files.append(row);blobs.setdefault(digest,p)
 manifest={'format':'sha256-gzip-blobs-v1','purpose':'Lossless duplicate-content evidence transport, original files retained locally. Paths are restored under explicit repository root only after exact SHA256/byte checks. Dependency/cache directories excluded; no evidence status rewritten.','files':sorted(files,key=lambda r:r['path']),'symlinks':sorted(links,key=lambda r:r['path']),'excludedDirectoryRoots':sorted(excluded),'explicitPreservedEvidenceRoots':[str(p.relative_to(root)) for p in preservedRoots],'fileCount':len(files),'originalBytes':sum(f['bytes'] for f in files),'uniqueBlobs':len(blobs),'uniqueBytes':sum(p.stat().st_size for p in blobs.values())}
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({k:manifest[k] for k in ['fileCount','originalBytes','uniqueBlobs','uniqueBytes']},indent=2),flush=True)
 if args.mode=='pack':
  # Individually gzip unique content; existing repeated screenshots/bundles/source
  # copies share blobs without changing historical path or byte identity.
  bd=out/'blobs';bd.mkdir();packed=[]
  for index,(digest,p) in enumerate(sorted(blobs.items())):
   data=p.read_bytes()
   if h(data)!=digest:raise SystemExit('Input changed during pack '+str(p))
   target=bd/(digest+'.gz')
   with target.open('wb') as f:
    with gzip.GzipFile(filename='',mode='wb',fileobj=f,compresslevel=6,mtime=0) as stream:stream.write(data)
   packed.append({'sha256':digest,'compressedSHA256':h(target.read_bytes()),'compressedBytes':target.stat().st_size})
   if (index+1)%2000==0:print('packed',index+1,'/',len(blobs),flush=True)
  # Rehash every original path, not just one representative of duplicate bytes.
  changes=[r['path'] for r in files if h((root/r['path']).read_bytes())!=r['sha256']]
  if changes:raise SystemExit('Original evidence changed during pack '+str(changes))
  (out/'blobs.json').write_text(json.dumps({'blobs':packed,'totalCompressedBytes':sum(r['compressedBytes'] for r in packed)},indent=2)+'\n')
  print('packedcompressed',sum(r['compressedBytes'] for r in packed),flush=True)
else:
 manifest=json.loads((out/'manifest.json').read_text());packed=json.loads((out/'blobs.json').read_text());lookup={r['sha256']:r for r in packed['blobs']};sizes={r['sha256']:r['bytes'] for r in manifest['files']};assert len(lookup)==len(sizes)==manifest['uniqueBlobs'];checked={}
 destination=Path(args.restore_root).resolve() if args.restore_root else None
 if args.mode=='restore' and not destination:raise SystemExit('restore requires --restore-root')
 if args.mode=='restore' and destination.exists():raise SystemExit('Restore requires a new destination directory, never an existing repository/worktree')
 for digest,row in sorted(lookup.items()):
  p=out/'blobs'/(digest+'.gz');raw=p.read_bytes()
  if h(raw)!=row['compressedSHA256'] or len(raw)!=row['compressedBytes']:raise SystemExit('Compressed blob mismatch '+digest)
  data=gzip.decompress(raw)
  if h(data)!=digest or len(data)!=sizes[digest]:raise SystemExit('Restored blob mismatch '+digest)
  checked[digest]=True
 if destination:
  for row in manifest['files']:
   relative=Path(row['path'])
   if relative.is_absolute() or '..' in relative.parts:raise SystemExit('Unsafe archived path '+str(relative))
   p=destination/relative
   if destination not in p.resolve().parents:raise SystemExit('Restored path escapes destination '+str(relative))
   if p.exists():
    if not p.is_file() or h(p.read_bytes())!=row['sha256']:raise SystemExit('Refusing overwrite mismatching restored evidence '+str(p))
    continue
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(gzip.decompress((out/'blobs'/(row['sha256']+'.gz')).read_bytes()))
  # Dependency/cache symlinks are documented but deliberately not restored;
  # installed environment paths are not part of portable proof bytes.
 receipt={'status':'PASS','manifestSHA256':h((out/'manifest.json').read_bytes()),'blobIndexSHA256':h((out/'blobs.json').read_bytes()),'verifiedBlobs':len(checked),'verifiedPaths':manifest['fileCount'],'originalBytes':manifest['originalBytes'],'compressedBytes':packed['totalCompressedBytes'],'mode':args.mode,'restoredRoot':str(destination) if destination else None,'originalsDeleted':False}
 target=Path(args.receipt).resolve() if args.receipt else out/(args.mode+'-receipt.json')
 if target.exists():raise SystemExit('Refusing existing verification receipt')
 target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
