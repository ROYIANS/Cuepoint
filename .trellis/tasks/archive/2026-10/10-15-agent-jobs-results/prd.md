# E07: 长任务、工具结果回读与产物索引

## Goal

Show truthful progress and retained, owned reports for actual foreground Agent work, while keeping model context bounded. First consumers are a bound-project video-availability check and the existing web_read extraction; the same actual result owner is the integration point for the selected E08 directory scan → video thumbnails → project import workflow.

## Authorization and evidence

Standing owner instruction: “ok，继续，每个阶段完了就提交代码，然后再继续”; necessary affected tests only, full/build/package/native checks at batch end. E06 is committed as d4c2c877 and archived. This task narrows its original broad jobs requirement to actual supported producers and preserves foreground lifetime. [Source investigation](research/jobs-results-design.md), [E06 contracts](../10-15-agent-resource-capabilities/prd.md), and the original [comparison](../10-15-desktop-agent-capability-research/research/capability-comparison.md) / [host investigation](../10-15-desktop-agent-capability-research/research/host-integration-review.md) establish current ownership and limits.

## Requirements

- E07-R1: Admit an owned call-unique job before actual work; report acknowledged accepted/running/stopping/stopped/completed/failed/unknown states and actual progress. UI reads durable facts; no artificial percentages or preparation captions.
- E07-R2: Retain complete sanitized accepted web extraction (within the existing 2 MiB response cap) and bounded project media reports. Save a bounded preview/reference in original call results and continuation; owner-checked readback pages make zero provider requests. Keep core's 65,536 string-unit result guard and existing compaction.
- E07-R3: Add an actual project_media_check tool for the bound video project, an exact optional selection of project-owned videos, real per-item availability findings and useful inline report UI. Browser availability is not codec/hash verification; native inspection remains the existing managed-binary owner.
- E07-R4: Use one ProductStore and existing held execution owner. Keep jobs distinct from model turns/remote generation, mandatory paid confirmation, current credentials and business/evidence/completion atomicity. Final report publication and original bounded call completion commit together; unknown never permits redispatch.
- E07-R5: Keep output until explicit clear or owning thread/project deletion, within documented byte/count quotas. Admission reserves capacity before producer/network work; quota exhaustion explains cleanup. Terminal clear preserves a small unavailable descriptor and immutable original history. Protect live publication and cascade parent deletion without late resurrection.
- E07-R6: Stop schedules no next media item, drains the actual current read before acknowledging stopped, retains checked coverage and never claims remote cancellation. Route/window departure keeps current foreground semantics. Reattachment/recovery reads saved state and does not dispatch work.

## Acceptance criteria

- [x] E07-AC1: A retained extraction larger than 65,536 characters yields a bounded original result/next model context and reconstructs exactly through authorized pages, with no extra Tavily request. Foreign/deleted/cleared/unpublished output is unavailable.
- [x] E07-AC2: The actual local checker exposes committed progress, Stop remains stopping while its held backend read drains, no next item starts, and committed observations/results survive. Remote waiting cancellation preserves serviceMayHaveRun; this stage does not claim to terminate an OS process.
- [x] E07-AC3: Inline current/historical report UI reattaches to authoritative state; recovery under actual ownership marks abandoned work conservatively and submits zero requests. Unknown publication reconciles durable completion and never repeats effects.
- [x] E07-AC4: Admission/quota, stage/publish/clear and parent deletion use actual ProductStore transactions; unknown acknowledgement, late callbacks, owner/scope drift and duplicate call admission cannot expose a fake complete reference or resurrect rows.

## Selected boundaries

No detached Agent/background host, filesystem directory grant, ffmpeg/shell, native process lifecycle, new package, second loop/store, arbitrary IPC, task-evidence redesign or paid-generation change. E08 must verify actual owned-process termination with its selected backend; E11 owns changed lifetime. Original E07 OS-process-stop coverage is assigned there explicitly rather than simulated here. Initial output limits are 2 MiB/output, 16 MiB/thread, 128 MiB total; metadata and job counts are bounded too. Exact implementation constants and chunk sizes are technical tunables. No silent expiry/automatic eviction. No new historical-data migration; fresh schema policy applies, preserving any already-existing explicitly scoped migration behavior.

## Validation cadence

Explicit Studio source runner/types with only exact public Agent aliases; necessary actual browser-store/loop/DOM/fault cases, scoped lint and architecture. Preserve default freshness and all emitted/packed/native/full/package gates for batch-end acceptance. Source fixtures cannot establish actual process kill, native backend execution, packaged responsiveness or live service behavior.

## Delivered verification

Independent final review: [review](research/review.md) and its complete
[scope ledger](research/review-scope.md). The finite source run passed 11 suites /
208 tests, including the actual job commands, producers/shared loop, report DOM,
existing web/ownership/claim races, tool loading/catalog/arguments and registry
identity. Strict Studio source and Node configuration type checks passed. Typed
lint of 20 changed Studio TS/TSX files had 0 errors and 31 visible warnings; the
final type-only public-entry repair also passed a targeted 0-error/0-warning
recheck. Architecture passed with 660 files, 2,591 static and 14 literal dynamic
imports, zero cycles/failures/computed imports.

AC1 is exercised by real Chat and Responses loop fixtures and authorized Unicode
page reconstruction. AC2 uses serial actual producers and a held native service
transport, not an executed OS process. AC3 combines real ownership recovery and
nine DOM/store cases. AC4 uses real browser ProductStore transactions and injected
fault/unknown acknowledgements, including publication with absent metadata and
descriptor tampering. These source-level criteria are complete under the owner's
necessary-only cadence; Rust/native disk/process, emitted/packed, full regression,
build/package and live-service acceptance remain explicitly deferred.
