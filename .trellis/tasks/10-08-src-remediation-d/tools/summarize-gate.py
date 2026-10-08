"""Validate immutable whole-D gate evidence; never alter source or declare independent PASS."""
from pathlib import Path
import hashlib, json, re
root=Path.cwd();task=Path(__file__).resolve().parents[1];out=task/'reviews/integration'
commands=json.loads((out/'commands.json').read_text())
extra=json.loads((task/'reviews/native-gate-plan.json').read_text())
expected=['typecheck','tests','b01-browser','b07-browser','c01-browser','c02-browser']+[row['name'] for row in extra]+['models','build']
if [r['name'] for r in commands]!=expected or any(r['exit'] for r in commands):raise SystemExit('Incomplete/failed integration commands')
pre=json.loads((out/'pre-gate-source-hashes.json').read_text());post=json.loads((out/'post-gate-source-hashes.json').read_text())
if pre!=post:raise SystemExit('Gate changed source/test/script hashes')
if (out/'diffcheck.txt').read_text().strip():raise SystemExit('Whitespace diagnostics remain')
for stage in ('pre', 'final'):
 whitespace=json.loads((out/(stage+'-whitespace.json')).read_text())
 if whitespace.get('status')!='PASS':raise SystemExit('Tracked/untracked whitespace check failed: '+stage)
 for row in whitespace['untrackedFiles']:
  if hashlib.sha256((root/row['path']).read_bytes()).hexdigest()!=row['sha256']:raise SystemExit('Whitespace input changed: '+row['path'])
for name,digest in post.items():
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=digest:raise SystemExit('Changed since gate: '+name)
coverage=json.loads((out/'review-file-coverage.json').read_text())
if coverage['missingOrChanged']:raise SystemExit('Incomplete current independent file coverage')
static=json.loads((out/'eslint-summary.json').read_text())
added=static['addedComplexity']
noncomplex=static['addedNoncomplexity']
if noncomplex:raise SystemExit('New noncomplexity diagnostics: '+json.dumps(noncomplex,ensure_ascii=False))
for name,value in static['hashes'].items():
 path=root/name
 actual=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
 if actual!=value['after']:raise SystemExit('Static source differs from integration freeze: '+name)
ast=json.loads((out/'ast-summary.json').read_text())
if ast['parseErrors'] or ast['staticValueCycles']:raise SystemExit('AST parse errors/value cycles remain')
if (out/'ast-results.json').is_file():
 ast_details=json.loads((out/'ast-results.json').read_text())
else:raise SystemExit('Missing complete AST results')
text=(out/'tests-stdout.txt').read_text();text=re.sub(r'\x1b\[[0-9;]*m','',text)
result={'status':'integration-gates-passed-awaiting-fullscope-independent-check','commands':commands,'frozenSourceTestScriptRunnerAndToolHashes':len(post),'reviewedChangedFiles':len(coverage['files']),'testSummary':[line.strip() for line in text.splitlines() if re.match(r'\s*(Test Files|Tests)\s',line)],'staticSourceFiles':static['files'],'astSummary':ast,'newNoncomplexityDiagnostics':noncomplex,'changedComplexityDiagnostics':added,'staticDiagnosticCounts':{'errors':static['currentErrors'],'warnings':static['currentWarnings']},'limitations':'Existing static debt remains; browser runs cover local fixtures, not live providers/full product. This tool does not replace independent full-scope review.'}
(out/'gate-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('commands','limitations')},ensure_ascii=False,indent=2))
