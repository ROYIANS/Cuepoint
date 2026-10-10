# R4 native acceptance — 2026-10-10

The main session exercised selection, arrangement, history, narrow layout and a real concurrent edit through ordinary visible UI in the Codex in-app Chromium at `http://127.0.0.1:5173`. This reviewer checked saved screenshots and the JSON entries of normal exports. This record identifies the actual effects and preserves the boundary between saved media, selection, placement and listening. It does not archive the task.

Project `prj_b2594f6c-5988-4acb-bdea-186e95766ab1`, chapter `ach_42fd3cb6-0d84-4abe-b7f4-d033ca1b50f7`, target voice track `atr_35eeae11-5e52-47be-82bc-c59094e20556`. [Browser preparation](2026-10-10-browser-preparation.md) describes the synthetic local WAV fixtures. Browser-created take metadata stores actual durations 1.25, 2.5 and 3.75 seconds; these are test tones, not subjective speech-quality evidence.

## Evidence map

| Observed behavior | Evidence and interpretation |
| --- | --- |
| Existing manual edit supplies the baseline | [Baseline screenshot](manual-clip-baseline.jpg), [manual baseline JSON](manual-baseline.json) and `audioProject.json` in `manual-baseline.zip` identify one manually trimmed/gained/faded clip. |
| Selection has a separate review and changes no clips | [Selection preview](selection-preview.jpg) shows three reviewed choices, one already selected and two to update. [Selection result JSON](selection-applied.json) and the corresponding normal export confirm exactly two changed segment choices and complete preservation of the clip records. |
| Arrangement previews real timing and preserves existing edits | [Arrangement preview](arrangement-preview.jpg), [expanded retained-clip detail](retained-clip-preview.jpg), [applied screenshot](arrangement-applied.jpg) and [applied JSON](arrangement-applied.json) agree on two additions and one preserved clip, with actual duration and trim data. |
| A stable group undo/redo restores the exact prepared effect | `audioProject.json` in `arrangement-undone.zip` and `arrangement-redone.zip`, checked against the stable proposal's own `before` and receipt, confirm clip counts 3 → 1 → 3. [History comparison](history-comparison.json) records the same exact checks. |
| Preparing again does not duplicate placed segments | Main-session native observation after stable redo: a new preview reports zero additions and three retained segments. The later [stale-preview screenshot](stale-preview-conflict.jpg) visibly retains that zero-addition/three-retained preview. |
| A real cross-tab edit invalidates the retained preview | [Conflict screenshot](stale-preview-conflict.jpg) shows the conflict, explicit repreview action and disabled confirm. The two normal concurrent-edit exports have identical complete `audioProject.json` bytes. |
| Narrow dialog fits and returns focus | [390 px dialog screenshot](narrow-arrangement-dialog.jpg) and the main session's native DOM/keyboard observations: viewport 390 × 844, document clientWidth/scrollWidth both 390, dialog width 358; Escape closes it and restores focus to the trigger. |

## Selection changes only selected versions

Before selection, clip `acl_22def859-ca7b-49cc-a1d8-a09dfa2ae927` is the single manual clip at revision 2. It uses first-line take `atk_79ff7b76-3bbe-4858-9cbe-db1b7d9e58bc` and has `startSec: 0.25`, trim `0.1–1.15`, gain `0.8`, fade-in `0.1`, fade-out `0.15`.

Selection proposal `aap_2253fcfe-3036-465b-a433-b069eda155de` reviews all three local takes. Its actual receipt contains two selected-segment changes and no added clips:

- Segment 2 `asg_abbe9673-ea6c-44d7-97f9-ba12b4c5b92a` changes from revision 1 to 2 and selects `atk_d7d0380c-2233-40da-964b-c8f785d1fd10`.
- Segment 3 `asg_27fd94af-dfd4-479a-9cd1-44db8de74208` changes from revision 1 to 2 and selects `atk_f5ad01b2-dcd7-4c79-9e77-eedce9ebb3e5`.

Segment 1's already selected version stays unchanged. Comparison of the entire `audioClips` arrays in `manual-baseline.json` and `selection-applied.json` is equal, including every field, revision and timestamp. No placement was inferred from selection, and no clip was added by selection.

## First arrangement uses actual trimmed end and duration

Initial arrangement proposal `aap_4083a1e1-7fce-4189-a799-9778a57b69f1` uses a reviewed gap of 0.2 seconds and appends to the target voice track. The existing clip's audible length is `1.15 - 0.1 = 1.05` seconds; its end is `0.25 + 1.05 = 1.3` seconds. The second take therefore starts at 1.3 seconds, uses its actual 2.5-second duration, and is followed by the 0.2-second gap; the third starts at 4.0 seconds and uses its actual 3.75-second duration. JSON stores the first start as `1.2999999999999998`, the floating-point representation displayed as `1.300` in the review.

The actual receipt has two `added` clips, one `preserved` clip and zero conflicts. Added clip IDs are `acl_be90ce21ff445819a6dac2e3bbae9c70a7311b2e936245452015245555cae192` and `acl_ac796342ea39c20da7954a7c570ceff8f4fc85f8375a5a4745ed20329b8294a7`. The manual clip's complete record is equal to the initial baseline; its gain, fades, trim, position, revision and timestamps are preserved. Duration was taken from saved decoded metadata, not guessed from the manuscript text.

## Stable grouped history and duplicate prevention

