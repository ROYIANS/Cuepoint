# E04 SS09 library implementation — final shared transaction

Status: ready for independent check of this writer's assigned scope. The final helper keeps exact owner equality ranges, executes their N cursor requests in one explicit readonly shots transaction, and returns a bounded cover Map. No factory, persisted cache or latency claim is introduced.

## Evolution and measured transaction/query scope

The earlier SS09 implementation used per-ID equals with independent implicit readonly transactions. Its report, source hashes and native-final artifacts remain unchanged under query-n-revision and native-final; the old helper is also an immutable test-owned comparator. A subsequent anyOf attempt reduced requests to one but failed the native ID-gap insertion case: an unselected owner between selected IDs triggered a cover callback. The attempt's exact source, failed DOM/screenshot/log, focused 8-test success and native failure are retained. Its 47 returned cursor rows and 45 matching reducer visits are distinct measurements. The final implementation returns to equals and combines transaction ownership.

Actual native comparison for the same three distinct owners (including an empty owner and duplicate input): old helper **3 readonly transactions / 3 cursor requests / 45 complete returned rows**; final helper **1 readonly transaction / 3 cursor requests / 45 complete returned rows**, with identical covers. The final default gallery uses **1 readonly transaction / 24 cursor requests / 1,046 returned rows / 1,046 reducer visits**. Video filtering uses **1 readonly transaction / 3 cursor requests / 45 rows / 45 reducer visits**, yielding **2 retained IDs / 53 UTF-8 JSON bytes**. The unselected ID-gap owner insertion emits zero cover callbacks, cursor requests, cover transactions or reducer visits. This is not a claim that one query is better than precise subscription scope.

The original pre-E04 gallery still provides the all-shot baseline: 1,296 native rows on cold loading and about 5.89 MB of retained callback data. Its warm cached update has zero new native reads but 3,888 filter checks and 142 sort comparisons; the final scoped update returns 45 rows and performs 45 reducer visits. These are separate work/storage observations, without latency, disk-IO or column-projection claims.

## Preserved behavior and validation

Explicit project coverMediaId wins. Fallback remains the first eligible first-frame result under project-wide order; equal-order ties preserve primary-key iteration order across episodes, early missing results are skipped, and a selected missing media ID does not cause a later frame to be chosen. The query-key retained-result guard rejects previous owner-scope data while a new query is held. There is no persisted cover cache.

Each keyed studio asset kind queries only its corresponding typed studio table and reuses its existing cover function. Authored source fields remain available to search; cover/wrapper IDs and provenance do not become search content. Relevant writes refresh cards, while other-kind and foreign-owner writes do not rerun the current subscription. Search, sort, archive, IP, missing/loading and E01 mutation ownership are preserved. Eight selected mutation/navigation bodies are byte-identical to E04 entry.

- Focused tests: **8 passed**; final fixture typecheck and application lint passed after the shared-transaction change.
- Current native library: **16 scenarios passed**, one document and zero page errors. The actual loaded closure contains **73 modules**; **15 owned inputs** match their final before/after receipt.
- Unchanged E01 runner: **20 scenarios passed** on helper SHA 88ee8de4fa4f8d82d2420da7ae9f08c37cdf7b3a81ddc2ab3b591c4d11eb25f1. Its **450 input fingerprints**, including **447 source/parser inputs** plus the exact producer and fixture, match pre/post. This bounded run receipt is not a global source freeze or certification of another writer.
- Exact source/producer bytes, before/after hashes, commands, failures and output metrics are in the JSON report and evidence receipts. E04-entry is the accepted post-E03 working tree, not HEAD. Permanent tests and runner do not import task/archive runtime inputs.

## Static attribution and remaining review

The coordinator's earlier read-only 18-file precheck was 4 errors/44 warnings → 3 errors/41 warnings, with zero added non-complexity and new-helper diagnostics at that earlier source snapshot; its 447 parser inputs did not drift during that run. The Gallery page bytes still match that precheck, so **Gallery complexity 31 → 32 remains one E04 metric change**, attributable to the necessary query-key guard and awaiting independent confirmation. No condition was moved to reduce the metric. The final helper bytes differ from the earlier precheck and require the coordinator's final static refresh; earlier zero-helper diagnostics are not advertised as a check of the new helper. AgentChat metric changes retain E01 attribution.

Main owns final cumulative static/AST/integration checks, independent review, specs and ledger. E01 write20 is now complete for the current fingerprint. No paid call, install, commit or spec/status/ledger edit was performed.

## English spec suggestions

- Gallery fallback queries read only visible projects with a nullish coverMediaId, using separate projectId equality ranges within one explicit readonly shots transaction. N cursor requests remain N; they share one consistent transaction. anyOf bounding-range observation is not equivalent to exact owner scopes. Retain only bounded project-to-media IDs and temporary order comparisons. Keep explicit covers, first eligible first-frame semantics, primary-key input order ties across episodes, and the selected missing-media ID. Do not create a persisted cover cache.
- A stable serialized sorted fallback-owner set is the gallery query identity. Return the identity with the cover map and reject retained results whose identity differs while a new live query loads. Sorting/card metadata changes that preserve the fallback-owner set do not resubscribe its shot query.
- Each keyed studio asset kind uses one typed studio-owner table query paired with its existing typed cover function. Preserve the original authored source object for search; wrapper/cover IDs and provenance must not become searchable. Relevant writes refresh cards; other-kind and foreign-owner writes do not rerun the current subscription.
- Native performance evidence separates complete IndexedDB returned rows, live-query callback rows, serialized retained projection bytes, and derivation work. Dexie caching can produce a fresh full-query callback without new native reads. No column-projection, latency, disk-IO or universal physical-read improvement follows from a smaller Map.

## Limits

- Native cursor/getAll counts returned complete rows, not physical disk IO or column projection. Exact owner equals ranges use N cursor requests inside one readonly transaction. Query count, transaction count, complete returned rows and reducer/output counts are separate metrics.
- Default Dexie caching can reuse warmed full-query arrays with zero additional native reads; warm native row counts and callback rows are separate.
- JSON bytes measure object data excluding Blob bytes, not allocations/network bytes.
- Callback counters describe derivation work, not elapsed latency.
- Negative subscription observations are bounded 200ms waits after committed writes.
- Only own scope is frozen; other E04 writers may change shared imported roots. Whole integration belongs to the coordinator.
- Asset wrapper JSON duplicates common metadata plus authored source; it is a serialized output-size measurement, not an allocation profile. Each kind still retains its complete authored record for existing search semantics.
- Gallery projects/IP/link subscriptions remain broad metadata subscriptions; the scoped claim concerns shot fallback reads. Filtered project metadata can rerun the project callback without rerunning its unchanged cover scope.
- The immutable original page snapshots share the currently served alias dependencies; they are a page/query comparator, not an E03 database snapshot. 'Untouched dependencies' in provenance means untouched by this SS09 writer. Exact served versions are preserved in native loaded-sources.
- Only local native Chromium/IndexedDB was exercised, with seeded PNGs; no paid/network model request, install, commit, spec/status/ledger change or independent check was performed.
- Main owns same-version whole-source static/AST analysis, full integration and independent check. The earlier precheck must be refreshed where final helper hashes differ; current-source E01 write20 has passed with its own unchanged-input receipt.
