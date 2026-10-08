from pathlib import Path
import subprocess,sys
root=Path('.trellis/tasks/10-08-src-remediation-d/tools/d06')
pnpm='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm';node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
pw='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';chrome='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
focused=['d06Capabilities','output','generationPreferences','generationReviewDraft','agentGeneration','agentGenerationReview','agentGenerationReviewTransactions','agentGenerationBatch','agentGenerationBatchSafety','agentGenerationRecovery','agentGenerationEvidence','manualDraftBaseline','draftConcurrency','d05ToolCatalog','d05SchemaEquivalence','d05ToolMetadata','toolValidationSafety','toolValidationDiagnostics']
gates=[('type-final',[pnpm,'lint']),('leaf-lint-final',[node,str(root/'lint-leaf.mjs'),'leaf-lint-final']),('focused-final',[pnpm,'exec','vitest','run',*[f'tests/{name}.test.ts' for name in focused],'--reporter=dot','--maxWorkers=4']),('compiler-positive-final',[pnpm,'exec','tsc','--project','tests/typecheck/tsconfig.agent-tools.json','--pretty','false']),('compiler-negative-final',[node,'.trellis/tasks/10-08-src-remediation-d/reviews/D06-compiler-negatives.mjs']),('full-final',[pnpm,'test','--reporter=dot','--maxWorkers=4']),('build-final',[pnpm,'build']),('models-final',[pnpm,'model-bank:verify'])]
for prefix,script in [('B01','scripts/b01-browser-regression.mjs'),('B07','scripts/b07-browser-regression.mjs'),('C01','.trellis/tasks/10-08-src-remediation-d/reviews/D05-native.mjs'),('C01','.trellis/tasks/10-08-src-remediation-d/reviews/D06-native.mjs')]:
 name=Path(script).stem.lower()+'-final';gates.append((name,['env',f'{prefix}_PLAYWRIGHT_PATH={pw}',f'{prefix}_CHROMIUM_PATH={chrome}',node,script]))
for name,cmd in gates:
 name=name+(('-'+sys.argv[1]) if len(sys.argv)>1 else '')
 print('START',name,flush=True)
 result=subprocess.run([sys.executable,str(root/'run-gate.py'),name,*cmd])
 if result.returncode:print('STOP failed',name,flush=True);sys.exit(result.returncode)
print('ALL_SERIAL_GATES_PASS',flush=True)
