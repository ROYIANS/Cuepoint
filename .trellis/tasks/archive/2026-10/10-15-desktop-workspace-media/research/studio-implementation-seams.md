# Research: Studio seams for desktop directory media import

- Query: Connect the approved Windows + macOS directory scan → real video thumbnail → selected project import workflow to actual Studio storage, library, Agent and result owners.
- Scope: internal source inspection; no product edits or execution of native/build/package checks.
- Date: 2026-10-16 (Asia/Shanghai)

## Findings

### 1. Existing owners and entry files

| File | Existing responsibility / relevant seam |
| --- | --- |
| `packages/studio/src/platform/product/store.ts:12` | Chooses one fixed browser/native ProductStore; native driver session and binary services are constructed together here. |
| `packages/studio/src/platform/runtime/runtimeIdentity.ts:2` | Detects actual Tauri runtime independently of storage profile. Native service presence alone must not replace the fixed store owner. |
| `packages/studio/src/platform/storage/protocol.ts:12` | `BinaryClaim` contains a managed reference and native `stageId`; claim entries travel with the same transaction batch as row mutations. |
| `packages/studio/src/platform/storage/native.ts:76` | `NativeTransaction` holds mutations and claims; `prepareBatch` encodes carriers and sends/seals a fingerprinted batch. |
| `packages/studio/src/platform/storage/nativeBinary.ts:10` | Closed reference/claim/lease schemas, prepare/discard and bounded native transport mechanisms. |
| `packages/studio/src/platform/storage/codec.ts:24` | Branded reference registry; plain objects that resemble references are not native binary tokens. |
| `packages/studio/src/platform/storage/rowCodec.ts:6` | Closed binary carrier whitelist: `media.blob`, file material `payload.blob`, setting snapshot `payload.media[].blob`. |
| `apps/desktop/src-tauri/src/full_product_store/mod.rs:963` | Native commit verifies claim files, row carrier closure and existing committed references; claims and product records commit together. |
| `apps/desktop/src-tauri/src/full_product_store/mod.rs:1219` | Rust independently enforces the same closed carrier whitelist. |
| `apps/desktop/src-tauri/src/product_binary.rs:597` | Existing native managed-file staging has `write_raw`; potential internal adoption seam, subject to native boundary design. |
| `packages/studio/src/features/library/models/media.ts:3` | `MediaRecord`: project, filename, MIME, single binary content and optional `libraryRetained`. No thumbnail or provenance currently exists. |
| `packages/studio/src/features/library/commands/media.ts:63` | `putMedia` adds immutable media IDs after checking current project and touches project in the same supplied transaction. |
| `packages/studio/src/features/library/commands/media.ts:11` | `collectMediaIds` defines retained logical closure; used by cleanup and project ZIP export. |
| `packages/studio/src/features/library/services/media.ts:35` | Binary preview lifecycle correctly releases opaque/native URLs and suppresses stale owner results. |
| `packages/studio/src/features/library/services/media.ts:136` | Existing individual upload reads a browser File, copies/hash-verifies it and calls `putMedia`; not a native directory service. |
| `packages/studio/src/features/library/services/workspace.ts:121` | Browser `ManagedCopyStage`, cancellation before write and no false canceled result after committed write. |
| `packages/studio/src/features/library/ui/MediaThumb.tsx:5` | Shared `MediaPreview` currently plays video using its original URL; no generated poster integration. |
| `packages/studio/src/features/library/services/mediaPicker.ts:5` | Existing picker selects every matching project-owned media row; derivative thumbnail rows need explicit hiding if used. |
| `packages/studio/src/features/library/ui/materials/LegacyMaterialSources.tsx:41` | Current media library already lists raw project media alongside independently versioned materials; useful human workflow entry. |
| `packages/studio/src/features/library/ui/MaterialLibraryPage.tsx:24` | Existing shared material page and project-scoped selection. Add a desktop-only inline import surface here or its existing project media owner. |
| `packages/studio/src/features/library/ui/materials/MaterialImportDialog.tsx:82` | Actual serial import, synchronous duplicate guard, remaining-file Stop and quarantine of uncertain write outcomes. Reuse behavioral rules, not its browser File-only function. |
| `packages/studio/src/features/projects/commands/lifecycle.ts:54` | Actual project deletion cascades project jobs and all project media through the same root transaction. |
| `packages/studio/src/app/workflows/packages/projectPackage.ts:186` | ZIP serializes a hand-picked media metadata shape; adding fields to the TypeScript model alone will not preserve them in export/import. |
| `packages/studio/src/features/library/commands/materials.ts:186` | Independent versioned material commands; file payload currently contains original binary, filename and MIME only. |
| `packages/studio/src/features/library/commands/assetReuse.ts:91` | Cross-project setting reuse copies direct slot media with spread; dependent thumbnail IDs would need recursive copy/remap. |
| `packages/studio/src/features/agent/runtime/toolDefinition.ts:7` | Studio tool context carries real run/thread/call/project/store and AbortSignal. |
| `packages/studio/src/features/agent/runtime/tools.ts:116` | Single real static tool registry, parser and schemas. New tools must be registered here and offered through skills/loading. |
| `packages/studio/src/features/agent/runtime/skills.ts:63` | Current business-read explicitly adds media check and result reader without enlarging common read group. Preserve 36-tool / 2-group limits. |
| `packages/studio/src/features/agent/commands/agentTools.ts:382` | `executeAtomicTool`: product mutations + original tool completion; callback must only do local DB work. |
| `packages/studio/src/features/agent/models/agentJob.ts:1` | E07 foreground model currently supports only web_read and project_media_check. |
| `packages/studio/src/features/agent/commands/agentJobs.ts:101` | Real run-owned admission, revision, frozen selection, bounded result publication, readback and recovery. |
| `packages/studio/src/features/agent/ui/AgentJobReport.tsx:166` | Actual inline retained report entry is allowlisted to the two E07 tool names. |

