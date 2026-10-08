import subprocess,sys
from pathlib import Path
root=Path(__file__).parent
pnpm='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
focused=['d07RequestBoundary','d07RequestWire','apimart','apimartAudio','aihubmix','mimoSpeech','openaiCompatible','connectors','boundedInput','boundedChatInput','boundedAudioRuntime','chatStream','responsesStream','webResearch','mimoRuntime','audioGenerationRecoveryAudit','agentGenerationRecovery','agentGenerationBatchSafety','agentGenerationBatch','agentToolTransactions','agentTools','agentRunReview','agentRuns','providerCacheUsage','agentReferences','materialReferenceWire','reasoningPolicy','d05ToolCatalog','d05SchemaEquivalence','d05ToolMetadata','d06Capabilities']
gates=[('type-final',[pnpm,'lint']),('leaf-static-final',[node,str(root/'lint-leaves.mjs')]),('focused-final',[pnpm,'exec','vitest','run',*[f'tests/{name}.test.ts' for name in focused],'--reporter=dot','--maxWorkers=4']),('full-final',[pnpm,'test','--reporter=dot','--maxWorkers=4']),('build-final',[pnpm,'build']),('models-final',[pnpm,'model-bank:verify'])]
for name,cmd in gates:
 print('START',name,flush=True)
 result=subprocess.run([sys.executable,str(root/'run-gate.py'),name,*cmd])
 if result.returncode:print('STOP failed',name,flush=True);sys.exit(result.returncode)
# Immediate product/input freeze is a dependency of report writing.
result=subprocess.run([sys.executable,str(root/'freeze.py')])
sys.exit(result.returncode)
