# C02 spec draft (append after independent PASS)

## 1. Scope / Trigger
Music draft saves, Agent save/reuse tools, generation inputs/provider wire, historical work metadata and ZIP restore.

## 2. Signatures
`MUSIC_DURATION_LIMITS` in domain/music is the shared FlowMusic 1..240 and Suno 10..360 bounds. `validateMusicSettings`, `validateMusicDraft`, `validateMusicWork` validate new values. Explicit `validateLegacyMusicDraft/Work` preserve bounded historical fractions only for package history and immutable existing work metadata.

## 3. Contracts
Optional generation duration is an integer number of seconds when provided. Tool advertised JSON and runtime schema, repository and generation/wire use the same engine bounds. Absence remains valid for incomplete drafts; generation readiness is separately validated. Decoded audio source duration remains fractional and is not the optional generation setting.

Existing finite in-range fractional parameters remain readable and unchanged. Generation/reuse-to-new-draft rejects them with actionable validation before paid requests; users repair saved draft settings with the existing revision CAS. Work metadata edits preserve its immutable settings exactly. Historical ZIP compatibility permits only former finite/range rules; new saves and reused drafts never adopt that exception. No rounding or rewriting of stored settings. Legacy Suno Simple drafts with a stored duration expose an explicit clear action, because the normal duration input only exists in Custom. The action preserves current draft text, uses the existing debounce/CAS, and is disabled during busy/switching; failed/conflicting saves retain the draft.

## 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Missing optional duration / incomplete text | Draft may save; generation completeness remains separate |
| Legal integer engine edges | Save/tool/generation/wire agree |
| Fraction/NaN/Infinity/out-of-range new duration | Reject before successful write/ledger/network |
| Historical finite in-range fraction | Read/restore exact value; generation blocked until repair |
| Existing legacy work title/notes/favorite edit | Preserve immutable settings, normal metadata/CAS validation |
| Historical invalid range or other invalid settings | Existing validation still rejects |
| Reuse legacy fractional settings as a new draft | Reject; no new invalid draft |

## 5. Good / Base / Bad Cases
Good: a 30.5-second decoded song may have a legal integer generation setting. Base: an old 30.5-second requested duration remains visible and repairable. Bad: accepting fractional new saves, silently rounding history, or blocking title edits because settings became stricter.

## 6. Required Tests
Both engines: advertised integer schema, boundary numbers, invalid new writes with atomic rollback and no network, incomplete drafts, exact wire values, existing draft reads/repair/CAS, immutable work metadata, real ZIP legacy roundtrip and rejected invalid historical ranges. Mocked audio proves repository/protocol behavior, not live generation or acoustic quality.

## 7. Wrong vs Correct
Wrong: every validator evolves independently, or apply new generation restrictions to all old-row edits. Correct: share bounds across concrete schemas, enforce new-write integers, and use explicit bounded compatibility only for existing historical values.
