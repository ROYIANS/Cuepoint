# E02 implementation evidence

## Delivered scope

Immediate page-local submitted attempts with exact reference revisions; independent next-draft editing; explicit failed/uncertain recovery; canonical admission IDs and create-only writes; atomic expected-project ownership; retained first-home handoff and eager transcript fallback. No schema, shared-core/provider protocol, dependency or background-host change.

## Focused verification and full changed-scope review

- Admission owner: `agentAdmission`, `agentRuns` and `agentReferences` passed as three files / 50 cases. New admission file contributes 18 real ProductStore cases, including asynchronous owner-change races, duplicate insert rollback, exact references and positive read-only acceptance.
- UI final review: B07 passed 40 cases and presentation passed six (46 total). The B07 integration commits actual begin, injects an unknown acknowledgement and uses the actual reader: one run/two messages/zero model execution. It then proves live lock refusal and explicit scoped recovery to interrupted without another begin/request.
- Existing connector regressions passed 99 cases in the UI owner's affected run. These groups passed in scoped runs, not one full-suite run.
- Real ReactDOM coverage verifies exact eager submitted content, held rich import, accepted-observation joining, retained composer DOM and absence of normal transient status. Projection tests cover chronology and exact canonical deduplication; scheduling tests cover two animation frames and the bounded hidden-document fallback.
- Final direct Studio TypeScript check passed. ESLint across all 11 changed TS/TSX source files: zero errors, 19 review warnings (including current flow complexity, not all historical).
- Architecture: 642 production files, 2552 static value edges, 11 literal dynamic edges, zero cycles/failures/computed imports; report `/tmp/e02-review-architecture.json`.
- Independent Trellis review covered the complete E02 changed scope, fixed its findings and froze product source. No blocking functional finding remains. Root spec-link checks, curated-manifest validation and staged whitespace verification also passed.

## Review corrections

- Positive unknown-admission reconciliation keeps an explicit 查看恢复选项 action even after the canonical user is visible. The action recovers only the owned thread under the existing lock and makes no model request. A genuinely live competing owner is refused; normal terminal/resumable records use existing controls.
- The owner rejected transient text beside normal user messages. Preparing and ordinary accepted bubbles now render without that status wrapper/copy; actionable failure, uncertainty and recovery controls remain. Actual ReactDOM assertions check the absence in both preparing and accepted cold fallback states.

## Explicit limits

Drafts and attempts retain the mounted Agent page's existing lifetime, without reload/crash persistence. Unknown creation/update acknowledgement remains conservatively unresolved when no complete positive admission receipt exists; an absent read never enables automatic retry, deletion or paid dispatch. Explicit negative native-operation status recovery would require a separate storage contract.

The owner requested necessary affected checks per stage. Full test suites, production builds, packaging, native integration and live paid providers are deferred to final batch integration. React DOM commit/callback assertions must be described separately from compositor paint or measured live latency.