The later stable history test uses proposal `aap_2d50b4b3-4c93-438c-bf80-e88a5c262b83`, not the earlier initial proposal. Between the two tests, ordinary manual deletion of the earlier test additions raised the retained manual clip's revision from 2 to 4. [History comparison](history-comparison.json) explicitly records this preceding history increment. The valid comparison baseline is this stable proposal's own complete `before` rows; it would be incorrect to attribute the revision-4 difference to arrangement or compare stable history with the earlier revision-2 snapshot.

Against that actual baseline, metadata comparison confirms:

- Stable apply has three clips; undo leaves exactly the one `before` clip, with its entire record equal to `proposal.before`.
- Redo restores three clips and preserves that manual clip's complete bytes at revision 4.
- Both inserted clip records equal the stable proposal receipt, and their IDs are reused: `acl_4d2891d86e536845b6c6ba5501a8afbef157d543c92f7103ffdde7ec6dfd7046` and `acl_812f799bf2673ccf3d3c248fedff8355532d2359996b6075e854317e00e0d675`.
- A fresh native preview after redo reports **zero new clips, three retained**; the main session did not silently reapply or replace them.

“Complete record bytes” here means deterministic JSON serialization of the entire row, preserving all data fields and number values. It does not mean identical ZIP file bytes or an audio-file comparison. The manual baseline row hashes to `edfec5f69e8051f4cfb73060a081827976f5e64d1e8aaca3c57aba00fd5a85e2`; the stable proposal's pre-apply, undone and redone manual row all hash to `fe749f8b9f517f886ee225704b3a3651350372ae5335c7638e6b8c38239a91e9`. Row hashes use UTF-8 `json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`, then SHA-256.

## Real concurrent edit is rejected without writes

The main session kept a prepared preview open in one tab, then changed the first manuscript line through the normal editor in a second tab by appending `（并发验收）`. The edited row is `asg_aa488a9e-c956-450c-a0b3-6bc2716f59f0`, revision 3, with text `第一段：今天，我们把旧任务逐项完成。（并发验收）`.

Returning to the original dialog preserves its old preview text and zero-addition/three-retained result. Attempting the old confirmation produces the typed stale-preview conflict, displays `章节、声音或时间线已改变，请重新预览并确认`, keeps that preview visible and disables confirmation. The [saved screenshot](stale-preview-conflict.jpg) captures this state. Only the explicit repreview action reads and displays the new manuscript text; the UI does not silently rebase the original approved preview.

The ordinary exports `concurrent-edit-before-apply.zip` and `concurrent-edit-after-rejected-apply.zip` contain identical `audioProject.json` bytes, SHA-256 `fc6cdb0cec01661c2184cdef8f7bdb2e7b4a686ec1c8a3899af72281563c8e9f`. Independent decoded-object comparison also confirms complete `audioClips` and `audioSegments` equality. The attempted stale apply neither altered the concurrent text nor added, moved or rewrote clips. Canonical array digests are `a16d7849c983d3bd636bab20ad9d63e8d7e2b1bc0228c6bd5245fce52e29031d` for clips and `fff74dd6c08e8b632e349f739ca4eea40af6888f34dea7333d735be14dbb8a9e` for segments, using the same serialization as above.

## Narrow and keyboard observation

At 390 × 844, the main session measured document clientWidth = 390 and scrollWidth = 390, and dialog width = 358. The [narrow screenshot](narrow-arrangement-dialog.jpg) shows the existing scrollable review controls and no horizontal page overflow. Native Escape closes the dialog, and the active element returns to its opening trigger. The measurements and focus result are main-session native observations; a screenshot alone cannot establish keyboard focus return or every accessibility behavior.

## Metadata evidence identities and limits

Only the ordinary ZIP JSON entries were read, including the following exact `audioProject.json` hashes. No audio Blob entry was read or copied, and this documentation change adds no ZIP/audio artifact to the repository.

| Normal export | `audioProject.json` SHA-256 |
| --- | --- |
| `manual-baseline.zip` | `17db6042ab6f0d7d1dd0408b269885cf8950d51fd388a215fdffb2829a521f53` |
| `selection-applied.zip` | `16aba7fa2529a5709c49f9588526e66578a4953188982a2155c88940b575c6f3` |
| `arrangement-applied.zip` | `415a51be01642d8d33738e5e0dd9fd2e1e5118c3c3f69eabe5cbabc329a9e9b0` |
| `arrangement-undone.zip` | `6f9ac220f60933618e89bc0b1524cb4040fe9759bf0d0cadd96b1d2bcad90d16` |
| `arrangement-redone.zip` | `c81c0ad5e18456fb59769af4d0fd088a86a828f6b003ac7383b5627fb8fd72b5` |
| Both concurrent-edit exports | `fc6cdb0cec01661c2184cdef8f7bdb2e7b4a686ec1c8a3899af72281563c8e9f` |

Normal exports retain proposals as dormant historical records, with historical fingerprints and scrubbed live ownership/approval. Their receipts and row snapshots support the comparisons above; they do not supply executable approval or independent original Agent-call provenance. This native trace checks ordinary selection/placement/history, one real cross-tab text conflict and the 390 px dialog. It does not certify speech quality, complete accessibility coverage, every possible deletion/race/foreign-owner case or imported execution. Those wider contracts are covered by [implementation validation](../validation/2026-10-10-implementation.md), [independent review](../../09-22-audio-batch-experience/validation/2026-10-10-independent-review.md) and the main session's final gates. No commit or archive is performed here.
