"""Curate next sequential unit contexts; no product code, closure or commit."""
from pathlib import Path
import json, sys
root=Path.cwd();task=Path(__file__).resolve().parents[1]
unit=sys.argv[1]
common=[("type-safety.md","Types and unknown boundaries"),("quality-guidelines.md","Actual regression checks")]
scopes={
"C02":([("audio-music.md","Music draft and historical value compatibility"),("agent-tools.md","Strict music tool schema and atomic ledger"),("ai-connectors.md","Wire parameter limits")],"C02-music-duration-contract.md"),
"C03":([("state-management.md","Parent ownership and transactional writes"),("production-contracts.md","Modern video ZIP and legacy import"),("ip-material-library.md","Studio ownership compatibility")],"C03-parent-package-contract.md"),
"C04":([("audio-music.md","Export freshness, package IDs and lifecycle")],"C04-audio-fingerprint-contract.md"),
"C05":([("state-management.md","Media write and retention transactions"),("asset-output-foundation.md","Slot reference and output ownership"),("production-contracts.md","Undo and proposal retention")],"C05-media-patch-contract.md"),
"C06":([("ai-connectors.md","Adapters and inbound protocol"),("audio-music.md","Decoder limits and paid recovery"),("agent-execution.md","Completion and preserved stream output"),("agent-web-research.md","Existing bounded inbound read patterns")],"C06-bounded-input-contract.md")}
if unit not in scopes:raise SystemExit("Unsupported unit")
ledger=json.loads((root/".trellis/tasks/09-30-src-quality-remediation/remediation-ledger.json").read_text())
if ledger["currentUnit"]!=unit:raise SystemExit("Not current ledger unit: "+str(ledger["currentUnit"]))
specs,research=scopes[unit]
entries=[{"file":".trellis/spec/frontend/"+name,"reason":reason} for name,reason in common+specs]
entries += [{"file":".trellis/spec/guides/cross-layer-thinking-guide.md","reason":"Shared boundaries"},{"file":".trellis/spec/guides/code-reuse-thinking-guide.md","reason":"One owner for rules"},{"file":str((task/"research"/research).relative_to(root)),"reason":unit+" refreshed contract"}]
if unit=="C05":entries.append({"file":str((task/"research/C05-manual-caller-followup.md").relative_to(root)),"reason":"Dynamic production caller payload follow-up"})
if unit=="C06":
 entries.append({"file":str((task/"research/C06-stream-reader-followup.md").relative_to(root)),"reason":"Handler ordering and actual provider media policy"})
 entries.append({"file":".trellis/tasks/09-30-src-quality-architecture-audit/research/providers-media.md","reason":"Original PM05 exact locations and risk classification"})
for action in ("implement","check"):(task/(action+".jsonl")).write_text("".join(json.dumps(e)+"\n" for e in entries))
print(json.dumps({"unit":unit,"entries":len(entries)}))
