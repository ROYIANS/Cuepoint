"""Task-owned verification receipt; does not modify product source or publish."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
if sys.argv[1:] not in ([], ["--native-recheck"]):
    raise SystemExit("Usage: verify-ci-quality-followup.py [--native-recheck]")
RECHECK = bool(sys.argv[1:])
OUT = Path(__file__).with_name("logs") / ("ci-quality-followup-recheck" if RECHECK else "ci-quality-followup")
PNPM = "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm"
NODE22 = "/Users/xiaomengdao/.nvm/versions/node/v22.21.1/bin"
NODE24 = "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin"
PROBE = ROOT / "desktop/tauri/.acceptance/ci-probe-readiness-node22-20261012/target/debug/product_store_probe"


def identities():
    paths = []
    for name in ("src", "tests", "scripts", "desktop/tauri/scripts", "desktop/tauri/ui",
                 "desktop/tauri/src-tauri/src", "desktop/tauri/src-tauri/permissions",
                 "desktop/tauri/src-tauri/capabilities", ".github/workflows", "quality"):
        paths += [p for p in (ROOT / name).rglob("*") if p.is_file()]
    for name in ("package.json", "pnpm-lock.yaml", "vitest.config.ts", "knip.json",
                 "eslint.config.mjs", "tsconfig.json", "tsconfig.app.json", "vite.config.ts",
                 "desktop/tauri/package.json", "desktop/tauri/knip.json",
                 "desktop/tauri/tsconfig.json", "desktop/tauri/eslint.config.mjs",
                 "desktop/tauri/src-tauri/Cargo.toml", "desktop/tauri/src-tauri/Cargo.lock",
                 "desktop/tauri/src-tauri/build.rs"):
        paths.append(ROOT / name)
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(set(paths)) if p.is_file()}


def environment(node_bin, real_probe=False):
    env = dict(os.environ)
    env["PATH"] = node_bin + os.pathsep + env.get("PATH", "")
    for name in ("CUEPOINT_STORAGE_TEST_OWNER", "CUEPOINT_NATIVE_STORAGE_ACCEPTANCE",
                 "CUEPOINT_NATIVE_STORE_PROBE", "CUEPOINT_TOOL_COVERAGE_DIR"):
        env.pop(name, None)
    if real_probe:
        env["CUEPOINT_NATIVE_STORE_PROBE"] = str(PROBE)
    return env


def run(label, arguments, node_bin=NODE24, real_probe=False):
    command = [PNPM, *arguments]
    started = time.time()
    print(f"Starting {label}", flush=True)
    with (OUT / f"{label}.log").open("w") as log:
        result = subprocess.run(command, cwd=ROOT, env=environment(node_bin, real_probe),
                                stdout=log, stderr=subprocess.STDOUT, check=False)
    row = {"label": label, "command": command, "nodeBin": node_bin,
           "realProbeOverride": str(PROBE) if real_probe else None,
           "exitCode": result.returncode, "seconds": time.time() - started,
           "log": f"{label}.log"}
    receipt["commands"].append(row)
    (OUT / "verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(f"Finished {label}: exit {result.returncode}", flush=True)
    if result.returncode:
        raise RuntimeError(f"Reached {label} failure; inspect its retained log")


OUT.mkdir(parents=True, exist_ok=False)
receipt = {"schema": 1, "startedAtUnix": time.time(),
           "baseline": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
           "platform": "local macOS ARM64; no hosted Linux or installer result implied",
           "probe": {"path": str(PROBE), "sha256": hashlib.sha256(PROBE.read_bytes()).hexdigest()},
           "sourceBefore": identities(), "commands": [], "exitCode": None}
try:
    # Run product tests without competing build/quality processes.
    if RECHECK:
        prior_path = OUT.with_name("ci-quality-followup") / "verification.json"
        prior = json.loads(prior_path.read_text())
        ordinary = next(row for row in prior["commands"] if row["label"] == "ordinary-full-root-node22")
        if ordinary["exitCode"] or prior["changedInputs"] or prior["sourceAfter"] != receipt["sourceBefore"]:
            raise RuntimeError("Cannot reuse prior ordinary root pass after source changes")
        receipt["reusedOrdinaryRoot"] = {"receipt": str(prior_path), "sourceUnchanged": True,
                                         "command": ordinary}
    else:
        run("ordinary-full-root-node22", ["test"], NODE22, True)
    run("complete-native-sqlite", ["test:storage:native", "--evidence-dir",
                                   str(OUT / "native-all"), "--suite", "all"])
    run("root-types", ["lint"])
    run("desktop-types", ["--dir", "desktop/tauri", "types"])
    run("desktop-lint", ["--dir", "desktop/tauri", "lint"])
    run("root-quality", ["quality"])
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
