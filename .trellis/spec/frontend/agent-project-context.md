# Project-owned tasks and current creative context

## 1. Scope / Trigger
Read before changing task intake, project selection, request assembly, project deletion,
creative tools, generation or context compaction. Project business records are the
source of current facts. This foundation does not implement durable memory retrieval.

## 2. Signatures
- `ChatThread.projectId?: Id`, `AgentRun.projectId?: Id`: ordinary Agent chats may
  intentionally remain projectless. `AgentTask.projectId: Id` is required.
- `createChatThread({ projectId?, taskMode?, ... })`; Task mode requires a real project.
- `bindChatThreadProject(threadId, projectId, expectedProjectId?)`: CAS, once, before
  messages/runs exist. Bound chats cannot move to another project.
- `createAgentTask({ projectId, title, goal, ... })`; AI/manual task-from-thread inherits
  the thread binding; model arguments cannot select a different owner.
- `getProjectContext(projectId): Promise<ProjectContextSnapshot>` with projectId, name,
  fingerprint, JSON content and episode/asset coverage (total, included, truncated).
- `getTaskContext(threadId, instructions, taskMode?, interactionMode?, projectId?)`
  shares request and inspector assembly. Persisted thread identity is authoritative.
- `refreshRunProjectContext(runId)` refreshes facts at a settled model boundary.
- `frozenProjectScope(context)` and `assertProjectToolScope(...)` load ownership from
  durable run/thread records. Dexie v15 adds project indexes without data backfill.

## 3. Contracts
Task mode selects a project before first send; first send still starts clarification,
not automatic task creation. AI calls task_create after requirements become clear.
Acquire the thread Web Lock **before navigating** a newly created chat to its detail
route: detail wrap-up recovery also takes that lock and otherwise can reject Send.

Snapshot includes bounded project facts, separately bounded worldview/background/rules,
logline, whitelisted generation defaults, project-owned default style, first 20 episodes,
first 40 assets and shot count. Full scripts/shot descriptions/assets remain on-demand.
Never serialize arbitrary `extra` data into automatic context. Reuse businessStore's
projection whitelist. Coverage is visible in the context inspector; its token estimate
includes these facts in the instruction envelope and never counts them twice.

Changes to underlying rows update the fingerprint. If visible facts/coverage are equal,
update only the stored fingerprint. Visible changes append field/index differences to
continuation and Responses input, keeping original dispatched requests and tool ledger
intact. The latest snapshot is saved on the run. Fresh chats use current business rows;
retries retain their frozen request and receive the current differences at the next
safe boundary. Protected live tool/fact chains still obey the shared budget and block
when they cannot fit; this does not promise unbounded execution or memory retrieval.

Bound business writes and generation destinations must equal the run project. Read
studio assets only through supported read paths; explicit asset_copy_from_studio copies
independent assets/media into the bound project. Never mutate studio originals from a
bound run. Verify scope before preview and in write/claim/apply transactions, plus before
paid submission. Model-provided ownerId cannot widen the run's authority.

Project deletion preserves chat/task/run/working-record/review history. Execution,
resumption, tools, Todo edits, generation and summary preparation cannot proceed. Context
compaction checks project existence/binding before each POST and before activation;
no late response can activate a summary after deletion. UI is read-only, including old
approval/generation/recovery controls. No automatic reassignment or compatibility flow.

## 4. Validation & Error Matrix
| Condition | Expected behavior |
| --- | --- |
| Task mode without project / studio as project | Reject before messages or run creation |
| Existing binding, messages or run on bind | Reject; start a new conversation |
| Stale project picker/model probe | Refuse stale send; preserve draft |
| Foreign project/studio write | Reject before effects; explicit studio copy allowed |
| Unchanged visible snapshot | Refresh fingerprint without another model message |
| Changed visible facts | Append compact differences, retain previous envelopes |
| Deleted project during compaction | Do not activate; no later compression POST |
| Deleted project's chat | History visible; send/run actions/review mutation unavailable |
| Long source text / many entities | Bounded excerpts, visible coverage, explicit detail tools |

## 5. Good / Base / Bad Cases
Good: select project → clarify → AI creates task → update project → next request sees
updated facts → new same-project chat starts with those facts.
Base: ordinary projectless Agent questions still work without creating a task.
Bad: infer ownership from model arguments, create a task on first send, migrate unknown
rows into a made-up project, or call current project facts long-term memory.

## 6. Tests Required
- `agentProjectContext.test.ts`: required scope, bind CAS, task inheritance, bounded
  snapshot, provider extras excluded, rules survive long worldview, invisible changes
  do not append, original Chat/Responses preserved, studio copy and cross-project
  rejection, generation scope, deletion history and compaction late-response guard.
- Task/run/business/generation/context/wrap-up suites retain existing effect/version
  and retry guarantees. Project changes invalidate current review evidence.
- Disposable browser fixture: first-send real request, clarification without task,
  AI task inheritance, reload/manual edits/new same-project chat, searchable keyboard
  picker, create project, manual task picker, project filtering, desktop/mobile,
  outside/Escape dismissal and deleted-project controls. No paid requests.

## 7. Wrong vs Correct
Wrong: navigate to a new thread, then race its recovery effect for execution ownership.
Correct: create thread, obtain the Web Lock, navigate, begin and execute under that lock.

Wrong: append an entire snapshot whenever any shot timestamp changes.
Correct: compare visible facts; append only changed fields/index rows at safe boundaries.

Wrong: show active generation approval controls in a deleted project's historical chat.
Correct: propagate explicit readOnly through MessageList and AgentRunDetails; keep the
saved preview and technical payload readable while removing mutating controls.
