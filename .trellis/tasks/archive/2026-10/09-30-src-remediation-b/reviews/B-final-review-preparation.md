# B final review preparation — B01–B06 only

Prepared 2026-09-30, Asia/Shanghai, as a bounded read-only sidecar while B07 is active. Baseline and current HEAD: `20b0204c9fab43e1265b94761ee880649be2fca9` (committed A). This is preparation for the later full-scope review, **not full-batch acceptance**.

## Scope and method

Read the active task's check.jsonl, prd.md, design.md, implement.md, research/B-batch-review-contract.md, all reviews/B01–B06-check.md and their latest snapshots. Read frontend/index.md, including Quality Check, and the relevant disk sections of state-management.md (complete A04/B01/B03 late contracts), project-memory.md, hook-guidelines.md, ai-connectors.md and audio-music.md. Compared B01–B06 product changes with committed A, inspected changed/new behavioral tests and the B01 browser fixture, and traced the existing repository/package/editor call boundaries below.

The latest applicable unit snapshots cover 28 distinct product paths, 11 changed/new behavioral test paths, five unchanged compatibility-test paths, and three fixture/runner paths: 47 distinct paths in total. Reading/hashing them at entry and again before writing this note found no mismatches or intervening drift. This is provenance, not a test result. In particular, ShotEditorPage uses **B03's after hash**, superseding B01's original hash; B05 uses the final checker snapshot with surrogate validation and the final 203-case evidence; B06 uses its final after map. No stale unit hash was treated as current.

No tests, lint, build, model verification, browser run, provider request or integration scanner were executed for this preparation. Prior individual-unit results are referenced, not reissued. No product/test files, specs, metadata, status, ledger, commits, dependencies or archives were changed. The only sidecar output is this note.

Excluded from any conclusion: active B07 AgentChatPage/useReferenceDraft/compose-session tests and B07-specific spec changes. Reading the task's execution boundary does not certify their current implementation. No other agent was spawned or messaged.

## Responsibility and evidence map

All product paths below are relative to `src/`. Whole-file overlapping changes remain attributed to their latest unit snapshot.

| Unit | Product paths inspected against A | Behavioral evidence inspected |
| --- | --- | --- |
| B01 identity and manual departure | components/assets/{Character,Prop,Scene,Style}DetailPage.tsx; components/produce/StoryboardPrintPage.tsx; components/shots/ShotEditorPage.tsx (shared with B03); components/slots/GenerationSlotCard.tsx; components/studio/materials/{MaterialControls,MaterialDetailPanel}.tsx; components/workspace/{ProjectSettingsPanel,WorkspaceChrome}.tsx; lib/useManualDraftGuard.tsx; lib/workspaceAvailability.ts; routes/p.$projectId.index.tsx; routes/p.$projectId.tsx | b01QueryIdentity and manualDraftWiring; actual styled tests/fixtures/b01 + scripts/b01-browser-regression.mjs; preserved A04 manualDraftBaseline, draftMedia and output-draft assertions. Prior browser evidence and its scheduling limitation are in B01-check.md. |
| B02 frozen promotion session | components/agent/TaskWrapup.tsx; components/memory/{MemoryPromotion,MemoryEditor}.tsx | b02MemoryPromotion: actual source intentions, shared synchronous lock, cloned body/ref/excerpt, stale close/save/pending, successful-session retirement, unmount/owner changes and explicit revision reconciliation. |
| B03 changed-field/set intent | components/agent/ContextParameters.tsx; db/contextSettings.ts; db/repo.ts; components/shots/ShotEditorPage.tsx | b03IntentBoundaries: actual stale callbacks + real Dexie writes, independent/same-field policy intent, optional clearing, full replacement, rapid checkbox operations, invalid ownership/survivors, exact-array clear and unrelated field preservation. |
| B04 protocol envelope/request gate | lib/ai/openaiCompatible.ts | openaiCompatible, connectors and modelMetadata changes: fresh Response objects, malformed GET bodies, permitted fallback matrix, valid success mocks on forbidden POST paths, exact method/count assertions and conservative optional metadata. |
| B05 task identity/cancellation/recovery | lib/ai/apimartAudio.ts; lib/audioGeneration/{taskIds,observations,runtime}.ts | apimartAudio, audioGenerationRecoveryAudit and audioTaskEvidence changes: real Request URL encoding, surrogate/control/length limits, repair before first GET, siblings/history, uncertain paid outcomes, zero-POST recovery and real package rollback. |
| B06 connector/file sessions | components/studio/ConnectorsPage.tsx; components/story/StoryPage.tsx | b06EditorSessions: frozen effective credentials and nested reads, synchronous write locks, obsolete finally/unmount suppression, edit/revert revision, candidate replacement, explicit latest/adopt/discard, and actual 400ms debounce persistence. |