### 2. A native output reference is not yet an adoptable product asset

The current transaction auto-adds claims only when encoding a **Blob**:

- `native.ts:254–262`: serialize row, Blob callback calls `prepareBlob`, then emit accumulated claims.
- `native.ts:296–303`: prepare via current session, register reference and push claim.
- `codec.ts:54–57`: an already branded managed ref bypasses the Blob callback.
- `full_product_store/mod.rs:987–1022`: a new ref must match a claim, or an existing committed binary; unused claims are rejected.

Therefore returning a fresh `{reference, stageId}` from native thumbnail/copy and merely assigning `reference` to a `media` row will **not** atomically adopt it. Calling the low-level native binary owner to publish a separate ready row would split the product transaction owner.

Recommended native integration: add a narrowly named prepared-native-binary adoption mechanism beside existing binary preparation. It must preserve a runtime brand and bind the stage to the actual ProductStore's native session/workspace, then emit its claim in the actual row transaction. Add the claims for both source copy and thumbnail to that batch. The public business command should accept typed staged capabilities rather than renderer-authored paths or arbitrary claim JSON. An adapter-side weak registry can bind branded native staging tokens to their session/claim; it must preserve that relation through `cloneStoredValue`, row encoding and final batch preparation. Do not silently extend `registerBinaryReference` to mean that a new binary is committed.

Smaller but inferior alternative: return all source + thumbnail bytes to renderer as bounded Blob chunks and use existing Blob preparation. It doubles native→renderer→native transfer, consumes video memory and loses the intended direct native media benefit. A bounded thumbnail Blob may be reasonable; full videos should use stage adoption.

Product startup already holds the native driver and its `getSession` closure (`platform/product/store.ts:18–21`), so install/construct the finite media transport there rather than expose a mutable globally selected native driver or choose storage from `isTauriRuntime()` later. Browser profile gets explicit unavailable directory capability, not a shadow native database.

### 3. Thumbnail representation: two viable designs, both require closure work

