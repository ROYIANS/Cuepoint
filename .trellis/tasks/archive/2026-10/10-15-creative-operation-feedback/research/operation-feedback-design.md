# Research: Bounded creative-operation feedback and recovery

- Query: Design the smallest E05 change for asset create/delete duplicate protection, truthful archive filtering, and batch-import progress/stop-remaining, using actual existing operation owners and preserving uncertain storage outcomes.
- Scope: internal, upcoming E05 research only. Active task supplied by parent: E03. No task activation, source/spec/metadata changes, tests, builds, browser/native acceptance, external search or paid requests.
- Date: 2026-10-15

## Findings

### Files found / current owners

| Source | Responsibility and present behavior |
| --- | --- |
| `packages/studio/src/features/library/ui/AssetLibraryPage.tsx:92–163,169–176,235–264` | Project World page. Four create branches await add+navigation without pending/ref lock/catch. Delete fires an unawaited promise from a Radix Action; no local pending/error path. This is the sampled defect owner. |
| `packages/studio/src/features/library/ui/AssetLibraryPages.tsx:129–209,232–233,265–288` | Studio character/scene/prop/style grids already have synchronous creating/deleting refs, immediate disabled/pending buttons, active-owner checks, held delete dialog and local delete error. Reuse this pattern instead of adding a global action framework. Unknown outcomes and add-versus-navigation errors remain conflated. |
| `packages/studio/src/features/library/commands/assets.ts:15–23,96–104,171–179,233–241` | Existing asset creates each own one minimal project+asset transaction. Parent validation, row insertion and project touch are atomic. Identity is allocated inside the transaction through `empty*`. |
| `packages/studio/src/features/library/commands/assets.ts:64–93,143–168,218–230,283–303` | Delete owners atomically remove the target, affected references/defaults and orphan media. Existing missing-target no-op behavior stays. UI cannot infer completion from closing a dialog. |
| `packages/studio/src/features/library/models/newAssets.ts:9–66` | Each create currently allocates a fresh entity ID; caught unknown creation cannot be safely deduped by name/time. |
| `packages/studio/src/features/projects/ui/ProjectGalleryPage.tsx:114–165` | Useful existing synchronous ref locks, pending controls, retained failures and receipt-driven navigation. Existing handling is a pattern, not proof that every error is safe to retry. |
| `packages/studio/src/features/projects/ui/ProjectGalleryPage.tsx:96–101,215–221` | Predicate selects **only** archived when `showArchived` is true, while the mutually exclusive navigation button says “含已归档项目”. |
| `packages/studio/src/features/library/ui/materials/MaterialImportDialog.tsx:22–53,60–77` | Serial import, synchronous pending ref, remaining File queue, current filename; shifts only after successful save. No completed/total or stop-remaining. Every exception currently becomes a normal retryable-looking error. |
| `packages/studio/src/features/library/commands/materials.ts:66–74,116–136,186–190` | File validation + one file-material/version/event transaction per file; material ID is allocated inside that transaction. No parser, upload progress, AbortSignal or batch job API exists at this boundary. |
| `packages/studio/src/features/library/ui/materials/MaterialControls.tsx:89–125` | Existing unsaved/pending route/unload/close guard; pending suppresses close/discard. Keep it as the sole dialog departure owner. |
| `packages/studio/src/features/library/ui/MaterialLibraryPage.tsx:130–132` | Dialog success selects the last imported material then closes; partial failure currently keeps the dialog/remaining files. |
| `packages/studio/src/platform/storage/errors.ts:11–25` | Typed `StorageError.certainty` separates known rollback and `UnknownCommitError`. |
| `packages/studio/src/platform/storage/native.ts:495–538` | Adapter already checks durable operation status after failed COMMIT acknowledgement; pending/not-found/status failure remain unknown. Notifications happen after commit, with a fallback invalidation. |
| `packages/studio/src/ui/alert-dialog.tsx:103–109` | Action is a thin Radix wrapper. Feature code must prevent default while awaiting a destructive command. |

