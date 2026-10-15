# E05 bounded creative-operation interaction design

## Scope and authorization

The owner authorized sequential stages and a commit after each one. Prepare after source investigation; activate only after E04's reviewed stage commit. The source-backed recommendation in research/operation-feedback-design.md resolves routine archive/stop-remaining choices without another owner question. Keep normal success quiet under interaction-feedback.md.

Selected owners are project World and Studio asset create/delete, the existing project gallery archive label, and MaterialImportDialog serial file admission. Do not redesign asset editors, project ZIP import, source/audio workflows or a generic operations/job framework.

## Asset creation and deletion

Use synchronous mounted-owner ref locks before the first await and immediate state on the existing controls. Freeze kind/project/target facts at gesture time; stale operations cannot navigate or clear another owner. Project World should match Studio's existing guarded pattern. Await the create command once and retain its returned entity receipt separately from subsequent navigation. If opening fails after confirmed create, recovery opens that exact entity without calling add again. Known rollback keeps a useful explicit retry; successful creation needs no extra status surface.

Unknown creation is quarantined as an uncertain local intent with plain inspection guidance, without ordinary retry or automatic replay. Existing commands allocate IDs internally; no exact reconciliation by name/time/list count is valid. Caller-reserved identities and a generic outbox are excluded from this bounded delivery. Mounted-page recovery is distinct from reload persistence.

Keep delete confirmation mounted through actual acknowledgement: prevent default on the existing action, acquire a synchronous lock, disable duplicates and close only after success. Known rollback retains exact target and local error. Unknown delete stays associated with the target and cannot be retried destructively; a feature-owned readonly presence check verifies kind/owner/id. A missing row may dismiss the target as absent without claiming which actor deleted it or proving the original cascade receipt. Present/foreign/read failure leaves the original uncertainty unresolved. Dismissing recovery must not silently restore a target's ordinary retry within the mounted owner. Preserve one meaningful error location.

## Archive and serial import

Keep the existing exclusive archived predicate and rename the misleading `含已归档项目` control to `已归档`, beside `使用中`. Do not add an all-project mode or change search/filter/sort/cover ownership.

Extend the existing serial import loop with confirmed completed/total, current filename and a synchronous stop-remaining ref checked immediately before admitting the next file. Stop does not abort the in-flight command or undo confirmed saves. Await the current outcome, remove/count it only after acknowledged success, then retain unstarted files for explicit continuation. Freeze target/files and keep total stable through stop/failure/resume. Existing dialog pending/draft close guards remain the sole departure owner. MaterialLibraryPage retains the importer session across controlled visibility so uncertain head/queue cannot reset on close/reopen. Nonpending uncertain close only hides the dialog for inspection; ordinary discard/completion resets the session, and actual route/unload keeps the existing guard. No new MaterialControls copy/guard API is required.

Known failure retains the current and later files; continuation retries only the known rolled-back head, never acknowledged predecessors. Unknown head freezes the head and later queue: no replay or skip-forward, no filename-based resolution, and no full-success callback. Inspection guidance explains confirmed files remain saved. Exact automatic unknown import reconciliation is excluded because material/version IDs are generated inside the transaction. Only all-files success selects the last acknowledged material and closes once. Use the existing dialog progress area, no per-file toast or invented read/parse/upload percentages.

## Necessary validation

Use actual callbacks/ReactDOM with held command acknowledgements for same-tick duplicate create/delete/import, mounted destructive dialogs, known-failure retry, navigation-only recovery after confirmed create, stale-owner completions, typed unknown quarantine and readonly check outcomes. Verify the actual archive card collection with active/archived fixtures. Import tests cover stop during held current file, confirmed count, explicit continuation, known failure, unknown head and all-success callbacks. Preserve existing real command/store evidence; add only corresponding ownership/rollback tests if a new presence query is needed. Run scoped tests/direct types/lint/architecture; defer full/native/build gates to batch completion. No paid services or dependency changes.
