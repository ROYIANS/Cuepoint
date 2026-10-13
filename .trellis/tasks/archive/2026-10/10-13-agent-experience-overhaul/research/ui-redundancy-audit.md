# Research: Agent UI status/notice/review redundancy audit

- **Query**: Read-only audit of every status/notice/badge/review/summary element in the Agent chat UI (src/components/agent/*, src/lib/agent/*).
- **Scope**: internal (+ inferred external comparison)
- **Date**: 2026-10-13

All line numbers are from the current tree. "可行动" = user can do something because of the text.

## 1. Inventory table

Where it renders: each assistant message with a run -> `AgentRunDetails` (AgentRunDetails.tsx:252-328), mounted from MessageList.tsx:170. Collapsed-header row = summary button (:254-259), then WriteOutcomes (:260), FinalReview (:261), then collapsed timeline (:262+).

| # | Text | file:line | Trigger | Actionable? | Suggestion |
|---|---|---|---|---|---|
| 1 | "成果声明未检查" | AgentFinalReviewStatus.tsx:23 | run.status==="completed" and run.finalReview undefined (conversation-mode runs? no: those get finalReview with reason "ineligible"; this is legacy runs, or runs where beginAgentFinalReview returned early) | No | Delete |
| 2 | "正在只读检查成果声明" | AgentFinalReviewStatus.tsx:25 (aria-live) | finalReview.status==="pending" && run running | No | Delete |
| 3 | "已检查成果声明 · 有界观察" | :25 | finalReview.status==="checked" | No | Delete (or hover-only) |
| 4 | "成果声明未核实" | :25 | finalReview unverified (any reason, incl. "ineligible" for every conversation-mode / no-tool run, :8-10 REASONS) | No | Delete |
| 5 | Review `<details>` body: "保留原文。模型判断只比较列出的观察…" / "观察是检查时的快照…" / reason line / "观察 N 项；省略 N 项；未覆盖的写入调用 N 项…" / "模型未提取完成声明，不能据此证明回复没有遗漏或错误" | :29-34 | opening the details | No | Delete |
| 6 | Per-claim blockquote + "模型判断与所引观察一致 / 矛盾 / 依据不足" + "结构条件已核对…（仅下列条件）" + "核对条件：…" + "查看来源 w0" + "历史直接修改：新增镜头 id；当时版本 n" / "…未试听" | :35-49, labels :12-13 | review checked with claims | Marginal: "查看来源" jumps to tool call (reveal) but rest is jargon (ref ids w0/o1, "predicate", "revision") | Delete |
| 7 | Reason strings (budget/ineligible/content_limit/context_limit/invalid/timeout/stopped/interrupted/stale/transport) | :7-11 | finalReview.reason | No (internal causes) | Delete |
| 8 | Header label `execution.label` e.g. "工具调用已结束", "仅回复，未调用工具", "回复已结束", "已读取，未执行修改", "仅准备，未执行业务", "工具调用存在失败或拒绝", "执行失败", "执行已中断", "执行已取消", "已暂停，等待继续", "等待确认", "正在执行/正在调用工具", "工具结果待核实", "仍有未结束的工具调用", "执行记录不完整" | executionSummary.ts:46-69, rendered AgentRunDetails.tsx:257 | every run with a details section | Only the exception states are actionable (等待确认, 已暂停, 工具结果待核实, 执行已中断). Success-ish labels (:64-69) are not. | Keep only exception states; delete the 5 "success/neutral" labels (:64,66,67,68,69) |
| 9 | Header `detail` paragraph: e.g. "回复已结束；成功调用的记录仍保留，未完成的调用不能计为已完成工作。" / "调用完成不代表整个目标完成，也不代表生成结果已保存…" / "本轮没有工具调用记录；文字回复本身不代表已读取或修改项目。" + appended "N 项调用失败。" + planNote "计划仍有 N 项未标记完成；计划状态不代表实际执行结果。" | executionSummary.ts:41,46-69; rendered AgentRunDetails.tsx:265 (inside collapsed timeline) | expanded timeline | No; almost all are disclaimers. Exceptions with real instruction: :46 (unknown result, don't retry), :50 (waiting approval), :56 (budget pause) | Delete disclaimers (:57,58,59,61,62,63,65,66,67,68,69, planNote :34, failures :35); keep :46/:50/:56 text only where a button sits next to it |
| 10 | Duplicate failure count: "含 N 项失败" in header | AgentRunDetails.tsx:258 (failedCount :216) | any failed call | Weak (already shown by row #8 "工具调用存在失败或拒绝", by #9 "N 项调用失败", by group badge #12, and per-call "失败") | Merge/delete: same fact appears 5 times |
| 11 | "用时 X 秒" | AgentRunDetails.tsx:54 (RunElapsed) | always, ticks each second while running | No | Downgrade (show only while running, or hover) |
| 12 | Group badge "N 项 · 待处理 / 含 N 项失败 / 执行中" | AgentRunDetails.tsx:184 | every ToolGroup | "待处理" yes, rest no | Keep 待处理 only |
| 13 | Per-call: title + status chip ("已完成/失败/已拒绝/执行中…") + icon | :115, STATUS :29-32 | each ToolCallRow | Partially (icon enough) | Drop "已完成" text; keep icon |
| 14 | Per-call panel line "读取本地数据 / 编辑数据 / 使用互联网 / 维护任务与计划" + " · 已回滚/未执行/高风险操作" | :120, EFFECT :33-35 | open row | No (except 高风险 + approval) | Downgrade |
| 15 | ValidationFailureNotice: "参数校验失败，操作未执行" + issue list + "此次操作未执行，也未产生结果。助手应修正上述参数后重新调用；若依据其他资料回答…" + limit/offset paging tip + legacy note | :57-70 | failed call w/ validation result | No (addressed to the model, not user) | Delete; model self-corrects. Keep in "参数与返回结果" |
| 16 | RecoveryFailureNotice: "操作已回滚 / 操作未开始 / 操作结果待核实" + error + recovery | :72-78 | failed call w/ recovery info | Only 待核实 | Keep 待核实; others fold into one-line error |
| 17 | Collapsible "参数与返回结果" with AI raw args / user-confirmed args / result | :135-147 | every call | Debug only | Downgrade (dev/advanced) |
| 18 | "执行记录" popover: 模型请求/工具调用/调用已返回/失败·拒绝/等待批准·待核实/最后请求提供的工具/请求协议 + "以下为本次执行记录，不代表作品已制作完成。" | :266-287; data executionSummary.ts:26-32 | click | No | Delete (diagnostic) |
| 19 | "本次已保存：新增镜头 3 项、更新角色 1 项等" collapsible button | AgentWriteOutcomes.tsx:18-20 | completed write calls with valid receipts | Useful (results + links), the best of the set | Keep, shorten |
| 20 | "本次写入缺少可核验记录" | AgentWriteOutcomes.tsx:20 | write calls without valid receipt, total==0 | No | Delete |
| 21 | WriteOutcomes expanded: "以下是执行当时保存的直接修改，按操作计数；后续编辑可能改变内容。生成、试听和整体完成情况需分别确认。" / per-entry "查看记录" / "还有 N 项修改，请展开执行过程查看。" / "N 次写入调用没有可核验的直接修改记录，未计入上述结果；不代表没有产生修改。" | :24-38 | open | Entry links yes; disclaimers no | Keep entry list; delete 3 disclaimer paragraphs |
| 22 | Reasoning panel title (formatThinkingTitle: active / "已思考 N 秒") | ThinkingPanel.tsx:34,45; used MessageList.tsx:172 and AgentRunDetails.tsx:293,297 | reasoning text present | Optional | Keep (collapsed, small); same pattern as ChatGPT/Claude |
| 23 | Plan "执行计划 · 2/5" details + per-step "已完成/进行中/待办" | AgentRunDetails.tsx:306-315 | run.plan present | Low; the same plan also shows in composer task summary (AgentChatPage.tsx:534 "n/m") and TaskBoard | Merge: one location |
| 24 | "正在执行工具 / 正在撰写 / 正在思考" spinner | AgentRunDetails.tsx:301-305 | running | Fine (live), but duplicates composer "正在执行" (#27) and ThinkingMatrix | Keep one |
| 25 | Unknown-result banner: "上次操作的结果尚未确认，为避免重复执行，已暂停自动接续。请先核实已有结果，再结束本次执行。" | AgentRunDetails.tsx:319-320 | any call unknown | Yes, but duplicates #8 "工具结果待核实", #9 detail :46, #12 "待处理", per-call "结果待核实" (#13), RecoveryFailureNotice (#16), AND composer attention "操作结果待核实" (#28) = 6 places | Keep one (composer attention) |
| 26 | Resume/cancel buttons "继续执行 · 最多 N 轮" / "从已保存的步骤继续" / "结束本次执行" | AgentRunDetails.tsx:321-326 | recoverable run | Yes | Keep |
| 27 | Composer run-status strip: "正在整理较早的对话…/正在执行/等待你批准操作/执行已暂停，可继续下一段/执行已中断，进度已保存/执行未完成" + 停止 | AgentChatPage.tsx:541-543 (showRunStatus) | run running/waiting/interrupted/failed | 停止 yes; the text duplicates #8/#24/#29 | Keep 停止, trim text |
| 28 | Composer attention card "需要你处理 (N 项)": 生成结果待核实 / 待你确认生成 / 批次等待开始 / 批次已暂停 / 操作结果待核实 / 待你批准操作 / 阶段已暂停 / 执行已中断 ("进度已保存，可检查后继续") / 任务待你验收 + action buttons; read error "待办读取失败，请刷新后检查执行记录。" | activityAttention.ts:42-106; AgentComposerAttention.tsx:34-58 | pending approval/unknown/draft batch/interrupted | Yes (has jump buttons) | Keep (core). Overlaps #25,#27,#29 for the same event |
| 29 | Message footer status: "生成失败 / 执行已暂停 / 生成中断 / 已停止 · {error \|\| 已保留收到的内容}" | MessageList.tsx:154,190 | message.status error/interrupted/aborted | Error text yes; "已保留收到的内容" no | Keep error text; delete filler. Also body placeholder "（已停止）" at :152 duplicates "已停止" at :190 |
| 30 | "重新生成" button | MessageList.tsx:191-192 | retryable | Yes | Keep |
| 31 | Meta row: model name + icon, "xx.x tok/s", total tokens (Coins) with tooltip, MemoryRunHistory, Copy | MessageList.tsx:177-189 | every finished assistant message | Model name low; tok/s and tokens no | tok/s, tokens: hover only or settings; Copy keep |
| 32 | MemoryRunHistory (memory chips) | MemoryContextDetails.tsx (rendered MessageList.tsx:187) | run has memory audit | Not audited line by line (outside focus) | Flag for follow-up |
| 33 | ReferenceMessageSources (user and assistant) | MessageList.tsx:174,176 | references used | Not audited in depth | Follow-up |
| 34 | AgentGenerationResults always mounted in details | AgentRunDetails.tsx:318 | any run | Content-dependent | Keep |
| 35 | Header "加载中…" / "正在加载对话…" / empty-state "准备开始 … 也可以独立完成清单，随时回来确认成果。" | MessageList.tsx:93; ChatWorkspace.tsx:110-125 | loading/empty | Neutral | Keep (empty-state hint optional) |
| 36 | Project/mode strips: "项目不可用 · 对话与记录仍保留", "需求沟通中 · 明确目标后，助手会建立任务", blockedReason "项目不可用 · 历史仍可查看，请新开项目对话" | AgentChatPage.tsx:516,522,530 | project missing / requirements mode | Mixed; 项目不可用 appears twice (:516 and :522) | Merge duplicates |

Toasts at AgentChatPage.tsx:181-413 are error toasts only (not redundant by themselves).

### Key duplication clusters
- "Tool failed": #8, #9 (+failures string), #10, #12, #13 = 5 renderings of one fact.
- "Result unknown": #8, #9, #12, #13, #16, #25, #28 = 7 renderings.
- "Interrupted/paused": #8, #9, #27, #28, #29 (message footer) = 5.
- "Not complete / not a guarantee" disclaimers: #5, #9 (11 variants), #18, #21 (3), #6 "未试听" — a single repeated message "this doesn't prove completion" in about 20 strings.

## 2. What the user sees after one turn (enumerated; collapsed default)

Common to all: assistant ChatItem (avatar, title, time) -> [aboveMessage] AgentRunDetails summary row: `用时 X 秒 ▾ <label> [含 N 项失败]` -> WriteOutcomes row (if any) -> FinalReview row (if applicable) -> body markdown -> footer: model name, tok/s, tokens, memory, copy -> optional status line / 重新生成. Timeline auto-collapses on terminal status (AgentRunDetails.tsx:228). Composer area: attention card and/or run-status strip and/or task summary.

Note: runs without tools in `conversation` mode: beginAgentFinalReview marks ineligible (agentFinalReview.ts:53) -> row "成果声明未核实" still appears (AgentFinalReviewStatus.tsx:25-26). A pure `run` exists for every message (MessageList.tsx:99) so even a plain chat answer gets the details section.

A. Success (tools incl. a write, final reply ok): 
 - `用时 42 秒 ▾ 工具调用已结束`
 - `本次已保存：新增镜头 3 项 ▾`
 - `已检查成果声明 · 有界观察 ▾` (or `成果声明未核实`)
 - answer body
 - footer: `model-name · 38.2 tok/s · 12.3k · [memory] · copy`
 - Composer: possibly 任务待你验收 card; task summary strip.
 Expanded detail adds: detail paragraph ("调用完成不代表整个目标完成…"), 执行记录 button, narrative, tool group `title、title等  N 项 ▾`, plan, etc.

B. Partial failure (1 tool failed, run completed): 
 - `用时 .. ▾ 工具调用存在失败或拒绝  含 1 项失败`
 - WriteOutcomes (if other writes ok), FinalReview row
 - body; footer as above
 - Expanded: "回复已结束；成功调用的记录仍保留，未完成的调用不能计为已完成工作。1 项调用失败。" + group badge "含 1 项失败" + failed row "失败" + ValidationFailureNotice/RecoveryFailureNotice + red call.error.
 - Composer: nothing (completed run has no attention).

C. Rejected (user rejected approval; run status may end completed/cancelled):
 - header label `工具调用存在失败或拒绝` (executionSummary.ts:63) if run completed, or `执行已取消` (:59) if cancelled, with detail "…N 项调用被拒绝。"; no "含 N 项失败" (only counts failed, :216). Per-call "已拒绝". Before decision: composer card "待你批准操作" + strip "等待你批准操作" + header "等待确认" + "待处理" group badge + 批准/拒绝 buttons in row (4 places).

D. Cancelled (user pressed 停止): 
 - If no tools: run cancelled (runChat.ts:308) ; header "执行已取消" + detail "取消不会撤销此前已执行的操作，也不代表远端任务已取消。"; message footer "已停止 · 已保留收到的内容" (message status aborted) and body "（已停止）"; FinalReview row absent (run != completed -> null when no review, AgentFinalReviewStatus.tsx:23) or "成果声明未核实" with reason 用户已停止 if review was begun. If tools had run: status interrupted -> header "执行已中断", composer strip "执行已中断，进度已保存" + attention card "执行已中断 / 进度已保存，可检查后继续 / 查看执行" + 继续/结束 buttons: same event shown 4-5 times.

E. Error (model/transport failure): 
 - header `执行失败` (:57) + detail "本次执行未正常结束；已完成的调用仍保留，不能据此认定整个目标已完成。"; footer "生成失败 · {message.error}"; 重新生成 button if retryable; composer strip "执行未完成"; attention card "执行已中断" only if run.hasToolCalls (activityAttention.ts:85). Header and footer both say failed.

## 3. Comparison with Claude Code / ChatGPT (inferred from general product knowledge, not verified this session)

- Claude Code (CLI/desktop/web): tool calls rendered as compact one-line entries (verb + target), collapsed by default, result shown only when relevant; failures show the error line inline; permission prompts are blocking inline dialogs with Allow/Deny; end of turn has no verdict/summary badge, just the model's final text. Interruption shows one line ("Interrupted"). No self-review of claims, no counters. (inferred)
- ChatGPT: a "Thought for N seconds" collapsible; tool/search/code steps as collapsed chips; on error a single red "Something went wrong" + Regenerate; per-message actions (copy, regenerate, thumbs) on hover; token/speed/model details not shown inline (model shown in selector). No post-hoc "claim check" or disclaimers about whether work completed. (inferred)
- Common pattern: status only when it needs the user (approval, error with retry); success is silent; diagnostics (tokens, timing, raw args) hidden or hover; one place per event. (inferred)

## 4. Consumers of review/evidence logic (grep-verified, src/ non-test; tests in tests/agentFinalReview.test.ts etc.)

Final-review chain (extra LLM request per completed tool-run reply, 30 s timeout, up to 4096 tokens; runChat.ts:318):
- `reviewFinalReply` (lib/agent/runFinalReview.ts) <- only runChat.ts:6,318.
- `finalReviewMessages`, `parseFinalReview` (lib/agent/finalReview.ts) <- runFinalReview.ts and db/agentFinalReview.ts:7,56 only.
- `collectFinalReviewSnapshot`, `finalReviewTables` (lib/agent/finalReviewEvidence.ts) <- db/agentFinalReview.ts only.
- `beginAgentFinalReview`/`finishAgentFinalReview` (db/agentFinalReview.ts) <- runFinalReview.ts only; db/agentRuns.ts:236 only flips pending -> unverified.
- `run.finalReview` field (domain/agent.ts:187, domain/agentFinalReview.ts) read by: AgentFinalReviewStatus.tsx only (plus the writers above). No other UI/logic reads claims/predicates/snapshots; it is not fed back to the model ("Its answer never enters the public reply or business continuation", runFinalReview.ts:13).
=> The whole chain (finalReview.ts, finalReviewEvidence.ts, runFinalReview.ts, db/agentFinalReview.ts, AgentFinalReviewStatus.tsx, domain/agentFinalReview.ts, run.finalReview, the "final_review" metrics purpose) serves only that UI row.
- Shared helpers in finalReviewEvidence.ts that DO have other consumers (do not orphan): `inspectAudioGenerationOutputs` (audioGeneration/runtime.ts:385, db/taskAudioGenerationEvidence.ts, db/audioGenerationBatches.ts:61), `inspectTaskGenerationOutput` (lib/agent/wrapupEvidence.ts:176, db/agentTaskRecords.ts:146), `ownedAgentAudioBatchJob` (db/taskAudioGenerationEvidence.ts:7). `audioSubmissionOrigin`, `ownsApprovedSubmission`, `submittedToProject` are local to finalReviewEvidence.ts.
- `finalReviewMessages` also gates on token budget via `budgetContext` (agentFinalReview.ts:56) only for this feature.

Other items:
- `describeRunExecution` (executionSummary.ts) <- only AgentRunDetails.tsx:217. Fields consumed: label (:257), detail (:265), counts/modelSteps/offeredTools/protocol (popover :272-284). Sole consumer.
- `describeRunWrites` (runWriteOutcomes.ts) <- AgentWriteOutcomes.tsx (UI), finishingCheck.ts:10 (model prompt) and finalReviewEvidence.ts:61. So it has a non-UI consumer (finishing check prompt). `WRITE_KIND_LABELS/WRITE_OPERATION_LABELS` also used by AgentFinalReviewStatus.tsx.
- `buildFinishingCheckPrompt` (finishingCheck.ts) <- db/agentFinishingCheck.ts:87 only; it is a model-facing system message (extra model round "本轮结束前检查") whose output is stored in activitySteps, i.e. the model's first final text is moved into the timeline and a second reply is generated (runChat.ts:317 `continue`). Not UI text, but it shapes what the user sees (prior reply demoted to process log).
- `selectActivityAttention` (activityAttention.ts) <- only AgentComposerAttention.tsx:36 (mounted AgentChatPage.tsx:519). Only consumer, but it carries actionable items.
- `RunExecutionSummary.kind` field: set in every `result(...)` call but no UI branch reads it (grep: AgentRunDetails uses only label/detail/counts/diagnostics). Verified by reading AgentRunDetails.tsx:217-285.
- Unchecked: `buildRunActivity`/`isPersistedToolRound` (runPresentation.ts) are structural (timeline build), not copy.

## Caveats / Not Found
- Entry #1 trigger: run.finalReview undefined for completed runs happens for legacy runs or when `beginAgentFinalReview` returns without creating a review; conversation-mode runs normally get an "ineligible" review and so display "成果声明未核实", not "成果声明未检查". I did not run the app to confirm which scenario dominates.
- I did not audit MemoryContextDetails, ReferenceAttachments, ContextUsagePanel, TaskInspector/TaskWrapup/TaskBoard copy in depth.
- Section 3 is knowledge-based inference, no web search performed.
- Test files referencing these modules: tests/agentFinalReview.test.ts (and others touching describeRunWrites/selectActivityAttention) would need updates if modules are removed; not enumerated fully.
