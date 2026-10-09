from pathlib import Path
import json, os
root = Path(__file__).resolve().parents[1]
repo = next(path for path in root.parents if (path / ".trellis").is_dir())
ledger = json.loads((root / 'remediation-ledger.json').read_text())
labels = {'pending': '待处理', 'in_progress': '处理中', 'verified': '验证完成'}
lines = ['# 逐项整改台账', '', '51/51审查发现映射到32个顺序单元；实现、行为验证、独立复核完成才关闭。风险先核实，不需变更时记录证据。', '', '来源：`remediation-ledger.json`。本表由 `tools/render-ledger.py` 生成。', '', '| 单元 | 内容 | 关联发现 | 状态 | 独立复核 |', '|---|---|---|---|---|']
for unit in ledger['units']:
    review = unit.get('review')
    review_cell = f"[{unit['id']}复核]({os.path.relpath((Path(review) if Path(review).is_absolute() else repo / review).resolve(), root)})" if review else '—'
    lines.append(f"| {unit['id']} | {unit['title']} | {', '.join(unit['findings'])} | {labels.get(unit['status'], unit['status'])} | {review_cell} |")
lines.extend(['', (f"下一未完成单元：{ledger['currentUnit']}。" if ledger['currentUnit'] else "全部32个单元已验证完成。"), '', '## 用户示例与附加整理', '', '这些事项不加入51项已审查发现计数，仍按关联单元执行并保留证据。', ''])
for work in ledger.get('ancillaryWork', []):
    lines.append(f"- {work['id']} / {work['unit']}：{work['file']} — {work['scope']}（{labels.get(work['status'], work['status'])}）")
lines.append('')
(root / 'remediation-ledger.md').write_text('\n'.join(lines))
