# Architecture

IndexedDB remains authoritative. AgentConfig describes identity/instructions; AgentRun records one attempt with frozen model/request context and checkpoint; future AgentTask describes a durable goal across runs. Chat messages link to their run. Later tool calls and approvals are durable records attached to a run, not opaque message text.

A browser executes while alive. Local execution requires exclusive ownership across tabs. After ownership is released/lost, unfinished work becomes interrupted. Recovery inspects stored phase and known outcomes; it never restarts side-effecting requests blindly. Future generation steps persist provider task IDs and result-ingestion operation IDs. Atomic local writes and operation deduplication protect retry; unknown remote submissions require reconciliation or a user decision.

Reference: LobeHub agent-runtime loop/state/transport boundaries and messageWriteBatcher; retain the separation, not its server queues, Redis or PostgreSQL runtime.
