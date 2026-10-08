import sys,subprocess,json,hashlib,datetime
from pathlib import Path
root=Path(__file__).parent
name=sys.argv[1];command=sys.argv[2:]
started=datetime.datetime.now().astimezone().isoformat()
with (root/(name+'.log')).open('w') as out:
    result=subprocess.run(command,stdout=out,stderr=subprocess.STDOUT)
log=root/(name+'.log')
entry={'startedAt':started,'finishedAt':datetime.datetime.now().astimezone().isoformat(),'command':command,'exitCode':result.returncode,'log':str(log),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()}
with (root/'gates.jsonl').open('a') as out:out.write(json.dumps(entry)+'\n')
print(json.dumps(entry));print(log.read_text()[-3000:]);sys.exit(result.returncode)