Latest authority: reviews/B01-check-snapshot.json, B02-check-snapshot.json, B03-check-snapshot.json, B04-check-snapshot.json, B05-check-snapshot.json and B06-check-snapshot.json. Their reports retain the precise focused commands, source hashes, fixed defects and evidence limits; this note does not aggregate their counts into a new gate.

## Cross-unit consistency inspected

### Identity, route guards and A04 manual baselines

Keys precede query/draft hooks: project Chrome route (routes/p.$projectId.tsx:10), owner/entity asset wrappers (each detail page:12), shot content (ShotEditorPage.tsx:236), and print content. Matching tagged null/empty results gate consumers. Returned asset ownership and episode ownership are checked separately from requested envelope identity. Chrome's current-episode envelope is needed even with its project key; same-project episode loading preserves settings/Outlet and hides old episode links (WorkspaceChrome.tsx:51 onward).

The shared guard (lib/useManualDraftGuard.tsx:10) adds pathname/unload protection without changing A04 transaction CAS. Slot initialization still freezes target/owner/baseline/callback; uploads/pickers use that owner; the actual slot save delegates through SlotEditSession with its baseline. Output settings still submit changed fields with original baselines and perform authoritative post-write acknowledgement (ProjectSettingsPanel.tsx:182 onward). B03's additive repo operation does not modify these A04 commands. The latest ShotEditorPage still passes all three slot baselines and target identities.

Slot route-discard marks the media session canceled before cleanup; a failed cleanup remains readable with writes disabled and retry allowed (GenerationSlotCard.tsx:214). Mounted open notifications balance unmount (same file:514). Retained deleted-row context disables assigned slot/output/relations writes; Chrome's inert Outlet and WorkspaceUnavailableContext cover inline controls and assigned slot portals. This is not a promise of universal draft survival across arbitrary grouping/filter removal or unrelated portals. Material parent selection remains guarded independently of router navigation (MaterialDetailPanel.tsx:47, MaterialControls.tsx:89), including latest B→C intent and Continue restoring the active selection.

### Frozen memory promotion and stable parent ownership

TaskInspectorContent remains keyed by task ID (TaskInspector.tsx:65). TaskWrapup owns one synchronous preparing/editing epoch and clones the selected candidate (TaskWrapup.tsx:157–214); source refresh does not key away an active editor. Its pending/editing notifications still reach the inspector. MemoryEditor freezes owner/body/tags/ref/excerpt/baseline (MemoryEditor.tsx:62), queries against that owner, rejects mismatching current or captured submits, and retires a successful session before notifying the parent (same file:152–216). The existing ProjectMemoryPage owns a captured editor record rather than deriving its key from every incoming live row (ProjectMemoryPage.tsx:200).

B01 project remount/departure protection and B02 frozen-session protection therefore serve different boundaries without replacing one another. Repository ownership/source validation and expected-revision CAS remain the final write checks. An already initiated original-owner write may complete after unmount, but cannot publish into a new UI or resubmit from a saved callback.

### Transaction-latest intent and deliberate replacements

ContextParameters forwards only explicit fields (ContextParameters.tsx:32); contextSettings reads and normalizes current thread/general-agent policy within the transaction before merging (contextSettings.ts:7 onward). Reset/default-copy intentionally use full replacement and remove absent optional tokens; nested transactions retain both tables.

ShotRow forwards selected=true/false (ShotEditorPage.tsx:1863). setShotCharacterSelected reads the latest shot and selected target under PRODUCTION_TABLES, validates latest project/episode/beat/surviving references, preserves unrelated slots/notes, and touches the project atomically (repo.ts:1501; assertShotReferences at :1404). Existing patchShot/clear/bulk/undo array replacements retain their separate intent. No entity-wide revision or merge scheme was substituted for A04 field/slot CAS.

### Protocol request counts and connector publication ownership

The B04 decoder distinguishes an actual empty directory from malformed envelopes/rows. GET body parsing and decoding remain outside the GET-fetch TypeError fallback gate; only GET-fetch TypeError or HTTP404/405 permits the single original minimal chat POST (openaiCompatible.ts:162 onward). Its successful fallback needs a valid choices/message frame with error-envelope priority; failed fallback cannot retry. Specialized provider dispatch remains read-only.

