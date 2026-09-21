# Agent execution transcript and conversation navigation

## 1. Scope / Trigger
Read before editing execution chronology, thinking/tool disclosure, composer action reminders or the turn navigation rail. These are presentation contracts; repository permissions, explicit paid confirmation and ambiguous-result recovery remain governed by agent-execution and agent-batch-generation.

## 2. Signatures
- `AgentRun.activitySteps?: AgentActivityStep[]`, where a step contains `step`, `content`, optional public `reasoning` and `reasoningDurationMs`.
- `saveToolRound(..., responseOutput?, publicOutput?)` stores the public snapshot in the same transaction as the tool ledger and continuation envelope.
- `buildRunActivity(run, calls)` returns chronological text/reasoning/tool groups; `isPersistedToolRound` distinguishes a retained tool-round message from a new model answer.
- `getRunElapsedMs(run, now?)` and `formatRunElapsed(ms)` implement natural elapsed time, including waits.
- `useAgentActivityNavigation()` exposes `request` and `reveal({runId, callId?, batchId?})`. The provider scopes requests to the current thread without remounting the execution owner.
- `selectActivityAttention(input)` derives owned required actions from current-thread runs, calls, batches, items, jobs, tasks and messages.
- `buildChatTurns(messages)`, `turnExcerpt(text, limit?)`, `getActiveTurnIndex(offsets, readingPosition)` are pure helpers for the conversation rail.

## 3. Contracts
Only public text belongs in the transcript. Never render encrypted Responses reasoning, raw request history or private provider envelopes as model thinking. Legacy rounds are recovered from the current continuation suffix and matched to the current run's tool identities. Missing historical reasoning cannot be reconstructed. A successful final answer stays visible even if it repeats a previous round's wording.

During execution, narrative and subdued collapsible tool groups are chronological. Adjacent calls without intervening narrative/reasoning form one group. Only the small elapsed label ticks each second. Completion/stop/failure transitions close the outer process once; subsequent manual toggles survive live-query updates. Failure and pending approval must never disable folding. The original permission and recovery controls remain inside the process.

Historical rich process content can defer mounting until first expansion. Batch results remain mounted under the hidden process so local edits and navigation blockers survive folding. A reveal opens the matching process/group/call or existing batch dialog; it never approves or sends a request. Expanded composer mode retains the status strip and exits when a process reveal arrives.

Reminders query the current thread independently of the latest model status. Draft generation batches remain visible after the model completes. Unknown results remain inspectable even when execution cannot resume. Approval/resume targets must be the latest eligible run, with no later user message and an open task/project. Task review opens the existing inspector. Multiple required actions remain individually accessible in a bounded list.

A user message anchors each navigation turn; later assistant attempts update that turn's preview. Previews are short plain text, not another Markdown renderer. Show the rail from five turns onward. Its internal viewport exposes at most ten ticks, with remaining turns reachable by rail scrolling. Resting lines are short; mouse-hovered neighbors grow in a distance-based wave; active state changes color only, all resting lines share the same short length and left edge and honor reduced-motion preferences. The rail owns its active/hover state so scrolling does not repaint all chat bodies. Hover and keyboard focus reveal previews; click/Enter changes only the transcript scroll position and pauses automatic following. Current turn comes from real message positions, including expanded-process height changes. Preserve the lazy MessageList import boundary.

## 4. Validation & Error Matrix
| Situation | Required behavior |
| --- | --- |
| Failed/awaiting tool | Outer process, group and tool row remain manually collapsible |
| Model completes with unconfirmed batch | Final answer visible, process collapsed, composer reminder persists |
| New DB tick after manual expansion | Do not force open/closed again |
| Running / terminal timer | Increment only while running; freeze at endedAt or updatedAt otherwise |
| Legacy continuation contains previous turns | Exclude the base envelope and validate owned tool identity |
| Batch has unsaved draft during fold | Keep component/state and leave protection mounted |
| Composer expanded then reminder clicked | Retain reminder; expose target without hidden/inert focus |
| Read failure | Show an explicit reminder-read error; do not silently imply no action |
| User jumps to an old round | Pause automatic following; never scroll the page or sidebar |
| Narrow viewport / long history | Bounded rail and preview; no page overflow; keyboard/touch targets remain usable |

## 5. Good / Base / Bad Cases
Good: a completed assistant answer has a compact elapsed disclosure and a visible batch-confirmation reminder; the user can open the batch directly, close it, and freely inspect the earlier process.

Base: a text-only run still shows its elapsed time and keeps final text readable. Old sessions without step snapshots recover available tool-round prose.

Bad: `expanded || needsAttention`, disabling the disclosure button, using every assistant request message as history, or hiding the reminder once `run.status === 'completed'`.

## 6. Tests Required
- `runPresentation.test.ts`: chronological merging, legacy ownership/history exclusion, final/tool round distinction and invalid timestamps.
- `agentActivityPersistence.test.ts`: Chat and Responses runtime snapshots and transaction safety, with opaque reasoning kept out of the public snapshot.
- `agentActivityAttention.test.ts`: completed-run batch draft, unknown/paused work, multiple priorities, stale/foreign/closed ownership.
- `toolValidationDiagnostics.test.ts` and `toolValidationSafety.test.ts`: screenshot limit/path errors, safe bounded diagnostics, both protocols receiving correction advice and invoking a new valid read, valid high-risk calls still requiring approval.
- `chatTurns.test.ts`: per-user grouping, retries, missing text, bounded Unicode excerpts and active reading offsets.
- Isolated browser evidence: repeated nested collapse, live/frozen timing, completion auto-close, batch shortcut + unsaved draft protection, expanded-editor reveal, multi-turn hover/focus/jump, preserved reading position and 390px layout.

## 7. Wrong vs Correct
Wrong: `const open = expanded || needsAttention`, or unmounting `AgentGenerationResults` with `{open && ...}`.

Correct: change disclosure state on an execution transition or explicit reveal/user action; keep batch review state mounted and surface required work in the composer independently.

## Tool validation diagnostics

Schema rejection is a pre-execution failure, not a successful read and not ambiguous paid submission. Preserve structured bounded field errors in the tool result sent to the model. For `business_read_text`, one request reads at most 12000 characters and episode scripts use `story.script`; pagination follows `nextOffset`. Never silently clamp requested input or rewrite the immutable call. Explain whether correction/new invocation is needed and that a final answer must disclose relevant missing evidence. The UI must not infer semantic recovery merely because another call succeeded later; the completed process header retains a failure count.

A failed parse must not label a local read as high-risk solely because argument parsing failed. Existing generic argument failures may display explicitly labelled diagnostics recomputed with current local schemas; do not rewrite historical records or fabricate what the old model received.

`CreatedEntityLinks` is a standalone lightweight component shared with TaskRecords. Do not import it from AgentRunDetails: that would eagerly pull process Markdown into the Agent route and bypass the MessageList lazy boundary.

## Composer footer occlusion

The bottom composer dock owns both the input card and its control footer. Its background-only `::before` mask reaches above the dock farther than the header mask and applies backdrop blur, so scrolled transcript text cannot remain legible behind the footer. Dock content stays in a higher stacking layer and remains interactive. Full-screen composer mode disables this pseudo-element so editing is not blurred.
