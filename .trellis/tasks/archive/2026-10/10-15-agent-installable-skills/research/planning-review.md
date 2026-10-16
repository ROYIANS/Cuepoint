# Research: E09 planning consistency review

- Query: Do the concrete PRD/design/implementation plan contain a blocking inconsistency in ProductStore persistence, run retention or native import transport?
- Scope: internal; bounded planning review, at most three material findings.
- Date: 2026-10-16

## Findings

### Resolved draft issue: physical body/resource disclosure granularity

At the reviewed draft, `design.md:114` places immutable package text and the complete resource manifest/content in one `agentSkills.content.<revision>` value. `design.md:183` says `load_skill` reads that content record to return the selected body and resource manifest. This makes loading a body hydrate every resource's text as well, even when the model has requested none of those resources. That needs reconciliation with the staged read promise in `prd.md:64` and `prd.md:103`.

This is observable storage behavior, not a hypothetical database optimization: `packages/studio/src/platform/storage/store.ts:117` implements `get` through full-row `bulkGet`, and `:121` clones the complete returned row. Native oversized row reads in `packages/studio/src/platform/storage/native.ts:285` collect the complete transfer before decoding the row. ProductStore has no field-projection or text-range read API that makes a monolithic content row physically lazy.

Recommended resolution: keep the existing deviceSettings owner, but split the immutable revision into a small version manifest containing body/resource key/hash/size references, a body value, and one value for each accepted resource. Revision identity covers the ordered manifest and exact bytes; its existing retention record owns the whole immutable set. Installation/update publishes the complete set atomically, and final cleanup deletes that set only when both catalogue/run references are zero. `load_skill` reads the manifest and body only; `read_skill_resource` reads the requested resource only, then applies the bounded scalar-value range. Admission/discovery continues to read catalogue and retention metadata only. Retain actual serialized 2 MiB checks for every value and aggregate quota accounting for the whole version. No table or generic storage protocol change is necessary.

The alternative is explicitly narrowing “on-demand resources” to model-context disclosure while accepting eager storage hydration for the selected skill. That would require changing the PRD/design/test claim before approval. The strict three-layer design is preferable and matches the stated user intent.

Resolution recorded by the main session after this review: `design.md` now splits
the immutable manifest, body and each resource into separate device-setting rows.
One retained revision identity owns atomic publication, quotas and group cleanup;
reads verify only the selected component against the manifest. `implement.md`
requires storage-read witnesses for metadata/body/selected-resource separation.
The identified draft issue is closed at the planning level. This records a reviewed
design correction, not implemented behavior or passing tests.

### Reviewed constraints without additional blocking findings

- `design.md:63` requires the actual serialized JSON UTF-8 value to fit 2 MiB, including escaping. This agrees with `features/settings/commands/deviceSettings.ts:26`; the separate 512 KiB raw-input cap is not treated as proof of serialized size.
- `design.md:86` gives the new finite directory-snapshot response an independent 2 MiB serialized ceiling, with rejection on overflow. It does not raise ProductStore/binary chunk limits or expose generic source paths. Existing store request validation is separately limited to 262144 bytes (`apps/desktop/src-tauri/src/full_product_store/protocol.rs:339`); this is not a global limit on every new Tauri response. Actual implementation must validate both native output and renderer response before adopting the candidate.
- Metadata-only admission and retry/resume retention are coherent: the snapshot is frozen atomically with the run; new retries pin once, resumes do not repin; content survives disable/uninstall until actual run deletion. Current `design.md:167` and `implement.md:60` already preserve project deletion's surviving chat/run pins and release only at actual run deletion. The known draft project-deletion mistake is fixed in the reviewed files.
- Strict authoritative reads avoid the existing convenience getter's swallowed failures. Current-reference and run-reference accounting permits identical immutable content to be shared by distinct installation generations without reviving old installation identity.

## Files and patterns checked

- Task `prd.md`, `design.md`, `implement.md`: proposed observable contracts, persistence shape, source limits, staged checks and deferred platform evidence.
- `packages/studio/src/platform/storage/store.ts:113`: whole-row table reads.
- `packages/studio/src/platform/storage/native.ts:285`: complete native row-transfer hydration.
- `packages/studio/src/features/settings/commands/deviceSettings.ts:5`: exact size/key limits, forgiving optional reads and transaction-aware writes.
- `packages/studio/src/features/agent/commands/agentRuns.ts:124`: new retry run identity and prior frozen execution inputs.
- `packages/studio/src/features/agent/commands/lifecycle.ts:8`: actual chat/run deletion transaction.
- `packages/studio/src/features/projects/commands/lifecycle.ts:30`: project deletion does not delete Agent chats/runs.
- `apps/desktop/src-tauri/src/full_product_store/protocol.rs:339`: command-specific ProductStore request ceiling.

## Related specs

- `.trellis/spec/frontend/shared-product-storage.md`: single ProductStore, whole-row storage, device settings and unknown-commit certainty.
- `.trellis/spec/frontend/agent-library-tools.md`: immutable run permission/tool snapshots and actual offered-step boundaries.
- `.trellis/spec/frontend/desktop-media-import.md`: independent media authority and actual host evidence limits.
- `.trellis/spec/guides/task-artifact-retention.md`: retain concise authored review rather than raw output.

## External references (docs, versions)

No external sources or upstream version claims were required for this repository planning review.

## Caveats / Not Found

- Reviewed a concurrently authored planning draft. The main session owns and may revise the cited task document lines after this review.
- No product source or main planning document was edited. No tests, builds, native picker or installed-host checks ran.
- This review covers storage/lifecycle/transport consistency only; it does not establish parser security, UI behavior, runtime integration or actual macOS/Windows support.
