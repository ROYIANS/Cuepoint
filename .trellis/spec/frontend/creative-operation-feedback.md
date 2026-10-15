# Creative operation feedback and recovery

## 1. Scope / Trigger

Read before changing project World or Studio asset creation/deletion, project archive filtering, or serial material-file import. Apply [Interaction Feedback](./interaction-feedback.md), [Shared Product Storage](./shared-product-storage.md), [Hook Guidelines](./hook-guidelines.md) and [IP / Material Library](./ip-material-library.md). These are mounted feature interactions; existing commands remain the sole durable write owners.

## 2. Signatures and owners

- `features/library/ui/useAssetOperations.ts` is private to the library feature. `useAssetOperations({kind: AssetKind | undefined, ownerId: string, openAsset: (id: string) => Promise<unknown> | void})` shares the actual two collection callers' locks, receipts and target recovery. `AssetKind` is `character | scene | prop | style` from `queries/assetLibrary.ts`.
- `readAssetPresence({kind, ownerId, id}, store = productDb): Promise<"missing" | "present" | "foreign">` uses one readonly transaction on the selected existing table and checks the row's `projectId`. It is inspection, never a write receipt or authorization to replay a delete.
- Existing `addCharacter/Scene/Prop/Style(ownerId)` return the created entity; existing delete commands retain their atomic reference/default/media cleanup. No reserved-ID creation API is introduced.
- `MaterialImportDialog` owns the serial queue and accepts controlled visibility from `MaterialLibraryPage`. The mounted session remains available while an uncertain result is hidden for inspection. `createFileMaterial(file, scope)` retains its existing per-file transaction. The existing material draft guard remains the only route/unload departure owner.

## 3. Contracts

Acquire a synchronous ref lock before the first await and reflect pending on the existing button. Freeze kind/owner/target before admitting the command. A late completion cannot navigate a different page or reset another operation. Repeated gestures while pending represent one intent, including gestures in the same React tick.

Separate acknowledged creation from opening its editor. Retain the returned exact entity ID until opening succeeds. If navigation rejects after the write succeeds, the recovery action opens that ID and never invokes add again. Known rollback can offer explicit retry. Normal creation needs no additional success toast or caption.

Treat `StorageError` with `certainty === "unknown"` as uncertain. Internally allocated IDs prevent exact automatic reconciliation of unknown creates/imports. Quarantine the original intent locally, use plain inspection guidance, and exclude ordinary retry, automatic replay or matching by name/time/list length. This does not promise recovery persistence after the owning page is destroyed.

Keep destructive confirmation mounted until acknowledgement: prevent the Radix Action's default dismissal, lock synchronously, disable repeated deletion and retain the captured target on known failure. Unknown deletion remains quarantined by kind/owner/entity even after its recovery dialog is dismissed. A fresh exact `missing` presence read can close the absent target surface; it establishes absence only. `present`, `foreign` or read failure cannot establish rollback or permit another destructive attempt.

Project gallery filters remain exclusive: `Boolean(project.archivedAt) === showArchived`. Name the two controls `使用中` and `已归档`; preserve the existing search, sort and other predicates.

Import admits files serially against a frozen target. Track total, acknowledged completed count and current filename. Remove a file and increment completed only after its command resolves successfully. Stop-remaining sets a ref immediately and is checked before every next command. It does not cancel the admitted transaction or undo saved files. After current settlement retain unstarted files and the stable denominator for explicit continuation; confirmed predecessors never repeat.

Known import failure retains the failed head and later files for explicit retry. Unknown head freezes it and the later queue; neither retry nor skip-forward is permitted. Hiding and reopening this importer within the same library page preserves that uncertainty and queue. Hiding is reversible presentation, not discarding the queue; actual route/unload departure retains the existing guard. A fresh independent session resets scope/count only after the prior ordinary session is completed or explicitly discarded.

Only acknowledged completion of every file invokes the existing last-material selection and close path once. Partial stop/failure never looks like whole-batch success. Keep one useful progress area with actual saved/total and current save or stopping information. Do not invent parsing/upload stages, percentages or per-file success notices.

## 4. Validation and error matrix

| Situation | Required result |
| --- | --- |
| Same-tick repeated create/delete/import | One command admission; immediate pending control |
| Create acknowledged, navigation fails | Retain exact ID; recovery navigates only |
| Known rollback | Preserve target/input and allow explicit retry |
| Unknown create | Inspection guidance; same intent cannot invoke add again |
| Delete pending or known failure | Exact target dialog remains; close only after acknowledged success |
| Unknown delete then dialog dismissal/reopen | Same target remains non-retryable |
| Unknown delete presence is missing | May close absent target; no claim about actor/cascade receipt |
| Presence is present/foreign/read error | Retain uncertainty; no destructive replay |
| One active and one archived project | Each exclusive control shows its own collection and pressed state |
| Stop while file A is admitted | Settle A, count only success, then stop before B |
| A saved, known failure at B | Keep B/C, count 1/3; continuation never repeats A |
| Unknown result at B | Keep B/C quarantined, count confirmed A only, including after hide/reopen |
| Whole batch acknowledged | Select last acknowledged material and close once |

## 5. Good / Base / Bad cases

Good: A saves, Stop is requested during B, and B's acknowledgement advances the count to 2/3 without starting C. Explicit continuation later starts only C. Base: a delayed create disables its existing button and opens the returned entity. Bad: closing a delete dialog is treated as success, or an uncertain B is silently retried because the import dialog was reopened.

## 6. Necessary verification

Use actual collection callbacks/ReactDOM and Radix confirmation with held commands: all four kinds, same-tick repeats, known retry, receipt-only navigation recovery, stale owner and unknown target inspection. Use real ProductStore readonly transactions for the presence query, including foreign ownership and injected read failure. Register any new real-store suite in future native business discovery without claiming it ran natively.

Use actual gallery cards/pressed controls for active-versus-archived data. Use actual import dialog callbacks/DOM for held A/B/C, stop during current work, confirmed counts, known retry, unknown head and controlled close/reopen. Assert callback counts and command identities, not only text or source strings. Run only necessary affected tests, direct types, scoped lint and changed architecture checks; broad/build/native acceptance stays at the owner's batch boundary.

## 7. Wrong vs Correct

Wrong: catch write and navigation in one retryable create block, dismiss pending deletion automatically, or increment import progress when a file starts.

Correct: retain the acknowledged create receipt, hold destructive confirmation until its command settles, distinguish uncertainty, and advance progress only from acknowledged saved files.
