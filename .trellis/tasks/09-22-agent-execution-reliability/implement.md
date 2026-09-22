# Implementation

1. Review pending readiness work and existing lifecycle/permissions; preserve uncommitted changes.
2. Add pure owned-ledger execution summary plus negative/legacy tests.
3. Integrate in AgentRunDetails with compact summary and expandable diagnostics; keep recovery actions and lazy process mounting.
4. Extend real runtime protocol tests for promise-only response, bookkeeping-only completion, failures/rejections and advice-only mode; no heuristic auto-loop.
5. Typecheck, focused and full tests, build; isolated browser check if available. Record live-model limitation separately.
6. Update specs and task evidence. No automatic commit or deployment.

Use explicit local pnpm path. No model calls with production credentials for verification.
