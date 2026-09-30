# C04 draft — append after independent acceptance

## 1. Scope / Trigger
Audio project ZIP ID remapping and historical export freshness in AudioTimeline/AudioExports.

## 2. Signatures
`createAudioExportFingerprint`, `getAudioExportFreshness`, `preserveAudioExportFreshness`, and `remapAudioExportFingerprint` share the scheduling contract in `src/lib/audio/fingerprint.ts` (confirm final signatures after independent acceptance). All three consumers must use the accepted contract, including recognizable legacy JSON schedule fingerprints.

## 3. Contracts
An export fingerprint describes the schedule when the export was produced. An import cannot replace it with the current schedule unconditionally. Fresh exports stay fresh after entity/media/project ID remapping; stale exports remain stale. Version 1 uses a schedule envelope with an optional sticky stale marker when lossy optional reference repair could otherwise upgrade history. Legacy buildAudioSchedule spreads full AudioTake rows, so project/segment/provenance IDs, metadata/revision and object key ordering need explicit compatibility handling. Canonical object keys may fix serialization order drift without discarding meaningful metadata or array order. Capture recognized stale status against full original rows before either ZIP snapshot allowlisting or import parsing strips unknown source metadata; comparing only the already-filtered package can erase the reason the export became stale. Unknown or malformed historical strings are retained and never reported current. Missing historical entities must not abort an otherwise valid package or disappear from a comparison to fabricate freshness. Deleted chapter exports retain chapter scope/title as historical outputs.

## 4. Validation / Error Matrix
| Historical export | Required result |
| --- | --- |
| Recognized current project/chapter fingerprint | Current after two roundtrips |
| Clip trim/gain or source metadata changed | Remains stale after two roundtrips |
| Fingerprint references deleted entities | Preserve historical stale state |
| Original chapter deleted | Preserve chapter history; do not reclassify as project |
| Malformed/unrecognized string | Retain; conservatively stale/unknown |
| Valid remapped media | Original bytes remain retrievable |

## 5. Good / Base / Bad Cases
Good: compatible ID mapping and key canonicalization keep an unchanged export current. Base: an old raw JSON fingerprint is still understood. Bad: comparing only selected acoustic fields drops a prior metadata change and falsely upgrades stale history, or import recomputes all fingerprints as current.

## 6. Required Tests
Real repository full AudioTake rows and actual export/import ZIP paths for project/chapter, current/stale, metadata-only changes, deleted chapter, unknown strings, two roundtrips and retained media bytes. These tests demonstrate persistence and comparison behavior, not decoded playback or acoustic render equivalence.

## 7. Wrong vs Correct
Wrong: blindly refresh fingerprints after import or only remap clipId/mediaId. Correct: preserve historical comparison semantics, remap every recognized identity deliberately, and keep unrecognized or already-stale evidence conservative.
