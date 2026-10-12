# Research: final release planning review

- Query: Are the final PRD, design and implementation plan consistent and executable before activation?
- Scope: internal static review, with one official Actions prerequisite check; no implementation, builds, task activation or remote operations.
- Date: 2026-10-12

## Findings

Reviewed the current `prd.md`, `design.md`, `implement.md` and all five research memos. The implementation plan was updated during review; findings below apply to its **W1/W2 candidate source + H1a actual host + H1b tag/draft** sequence, not the earlier W1-before-host-success draft.

### HIGH — first hosted activation lacks a default-branch bootstrap

`design.md:93` permits manual dispatch on the reviewed development ref after owner push; `implement.md:18,98` depends on that for the first Windows feasibility check. A newly added workflow only on that branch cannot be manually dispatched: GitHub requires the workflow to exist on the default branch. The baseline has no desktop workflow.

Minimal fix: explicitly choose an owner-controlled bootstrap before H1a. Either review/commit the build-only workflow and arrange its default-branch availability before manual dispatch of the development ref, or use a reviewed PR/temporary build-only trigger for the initial corresponding-host spike. The bootstrap must preserve read-only/build-only behavior and cannot create a draft or substitute unverified Windows success. Record who performs the merge/push/activation; do not infer root remote authorization. [Official manual workflow prerequisite](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

### MEDIUM — source commit and final evidence commit ordering is implicit

`implement.md:98` mentions reviewable local changes/commit plan before owner push, while its only explicit commit step is F1 after hosted gates (`:20,101`). Hosted source must already exist in a concrete committed ref. PRD AC6 also puts actual outcome review before a concrete commit plan, which conflicts with the preliminary commit needed for H1a.

Minimal fix: name a preliminary, reviewed local source-commit/owner-activation gate after Q1 (or before an earlier bootstrap spike). These commits remain **candidate source** and do not close host acceptance or authorize archive. After H1a/H1b, F1 commits final evidence/spec/journal updates and archives only after required criteria pass. Preserve explicit local commit authorization and separate owner-controlled remote actions.

### MEDIUM — Linux format-specific runtime acceptance needs an explicit choice

`design.md:85` says Linux DEB/AppImage contents; `implement.md:53-54` refers to generated packages without explicitly requiring both Linux payloads. Both formats are required outputs, and their dependency/layout behavior differs.

Minimal fix: state that each Linux format receives its own install/extract + real-payload startup/import/reopen smoke (with isolated runner-created workspace between cases), or explicitly define the narrower acceptance and corresponding pending format claim. Both formats still require target/version/layout/hash verification. No need to turn TXT smoke into a universal codec/device claim.

### LOW — stale H1 references after the split

`implement.md:20,66,95` still says H1 rather than H1a/H1b. Replace F1 dependency with Q1 + H1a + H1b; identify real draft API evidence specifically as H1b. In PRD risk wording, distinguish candidate W1 source preparation from H1a's corresponding-host feasibility proof.

## Ready aspects and remaining limits

- Counts are consistent: four targets and five installers; `SHA256SUMS` and `release-manifest.json` are additional named metadata, not extra installer targets.
- Version/identity policy is consistent: numeric0.1.0 across root/desktop/Cargo/Tauri, existing internal identifier/executable retained, approved dark icons, visible Cuepoint naming, desktop-v namespace separate from GHCR v*.
- Source/run/attempt/payload retry rules are conservative and explicit. Manual runs cannot mutate Releases/tags; published/unowned/different payloads reject; incomplete draft uploads remain visible.
- Candidate W1/W2 followed by owner-activated H1a removes the earlier circular proof prerequisite. Windows publication guarantees remain unresolved technical work, correctly requiring review if certainty changes. Process restart does not prove power-loss durability.
- No unjustified separate product/UI/Agent/storage implementation, migration, paid-provider test or signing credential work is included. Mac Intel UI/hardware and broader media/system cases remain honestly pending.

**Static verdict: ready for final planning review after the above activation/commit sequencing and Linux-format clarification are incorporated.** This is not corresponding-host feasibility, installed-runtime, draft-upload or overall task acceptance; those require actual later execution.

Root's review response selects a narrowly scoped `push` bootstrap on exactly `codex/desktop-release-pipeline`, with read-only build permissions and publisher restricted to desktop version tags. Manual dispatch will explicitly retain the default-branch prerequisite. Root also selects a concrete preliminary source-commit review after Q1 and before owner bootstrap push, separate from final hosted evidence/archival. Those resolutions address the HIGH and first MEDIUM findings when incorporated in the artifacts; no new remote authorization is implied.

## Resolution audit by root

All four findings were incorporated before final planning presentation:

- HIGH: design Actions/activation and PRD delivery boundary now name the exact branch push bootstrap, tag-only publisher and default-branch manual prerequisite.
- MEDIUM commit ordering: implement C0 before H1a explicitly covers approved preliminary work commits; PRD AC6 distinguishes local review from hosted/final outcome review. Archive remains after H1a/H1b.
- MEDIUM Linux formats: PRD AC3, design runtime evidence and V1 require independent fresh-state complete smoke for both DEB and AppImage. Extracted AppImage evidence does not claim FUSE/desktop-launch success.
- LOW references: F1 requires Q1+H1a+H1b, real draft proof is H1b, and Windows W1/W2 preparation versus H1a host proof is explicit.

Root reread the converged three planning documents, validated both manifests and checked the task-only working scope. Static planning is ready for final user review. Actual code/host/draft acceptance remains future execution.

## Caveats / Not Found

Only the owned research file was written. No source/config/spec/task-state edit, git operation, build, secret access, hosted activation or Release API call occurred. Line references describe the reviewed snapshot and may move when root applies fixes.