Specs and planning evidence read: `.trellis/workflow.md`; `.trellis/spec/studio/frontend/index.md`; frontend `interaction-feedback.md`, `component-guidelines.md` (component/feedback/error/ownership sections), `shared-product-storage.md`, relevant `native-product-runtime.md` certainty contract, `state-management.md` C03/manual ownership sections, and `asset-output-foundation.md`; E05 PRD; parent PRD/roadmap; original `interaction-audit.md` and `interaction-spotchecks.md`. The sampled evidence is source behavior, not measured product latency.

### 1. Smallest delivery and ownership

Modify the project World create/delete owner, harden the same affected paths in the Studio library, correct one project-filter label, and extend the existing material-import dialog's serial loop. Keep existing commands and ProductStore transaction boundaries. Do not include asset editor redesign, Studio-copy picker, project ZIP import, audio workflows, generic jobs, drawers, Agent runtime or E01–E04 owners.

The four asset kinds have two genuine UI callers with the same operation lifecycle. A **feature-private** small hook/helper shared by those two pages is reasonable if it actually removes duplicate lock/receipt/unknown handling; inline handlers are also fine if equally clear. Avoid action registries, a global mutation manager or a new generic status dashboard. UI primitives remain presentational and do not gain ProductStore access.

Freeze `{ownerId, kind, targetId?, targetName?}` at gesture time; acquire a ref lock before the first await and update the existing control immediately. Refuse same-tick duplicate gestures, not merely after the next disabled render. Snapshot identity must survive tab changes and async results. Only the still-owned operation may clear its error, close its dialog or navigate; leaving an owning page must not let a late promise navigate the current page. Preserve the project's existing keyed Chrome rather than introducing a new remount policy.

### 2. Asset creation: immediate control state, quiet result, receipt-aware recovery

For the project page, add the same synchronous creating guard and existing-button pending behavior as Studio. “创建中…” inside that button is sufficient; no extra caption, toast or skeleton card is needed for a normal successful create. Keep the result/navigation as confirmation.

Separate the two awaited effects:

1. Await `addCharacter/Scene/Prop/Style` once and retain its returned `{id, projectId}` receipt.
2. Navigate only if this UI still owns that operation. If navigation rejects **after** successful create, preserve the receipt and offer “打开已创建的角色/场景/道具/风格”; that action only navigates. Do not present “创建失败，重试” and call add again.

Known validation/rollback failure clears busy and keeps the operation near its original control for explicit retry. Reuse the existing error presentation (`showError` for a global non-crash error or one local `role="alert"` if the recovery action is local), without duplicating the same error in a toast and inline row. Do not expose operation IDs or raw native/storage internals in normal UI.

An unknown create result is different: retain the operation and explain “创建结果待确认，请先核对列表，避免重复创建”. Do not re-enable an ordinary retry for that intent or invoke add from a query observation. Existing commands generate IDs internally, so exact automatic create reconciliation is **not available** without a new command contract. The minimal safe scope leaves this exceptional intent quarantined and offers inspection/closing rather than pretending to resolve it. Do not dedupe by generated name, timestamps, list length or optimistic invented records.

If implementation chooses an exact automatic “核对结果” for unknown creates, explicitly add caller-reserved entity identities with create-only semantics and an owned read contract; that is an additional command/API slice, not necessary for pending/deduplication or the PRD's known-failure recovery criterion. Keep optional `ProductStore` injection/nested transaction compatibility and test duplicate IDs/parent-touch rollback if taking that slice. Do not enlarge E05 into a durable outbox to get it.

### 3. Asset deletion: held confirmation with target-local recovery

Use Studio's current strategy for the project World page: prevent default on `AlertDialogAction`, synchronously claim the deleting ref, disable duplicate confirmation, keep the dialog while awaiting the command, and close only after successful acknowledgement. Capture the exact target before await. A known rollback retains the target's name/context and a relevant error; explicit retry invokes the same command against that target. No optimistic hide/restore strategy is required.

Apply typed certainty handling to both affected library owners. On `certainty === "unknown"`, keep a distinct non-retryable operation associated with the target and offer a readonly result check/inspection; do not label it “删除失败” or allow “重试删除”. A useful small query signature for the two actual callers is:

