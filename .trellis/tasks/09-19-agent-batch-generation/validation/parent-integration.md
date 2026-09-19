# Parent cross-child integration evidence

Date: 2026-09-19. Native Edge with disposable browser context and IndexedDB; real Agent runtime/tools and locally mocked model responses. Reproducible script: `parent-integration.cjs` with Vite at localhost:5185. No paid generation or user data.

## Passed scenario

1. Create task A with a real acceptance criterion. Run `character_create` through `executeChatRun`; verify the returned character exists with the expected name.
2. Read actual tool/entity evidence into a manual wrap-up, mark the criterion met, save and confirm a source-linked lesson, then complete task A with that exact confirmed summary identity.
3. Promote the reviewed lesson into project memory with the original task/summary revision and evidence.
4. Open a new project-bound task-mode conversation. Verify neither the thread nor `beginAgentRun` automatically creates a task. Execute the real `task_create` tool, verify task B ownership and its durable requirements record.
5. Inspect the actual model request and persisted audit for task B: the promoted lesson text and source-linked memory identity are present.
6. Continue actual task B with `prepare_generation_batch`, two MiniMax-H3 clip candidates and a browser-recorded 320×180 VP8 WebM fixture. Verify open drafts block completion and their bookkeeping tool does not support result claims.
7. Confirm and execute exactly two mocked video POSTs. Decode the saved Blob in a native video element, apply A then B, verify only B is current, and save a generation-backed verification record inside native IndexedDB. Mark Todo complete, save/confirm a current summary and complete task B.
8. Archive task A and verify the memory source is explicitly `historical` and remains locatable.
9. Explicitly replace the lesson; verify a fresh same-project request contains the correction and omits the superseded text. Verify an unrelated project's request excludes it.
10. Disable and then delete the replacement; fresh requests omit it in both cases.

Task B creation used exactly two mocked model requests (tool call plus continuation); its later video-batch proposal used a separate actual Agent run and two mocked paid-generation POSTs. No page errors. Initial fixture invocation passed the wrong argument shape to `getMemorySourceState`; corrected the fixture to `(projectId, memoryId)` and reran successfully. No product fix was needed for this scenario.

## Parent coverage and remaining work

- AC0: real task-mode creation plus requirements persistence and no premature auto-create verified here; the earlier orchestration child owns broader Todo/research/progress editing/recovery coverage.
- AC1: exact completed task A → reviewed lesson → actual task B request scenario verified here.
- AC2: replacement, project isolation, disable and delete behavior verified in fresh requests.
- AC4: archive retains accessible source verified here; reference withdrawal/deletion tests remain in the archived reference-intake quality record.
- AC3: batch runtime and native-browser gates pass unknown/reload/exact-POST/business-write checks. Native task B proves draft blocking, real output evidence and reviewed completion.
- AC5: batch implementation, independent review, tests, native browser acceptance and spec updates are complete. Work commits and archival remain outstanding. Parent is not complete.
