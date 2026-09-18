# LobeHub reference decisions

Read-only reference: `/Users/xiaomengdao/WebstormProjects/lobehub`, HEAD ebe586289d (2026-09-18).

| Source | Useful contract | Cuepoint adaptation |
| --- | --- | --- |
| packages/agent-runtime/src/loop/index.ts | Step loop separates host execution from stop reasons; parked is not completed | Explicit run statuses now; multi-step and approvals in child 2 |
| packages/agent-runtime/src/types/state.ts | Execution origin and configuration snapshot | AgentRun links input/output IDs, original request, agent/model/connector snapshot and retry origin |
| src/store/chat/slices/agentRun/actions/transports/hetero/messageWriteBatcher.ts | Serialize writes and merge consecutive updates; expose persistence failure | Local coalescing writer; flush rejects on failure, abort transport, never mark failed persistence successful |
| packages/context-engine | Rebuild request context from known history and valid tool chains | Text-only completed history now; tool-chain context added with child 2 |

Do not copy server queues, Redis locks or backend snapshot stores into this frontend. Use Web Locks for live tab ownership and IndexedDB for durable checkpoints. Browser freeze alone is not evidence that another tab abandoned a run.

LobeHub's batcher flush deliberately resolves despite callback failure; our terminal transition needs stronger acknowledgement, so our flush rejects. No hidden model-state restoration is implied by a saved request.
