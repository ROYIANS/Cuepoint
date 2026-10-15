# Agent experience and desktop capability evolution

## Goal

Turn the 2026-10-15 source investigation into one parent task and independently verifiable deliveries. Improve immediate feedback and creative continuity first, then expand native tools, external capabilities and background execution while retaining the reusable Agent libraries and current product guarantees.

## Owner-confirmed decisions

- The owner requested one large task covering the discovered improvements and sequential delivery: “把此次发现的可以优化的点，做一个大任务，然后逐个攻破”. This authorizes parent/child task organization without another task-creation question.
- A valid Send must immediately change the visible conversation before waiting for network or durable storage admission.
- Business details should use the existing right-side parallel working area. Opening a shot from an Agent link must preserve the conversation in place, continue execution and avoid the stop-conversation prompt/main shot-page navigation.
- Detail surfaces should stop using drawers. On 2026-10-15 the owner selected full-width detail inside the same working surface when two columns do not fit, with the conversation retained/running and an explicit Return to conversation action.
- The first single-shot detail supports both viewing and editing, reusing existing saving, version-conflict and unsaved-edit protection. The owner confirmed this on 2026-10-15.
- This turn organizes tasks and converges the first design. Future capability defaults, runtime/host language and platforms remain child-owned choices; the task tree itself does not enable experimental tools.

## Evidence

- Cuepoint source baseline: `9d1a41739b17be27cf832326de15a9489017825a`.
- Local DeepSeek Harness source baseline: `571902028a75c64c1d767f4ae5fd099485f0ddf0`, version `0.2.1-alpha.3`.
- [Original investigation](../10-15-desktop-agent-capability-research/prd.md) contains the capability matrix, Agent interaction audit, adjacent-screen spot-check and host integration review. It is linked as an evidence child.
- Findings establish source behavior and documented limits, not measured user-visible latency or tested cross-platform confinement/background behavior.
- [Delivery roadmap](roadmap.md) is the authoritative finding-to-child map and proposed order. Each child repeats its actual prerequisites rather than relying on tree position.

## Requirements

- EP1: Preserve every investigated improvement as a traceable requirement, independently verifiable delivery or explicitly optional evaluation; distinguish confirmed defects from capability proposals and unmeasured hypotheses.
- EP2: Each child owns a bounded user outcome, acceptance, dependencies and scope. Child-specific technical/validation plans and final review precede its implementation.
- EP3: Prioritize conversation continuity: parallel details, immediate Send/recovery, real waiting/stopping feedback, scoped thread loading and user-controlled reading.
- EP4: Address the sampled create/delete/import/filter inconsistencies, then deliver native capability through a complete useful creative workflow.
- EP5: Converge resource grants, result/job handling, Skills, MCP, background ownership, delegation and advanced automation in their own deliveries; an unselected runtime/profile/platform must not be presented as approved.
- EP6: Keep one real reusable loop/providers, one product transaction owner, exact generation approval, unknown-effect handling, reviewed memory/current credentials and shared browser/desktop business code.
- EP7: Separate opening details from genuine route departure. No-drawer detail presentation does not remove legitimate confirmation dialogs, media-operation dialogs, file pickers or left navigation.

## Parent acceptance

- EAC1: Every original finding and the new detail-navigation request has an owning child, explicit prerequisites and an observable acceptance method in the roadmap.
- EAC2: During active execution, a supported shot-detail link opens the clicked owned record in the detail surface without unmounting chat/draft/run ownership or asking to stop. Narrow full-width detail retains the same runtime and returns to the same conversation state.
- EAC3: Shot edits retain current saving, failure and revision protections. Replacing, closing or resizing details never silently loses outgoing edits; Agent/manual concurrency cannot overwrite newer values without the existing conflict behavior.
- EAC4: Immediate feedback, recovery and query identity are verified with slow/failing storage, offline requests, late observations and repeated gestures; animation or a screenshot alone is insufficient.
- EAC5: Future native/external capabilities share policy, cancellation, ledger and real product commit semantics. Unknown external effects are not automatically replayed.
- EAC6: The parent owns source requirements and integration acceptance; only the selected delivery child starts implementation. Optional/deferred scope receives an explicit disposition before parent completion.

## Scope boundaries

The first detail delivery starts from single-shot viewing/editing and the shared presentation behavior; other entity editors are inventoried and assigned without promising all editors in the first slice. Do not replace the Agent core, adopt all Harness packages, choose Node by assumption, add a second store, disable real departure protection or remove unrelated dialogs.

The parent is ready to organize sequential work. Later children retain local decision inventories for their own review; they do not block the already explicit early UX outcomes. No product source, branch, commit, remote or release is changed by task organization.
