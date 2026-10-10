# Controlled real-model acceptance — 2026-10-10

Model: **AIHubMix gpt-6-luna**, selected in the native model dialog per the user's instruction. All chat samples used existing connector UI settings, smart mode and request-approval permissions. The user authorized the scoped API costs and about three seconds of local microphone capture. No key or private microphone recording entered the prompt, evidence file or a supplier request. Requests below are synthetic acceptance text in dedicated local test projects.

## Visible execution trace and actual state

| Sample | Actual visible tools/state | Result and stop boundary |
| --- | --- | --- |
| Bound edit, 15:09:35 | Overview and audio reads, then exact segment-note update approval | Second manuscript segment `order=2` saved notes `10-10 真实模型验收：已执行本地备注修改`. One correct write approval, no fresh user start and no speech submission. Three prior timeline clip objects and selection choices stay unchanged. One run ended in 1m24 including approval waits. |
| Prepare only, 15:12:29 | One failed audio read, corrected audio read, then successful `prepare_audio_generation_batch` | One draft for line 12 only. The UI retains the read failure, successful preparation, zero saved outputs and a real `核对并确认` control. The model correctly says no paid request has yet been sent. A draft is not counted as saved generated audio or a direct business write receipt. |
| Separate exact batch confirmation | Frozen one-item dialog shows real MiMo endpoint, model, preset and exact text; root invokes the authorized native confirmation | One real saved MiMo job/take, 1.92 seconds, unselected/unplaced. Original candidate draft prose remains historical; live progress updates separately to saved 1. [Native proof](../../09-22-audio-batch-experience/acceptance/2026-10-10-native-acceptance.md). |
| Read current generated facts, 15:16:31 | Read-only batch/project calls; no new generation or mutation | Reply separately states saved yes, selected false, placed false and three existing clips. `用时 41 秒 已读取，未执行修改`. It does not certify acoustic quality. A take-list call returned no list details; that limitation remains in the reply. |
| Projectless create-and-continue, 15:21:28 | Load tools, plan, approved `project_create`, automatic same-execution bind, reads, approved new segment, readback and plan update | New project `prj_f6005be3-74ee-40b3-ae60-5d7320572ffd`; one actual first-chapter segment `创建后继续写入成功。`, initialized chapter/voice track, zero takes/clips. No second user start message. Ten tool calls returned, zero failures/rejections, eleven model requests, last request offered zero tools, protocol chat-completions. Ended in 1m42 including human approval waiting. Plan4/4 is displayed separately from the four actual persisted receipt observations. |
| Advice only, 15:26:32 | Zero tool calls, no plan, no write, no paid speech | Two rhythm suggestions, `用时 7 秒 仅回复，未调用工具`. Bounded read-only review produced valid empty claims; this is not certification that all possible prose errors were detected. |
| Stop while awaiting new write, 15:26:58 | Two reads then segment-create proposal waits for approval; root invokes `结束本次执行` | `用时 34 秒 执行已取消`, pending unapproved write never commits. Reload retains cancelled state. Manual workspace still has exactly the one original segment, no `此段用于停止验收`, zero takes/clips. Prior completed creation stays intact. |

Original conversation IDs: bound edits/batch `cth_893162dc-39b9-467b-9b00-b416d69267c7`; projectless create/advice/Stop `cth_2cd95cf6-99aa-4576-a645-f7a5396ca28b`. These identify local visible histories, not fabricated run/call IDs. Portable ZIPs deliberately omit execution identity and scrub batch confirmation, so they cannot alone establish original Agent origin or request counts.

## Finishing and final-review observations

The create execution visibly retained its earlier candidate response in expanded process history, followed by the bounded final response. The terminal review request offered zero tools. The implementation guards one finishing check plus one read-only final review, preserving approval/Stop/budget and original protocol messages; meaningful Chat/Responses fixtures prove the durable once-only mechanics. Live observations record actual outcomes, not a claim that every model obeys perfectly.

The nonempty notes and create replies returned invalid exact text spans or source references from the read-only checker. UI explicitly says `检查返回的文字范围或来源无效` and `成果声明未核实`, preserving original prose and committed receipt observations. The create review lists four observations, zero omissions and zero uncovered writes. We did not loosen the parser, repeat the review request, silently rewrite the answer or promote an invalid review into verification. This is an observed model-format limitation of the approved bounded design. Advice-only review returned a valid empty-claim check, whose UI correctly states that empty extraction does not prove the reply is flawless.

## Native layout / evidence

The actual completed Agent result was loaded into the tab with a confirmed 390×844 override: document clientWidth = scrollWidth = 390, including expanded unverified-review details. Other existing tabs did not all inherit this viewport; screenshots and measurements refer to the tab actually measured. The override was restored afterwards.

- [Create/continue final](2026-10-10-live-create-continue.jpg), [actual project text](2026-10-10-live-create-project.jpg), [execution summary DOM](2026-10-10-live-create-execution-ui.txt).
- [Advice-only DOM](2026-10-10-live-advice-ui.txt), [Stop DOM](2026-10-10-live-stop-ui.txt), [cancelled result](2026-10-10-live-stop.jpg), [390px result](2026-10-10-live-agent-narrow.jpg).
- [Bound write screenshot](../../09-22-agent-result-evidence/validation/2026-10-10-live-model-write.jpg), [read-only output report](../../09-22-agent-result-evidence/validation/2026-10-10-live-model-output-read.jpg).
- [Current exported metadata](../../09-22-apimart-audio-music/validation/2026-10-10-live-metadata.json) verifies actual note target, retained clips, real take and new project's actual segment. Recording-containing raw backups remain local-only outside Git.

Scope/foreign ownership, stale revisions, unavailable connections, disabled skills, full permission paid-review, unknown effects, budgets, both protocols and rollback/replay have deterministic repository/runtime coverage in the full suite. This small live sample does not replace those negatives or promise universal semantic detection, all codecs/devices or subjective acoustic acceptance.
