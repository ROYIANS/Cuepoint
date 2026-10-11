# Research: Packaged synthetic audio, music and task flows

- Query: Exact minimal provider UI configuration and registered task payloads for the actual packaged native SQLite product.
- Scope: internal
- Date: 2026-10-12

## Findings

The root-supplied running fixture origin is **`http://127.0.0.1:58470`**. Its public synthetic key is **`synthetic-local-only`**. All connection Base URLs below are exactly **`http://127.0.0.1:58470/v1`**, without query, fragment, credentials or repeated `/v1`. This investigation does not probe the endpoint, inspect profiles/keys or operate the application.

### Files found and source contracts

| File | Owner and anchor |
| --- | --- |
| `scripts/native-product-fixture.mjs:13` | Closed explicit-tool allowlist; current task tools are absent. |
| `scripts/native-product-fixture.mjs:160` | Synthetic models directory supports connection/model probes. |
| `scripts/native-product-fixture.mjs:171` | APIMart speech binary route. |
| `scripts/native-product-fixture.mjs:172` | Synthetic music submission and172–186 task polling/result URL. |
| `scripts/native-product-fixture.mjs:192` | MiMo TTS models return WAV base64 envelope. |
| `src/db/connectors.ts:28` | One saved config per provider definition; trim key and normalize trailing slash; no provider alias inference from URL. |
| `src/lib/ai/baseUrl.ts:2` | Base normalization only trims text/trailing slashes. |
| `src/components/audio/MimoConnection.tsx:10` | Existing inline MiMo first-use UI with exact accessible field labels. |
| `src/components/audio/SpeechControls.tsx:21` | Default segment speaker picks MiMo; APIMart voices remain a distinct existing profile. |
| `src/lib/audioGeneration/defaults.ts:15` | No selected speaker means MiMo preset/default voice/speed1/empty instruction. |
| `src/components/music/MusicCreation.tsx:75` | Existing Suno/simple/custom/Flow controls and connection selector. |
| `src/components/audioMusic/shared.tsx:77` | Music connection selector permits APIMart only; a generic OpenAI connector cannot substitute. |
| `src/components/music/switchMusicVariant.ts:13` | Variant switching flushes drafts and atomically stores separate retained drafts plus `project.musicVariantLinks`; no network request. |
| `src/lib/agent/taskTools.ts:105` | Exact current task tool schemas, scope and source validation. |
| `src/lib/agent/taskContext.ts:22` | Task tools and update_run_plan are core definitions for smart task mode/current task, not a loadable `task` group. |
| `src/components/agent/TaskWrapup.tsx:399` | Actual manual/AI summary controls; no registered wrapup tool. |
| `src/lib/agent/taskWrapup.ts:36` | AI summary request uses explicit read-only JSON snapshot, no tools. |
| `src/lib/agent/wrapupSchema.ts:21` | Strict source/criteria validation; model cannot independently certify acceptance. |

### Generated audio take: minimum UI path

1. Save the **MiMo** provider connection with the Base URL/key above. Existing inline alternative: select a nonempty audio segment, open **自定义地址**, fill **MiMo Base URL** and **MiMo API Key**, click **保存连接** (`MimoConnection.tsx:17–38`). The inline validator accepts HTTP/HTTPS with `/v1` and rejects embedded auth/query/fragment. A generic OpenAI connection is not selected as MiMo.
2. Audio project: select an actual segment with nonempty saved text, for example `这是本地 SQLite 配音验收。`. Leave **这段使用的音色** at **MiMo 默认音色**; no additional speaker, design instruction, clone reference or optimization setting is necessary.
3. Click **生成这段配音** (`SpeechControls.tsx:82`). The existing owners flush the draft, recheck segment/speaker revisions, prepare one generation job and submit once. The wire model is `mimo-v2.5-tts`, `stream:false`, audio WAV/default preset voice (`mimoSpeech.ts:161–164`). No chat model picker is involved.
4. Fixture `/v1/chat/completions` returns the real synthetic `tone.wav` base64 (`native-product-fixture.mjs:192–194`). The product decodes/owns the actual bytes and saves the completed job/take/media; inspect **配音已保存到下方版本，试听后即可采用。** and the newly appeared **配音版本**.
5. Select the take to use the existing AudioPlayer. **采用此版本** changes selectedTakeId; **放入音轨** is a separate action and preserves existing clips (`AudioInspector.tsx:83–118`). Check take/media/segment association and actual duration; fixture audio is a deterministic tone, not synthesized speech quality.
6. Quit/reopen and verify the same take ID, managed bytes, original text snapshot and adoption/clip association without another TTS POST. Compare byte hash against the known repository fixture if exported. Refresh alone cannot regenerate.

An existing APIMart speaker voice such as `alloy` without a MiMo profile selects the APIMart connector instead. The fixture has `/v1/audio/speech` returning WAV and supports that actual adapter, but creating such a legacy-shaped speaker solely for convenience is unnecessary; the current default MiMo path is the smallest genuine UI path.

