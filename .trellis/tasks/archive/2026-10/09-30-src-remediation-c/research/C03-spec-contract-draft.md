# C03 spec draft (after independent PASS)

## 1. Scope / Trigger
Standalone asset/media creation and modern video project ZIP restore.

## 2. Signatures
`addCharacter/Scene/Prop/Style(projectId)` create only under an existing project or STUDIO_LIBRARY_ID. `putMedia(record)` verifies its parent in the existing media/projects transaction. `importProjectZip` validates modern raw episode/shot/beat identities before repair/remapping.

## 3. Contracts
Asset create opens a minimal projects + owning-asset rw transaction. Read nonstudio parent, create, touch project within that transaction; nested Agent transactions remain compatible. Studio system ownership needs no ordinary projects row. Late async results after project deletion reject without orphans. Failure touching the project rolls back the asset/media write.

A modern nonempty episodes array defines the authoritative original episode IDs. Every original shot episodeId is required and must resolve; optional beatId must be present in that same original episode. Reject duplicate episode/shot IDs and duplicate beat IDs within an episode. The same beat ID in distinct episode scopes is not inherently ambiguous. Validate before parsers supply fallback values or remapping mutates IDs. Also check normalized beat IDs before remapping so a synthesized identity cannot collide with an explicit identity; this ambiguity rejects atomically while unique unreferenced repaired beats remain compatible. Legacy missing/empty episode data retains synthesize-first-episode behavior. Preserve valid optional unknown data. Invalid imports create no project/entities/media or atomically roll back.

## 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Deleted/missing nonstudio project | Reject create/media; no row |
| Studio create/media | Valid without synthetic project |
| Parent touch fails | Full create rollback |
| Modern missing/foreign episode reference | Reject, no first-episode fallback |
| Modern cross-episode beat / duplicate identity | Reject atomically |
| Valid modern link | Preserve correct remapped relationship |
| Legacy absent/empty episodes | Existing first-episode compatibility |

## 5. Good / Base / Bad Cases
Good: a late upload is refused after its parent disappears. Base: a legacy single-document video still restores as its first episode. Bad: committing an orphan before touch fails, or silently binding a malformed modern shot to another episode.

## 6. Required Tests
Real repository delayed writes, studio and normal creation, touch fault rollback and nested transaction behavior. Real ZIP modern missing/foreign/cross-episode/duplicate rejection, unchanged database, valid modern and legacy roundtrips and extra preservation. Tests prove storage/parser behavior, not full browser upload latency.

## 7. Wrong vs Correct
Wrong: add asset, then touch parent separately. Correct: verify parent and commit both in one transaction. Wrong: use first-episode fallback for every unknown ID. Correct: confine fallback to the explicit legacy branch and diagnose malformed modern relationships.
