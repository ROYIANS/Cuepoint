"""Render a concrete B commit plan from reviewed files; never stage or commit."""
from pathlib import Path
import json, subprocess

task = Path(__file__).resolve().parents[1]
dirty = {path for output in (
    subprocess.check_output(['git', 'diff', '--name-only', '-z'], text=True),
    subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '-z'], text=True))
    for path in output.split('\0') if path}

def unit_paths(unit):
    path = task / 'reviews' / f'{unit}-check-snapshot.json'
    if not path.exists():
        path = task / 'reviews' / f'{unit}-check-coverage.json'
    snapshot = json.loads(path.read_text())
    mapping = snapshot.get('after', snapshot.get('sha256', {}))
    if not mapping:
        mapping = {entry['path']: entry['sha256'] for entry in snapshot.get('files', [])}
    return list(mapping)

groups = [
    ('fix: 保持工作区身份和局部写入意图', ['B01', 'B03'], ['.trellis/spec/frontend/state-management.md']),
    ('fix: 隔离编辑请求和主题发送草稿', ['B02', 'B06', 'B07'], [
        '.trellis/spec/frontend/project-memory.md', '.trellis/spec/frontend/hook-guidelines.md',
        '.trellis/spec/frontend/agent-references.md']),
    ('fix: 校验服务响应和恢复音乐任务', ['B04', 'B05'], [
        '.trellis/spec/frontend/ai-connectors.md', '.trellis/spec/frontend/audio-music.md']),
]
commits, assigned = [], set()
for message, units, specs in groups:
    files = sorted({path for unit in units for path in unit_paths(unit)
                    if path in dirty and path.startswith(('src/', 'tests/', 'scripts/'))}
                   | {path for path in specs if path in dirty})
    if assigned.intersection(files):
        raise SystemExit('Overlapping commit file groups')
    assigned.update(files)
    commits.append({'message': message, 'units': units, 'files': files})
remaining = dirty - assigned
unknown = sorted(path for path in remaining if not path.startswith((
    '.trellis/tasks/09-30-src-remediation-b/', '.trellis/tasks/09-30-src-quality-remediation/')))
commits.append({'message': 'chore: 记录源码整改B验证和后续关口',
                'files': sorted(remaining - set(unknown))})
plan_path = task / 'commit-plan.json'
previous = json.loads(plan_path.read_text()) if plan_path.exists() else {}
plan = {'status': previous.get('status', 'draft-awaiting-final-gate-and-full-scope-review'),
        'baseRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
        'commits': commits, 'unrecognizedDirtyFiles': unknown, 'approval': previous.get('approval')}
plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
markdown = ['# B batch concrete commit plan', '', 'Status: ' + plan['status'], '',
            'Commit only after the one Phase3.4 human confirmation. No push/archive/publication.', '']
for index, entry in enumerate(commits, 1):
    markdown += [f'## {index}. {entry["message"]}', '', f'{len(entry["files"])} files:', '']
    markdown += ['- `' + path + '`' for path in entry['files']]
    markdown.append('')
markdown += ['## Unrecognized dirty files', '']
markdown += ['- `' + path + '`' for path in unknown] if unknown else ['None.']
(task / 'commit-plan.md').write_text('\n'.join(markdown) + '\n')
print(json.dumps({'commits': [{'message': entry['message'], 'files': len(entry['files'])}
                             for entry in commits], 'unknown': unknown}, ensure_ascii=False, indent=2))
