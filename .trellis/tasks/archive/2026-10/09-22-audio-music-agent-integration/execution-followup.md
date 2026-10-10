# Avoid promise-only creative turns

Observed: user says start, assistant promises to read and execute but ends without business calls. Runtime already continues after real tool calls; no-call model outputs end the turn. Current guidance calls dependent work “next round” without distinguishing model requests from user turns, and each new bound sound-project run initially offers only discovery tools.

Scope: add explicit shared smart execution guidance and preload the enabled matching sound-project group from durable project kind. Apply the same initialization to actual runs and the context preview. Preserve disabled skills, conversation mode, permission ceiling, 36-tool cap, retry snapshots and approval ledgers. No keyword-driven forced loops, automatic paid submissions or claims of guaranteed model compliance. No new result-verification UI in this patch.

Files: skills/toolLoading for instructions and kind-based authorized initial offers; taskContext for durable project kind; agentRuns and ContextUsagePanel for consistent initialization; regression tests and frontend spec. Test real mocked Chat/Responses loops through read/write, readiness on a subsequent user turn, disabled groups/conversation, paid review parking, Stop and frozen retries. Live provider behavior remains unverified without a real session trace.

## Validation

- Added 12 regression tests in `audioAgentExecution.test.ts`; all pass.
- Both mocked protocols run real local reads and writes in one execution, using the actual read-result IDs; no second user turn is added. Paid generation parks at approval without generation jobs or paid requests.
- Initial readiness, later user turns, disabled skills, unbound/video contexts, conversation mode, Stop and immutable retry snapshots covered.
- Full suite: 114 files / 1308 tests passed. Typecheck, production build and diff check passed. Existing large-chunk build warnings remain.
- Original live model request/response trace was not available. These tests establish runtime behavior with scripted model outputs; they do not establish that the live model always follows the new guidance. No semantic completion validator or forced continuation loop shipped.
- Uncommitted changes ready for review.
