# Review E05 – creative-operation-feedback (04d47969)

Targeted tests run: `e05AssetOperations, e05AssetPresence, e05MaterialImport, sharedVideoPageParity` → 4 files / 58 tests pass [test].

## Verdict
Solid, defensive delivery that matches the PRD's conservative decisions (create/delete unknown outcomes are quarantined, never replayed; known failures are retryable; stop-remaining settles the admitted file first). No P0/P1. Findings are mostly P2 "dead-end/unload" behaviours that the PRD explicitly scoped as mounted-page-only, plus a few test-adequacy gaps.

## AC map
| AC | Status | Evidence |
| --- | --- | --- |
| AC1 rapid asset-create clicks = one intent; recoverable failure | Met | Synchronous lock via ref (`useAssetOperations.ts:34,46-50,52-53`); `create` returns early while `locks` has the key; receipt retained so retry opens, never re-adds (`:56-61,69-79`). Tests `e05AssetOperations.test.ts:55-57` (`click(text, twice)`), `:86` (`add` called once), `:95,107,116` [test]. Both library surfaces wired: `AssetLibraryPages.tsx:121,153-155`, `AssetLibraryPage.tsx:117,145-152` [code]. |
| AC2 delete failure tied to target; known vs unknown distinct; no blind replay | Met | `remove`/`inspectDelete` (`useAssetOperations.ts:95-139`), per-owner/target quarantine map (`:37,104-108`), read-only presence `readAssetPresence` (`queries/assetLibrary.ts:10-20`); tests `:126,145,164`, `e05AssetPresence.test.ts:8` [test]. Dialog dismissal is locked while busy (`:87,92`). |
| AC3 archive label vs predicate | Met | Label `已归档` (`ProjectGalleryPage.tsx:219`) over predicate `Boolean(project.archivedAt) === showArchived` (`:99`); test `sharedVideoPageParity.test.ts` "gallery state labels…" (added in this commit) [test]. Test renders via the file's lightweight tree renderer (not real DOM) but asserts actual card collections. |
| AC4 import failure retains uncompleted items; stop-remaining | Met | Serial loop with head-only dequeue after acknowledgement (`MaterialImportDialog.tsx:93-104`), stop flag checked before each admission (`:94`), progress "已导入 x / y · 正在保存 name" (`:150-153`); tests `e05MaterialImport.test.ts:59,80,113` [test]. |

## Findings

### P2-1 Unknown create has no in-UI exit (dead-end until the page remounts)
After an unknown create the owner/kind key goes into `unknownCreates` (`useAssetOperations.ts:64`) and `create` early-returns forever (`:53`); the button stays disabled (`AssetLibraryPages.tsx:153`, `AssetLibraryPage.tsx:145`) and the only copy is "请先查看当前列表" (`:15`). There is no "I've checked, allow creating again" action and no automatic list diff (a created row appears in the live list but the quarantine does not clear). Users must leave and reopen the page. This is the stated PRD trade-off ("quarantine unknown … locally without replay; exact reconciliation separate scope") but it is a real UX dead end; no test asserts the recovery path beyond "stays blocked" (`e05AssetOperations.test.ts:116`).

### P2-2 Import queue is lost silently on page unmount mid-batch
`save()` returns when `!activeRef.current` after an acknowledgement (`MaterialImportDialog.tsx:101,107`) – remaining files are dropped without any notice and `onImported`/navigation never fires; `close()` is blocked only while pending *inside* the dialog (`:59`), not on route change. Confirmed saved files persist; unprocessed ones are just gone (PRD says "retain uncompleted items", scoped to mounted dialog). No `useBlocker`/before-unload protection while `pendingRef` is true and no test for unmount-during-import (the unmount branch is not in `e05MaterialImport.test.ts`).

### P2-3 Failed-import retry re-reads/re-parses the same `File` from the beginning for the head item; unknown outcome blocks the *whole* batch
By design (`:83`, `:108-111`), an unknown result on file N blocks files N+1..M and the dialog can only be hidden ("查看素材库", `:155`), never resumed except by remount; the unknown flag is never clearable by checking the library (`unknown` only set, `:109`). Correct for safety, but the user cannot skip the uncertain file once verified. Matches PRD wording ("不要重复导入或跳过此文件继续").

### P3-1 Stop-remaining when stop is requested during the *last* file silently becomes a normal finish (`:105,120`); acceptable but the "当前文件完成后停止后续导入" hint (`:153`) remains visible until completion.
### P3-2 `setProgress({... stopRequested:false})` at the start of each iteration (`:96`) resets the visible stop flag every file even though `stopRemaining.current` stays true; harmless because the loop breaks at `:94`, but a stopped queue's status could flicker.
### P3-3 `readAssetPresence` classifies foreign owner by `row.projectId === ownerId` (`assetLibrary.ts:18`); for Studio-library assets this relies on `STUDIO_LIBRARY_ID` being stored in `projectId` — true today (`AssetLibraryPages.tsx:121` passes it), but not asserted by a Studio-owner test (`e05AssetPresence.test.ts` has one test) [code].
### P3-4 Spec: `.trellis/spec/frontend/creative-operation-feedback.md` added (64 lines) and linked; per-commit lint output (design says "reviewed warnings") not reproduced here.

## Claims vs code
- "Reuse current command transaction owners and internally allocated IDs": `createCommands`/`deleteCommands` map straight to `commands/assets` (`useAssetOperations.ts:13-14`), no ID pre-allocation [code]. Consequence: lost create ack can never be reconciled (see P2-1) — consistent with claim.
- "Quarantine unknown through tab changes": key is `[ownerId, kind]` (`:26`), covered by `e05AssetOperations.test.ts:116`.
- "No blind destructive replay": confirmed — `remove` refuses when quarantined (`:97`).