### Music variants and one actual generated work

1. Save the **APIMart** provider with the same Base URL/key. Testing reads `/v1/models`. Choose that connection under **生成连接 → 选择 APIMart 连接** at the bottom of the music composer. MiMo/generic OpenAI connections do not appear in this selector (`audioMusic/shared.tsx:84`).
2. Minimum Suno path: keep initial **Suno v6**, **简单**, fill **音乐描述** with `本地验收：轻快钢琴旋律。`; click **生成音乐**. Simple mode requires a nonempty prompt; no style/title/duration is needed. A historical simple-mode duration must be cleared rather than silently sent (`MusicCreation.tsx:163`).
3. Equivalent minimum Flow path: choose **Flow Music** in **音乐引擎与模型**, fill **音乐描述**; optional **更多设置 → 期望时长**1 is valid. Lyrics/BPM/seed/title can remain empty. Flow allows1–240 integer seconds; Suno custom allows10–360, and Suno simple forbids duration (`apimartAudio.ts:18–50`).
4. Actual owners submit `/v1/music/generations`, get a unique synthetic task ID, poll `/v1/music/tasks/<id>?language=zh`, then GET `/media/audio` with no authorization/cookie. Fixture replies completed with one known WAV-backed music result (`native-product-fixture.mjs:172–186`; `apimartAudio.ts:200–244`). It returns one work per submission, not multiple alternate songs automatically.
5. Verify work appears, plays, preserves settings/provenance/draft relation, and survives reopen without resubmission. A fixture duration metadata value1 must not be used as proof of the decoded file's true duration.
6. Separately verify three retained editing variants without extra generation calls: simple description A → **自定义** with lyric B/style C → **Flow Music** description D → back to Suno/simple/custom. Each first switch creates its own durable draft; retained switches reuse IDs and data. New custom/Flow drafts intentionally do not treat the old simple description as lyrics (`draftVariants.ts:9–20`). Quit/reopen, choose actual drafts and switch through them again; compare text and stable links. Switching does not submit provider traffic.

### Current fixture task limitation

**The current running fixture cannot emit the task recipes below.** Its exact `fixtureToolGroups` allowlist at13–18 omits task_read/task_create/task_update/task_record_write/task_record_read/update_run_plan. Any `[fixture:tool]` containing them returns the safe unsupported-tool sentence before inspecting the offered product schema (`native-product-fixture.mjs:52`). Adding a nonexistent `task` load group is wrong: these are task-mode core definitions and need no load group when offered.

Product read-only research must not modify that fixture. Root can either validate current task UI manually, or commission an independently reviewed narrow external-fixture extension that permits only these actual names, checks the offered schema and returns a safe mode/scope explanation when a core tool is absent. Keep runtime fixture script/source identity separate from the bundled frontend identity and retain the previous server log. Never relax product validation or substitute manufactured completed records.

### Exact registered task recipes (templates, currently unsupported by fixture)

Precondition for all recipes: real selected/bound project, **任务模式**, **智能** interaction, latest active task thread/run, task lifecycle open. `taskTools.ts:62–75` enforces each condition. A task_create test needs a new task-mode thread with no existing task; using TaskBoard manual creation first makes task_create return the existing task with reused:true rather than exercise creation. Bookkeeping tools are atomic and do not ask write approval; this does not grant permission for business writes.

First source discovery:

```text
[fixture:tool] {"name":"task_read","arguments":{}}
```

Read `messages[].id` from the actual tool result. Use the actual same-thread user requirement message ID below, never a guessed ID. All tool source IDs must be actual completed calls in this task. `task_read` includes a sourceProjectionVersion and paged content. Source type message is a user message, not an assistant message.

Create with a truthful pending plan (or `steps:[]` for a deliberately plan-free simple task):

```text
[fixture:tool] {"name":"task_create","arguments":{"title":"SQLite 任务验收","goal":"验证工作记录与验收总结在重开后保持一致。","acceptanceCriteria":["工作记录和总结重开后仍可查看。"],"steps":[{"id":"check-records","title":"检查记录持久化","status":"pending"}],"sources":[{"type":"message","id":"<actual-user-message-id>"}]}}
```

All title/goal/acceptanceCriteria/steps/sources fields are required (`taskTools.ts:52,201–204`); sources must contain at least one actual user message. No projectId/taskId/threadId field is accepted; frozen context owns them. New tasks cannot preclaim completed steps. Creation also writes the actual requirement snapshot record and version atomically (`taskTools.ts:226`).

Minimal work record with no unsupported success claim:

```text
[fixture:tool] {"name":"task_record_write","arguments":{"kind":"progress","claim":"proposal","title":"持久化检查方案","body":"先检查工作记录与历史版本，再关闭并重新打开应用复核。","sources":[]}}
```

