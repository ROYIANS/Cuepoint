# Batch generation retrospective

## Outcome
Delivered reviewed multi-target queues and candidate comparison with explicit application, durable identities and task evidence. Numeric limits are the user-approved 20 requests/four per target/two active. Existing single generation and provider field mappings are retained. Final evidence is in validation/quality.md.

## Lessons captured in executable specs
1. A durable pause alone is insufficient when persistence is the failed subsystem. Set a process-local dispatch stop before writing pause, preserve ambiguity and drain siblings before releasing the thread lock. An injected failure reproduced four sends instead of the initial two; regression now prevents it.
2. Registering a worker is not proof of Web Lock ownership. UI actions may reuse the worker only after acquisition; otherwise they must acquire or fail closed.
3. Shared transport entry is the uncertainty boundary. If saving acceptance fails, missing providerTaskId cannot establish that no paid POST occurred.
4. Bookkeeping provenance and output provenance differ. Batch prepare remains a draft tool result; verified task records use a task-owned generation source and current local media/slot state. Extend transaction scopes when source validation reads new tables.
5. Per-entity revision chains permit own sibling-slot writes and user candidate switching without tolerating external edits. Snapshot current output evidence rather than historical job labels.
6. Native review found nested Escape closing both preview and batch dialog. Handle the inner preview first and test actual controls, including a saved parameter reaching the submitted HTTP payload.
7. Cancellation and deletion differ. Cancellation retains auditable history/input references; deletion releases only those references and retains shared/business-owned media.

## Validation limits and finish
Mocked providers protect against accidental charges but cannot certify account availability or live output quality. Browser fixtures additionally decode real locally produced media and run native IndexedDB transactions. Existing bundle size warnings are unchanged. Work commits, archival and journal recording remain pending the single workflow approval; parent roadmap completion waits for final child archival.

## Finish update

User approved commits on 2026-09-19. Feature commit: `e6e3f94`; documentation commit: `2903466`. Child archived after work commits; parent AC5 closes with that archive. Earlier pending-finish statements describe the pre-commit validation snapshot. Session journal records final commit/acceptance state.
