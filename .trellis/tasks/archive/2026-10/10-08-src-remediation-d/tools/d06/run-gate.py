import sys,subprocess,json,hashlib,datetime
from pathlib import Path
root=Path(__file__).parent
name=sys.argv[1];cmd=sys.argv[2:]
with (root/(name+'.log')).open('w') as out:
 result=subprocess.run(cmd,stdout=out,stderr=subprocess.STDOUT)
entry={'at':datetime.datetime.now().astimezone().isoformat(),'command':cmd,'exitCode':result.returncode,'log':str(root/(name+'.log')),'sha256':hashlib.sha256((root/(name+'.log')).read_bytes()).hexdigest()}
with (root/'gates.jsonl').open('a') as out:out.write(json.dumps(entry)+'\n')
print(json.dumps(entry));print((root/(name+'.log')).read_text()[-2500:]);sys.exit(result.returncode)