```ts
readAssetPresence({kind, ownerId, id}, store?)
  // one readonly transaction on the kind's existing table
  // -> {status: "missing"} | {status: "present"} | {status: "foreign"}
```

Return explicit absence and verify the existing row's `projectId` against the captured owner. A fresh `missing` read supports “此项已不在列表” and closing that recovery surface. It does **not** prove which actor deleted it or provide a receipt for the original reference/media cleanup. `present`, foreign ownership, or a failed check leaves the original uncertain intent unresolved and does not authorize a destructive replay. The durable native status/fingerprint is adapter-owned; do not reach through renderer IPC or claim that mere row presence establishes rollback.

If the user dismisses exceptional recovery UI, retain the unresolved target locally rather than silently resetting its Delete action into a retry. Other independent intents need not acquire that target's uncertainty. This is mounted-page recovery only; persistence across reload is not in the task. The selected fallback can be conservative (leave the target's recovery dialog/control available) rather than inventing a global operations inbox.

### 4. Archive truth: fix the label to the existing exclusive collection

Recommended choice: keep `Boolean(project.archivedAt) === showArchived` and change the second navigation item to **“已归档”** (or “仅已归档”). Its sibling is “使用中”, both are exclusive `aria-pressed` buttons, and current IP/material libraries use active/archived categories. This is a local mismatch correction, inferable from the current UI and predicate; it does not require adding an “all” mode or another owner question.

One active + one archived fixture must yield only the active card under 使用中 and only the archived card under 已归档. Search, IP/type filters, sort and cover-query scope stay unchanged. If the owner later explicitly wants an inclusive collection, change both predicate and label in its own scope; do not silently broaden E05 now.

### 5. Import: truthful count and stop only before the next file

Preserve the serial command loop and “remove only after acknowledged save” behavior. Freeze the selected files and target scope for each invocation; keep the synchronous `pendingRef`. Add a ref `stopRemainingRequested` checked immediately **before each next `createFileMaterial` call**. “停止后续导入” sets that ref synchronously and disables repeated stop requests. It does not abort the file already admitted or its storage transaction, delete saved files, or promise rollback.

Use one existing dialog progress surface. Represent count explicitly, for example `{total, completed, currentName?, stopRequested}`. `completed` advances only after an acknowledged command success; never use “files started” as saved count. Keep the denominator stable for the selected batch while it pauses/fails/resumes, resetting it only when the user selects a new independent file set. A bounded local queue of File entries is enough; filename is a display value, not unique identity or deduplication key.

Meaningful copy can be `已导入 2 / 5 · 正在保存 next.png`. There is only one observable save stage at this command boundary; do not fabricate reading/parsing/uploading percentages or expose transaction preparation. After a stop request while one file is pending, use the same location to explain `当前文件完成后停止后续导入`; continue awaiting its actual outcome. Once it succeeds, remove that file, increment the count, and settle with the remaining File queue retained. Provide “继续导入” and the existing close/unsaved guard. An acknowledged current-file failure still wins over the user's stop request and remains actionable.

On known failure at file N, preserve N and later files; previously confirmed items remain removed and must not be re-imported on explicit continuation. On unknown outcome at N, keep N marked uncertain and stop admitting later files. A normal import/retry action must not rerun N or skip it and continue later items. Suggested message: `当前文件的导入结果待确认，请先核对素材库。已确认保存的文件会保留。` Neither an absent list search nor a matching filename resolves it.

`createFileMaterial` currently allocates the material/version/event IDs inside its transaction and exposes no import-receipt query (`materials.ts:116–136,186–190`). Therefore the **smallest safe design** quarantines an unknown queue head and preserves all remaining Files without automatic replay. Exact positive automatic reconciliation/continuation would require a caller-reserved material identity plus a matching material/version read, an explicitly additional API slice. No hashing every large File, new telemetry/job system or identity-by-filename is needed merely to show progress/stop remaining.

