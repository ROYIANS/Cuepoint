# Interaction feedback and quiet success paths

## 1. Scope / Trigger

Read when adding loading labels, progress, success notices, message metadata, recovery controls or status transitions in any product feature. This records the owner's 2026-10-15 corrections: brief sending/saved/loading labels beside the submitted user bubble and the automatic `正在确认 APIMart 模型类型…` warning added visual noise and were explicitly rejected. Apply the lesson across the product, rather than treating it as one forbidden string.

## 2. Owners and concrete interfaces

Feature components own feedback for their actual user operation. Reuse the existing control, result surface and error presentation before adding another status area. Internal async/storage/runtime states may be necessary for correctness without needing a visible label for each state. This contract introduces no shared state machine, new component API or dependency.

Current Agent example: `features/agent/ui/SubmissionMessage.tsx` renders submitted content eagerly; `SubmissionStatus` returns `null` for `preparing` and ordinary `accepted`. `recoveryRequired` is an exceptional actionable condition, not a reason to label every successful message. See [Agent Send Recovery](./agent-send-recovery.md) for identity, draft and uncertainty behavior.

## 3. Interaction and copy contracts

- **Keep normal success paths quiet.** A visible result usually supplies its own confirmation: a sent message appears, a created item is in its collection, or a changed field shows its value. Do not add a transient caption or toast merely because a promise resolved.
- **Keep automatic model checks and request preparation quiet.** Model-capability probing and internal preparation do not need an unsolicited warning/status line. In the Agent composer, unresolved background probing produces no `modelWarning`; once checks resolve, preserve actual incompatible/invalid-model errors and their existing send guards. A capability panel opened by the user can still describe the requested capability result.
- **Acknowledge the user's action immediately through the relevant surface.** Show submitted content before preparation, or use the existing button's pending/disabled state to prevent duplicates. Do not make the user wait for a network/storage round trip to see that their gesture took effect.
- **Expose information that helps the user act or understand real waiting.** A long import may need completed/total and Stop; an unavailable result may need recovery. Each visible status needs a user purpose beyond naming the internal phase.
- **Use one relevant feedback location.** Preserve existing composer/action/job feedback where it is useful. Do not repeat it in a bubble caption, process header and toast, or add a new row for each internal transition.
- **Use product language.** Explain the saved result, what is unavailable and what the next action does. Storage commits, hydration, identity joining and execution-state reconciliation belong in implementation/diagnostics, not ordinary product copy. For the exceptional Agent case, use `消息已保存，可查看恢复选项` / `查看恢复选项` instead of asking users to `恢复执行状态`.
- **Show failures and necessary decisions clearly.** Keep drafts, meaningful errors and actual recovery actions available. Unknown outcomes must not be falsely described as failure or invite blind resend. Quiet normal behavior does not hide an unresolved problem.
- **Remove unnecessary feedback at its source.** Do not add arbitrary minimum display durations, delayed dismissal or debounce merely to make an unnecessary transient label less noticeable. Give a genuinely useful slow-operation indicator its own justified behavior.

## 4. Validation and error matrix

| Situation | Expected presentation |
| --- | --- |
| Send captured; preparation pending | Submitted bubble visible immediately; no transient sending caption beside it |
| Durable user message replaces local echo | One continuous bubble; no saved/loading caption flashes during the join |
| Ordinary create/edit succeeds and result is visible | Result confirms the action; no redundant success notice |
| Action is pending and duplicate submission matters | Existing control reflects pending state and excludes duplicate gestures |
| Long task has useful measurable progress | One owned progress surface describes actual completed/remaining work |
| Known failure needs user action | Relevant error/recovery remains available, preserving entered content |
| Outcome is uncertain | Plain explanation and a safe check/recovery action; no false success/failure or blind replay |
| Internal preparation/storage/loading transition | Internal state and diagnostics suffice unless the transition has a concrete user need |
| Background model-type/capability check pending | No automatic confirmation warning or preparation caption; actual validation and resolved errors remain |

## 5. Good / Base / Bad cases

Good: Send immediately displays the exact message and clears only the submitted draft. New text stays editable. The normal bubble stays quiet, and a genuine failed submission offers a useful recovery action.

Base: an existing import progress area reports actual completed/total without duplicating it in a toast for every file.

Bad: every message briefly gains `正在发送…` followed by `已发送，正在载入对话…`, or the composer flashes `正在确认 APIMart 模型类型…` while background probing runs. These labels expose implementation sequencing, cause visual flicker and do not help the user decide anything.

## 6. Necessary verification

For a changed interaction, check the actual affected pending, success and error paths. Assert immediate visible results, absence of redundant normal captions, one feedback location where needed and preservation of actionable recovery. Hold relevant async boundaries when required to make flicker/duplicate presentation reproducible; do not rely only on settled screenshots or source-string tests.

`tests/e02SubmissionPresentation.test.ts` checks real ReactDOM while the rich transcript is held and after acceptance: exact content remains visible, normal `.agent-submission-status` is absent, and exceptional recovery controls remain available. B07 callbacks protect the draft/ownership behavior beneath the presentation. These tests establish their specific DOM/callback assertions, not physical pixel paint or native packaging. Do not create tests for every trivial copy change; use the minimum meaningful verification for the affected behavior.

## 7. Wrong vs Correct

Wrong: map each internal async phase to a visible caption because the phase exists; then add timers to conceal the flicker.

Correct: first identify what the user needs to see or do, show the direct result promptly, reuse the relevant operation's existing feedback and keep ordinary success quiet. Reserve additional copy for real waiting, failure or an actionable decision.
