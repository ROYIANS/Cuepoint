# Retained persistence owner contracts

This compact context extracts complete applicable sections from `.trellis/spec/frontend/state-management.md` on 2026-10-10 to avoid the 32 KiB injection truncation limit. The original spec remains authoritative; read it if changing an area outside these preserved sections. New workspace/copy behavior is recorded separately in the child artifacts.

## Scenario: Studio library owner vs project owner

### 1. Scope / Trigger

Studio 角色/场景/道具/风格 are first-class libraries. Creating them must stay under `StudioShell`, not open a project picker or `/p/$projectId/...`.

### 2. Signatures

```ts
export const STUDIO_LIBRARY_ID = "studio" as const;
export function isStudioLibrary(ownerId: Id): boolean;

addCharacter(projectId: Id): Promise<Character>
addScene(projectId: Id): Promise<Scene>
addProp(projectId: Id): Promise<Prop>
addStyle(projectId: Id): Promise<VisualStyle>
copyStudioCharacter(projectId: Id, sourceId: Id): Promise<Character>
copyStudioScene(projectId: Id, sourceId: Id): Promise<Scene>
copyStudioProp(projectId: Id, sourceId: Id): Promise<Prop>
copyStudioStyle(projectId: Id, sourceId: Id): Promise<VisualStyle>
```

Dexie v2 stores:

```
props: "id, projectId, updatedAt"
styles: "id, projectId, updatedAt"
```

`projectId` on character/scene/prop/style/media is the **owner id**. For studio library rows it is `STUDIO_LIBRARY_ID`, not a real `projects` row.

`touchProject(id)` must no-op when `isStudioLibrary(id)` so create/edit does not invent a project named `studio`.

### 3. Contracts

| Field | Constraint |
| --- | --- |
| Studio create | `add*(STUDIO_LIBRARY_ID)` then navigate to `/characters/$id`, `/scenes/$id`, `/props/$id`, `/styles/$id` |
| Studio detail back | Character/Scene `back: { kind: "studio" }` → `/characters` or `/scenes`. Props/styles always return to `/props` / `/styles` |
| Project detail back | `back: { kind: "project", projectId }` → `/p/$projectId/world` |
| Add studio asset to project | Copy to a new project-owned ID and copy referenced media to new project-owned media IDs. Record `extra.sourceAssetId` only as provenance |
| Project zip | Includes copied project snapshots; studio-owned source rows are never included |

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| `add*` with `STUDIO_LIBRARY_ID` | Row written; no `projects` insert |
| `touchProject("studio")` | No-op |
| Source is not studio-owned | Reject snapshot copy |
| Same `sourceAssetId` already exists in destination | Reject atomically; do not duplicate media |
| Snapshot copy fails | Roll back asset and all copied media in one transaction |
| Missing detail id | See hook-guidelines: liveQuery `get() ?? null` |

### 5. Good/Base/Bad Cases

- Good: 创建角色 on `/characters` lands on `/characters/chr_…` with studio nav current
- Good: “从工作室添加” creates an independent project snapshot whose edits do not affect the source
- Base: deleting a studio source leaves existing project snapshots intact
- Bad: studio create opens a project picker or `/p/$projectId/assets/characters/$id`
- Bad: point a project row directly at studio media IDs

### 6. Tests Required

- Create from each studio library: URL stays `/characters|scenes|props|styles/$id`
- `touchProject("studio")` does not create a project row
- Copy each asset type: new asset/media IDs, project ownership, field/extra preservation, and source independence
- Copy the same source twice: second copy rejects without extra rows
- Delete source: snapshot and copied media remain
- Missing id shows 找不到, not an infinite 加载中

### 7. Wrong vs Correct

#### Wrong

```ts
const projectId = await pickProject();
const character = await addCharacter(projectId);
await navigate({ to: "/p/$projectId/assets/characters/$characterId", params: { projectId, characterId: character.id } });
```

#### Correct

```ts
const character = await addCharacter(STUDIO_LIBRARY_ID);
await navigate({ to: "/characters/$characterId", params: { characterId: character.id } });
```

Project reuse is also copy-on-add:

```ts
const snapshot = await copyStudioCharacter(projectId, studioCharacterId);
// snapshot.id !== studioCharacterId
// snapshot.projectId === projectId
// snapshot.extra?.sourceAssetId === studioCharacterId
```

---

## C03 parent ownership and modern package identity contract (2026-09-30)

### 1. Scope / Trigger
Standalone asset/media creation and modern video project ZIP restore.

### 2. Signatures
`addCharacter/Scene/Prop/Style(projectId)` create only under an existing project or STUDIO_LIBRARY_ID. `putMedia(record)` verifies its parent in the existing media/projects transaction. `importProjectZip` validates modern raw episode/shot/beat identities before repair/remapping.

### 3. Contracts
Asset create opens a minimal projects + owning-asset rw transaction. Read nonstudio parent, create, touch project within that transaction; nested Agent transactions remain compatible. Studio system ownership needs no ordinary projects row. Late async results after project deletion reject without orphans. Failure touching the project rolls back the asset/media write.