Keep the existing successful all-files behavior: select the last acknowledged material and close once. For stop/partial failure, leave the dialog and queue open rather than calling `onImported`/`onClose` as though the whole batch completed. Do not toast for each file or add a new normal-success notice. Close/discard means discarding the in-memory remaining queue, not undoing confirmed saved items; keep that distinction in the existing draft-guard copy if changed. Keep the guard's pending protection and do not force-close an in-flight transaction.

### 6. Necessary actual tests and reusable seams

| Behavior | Minimum meaningful evidence |
| --- | --- |
| Four asset kinds / duplicate create | Parameterized actual page callbacks or ReactDOM test, hold the add promise, trigger twice in the same tick, assert one add and immediate existing-control pending. Resolve and assert one navigation to the returned entity. Known failure keeps retry possible. |
| Add acknowledged, navigation failed | Reject navigation after returning a real/specified receipt. Recovery opens that ID; assert add remains called once. A late completion after owner departure must not navigate another page. |
| Destructive dialog lifecycle | Actual ReactDOM/Radix harness: delayed delete keeps target/dialog visible and action disabled; failure retains target/error; success closes after acknowledgement. Same-tick repeat still reaches one command. This catches the current auto-dismiss behavior that a pure command test cannot. |
| Unknown delete / checks | Inject typed `UnknownCommitError`, assert no retry/delete call from observation, present/failed readonly checks or repeated clicks. Missing check may remove the recovery surface without a new write. Check owner mismatch, same-target preservation and single feedback location. |
| Archive collection | Extend the existing actual `ProjectGalleryPage` callback harness in `tests/sharedVideoPageParity.test.ts` (`:96` render helper, `:160–174` gallery controls) with active/archived records and click both state controls. Assert rendered `CoverCard` IDs and matching pressed labels; no string-only source assertion. |
| Import stop boundary | Actual `MaterialImportDialog` callbacks/DOM with a deferred `createFileMaterial`: select A/B/C, start twice same tick, request stop while A is held, resolve A, assert only A called/removed, 1/3 shown and B/C retained. Continue explicitly and ensure A never repeats. Native button keyboard/touch behavior comes from the reused Button primitive; one actual activation path is enough. |
| Import known failure and uncertainty | Save A, fail B, retain B/C and count 1/3; retry only B after known rollback. Separately inject unknown B, assert count remains confirmed-only and neither B nor C is called again. Partial/stop does not invoke full-success callbacks. All-success invokes the existing last-ID/close path once without per-file success notices. |

Existing command/store evidence to retain: `tests/assetFoundation.test.ts:88–99` checks prop/style reference cleanup; `tests/materialLibrary.test.ts:39–50` checks file/scope validation without partial rows and `:135–142` demonstrates real-store fault injection through `tests/helpers/storeFaults`; `tests/sharedNativeOutcome.test.ts:43–58` demonstrates committed rows plus unknown acknowledgement/status behavior. These are useful existing boundaries, not a reason to rerun full native/package suites for a local UI slice. If commands remain unchanged, focused actual interaction tests plus necessary affected types/lint suffice; if identities or command semantics change, add only corresponding create-only/rollback/ownership tests in the real ProductStore.

## External references

None required. No new library or external API is proposed; recommendations follow current ProductStore/Radix contracts and existing UI owners.

## Caveats / Not Found

- The current ProjectGallery and Studio-library patterns already guard common duplicate gestures, but their catch-all errors are not a complete unknown-outcome recovery design. Copy the useful lock/pending pattern, not that assumption.
- Exact automatic recovery for an unknown **creation/import** cannot be provided by the current command return types: IDs are allocated inside the transaction and may be lost with acknowledgement. Keeping that intent non-retryable is safe but intentionally conservative; adding reserved-ID reconciliation is a separate concrete optional implementation choice, not a user preference question or permission gate.
- No new owner-level question is necessary for the bounded recommendation: choose archive-only label truth, include stop-remaining at the next-file admission boundary, retain current-file settlement and confirmed saves. True in-file cancellation, background continuation, reload-safe queues and source/paid/audio workflows remain outside E05.
- The investigation did not run tests, measure paint/latency or verify native packaging. Existing source tests are cited for reuse; their results are not claimed here.