**Option A: separate derivative media row (recommended if preserving current carrier whitelist).** Add metadata `thumbnailMediaId?: string`, bounded structured `source?: DesktopImportProvenance` to video `MediaRecord`; save a same-project image row tagged `derivativeOf: sourceVideoId`. Both original and image bytes stay in the existing `media.blob` carrier. Video is `libraryRetained: true`; thumbnail is retained through its owner reference, not independently shown as an uploaded image.

Required real changes:

1. `collectMediaIds` must follow thumbnail dependencies from actually retained/used video roots, validating same project and image MIME. Do not retain every thumbnail just because some orphan video row still exists.
2. `deleteMediaIfOrphans` needs dependent candidate closure or a defined retained derivative deletion path. Today it only examines explicit candidates (`media.ts:101–119`), so deleting an orphan video alone will leave its image row unless the caller supplies it.
3. `mediaPicker.ts:7`, `LegacyMaterialSources.tsx:52` and applicable summary counts must hide derivative image rows.
4. `MediaPreview` uses poster from thumbnail for video without starting playback; inspect can still play original. `MaterialPreview` and raw media payload projection currently discard thumbnail data.
5. ZIP export/import must include and validate `thumbnailMediaId`, derivative relation and safe provenance, then remap IDs after the full media map is available. Current explicit shape omits all of these (`projectPackage.ts:186–192,245–284`). Round-trip both independent binaries.
6. Cross-project copies (`assetReuse.ts:96–106`, material setting snapshot/adoption) must clone/remap the thumbnail dependency. A spread would leave an original-project thumbnail ID. `materials.ts:177–183,342–357` copies only direct selected media today.
7. Promoting a video to a file material currently intentionally captures only original bytes (`materials.ts:202–209`). Either explicitly specify thumbnail regeneration after adoption, or extend immutable file payload with an image snapshot and register the new carrier in both runtimes. Do not claim preservation if it is silently dropped.

**Option B: inline `MediaRecord.thumbnail: {blob, mimeType, atSeconds, width, height}`.** Fewer extra IDs, no image picker pollution or reference graph; metadata and original live in one row. However `rowCodec.ts:6–11` and Rust `carrier_references:1231–1237` currently reject this fourth carrier. Nested setting snapshots would add `payload.media[].thumbnail.blob`, and file material needs equivalent representation if preservation is in scope. This demands explicit carrier registration in all encode/commit/reopen/probe fixtures, ZIP binary files + metadata, immutable snapshots and migration/compatibility documentation. Merely adding a TypeScript optional property is insufficient.

Choose one representation before implementation; do not mix an in-memory-only thumbnail and durable source import while describing the workflow as persisted.

### 4. Small closed native media protocol

The exact Rust signatures remain the native owner's decision. Studio needs a finite service, not `fs`, `exec` or shell:

```ts
pickDirectory({operationId, projectId}): Promise<Canceled | DirectoryGrantSummary>
scan({grantId, operationId, limits}): Promise<ScanManifestSummary>
readScanPage({grantId, scanId, offset, limit}): Promise<ScanPage>
prepareVideo({grantId, scanId, entryId, expectedRevision, operationId,
              thumbnail: FixedThumbnailPreset}): Promise<PreparedVideoSummary>
readOperation({operationId}): Promise<Pending | Prepared | Stopped | Failed | Unknown>
cancelOperation({operationId}): Promise<Stopping | Stopped | AlreadyTerminal>
discardPrepared({operationId}): Promise<Discarded | AlreadyAdopted | CleanupPending>
revokeDirectory({grantId}): Promise<void>
```

The client never supplies absolute source/output/executable paths, arbitrary command flags, SQL, output file names or URLs. Runtime selects directory through OS picker, freezes entry IDs and actual source identity/version/hash policy, snapshots bytes for probe/extraction or verifies all consumed file reads, and returns safe display metadata. Absolute native paths stay behind the grant registry. Grant/entry IDs are capabilities only in conjunction with the bound native session, scope/project and revocation state. File names are untrusted data, never arguments concatenated into shell commands.

The produced thumbnail must be real decoded frame output. Return bounded width/height/time/content-hash metadata and a native-owned prepared artifact; claimed MIME alone is not image validation. Video extension is just a candidate filter; probe determines acceptance. Count/byte/depth/time/log budgets are explicit rejected/partial results, never silently truncated complete scans.

