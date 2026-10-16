# E08: 本地工作区与媒体自动化

## Closure (2026-10-16)

Source delivery is complete. On 2026-10-16 the owner took over final checks and requested archival. Actual Windows/installed and full batch acceptance remain unperformed owner checks, listed in task.json and the parent roadmap.

## Goal

Deliver a complete authorized-directory-to-verified-media-import workflow through owned native tools.

## Planning state

The owner approved development on 2026-10-16 after the first workflow and platform
scope were converged. The implementation is staged: each stage has its own
validation and checkpoint, while this task remains the single source of the
end-to-end acceptance criteria. The first release supports macOS and Windows;
Linux remains an existing desktop target but is outside this workflow until a
separate platform contract is written.

## Evidence

- [Research: capability-comparison.md](../10-15-desktop-agent-capability-research/research/capability-comparison.md)
- [Research: host-integration-review.md](../10-15-desktop-agent-capability-research/research/host-integration-review.md)

## Dependencies and order

- E06: [E06 delivered contracts](../archive/2026-10/10-15-agent-resource-capabilities/prd.md) — use its reviewed contracts/results before this task is activated.
- E07: [delivered foreground jobs/results](../archive/2026-10/10-15-agent-jobs-results/prd.md), commit `c9fd6706` — use its reviewed contracts/results before this task is activated.

The working branch starts from the delivered E07 checkpoint. No second ProductStore,
reference-workspace import lane, or renderer filesystem/shell authority is allowed.

Tree position does not enforce these dependencies. If a dependency is deliberately narrowed or removed, update this PRD and the parent roadmap with the corresponding lifecycle/acceptance consequence before review.

## Requirements

- E08-R1: Select an initial media workflow: scoped directory scan and media probing followed by a useful transformation and verified project import.
- E08-R2: Use granted paths, file-version checks, owned process cancellation, bounded logs/results and explicit artifact cleanup.
- E08-R3: Keep final project changes through existing product commands and transactions, preserving concurrent edits.
- E08-R4: Evaluate whether a generic shell is necessary after the bounded media workflow; no arbitrary renderer filesystem/shell access is assumed.

## Approved first workflow and platform contract (2026-10-16)

The first user-visible path is:

1. A user invokes the existing Agent/tool entry point for local media and explicitly
   chooses a directory through the native directory picker.
2. The native host creates a session-bound directory grant and scans that grant with
   bounded depth, entry count, file size and total-byte limits. The renderer receives
   opaque grant/scan/entry IDs plus safe display metadata; it never receives an
   authoritative source path.
3. The user reviews the deterministic video list and selects entries. The host
   freezes each selected file identity and copies it into an owned operation area.
4. A fixed, bundled media decoder creates a real PNG thumbnail from the frozen copy;
   stdout/stderr, duration, dimensions and output bytes are bounded. macOS uses a
   process group; Windows initially owns the fixed decoder child and promises direct
   child kill-and-wait. A stop is terminal only after the child is killed and reaped.
5. The host prepares the original and thumbnail as managed binary claims. The shared
   ProductStore transaction atomically adopts both claims, writes the source media
   row, derivative thumbnail row, provenance and import receipt, and touches the
   selected project. A late stop reports the committed receipt.

The initial Windows source-volume baseline is local fixed NTFS because the existing
file-identity and reparse protections require it. SMB, removable/exFAT and other
unsupported referrals fail with a clear scoped error before copying. macOS accepts
ordinary directories/files under the native grant and applies the existing identity
and symlink checks. Neither platform follows discovered aliases/reparse points.

The thumbnail representation is a separate derivative `media` row referenced by the
source video. This reuses the existing binary carrier and keeps the derivative out of
normal media pickers, but its reference must be closed over retain/delete, project
copy, package export/import and preview code before the workflow is considered done.

Executable distribution is a later implementation stage. We will pin one reviewed
FFmpeg/ffprobe source and per-target digest manifest, verify the executable before
launch, and keep it outside renderer-controlled input. Until that stage lands, no
desktop build or packaged binary is claimed as media-workflow support.

## Acceptance criteria

- [ ] E08-AC1: Selected macOS and Windows fixture inputs produce verified original and PNG derivative outputs and import into the intended project with provenance and a durable receipt.
- [ ] E08-AC2: Out-of-grant access, unsupported Windows volumes, changed/replaced files and revoked permissions fail before unauthorized product effects.
- [ ] E08-AC3: Cancellation stops owned local work and leaves committed product effects/unknown external outcomes truthful; an uncertain native acknowledgement is retained for reconciliation and never replayed automatically.
- [ ] E08-AC4: After reload, the thumbnail previews with its source video; derivative rows stay out of ordinary pickers and survive retain/delete, project-copy and package round trips.

## Boundaries

- Preserve one reusable Agent loop, sole product transaction owner, exact approval, current credentials, scoped references and explicit unknown outcomes.
- Keep browser and desktop behavior shared where supported. No second product store, unreviewed core replacement, automatic external-effect replay or arbitrary renderer IPC.
- Future features listed in sibling tasks do not enter this task merely because they share files. Test actual observable behavior with bounded deterministic fixtures before live/paid checks.

## Resolved decisions

- First operation: directory scan → selected video list → real PNG thumbnail → verified
  import into the current project.
- Platforms: macOS and Windows in the first release; Windows is initially local fixed
  NTFS only. Existing Linux packaging is preserved but does not claim E08 support.
- Authority: one native grant/process owner and one existing ProductStore; human and
  Agent callers share one library import command. No fake Agent run is created for the
  human picker.
- Admission: one project-owned `desktopMediaImports` table stores pre-effect intent,
  stable item/source/thumbnail IDs and exact committed receipts. It belongs to the
  same ProductStore and follows project deletion; it is not an alternate database.
- Effects: source files are read and copied, never modified or renamed. Managed
  publication is immutable; repeated stable item receipts deduplicate, while an
  unknown commit is quarantined for status reconciliation.
- Cleanup: confirmed pre-commit cancellation removes owned unclaimed stages after
  child reaping; confirmed/unknown commit retains evidence for reconciliation.
- Distribution: fixed bundled decoder with digest/provenance manifest; no PATH lookup,
  shell, model-supplied flags, network protocol or renderer-selected output path.

E07 supplies foreground job/result ownership and readback. Its selected producer does not own an OS process. E08 retains actual owned-process cancellation/termination acceptance for the chosen media backend; do not infer it from E07 waiting cancellation or saved job state.

## Current investigation

[Native media boundary investigation](research/native-media-boundary.md) records actual path, managed-binary and product owners plus candidate executable distribution evidence. The platform/backend decisions are now recorded in the task design and research files, and implementation is enabled on the E08 branch. Research files continue to hold source-backed caveats rather than acceptance evidence.

## Source implementation checkpoint (2026-10-16)

Implementation is committed as `52e584c7`, `2b00d8e5` and `ca2da1a5`. The
authorized-directory workflow, fixed decoder resources, atomic original/thumbnail
publication, inline library surface and finite Agent group are implemented and
independently reviewed. [Actual source validation](research/implementation-validation.md)
records affected tests, strict types, lint, architecture and real macOS fixture
evidence separately.

The acceptance boxes above remain open because selected criteria include actual
Windows and installed-host behavior. Per the owner's testing cadence, those and
full regression/build/package/native integration run at the epic batch boundary.
This task remains active as source-complete, awaiting those gates; it is not
archived or represented as full platform acceptance.
