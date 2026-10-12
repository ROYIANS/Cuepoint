"""Finite, frozen local gates for the MiMo decoder follow-up; no publication."""
import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
PNPM = "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm"
NODE22 = "/Users/xiaomengdao/.nvm/versions/node/v22.21.1/bin"
NODE24 = "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin"
HELPER = Path(__file__).with_name("verify-ci-quality-followup.py")
# Reuse the earlier task's unchanged identity/environment/command receipt owners.
# Extract only the three helpers; never execute its historical runs or outputs.
tree = ast.parse(HELPER.read_text())
helpers = [node for node in tree.body if isinstance(node, ast.FunctionDef)
           and node.name in {"identities", "environment", "run"}]
assert len(helpers) == 3
exec(compile(ast.Module(body=helpers, type_ignores=[]), str(HELPER), "exec"))

PROBE = ROOT / "desktop/tauri/.acceptance/ci-probe-readiness-node22-20261012/target/debug/product_store_probe"
OUT = Path(__file__).with_name("logs") / "ci-mimo-boundary-final"
NATIVE_OUT = ROOT / "desktop/tauri/.acceptance/ci-mimo-boundary-final-native-20261012"
if NATIVE_OUT.exists():
    raise SystemExit("Native evidence output must be fresh")
OUT.mkdir(parents=True, exist_ok=False)
receipt = {
    "schema": 1, "startedAtUnix": time.time(),
    "baseline": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "platform": "local macOS ARM64; no hosted Linux or installer success implied",
    "receiptHelper": {"path": str(HELPER.relative_to(ROOT)),
                      "sha256": hashlib.sha256(HELPER.read_bytes()).hexdigest()},
    "probe": {"path": str(PROBE), "sha256": hashlib.sha256(PROBE.read_bytes()).hexdigest()},
    "nativeEvidenceKeptAt": str(NATIVE_OUT),
    "sourceBefore": identities(), "commands": [], "exitCode": None,
}
try:
    # Keep CPU-heavy product test runs sequential with unchanged test settings.
    run("ordinary-full-root-node22", ["test"], NODE22, True)
    run("ordinary-full-root-node24", ["test"], NODE24, True)
    run("complete-native-sqlite", ["test:storage:native", "--evidence-dir", str(NATIVE_OUT), "--suite", "all"])
    acceptance = NATIVE_OUT / "acceptance.json"
    (OUT / "native-acceptance.json").write_bytes(acceptance.read_bytes())
    run("root-types", ["lint"])
    run("root-quality", ["quality"])
    run("desktop-types", ["--dir", "desktop/tauri", "types"])
    run("desktop-lint", ["--dir", "desktop/tauri", "lint"])
    run("desktop-quality", ["--dir", "desktop/tauri", "quality"])
    run("quality-self-test", ["quality:self-test", "--output", str(OUT / "quality-self-test")])
    run("model-verify", ["model-bank:verify"])
    run("production-build", ["build"])
    receipt["exitCode"] = 0
except Exception as error:
    receipt["exitCode"] = 1
    receipt["failure"] = str(error)
finally:
    receipt["sourceAfter"] = identities()
    receipt["changedInputs"] = [p for p in sorted(set(receipt["sourceBefore"]) | set(receipt["sourceAfter"]))
                                if receipt["sourceBefore"].get(p) != receipt["sourceAfter"].get(p)]
    if receipt["changedInputs"]:
        receipt["exitCode"] = 1
    receipt["finishedAtUnix"] = time.time()
    (OUT / "verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"exitCode": receipt["exitCode"], "changedInputs": receipt["changedInputs"]}), flush=True)
raise SystemExit(receipt["exitCode"])
