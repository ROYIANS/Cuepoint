# Business tools correctness review

Reviewed 2026-09-19. Read-only inspection of businessTools.ts, businessStore.ts,
businessSchemas.ts and the corresponding repository paths. Product files were not
modified. This review is separate from the atomic-tool and generation-recovery
runtime tests already added by the reviewer.

## Findings — all closed after targeted re-review

The original findings below are retained as review evidence. All three were fixed
by the business worker and independently re-read on 2026-09-19:

- **B1 closed:** `assetMediaDependencies` validates ownership/kind/nonempty media
  before approval and binds sorted metadata into the revision; repository copy
  calls `assertSlotMedia` and rejects missing dependencies. `putMedia` is now
  append-only, requiring new IDs for physical replacement. Missing/foreign/wrong
  kind sources, changed metadata and attempted same-ID replacement are tested.
- **B2 closed:** sanitized `mediaRetention` exposes proposal/job counts and delete
  preparation rejects retained media before approval. Existing cleanup still
  protects these references. The fixture verifies unapplied generation retention,
  no connector internals in the response, and project cleanup.
- **B3 closed:** scalar reference arrays preserve up to 100 IDs, and the scoped
  `business_read_relations` tool provides bounded pagination for deeper slot paths.
  The fixture retrieves all 100 IDs and the second 50-item page.

Reviewer reran `tests/agentBusiness.test.ts`: **19/19 passed**, including thread
deletion removing jobs and reclaiming only media not retained by slots/other jobs.

### B1 — Studio reuse does not validate or freeze its media dependencies

Evidence: businessTools.ts `asset_copy_from_studio` (around lines 204–208) binds
only `{source, ownerId}` into the approval revision. Its source asset stores media
IDs, not the media records. `copyStudioSnapshot` in db/repo.ts (around 648–673)
loads those IDs, silently skips missing records, and copies existing records
without checking their source project or declared media kind.

Consequences:
- A legacy/imported source with a missing media ID reports successful reuse while
  silently dropping the promised reference/result.
- A source referencing a media record owned by another project copies that file
  into the destination without rejecting the invalid ownership.
- Changes to the referenced media record between preview and approval are not
  covered by the approval revision if the source asset row stays the same.

Recommendation: validate source slot/media existence, studio ownership, nonempty
content and expected kind at the repository boundary; include the copied media
dependencies in the tool's preview revision. Preserve the existing rule that
physical replacement creates a new media record. Add regression cases for missing,
foreign-owner and wrong-kind source media, and changed dependencies after preview.
This is a validation gap for malformed/legacy sources, not evidence that ordinary
UI slot writes currently create such invalid references.

### B2 — Media usage omits records which actively prevent deletion

Evidence: businessStore.ts `mediaUsage` (around 147–160) counts project covers and
asset/shot slots only. `deleteMediaIfOrphan` now also retains media referenced by
production proposals and generation-job inputs/results. `business_detail` exposes
the former as `usage`/`usageCount`; `media_delete_orphan` discovers the latter only
after the user approves and execution calls the repository.

Reproduction: a downloaded but not yet applied generation result has a job.result
reference and no slot reference. The media detail reports usageCount 0. The delete
preview is offered, but execution correctly refuses deletion. There is no data
loss; the read and approval UI give incomplete information and unnecessary approval.

Recommendation: expose bounded, sanitized retention reasons for proposals/jobs
alongside slot usage, and reject known retained media during preparation. Do not
return provider credentials or opaque execution internals.

### B3 — Larger slot reference arrays cannot be fully read back

Evidence: businessSchemas.ts allows up to 100 `referenceImageIds` and
`referenceVideoIds` for slot_update. businessStore.ts `bounded` truncates every
array to 50. `textAt` rejects paths longer than three segments, so a caller cannot
read `slots.front.referenceImageIds.50`; `business_search` returns summaries, not
these relationships. The result is explicitly marked truncated, but there is no
usable continuation for the remaining references.

Recommendation: preserve bounded scalar ID arrays up to the accepted 100-item
mutation limit, or add a paginated relationship read. Keep large arrays of prose
records truncated/paginated separately. Test an asset slot with 51–100 references
and verify every ID remains retrievable without mutation.

## Contracts checked without defects

- Project, episode, beat, shot and four asset kinds each have list/detail and
  explicit create/update/delete coverage; duplication, complete-scope reorder,
  studio reuse, slot updates and orphan cleanup are mapped to repository methods.
- Creation and mutation schemas are strict; administrative IDs/ownership/extra
  bags are not arbitrary writable fields. Read projections omit top-level extras,
  recursively suppress nested extra bags and do not expose Blob contents.
- Project/episode/shot ownership is checked before mutation. Repository reference
  checks enforce same-project assets and same-episode beats. Studio is not a
  deletable project. Last-episode deletion is rejected.
- Null clearing is mapped to domain semantics for scene/beat associations,
  default style, cover, generation defaults and slot results. Explicit no-style
  remains distinct from inherited style. Undefined shot-setting fields are
  filtered by updateShotSettings instead of clearing unrelated settings.
- Mutation preparation flushes scoped drafts; execution flushes again, recomputes
  the revision and executes inside executeAtomicTool. Deletion binds an owner-wide
  snapshot including proposals and generation jobs. Concurrent writes cannot
  interleave with the mutation/result commit.
- Bounded batch create and duplication validate their sizes. Reorder requires the
  exact complete ID set for the requested scope. Existing asset/reference cascade
  behavior is reused instead of implemented as generic table deletion.
- Newly generated/retained media is protected from orphan collection by the new
  PRODUCTION_TABLES/job-retention changes. Project deletion removes its jobs;
  generation recovery and late-result safeguards are reviewed in the generation
  workstream.

## Verification scope

This bounded review did not edit product code. Original source-based findings
were followed by targeted source reinspection and the passing 19-test business
suite. Final integrated project checks and spec synchronization belong to the main
session.