Process service must give cancellation a request path independent of any single locked long-running store request. A mutex held by the full scan/process invoke would block Stop. `cancel` is a request; only actual terminated/reaped worker and closed/cleaned handles permit Stopped. Windows job/process-tree semantics and Unix process group semantics require separate actual evidence.

### 5. Human + Agent share product commands, not fake chat identities

Use new library-owned import orchestration (`features/library/services/desktopMediaImport.ts` is a reasonable destination), with product writes in a narrow library command (`commands/desktopMediaImport.ts`). Platform owns finite DTO/transport, library owns target selection/receipts and Agent adapter, app composes entry. Neither a second ProductStore nor `workspace_request` reference lane is appropriate.

Human first flow: project-scoped existing media library → “导入文件夹” → native directory picker → inline table/grid of discovered videos + useful probe data + actual thumbnails → selected import. Show one progress surface with counts, current file and Stop. Keep chat mounted and no drawer/navigation away. Agent can return a concrete grant-needed result and open the same inline picker affordance; it must not choose a path from text or launch arbitrary selectors without a user action. The user-facing label stays disabled/unavailable in unsupported browser runtime.

Both callers invoke the same import command. Native work and verification happen **outside** product write transactions. Final per-item write atomically adds immutable source and thumbnail media rows, project touch, provenance and receipt; an Agent call's completion/observation must join the same actual transaction where claimed. Concurrent edits to unrelated project data are retained. Recheck project existence, frozen source version/grant and exact selected target before publication.

Durable operation identity is required across ambiguous acknowledgements. One option with no new table is stable reserved media IDs + `source.importOperationId` and item operation IDs, frozen expected source hash/scan revision, and exact receipt lookups. This needs a provable pre-effect intent in an existing suitable record; a media row that exists only after publication is not by itself pre-effect admission. A dedicated **project-owned** import batch/receipt table in the same ProductStore is clearer for human and Agent recovery, but adds table registry/hash/lifecycle/native fixture work. Choose explicitly. Avoid relying on React state for post-reload ambiguity or blindly starting a new import when native acknowledgement is missing.

### 6. E07 job extension scope is larger than adding a kind string

Current E07 admission is exclusively real Agent execution:

- `agentJobs.ts:45–62` checks exact durable run/thread/call/assistant-message/offered-step ownership.
- `agentJobs.ts:120` requires `call.name === selection.kind`.
- `models/agentJob.ts:4–9` selection and observations describe existing project media only.
- `agentJobs.ts:65–72,121–127` validates the two original selection kinds.
- `agentJobs.ts:134–137` derives total as one web request or existing media list.
- `agentJobs.ts:172–176` observation and completed count require existing selected media IDs.
- `agentJobs.ts:207–225` publication distinguishes webpage versus canonical media report.
- `agentJobs.ts:289` clear creates one of the two existing empty selections.
- `agentJobs.ts:308–315` recovery treats all non-dispatched-web work as stopped local checks.
- `AgentJobReport.tsx:32–54,141,168` includes tool-name allowlist and media-check-specific counters/copy.

Do not manufacture a run/thread/call for the human import UI. Preferred split: project-owned import intent/receipt is common durable authority; Agent adapter additionally saves bounded E07 reports under its actual call. If extending E07, add explicit typed local-media selection/observations (grant/scan/version/item IDs and committed media receipts, no paths or binary tokens); update validation, count, format, clear, read, lifecycle and recovery branches together. Completion must not convert a native process status to confirmed product import without an atomic stored receipt. Recovery must query/reconcile existing operation, never dispatch a new native worker.

### 7. Tool discovery and approval

Suggested focused group `desktop-media` with `desktop_media_scan`, `desktop_media_read`, `desktop_media_import`, plus existing `read_job_result` where the new job kind actually supports it. Names are proposals, not current implementation. Keep grant creation in an explicit user interaction; scan reads only current granted scope. Import is write/high-risk with `requiresConfirmation: true` when actual selection must be reviewed. Freeze scan revision, exact entry IDs/hashes and current bound project in preview revision and recheck before effects. Existing `AgentToolPreview` supports summary/changes/revision (`models/agent.ts:48–54`).

