# D02 executable spec draft — apply after independent acceptance

## 1. Scope / Trigger
Production persistence has explicit business owners rather than a single `repo.ts`. Use these owners from actual source/test/fixture callers; schema and migrations remain in `database.ts`. Cross-domain transactions remain whole commands, not a collection of table CRUD calls.

## 2. Signatures and owners
| Owner | Actual existing public behavior |
| --- | --- |
| `productionRecords` | `emptyProject/Episode/Shot/Character/Scene/Prop/Style` constructors |
| `productionShared` | `PRODUCTION_TABLES`, timestamp, ownership/reference/order and patch guards |
| `projects` | Project/video/audio/music creation, metadata/settings/output/cover writers |
| `episodes` | Episode/story/beat lifecycle, scoped filters/order, deletion and restoration |
| `shots` | Shot edits, character membership intent, bulk inverse/undo, reorder, slots, committed delete snapshots |
| `assets` | Four creative asset types and text/slot/delete commands |
| `media` | `putMedia`, `collectMediaIds`, `deleteMediaIfOrphan`, slot validity/recycling |
| `assetReuse` | Studio snapshot copies and `releaseMaterialUse` |
| `connectors` | Saved connection/alias CRUD and `resolveConnector` |
| `chat` | Ordinary thread/messages, metadata and project binding |
| `cascadeCommands` | `deleteProject`, `deleteChatThread`, `setProjectArchived` |

Moved command signatures and return values remain unchanged. Existing cross-owner support exports are intentional real consumers, not new forwarding APIs. The five legacy unconsumed read/message exports remain separately tracked for later cleanup; their presence does not authorize using an all-purpose facade.

## 3. Contracts
Constructors import no database. Shared persistence scope/guards import no command owners. Media retention never imports asset/shot command modules. Episodes/shots share guards without mutually importing commands. Cascade commands preserve original full store sets and atomic ordering, including audio, references, material history and generation outcomes. D01 readers/preparation/selector imports keep their accepted dependency direction.

All actual imports, type queries, module mocks, namespace spies and browser interception paths target the concrete consumed owner. Business tools use named owner functions and retain existing schemas/permissions/atomic receipts; their actual asset dispatch map is not a replacement global repository namespace. No `export *` facade or dynamic import hides the removed owner.

Project creation and media/asset creation retain parent checks, studio exceptions and transaction-local touch. C05 generic patch rejection, dedicated slot/cover validity and global orphan/history protection remain authoritative. Project/thread cascades and studio material release never compose separately committed child delete APIs. Blob preparation, ZIP compression, hashing and transport remain outside write transactions.

## 4. Validation & Error Matrix
| Condition | Required result |
| --- | --- |
| Missing nonstudio parent at create | Reject without child or media insertion |
| Generic media patch or invalid dedicated target/owned Blob | Existing rejection; no partial mutation/touch/recycle |
| Field/slot/bulk baseline mismatch | Existing conflict and whole-group atomicity |
| Any project/thread cascade late storage failure | Roll back all earlier child/history/media/binding changes |
| Release event/storage failure | Restore copy, binding, retained-media flag and bytes |
| Media still selected or protected by reference/material/audio/proposal/job/batch history | Retain media under existing owner/global rules |
| Genuine unreferenced media after successful release | Remove only the existing computed orphan set |

## 5. Good / Base / Bad Cases
Good: import a named shot command and preserve its transaction-returned inverse for undo; execute thread deletion as one existing lifecycle command and retain selected production media. Base: asset creation for the studio owner does not require an invented project row. Bad: reconstitute the old repo namespace in a barrel or delete each table through separately committed feature APIs.

## 6. Tests Required
Actual entry tests cover parent, media, scoped relationships, CAS/bulk undo/deletion snapshots, proposals/generation/history and ZIP storage. Mocks/spies must intercept the module the feature imports. Native late-fault tests observe earlier writes, inject failure afterward, and compare durable rows plus Blob bytes before/after; successful retry distinguishes retained references from true orphans. Existing B01/B07/C01/C02 fixtures cover migrated UI/session/native entries. Preserve the stronger D01 single/batch late-ledger/history fault proof through a later import-only verification clone, without rewriting its historical evidence.

Fault-injection fixtures must guarantee a real field update before installing the hook, capture expected rollback state after setup, and assert the hook was reached. An equal millisecond timestamp can be a no-op; neither sleep nor timeout inflation proves transaction rollback.

AST distinguishes value/type edges and must retain zero value SCCs. Static baseline/current programs use the same tool versions and complete separate source roots; moved-body diagnostics remain inherited and absent files contribute zero baseline source-rule diagnostics.

## 7. Wrong vs Correct
Wrong: `import * as repo` from a new facade and `vi.spyOn` a different wrapper than the UI calls. Correct: named imports from the concrete owner and spies on that same module, while cross-table transaction ownership remains in the explicit lifecycle command.