A modern nonempty episodes array defines the authoritative original episode IDs. Every original shot episodeId is required and must resolve; optional beatId must be present in that same original episode. Reject duplicate episode/shot IDs and duplicate beat IDs within an episode. The same beat ID in distinct episode scopes is not inherently ambiguous. Validate before parsers supply fallback values or remapping mutates IDs. Also check normalized beat IDs before remapping so a synthesized identity cannot collide with an explicit identity; this ambiguity rejects atomically while unique unreferenced repaired beats remain compatible. Legacy missing/empty episode data retains synthesize-first-episode behavior. Preserve valid optional unknown data. Invalid imports create no project/entities/media or atomically roll back.

### 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Deleted/missing nonstudio project | Reject create/media; no row |
| Studio create/media | Valid without synthetic project |
| Parent touch fails | Full create rollback |
| Modern missing/foreign episode reference | Reject, no first-episode fallback |
| Modern cross-episode beat / duplicate identity | Reject atomically |
| Valid modern link | Preserve correct remapped relationship |
| Legacy absent/empty episodes | Existing first-episode compatibility |

### 5. Good / Base / Bad Cases
Good: a late upload is refused after its parent disappears. Base: a legacy single-document video still restores as its first episode. Bad: committing an orphan before touch fails, or silently binding a malformed modern shot to another episode.

### 6. Required Tests
Real repository delayed writes, studio and normal creation, touch fault rollback and nested transaction behavior. Real ZIP modern missing/foreign/cross-episode/duplicate rejection, unchanged database, valid modern and legacy roundtrips and extra preservation. Tests prove storage/parser behavior, not full browser upload latency.

### 7. Wrong vs Correct
Wrong: add asset, then touch parent separately. Correct: verify parent and commit both in one transaction. Wrong: use first-episode fallback for every unknown ID. Correct: confine fallback to the explicit legacy branch and diagnose malformed modern relationships.

## D02 production persistence responsibility boundaries

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

## E04 PD07 fresh media retention and batch transaction ownership (2026-10-09)

### 1. Scope

Apply batching to media orphan cleanup and each changed production caller. Preserve collectMediaIds(projectId?) for global current retention and owner-scoped backup projection, plus scalar deleteMediaIfOrphan and injected DraftMediaSession compatibility. Keep PRODUCTION_TABLES at25.

### 2. Signatures / Owners

deleteMediaIfOrphans accepts readonly (Id | undefined)[] and owns or joins a production readwrite root. Deduplicate truthy candidates, bulkGet media rows once, derive each actual MediaRecord.projectId, snapshot global current references once and indexed history sets once per actual owner. The scalar API delegates one ID. Caller mutation, retention snapshot, deletes and durable receipt/event remain under the original transaction owner.

### 3. Contracts

Retain all18 source tables:14 current tables plus productionProposals, agentGenerationJobs, agentGenerationBatches and agentGenerationBatchItems. Current references are global, including archived/library/audio/reference/material-use cases. Historical references use the candidate record owner, including cancelled/deleted-target evidence; foreign-owner-only history retains original exclusion semantics. Do not persist/cache reference sets across calls. Await individual deletes to retain fault hooks. Release a material use only after other uses allow it, clear every copied libraryRetained flag before one snapshot, reject survivors, then emit the event. Roll back use/flags/real Blob deletes on any later failure.

### 4. Validation / Error Matrix

Undefined/missing/duplicate candidates -> safe skip/dedup. A reference added between independent calls -> fresh retention. Same-owner history after target deletion/cancellation -> retained. Foreign-owner-only history -> original parity. Later actual media deletion failure -> all prior current/history/Blob changes restored. Retained copied media or final event fault -> full release rollback. Real shot_delete receipt followed by ledger fault -> receipt and deletion roll back together; successful retry/replay stays idempotent. Orphan-only tools do not gain a business receipt.

### 5. Good / Base / Bad Cases

Good: mutate all relevant current rows first, snapshot once inside the existing production root, use per-candidate-owner history sets and sequential deletes. Base: DraftMediaSession continues per-ID scalar cleanup, retaining failed IDs for retry and releasing kept ownership only after persist succeeds. Bad: clear one flag, snapshot, then clear another; reuse an ambient retention cache; derive history ownership from the deleting caller; claim all uploads plus save are atomic.

### 6. Tests Required

Keep the full18-table retention and complete caller matrix, protected scalar cover/reference/backup paths and actual receipt/undo closure. Native proof must include fresh references, mixed owners, late actual deletes, flags/other uses/events and overlapping-writer commit visibility. Work fixture:30 unique existing library-retained candidates,3 owners,60 original duplicate scalar calls; final receives same duplicates plus undefined/missing,31 lookup keys. Report1080->26 DBCore retention requests and1800->30 returned-row/cursor-step sum separately from candidate reads/writes; formula14 +4*actualOwners applies to this retention scan shape.

### 7. Wrong vs Correct

Wrong: label these logical request/row totals exclusive physical disk IO, IDBCursor-only visits or latency savings. Correct: state the exact denominator, observers, excluded candidate reads/writes, mixed-owner/current-history semantics and finite isolated Chromium evidence limits. Preserve actual mutation fault producers, their failure history and raw source hashes.