`executeAtomicTool` cannot wrap scanning/probe/extraction/copy: its callback is DB-only (`agentTools.ts:379–408`). Native producer is non-atomic IO; only final local product publication can use/join its transaction. Do not classify an entire native workflow `atomic:true` or `recovery:'repeatable'` because its last write is local.

The current tool group cap is fixed. E07 specifically kept `BUSINESS_TOOL_GROUPS.read` unchanged and added media tools only to `business-read` (`skills.ts:63–66`), preserving story + asset editing at 36 offered tools. Do not append all E08 tools to that shared read group. Verify new group discovery/offering and existing common combinations with the actual production loader/catalog tests.

### 8. Necessary validation seams

- Native staged adoption: same transaction includes new binaries + carrier rows; foreign/current-workspace/stage mismatch denied; rollback discards owned unclaimed artifacts; unknown commit never discards potentially committed content.
- Source safety: changed/replaced/deleted file and revoked grant before/during prepare reject without stale import; no outside-grant path accepted. Actual Windows paths/junction/reparse cases belong to native verification.
- ProductStore command: current project validated; item receipts deduplicate stable operation identity; late delete prevents resurrection; original + thumbnail + receipt atomic; unrelated edits preserved; known rollback retry versus unknown quarantine distinguishable.
- Stop: hold actual native operation; no next item, actual process terminated and reaped before unlock; if product publication wins, return committed receipt despite late Stop.
- UI: immediate action/duplicate guard, selection survives known failure, actual counters only, Stop once, unknown view/check action without replay, chat remains mounted, no drawer or extra success captions. Use actual React/ProductStore integration rather than only service mocks.
- Artifact closure: poster visible after reload; derivative images not separately selectable; retain/delete/cross-project reuse/ZIP round-trip all preserve chosen thumbnail representation; source file deletion after successful copy does not break managed original or thumbnail.
- Existing relevant regression owners: `tests/nativeBinaryProduct.test.ts`, `tests/agentJobs.test.ts`, `tests/agentJobProducers.test.ts`, `tests/agentJobsUi.test.ts`, tool loading/catalog/registered argument tests and real project package fixtures. Run only affected source/targeted native tests now; full build/package/native integration remains the owner's batch-end gate.

## Related specs

- `.trellis/spec/studio/frontend/index.md`
- `.trellis/spec/desktop/runtime/index.md`
- `.trellis/spec/frontend/feature-organization.md`
- `.trellis/spec/frontend/shared-product-storage.md` (especially native claims, three carriers and unknown-commit certainty)
- `.trellis/spec/frontend/native-product-runtime.md` (including platform file authority and registry tail)
- `.trellis/spec/frontend/native-workspace.md` (reference API is not the full-product owner)
- `.trellis/spec/frontend/agent-jobs-results.md`
- `.trellis/spec/frontend/interaction-feedback.md`
- `.trellis/spec/frontend/creative-operation-feedback.md`

## External references

None used for this internal implementation-seam report. Native executable backend/distribution, decoder licensing, target binaries and process-tree controls are separate owner research; no technical claim about a specific current FFmpeg/Tauri/plugin release is inferred here.

## Caveats / Not Found

- No current directory grant, source manifest, media process service, durable media import batch/provenance or generated poster field exists in the inspected Studio owners.
- Existing browser `copyIntoManagedWorkspace` and the schema-4 reference workspace are not implementations of desktop directory authority.
- A new media model optional field does not automatically require a new indexed table, but its byte carrier, project package and lifecycle behavior must be explicitly implemented. A new import batch table does require schema registry/hash/lifecycle closure.
- This report recommends seams/options, not approved DTOs, selected budgets or implementation status. Native command details and thumbnail representation must converge with the other owner before product edits.
- No tests/build/install/native executable/packaged app were run, no Git operations performed, and no files outside this task's research directory were written by this researcher.
