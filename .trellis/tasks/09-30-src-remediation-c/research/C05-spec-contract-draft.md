# C05 spec draft — append only after independent acceptance

## 1. Scope / Trigger
Repository asset/shot text patches and project cover replacement, including direct API callers outside the UI.

## 2. Signatures
`patchCharacter/Scene/Prop/Style` omit slots; `patchShot` omits firstFrame/lastFrame/clip. An own media property is explicitly rejected at runtime before generic pickPatch, even if undefined. `patchProjectOutput` validates cover media within PRODUCTION_TABLES using the strict owned nonempty image contract.

## 3. Contracts
An optional TypeScript property restriction does not validate untrusted runtime callers. Media mutation requires existing owned nonempty media with a compatible declared kind and MIME, and atomic write/touch/recycling. Asset/shot text and relationship callers must retain their supported behavior. Asset/still result slots accept images; only the shot clip slot also permits a video result. Video reference inputs remain valid where previously supported. Shot clip image planning placeholders remain supported by the dedicated slot API. Shared and historical job/proposal/batch references protect media from recycling; an actual unreferenced predecessor can be removed. Existing slot revision/CAS and undo behavior remains authoritative.

## 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Generic patch contains unsupported media field | Explicit rejection; no silent dropping |
| Cover references foreign/missing/empty/non-image media | Reject without changing project or media |
| Valid owned image cover | Commit and recycle only unreferenced predecessor |
| Shared or history-retained predecessor | Preserve the media |
| Project touch/storage failure | Roll back the entire mutation |

## 5. Good / Base / Bad Cases
Good: text edits continue to use a small generic patch while media uses validated slot APIs. Base: a video shot can retain an image planning placeholder in its clip slot. Bad: a direct patch bypasses the UI's ownership check, or replacement removes a media file still used by a historical result.

## 6. Required Tests
Direct repository rejection and unchanged-row assertions, valid owned media, clear and replacement, shared/history retention, rollback, and adjacent CAS/undo/proposal tests. Audit named imports, namespace dispatch and dynamic caller payloads. These tests demonstrate repository invariants rather than a claimed normal-UI exploit.

## 7. Wrong vs Correct
Wrong: rely on TypeScript Omit alone or silently delete unsupported fields. Correct: enforce the accepted runtime boundary before writing and use one validated media mutation transaction.
