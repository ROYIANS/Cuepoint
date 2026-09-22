# Implementation

1. Review pending readiness work and existing lifecycle/permissions; preserve uncommitted changes.
2. Add pure owned-ledger execution summary plus negative/legacy tests.
3. Integrate in AgentRunDetails with compact summary and expandable diagnostics; keep recovery actions and lazy process mounting.
4. Extend real runtime protocol tests for promise-only response, bookkeeping-only completion, failures/rejections and advice-only mode; no heuristic auto-loop.
5. Typecheck, focused and full tests, build; isolated browser check if available. Record live-model limitation separately.
6. Update specs and task evidence. No automatic commit or deployment.

Use explicit local pnpm path. No model calls with production credentials for verification.

## Second delivery
1. Implement atomic create-and-continue with explicit create-only opt-out, approval revision migration, exact origin provenance and stable replay.
2. Integrate settled tool/context refresh and current-scope execution; preserve request/history and frozen capability/permission limits.
3. Update creation result UI and outcome projection, plus Chat/Responses create/read/edit regression with no repeated user message.
4. Cover same-round cross-project calls, old approvals, rollback, duplicate execution, Stop, deleted owner, disabled tools and conversation mode. Run independent review, full gate, isolated browser fixture where available.
5. Record evidence/remaining live-model and semantic-stop gaps, update specs and commit this batch under existing user authorization.
