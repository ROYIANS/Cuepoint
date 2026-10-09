# E07 coercion source slice A — completed implementation

The four owned source files now have **zero ESLint errors**, resolving all80 fresh entry errors (66 unsafe object stringifications plus migration any/assertion diagnostics). A small domain scalar guard/type union makes JSON primitive compatibility explicit; package-specific field-list assertions reject unsupported compound known fields with a path, while local persisted readers recover without side-effect writes. No package/config/CI/spec/ledger/task status or other worker source was edited.

The code and tests are frozen for independent review. This is implementer completion of the assigned slice, not E07/QG01 acceptance. Exact before/review-entry/after SHA-256, all80 diagnostic resolutions, commands, raw outputs and input manifests are in the companion JSON and `e07-coercion-implementation/`.

## Validation performed

- Final actual machine Node24/pnpm: Node24.11.0, explicit authorized pnpm executable reports10.15.0. Installed ESLint10.12.0, JS10.0.1, typed8.71.1, Hooks7.1.1, Sonar4.2.2, Knip6.40.0; no install performed.
- Final focused suite: **374 passed /11 files**, including220 new durable contract cases and current package relations/assets/audio defaults/image discovery/CAS/memory history tests.
- Actual application TypeScript build and strict source+new-test TypeScript checks: exit0. An earlier main-owned `MODEL_BANK_REVISION` unused declaration failure is retained; its owner corrected it before final acceptance commands.
- Targeted ESLint over four owners plus primitive helper: exit0, errors0, warnings3. Remaining pre-existing parseShot complexity21 and memory validation complexity26/cognitive21 receive concrete responsibility review; no blanket allowance, baseline or rule suppression written. The prior nested ternary signal was removed with the explicit video episode branch.
- Scoped full/test Knip: **zero issues in all owned source files**. Whole command exits1 on remaining other-owner findings; this is not a repository pass claim.
- Actual post-E06 original source mirror (all991 input files): the18 prose/name/time scalar characterizations and20 successful primitive ID/FK absence/legacy-scope characterizations pass unchanged. The full220-case regression deliberately fails against old source (173 failures/47 passes) and passes on current source; failures include new field-path error assertions, so173 is not an independent bug count. Original evidence stays byte-identical and both mirror runs have zero input drift. Existing installed dependencies were shared by a symlink, no install.
- Final command input drift is explicitly recorded: main-owned quality schema files appeared; all owned source/test hashes stayed fixed. A preceding complete pass had zero whole-input drift. Source hashes and final tool/config hashes identify what was actually checked.

## Adopted owner policies

Known historical package text/name/timestamp fields accept exact strings, empty/whitespace, number/boolean spelling and original per-field nullish defaults. Fresh tests enumerate every affected prose field. New optionalText/optionalIds contracts stay strict. Compound known text/ID/media/nested story fields reject with file/row/field path before any DB write, verified against every table including existing media. Structured extras, sourceAssetId and future generation profiles roundtrip unchanged.

Package identity repair is separate from relationship eligibility. Original modern episode/beat string/FK and primitive-collision validation still runs before parser synthesis/remap. Coerced0/false/true/7 identities can import without external references, but stringified references never become valid modern originals. Explicit empty row/beat IDs now diagnose before an undefined remap identity can enter the aggregate. Missing/null IDs keep original synthesis. Missing or explicitly empty episode arrays retain one generated owner and ignore old episodeId even if compound; optional falsey beat/scene absence stays unchanged.

Persisted story/slot recovery never throws PackageError or writes storage. Compound prose uses empty/default; compound reference members are omitted instead of claiming an artifact media ID. Genuine current scalar result wins; unusable current result can recover through genuine legacy scalar media. Authored image/video slots, empty slots, current/reference roles, prompt fallback and reference dedupe remain tested. Compound beat identities recover deterministically without colliding with valid or generated identities. Only string excerpts can substantiate script ranges; malformed offsets/excerpts/stale slices drop the association while retaining the beat and content, including valid UTF-16 emoji ranges.

The historical v3 upgrade uses typed unknown rows, preserves exact original string project ownership and aborts/rolls back invalid owner IDs. In its no-existing-episodes branch all old shot episode scopes are orphaned and attach to the generated episode. Actual v1/v2 upgrade tests cover absent, empty, orphan string, scalar and compound scopes and retained real media; invalid numeric/array project identity tests verify atomic rollback. No schema version was added.

Episode/beat writes continue to compare normalized editor values and preserve unrelated edits; stale same-field writes conflict/roll back. Raw source revision hashing remains unchanged. World-setting CAS deliberately retains raw storage comparison: normalized malformed prose cannot conceal the original compound value. The new test proves that replacement from an empty normalized baseline conflicts while ordinary unrelated/same-field CAS remains valid. This known recovery limitation is documented rather than silently changing a disjoint writer.

## Unused export decisions

Fresh scoped Knip plus current source/full tests/native/compiled type searches found no external consumers for AifenjingDB, normalizeShotWorkspaceView, normalizeStoryBeat, ColumnSettings or mergeLegacyReferenceIntoFirstFrame. All five were narrowed from export to local; entire bodies and internal callers remain. The public db singleton, Project structural contract and aggregate normalizers remain the actual consumers. No functions were deleted and no mass unused exception was added.

## Review and evidence limits

No full suite/model/build/native/provider rerun was performed. Node22 clean locked install and whole-batch final gates remain coordinator work. Upgrade tests use fake-indexeddb; local source mirror tests are not a new dependency installation or native-browser proof. Independent check/spec/ledger closure follows this implementation freeze. No commits or pushes performed.

## Frozen changed paths

| Path | Before | Review entry / after |
| --- | --- | --- |
| `src/lib/packages/projectPackageCodec.ts` | `132f14d352120fa732b4ae9b4148e4f5fdde4fd000116be43ded3c21e17402da` | `a0b273442d7a8eb3e204e2ab0b6eca42e42d01494cbfb4781c08e1013489167c` |
| `src/domain/types.ts` | `ec78e60ae3ddcb9c06299954a5c07c59adae535d1dd400821e5ec0aaf37f7204` | `2fd6270b0a2a97ed725148046ef67d2875fee04d7107ef22d8f212cdd9cce78f` |
| `src/domain/slot.ts` | `13dc3767e2114e1793c01a09beeaa6d4d708e06e87b3458bce83cb3bbdc14cd5` | `92f23cbcd33bf46b330e6473378f14bcf1ee8aeb50414abeaf7a4b0171f68c91` |
| `src/db/database.ts` | `9341c96f7adb202f51334250e45188e9964e363b831b0d89eca38018ad1c3982` | `22bcb0693e9b7dc7d559e3a9439566566d9afc125ac7f9c4d32102534f41f37f` |
| `src/domain/legacyScalar.ts` | `new` | `bfe4effb141c407fa2e4618da3c4fedd623a1cf812798cd6fb9eb45dae2c7a8a` |
| `tests/e07CoercionContracts.test.ts` | `new` | `5a691cc4fd08e112119836b1dfe9f88f3cc30b0ab82ec225fa10687b52edaa7b` |

Raw failed attempts and deliberate baseline failures remain under the evidence directory. The source diff is `owned-source.patch`. Evidence/report hashes are in `artifact-hashes.json` (excluded from its own inventory).