B06 freezes definition/baseUrl/effective key and checks both editor and operation identity after the first test and nested directory read (ConnectorsPage.tsx:107, :157). Credential edits retire publication ownership synchronously; an old finally cannot clear a new operation. Save/disconnect hold the write lock across direct callbacks, input/dismissal/open attempts and repository settlement (:187, :206). This preserves B04's transport policy. The connection page can issue its separate list GET after a successful via=models probe; it cannot be described as one total page-wide GET. Publication cancellation does not abort an already initiated transport.

### Durable music identities, package boundaries and original evidence

One taskIds predicate/canonicalizer handles opaque ID bounds, dot segments, controls and encodable Unicode. Submit deduplicates first-seen valid IDs; detail reads validate before constructing the encoded path (apimartAudio.ts:181, :194). Strict observation validation first validates taskIds even when observations are absent (observations.ts:9). Existing prepare/claim/patch boundaries call this validator; both snapshot/import validation loops do too (db/audioGeneration.ts:18, :105; lib/audioProjectPackage.ts:192, :202).

Active legacy recovery reads the owned row, validates the project, writes the unique taskIds-only CAS checkpoint, then validates observations and queries (runtime.ts:246–255). It preserves source/connector/results/history and has no submit call. Dormant/prepared/saved early returns are unchanged; malformed active history fails locally unchanged. The tests assert checkpoint contents at the first GET, saved sibling/evidence survival and zero POST. submitAudioGeneration still refuses any non-prepared job, retaining ambiguous paid claims; original task/call evidence cannot be adopted by another task. AbortError classification includes independent Error/DOMException and body failures without claiming remote cancellation.

### File sessions and existing episode draft lifetime

The existing route already keys StoryPage by episode ID (routes/p.$projectId.e.$episodeId.index.tsx:10), underneath B01's project key. StoryEditor remains keyed by its episode (StoryPage.tsx:56). B06 adds a local owner/request/script-revision boundary (:100 onward), increments on every script edit including revert, preserves unrelated title/logline fields, and offers only the latest candidate for explicit adoption. Explicit use-latest retires reads/candidates before existing baseline adoption (:122); stale candidate callbacks cannot retire a newer candidate. The existing changedDraftFields/updateEpisodeDraft path remains intact. Automatic debounce assertions verify actual storage, not only local rendered values or copied import logic.

## Quality Check and findings

For this scope, the frontend Quality Check still aligns with the inspected code: studio ownership paths remain independent of project routing; matching missing assets show not-found; video home repair waits for matched reads and excludes explicit audio/music kinds; shot and print reads remain episode-scoped; delivery waits for the matched project/episode/asset collections. The repo diff is additive at the new character-intent command, preserving the committed A media/cascade/bulk/manual-baseline paths. This preparation does not certify B07 agent stream/memo/compose behavior or declare every unrelated Quality Check exercised.

**No additional concrete uncovered B01–B06 integration defect was identified in the bounded source/test inspection.** No fixes or new regressions are requested by this note. Existing unit-review limitations remain material to the later evidence wording:

- B01's styled fixture uses real ReactDOM/Radix/router/isolated IndexedDB, but simplified surrounding routes and controlled timing seams; its recorded transient detached locator is preserved in B01-check.md.
- B02/B03/B06 deterministic hook hosts execute production callbacks/effects and real repositories over fake-indexeddb. They do not establish native DOM event scheduling or ReactDOM StrictMode. B06 mocks the connector API, while B04 verifies actual adapter/dispatch request counts separately; a live composed provider/page E2E run has not been claimed.
- B05 uses mocked provider/CDN/decode seams and real Request normalization. It establishes durable identity/recovery/storage contracts, not acoustic quality, live provider behavior or browser decoder support.

These are recorded evidence boundaries, not newly inferred product findings or metrics-based blockers. The historical concurrent integration run is not a final gate and was not rerun here.

## Deferred coordinator handoff

After B07 independently settles and the coordinator explicitly requests the full review, restore full B check context, include all final B07 product/test changes, refresh the latest responsibility/hash map, and execute the complete gate in research/B-batch-review-contract.md: local pnpm lint, full tests, model verification, build, B01 styled browser fixture, diff check and the changed-source ESLint comparison against A. Verify reviewed-file coverage and before/after fingerprints against final snapshots; any changed unit file needs explicit replacement attribution. Preserve the unit-level limits when reporting the final gate. Specs/ledger/status synchronization and the concrete Phase3.4 commit proposal remain coordinator work. This note supplies no full-batch verdict and authorizes no commit/push/archive/install.