Allowed kinds are research/approach/progress/verification/question; claims observation/proposal/decision/result (`agentTaskRecords.ts:1–2`). Proposal can have no source. AI decision requires actual user-message source; observation requires nonempty real source; result requires actual successful nonbookkeeping business/generation evidence (`agentTaskRecords.ts:78–80`). A Todo check or another task bookkeeping call is not completed business evidence.

Read actual record/version after obtaining `record.id` from the result:

```text
[fixture:tool] {"name":"task_record_read","arguments":{"id":"<actual-record-id>","revision":1,"offset":0,"limit":6000}}
```

Update that same record with all record fields plus **id** and **expectedRevision**1; successful update increments revision and appends an immutable version. Do not include expectedRevision when creating a new record. Record body limit12000/title120; optional todoId must identify an actual current plan item (`taskTools.ts:261–295`; `agentTaskRecords.ts:93–122`).

After an actual completed check, update current plan through the actual registered core tool:

```text
[fixture:tool] {"name":"update_run_plan","arguments":{"steps":[{"id":"check-records","title":"检查记录持久化","status":"completed"}],"reason":"已按实际界面和重开结果复核记录。"}}
```

Do not issue this before observing its stated result. The product validates unique step IDs and at most one in_progress; task_update is for title/goal/acceptance criteria and expected task revision, not plan changes (`tools.ts:34–41,105`).

### Wrapup is an explicit UI operation, not `[fixture:tool]`

No registered `task_wrapup`, `wrapup_create` or `task_complete` tool exists. Actual path is TaskInspector **验收总结** → **手动填写** (or **AI 整理总结**) → **保存草稿** → **确认这份总结** → **确认任务完成** only when blockers allow. Confirmation saves history; it does not automatically mark the task completed (`TaskWrapup.tsx:399–400,510–511,534–541`). Every acceptance finding must match the current criterion text/index exactly, and pending Todo/unknown outcomes block task completion.

Current fixture-chat returns ordinary Chinese prose for the AI-summary prompt, so **AI 整理总结** will correctly fail JSON parsing. This can establish failure/history retention, not success. A fixture-only success extension would need to recognize the actual read-only snapshot request and produce JSON with every provided criterion; it must not emit tools, invent evidence IDs or mark subjective acceptance passed.

For reference, the strict shape for an empty-results read-only AI draft is:

```json
{"overview":"本地合成验收草稿，请依据实际界面复核。","results":[],"acceptance":[{"criterionIndex":0,"criterion":"<exact-current-criterion>","status":"review","note":"尚待实际验收确认。","sourceIds":[]}],"decisions":[],"lessons":[],"unresolved":[]}
```

This is a response shape, **not a tool payload**. The criterion count/text must be copied from current snapshot criteria; it is not safely hardcoded. AI results need eligible actual source IDs, and AI conclusions/unresolved items require source IDs (`wrapupSchema.ts:21–36`). Model met is downgraded to review; manual real observation owns final judgment.

### Existing UI alternative without extending the fixture

- TaskBoard **新建任务**: choose the known synthetic project; fill title/goal; create through current shared `createAgentTask` (`TaskBoard.tsx:63–75`). This is manual task creation evidence, not Agent task_create evidence.
- TaskInspector **工作记录 → 新记录**: set 分类 **进展**, 内容性质 **建议**, title/body; **保存记录**. Default new-record sources[] is valid. Edit once, inspect **历史版本** and verify both versions after reopen (`TaskRecords.tsx:186,248–255,292–307`).
- TaskInspector **验收总结 → 手动填写**: write factual stage summary, review actual acceptance findings, save/confirm; inspect **查看总结历史** after reopen. Do not mark the task completed unless actual blockers/criteria are satisfied.
- Retain exact synthetic task/record/wrapup IDs, author user/ai distinction and versions. One all-native automated task-tool lane plus this manual UI smoke does not become a claim that the current fixture emitted task tools.

### Related specifications and external references

Owning specs: `.trellis/spec/frontend/audio-music.md`, `audio-batch-arrangement.md`, `agent-tasks.md`, `agent-task-wrapup.md`, `shared-product-storage.md`, `native-product-runtime.md`. Task PRD R1/R3/R4/R5 and AC8 require truthful provider/task/system labels. Current implementation sources determine exact schema/UI labels; no external reference or dependency update was necessary.

## Caveats / Not Found

- No service requests, profile/key reads, tests/builds, product edits or CUA were performed. This guide is the only write in this dispatch.
- No task/wrapup fixture success branch exists in the currently inspected script. Core-task load group and guessed wrapup tool names are invalid.
- Fixture music yields one known synthetic tone-backed work, not real composition quality or automatic multi-candidate output. Verify variant persistence separately from generation.
- All placeholder IDs above must come from real current product tool/UI records. Safe source lookup and user-only decision authority are not bypassed.
- Root owns actual host acceptance and any separately reviewed fixture extension. Research alone does not close the corresponding UI gates.
