# Project-owned tasks and current creative context

## 1. Scope / Trigger
Read before changing task intake, project selection, request assembly, project deletion,
creative tools, generation or context compaction. Project business records are the
source of current facts. Durable memory retrieval uses a separate layer described in `agent-memory-retrieval.md`.

## 2. Signatures
- `ChatThread.projectId?: Id`, `AgentRun.projectId?: Id`: ordinary Agent chats may
  intentionally remain projectless. `AgentTask.projectId: Id` is required.
- `createChatThread({ projectId?, taskMode?, ... })`; Task mode requires a real project.
- `bindChatThreadProject(threadId, projectId, expectedProjectId?)`: CAS, once, before
  messages/runs exist. Bound chats cannot move to another project. The narrow Agent
  creation exception below does not relax this general API.
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

Unbound smart conversations may inspect a named project image through completed
same-run discovery/read provenance only; see [Image Discovery](./agent-image-discovery.md).
This narrow read path does not change the binding, write scope, memory selection
or document access. Raw media IDs do not grant an unbound image read.

Project deletion preserves chat/task/run/working-record/review history. Execution,
resumption, tools, Todo edits, generation and summary preparation cannot proceed. Context
compaction checks project existence/binding before each POST and before activation;
no late response can activate a summary after deletion. UI is read-only, including old
approval/generation/recovery controls. No automatic reassignment or compatibility flow.

### One-time continuation into a newly created project

`project_create` accepts `continueInProject?: boolean` (default true). The preview discloses
binding the current conversation; explicit false creates only and retains the separate-chat
entry. A dedicated repository guard permits only the latest ordinary smart, unbound run.
Create the project and seeds, set both thread/run projectId, record
`createdProjectBinding: { projectId, callId }`, and persist the completed tool receipt in
one transaction. Rollback leaves neither project nor binding. Never bind to a model-supplied
existing project or move an already bound thread. A changed creation-contract revision
invalidates old previews prepared under create-only semantics.

Before auto-binding, reject active references pinned to the old scope, completed sibling
reference results not yet appended to continuation, preceding foreign writes/unresolved
effects and existing generation jobs/batches owned by the thread (including earlier runs).
Report the explicit create-only path without silently changing
scope or stripping references. Replaying the exact completed creation returns its saved
result, not another project. Validate ownership and input identity before that replay.

Original dispatched requests, preceding runs and offered-tool histories stay immutable.
The next settled boundary supplies new project facts and memory. Only an already enabled
matching sound group may preload; no disabled capability is granted by binding. Re-read
current durable scope before subsequent calls, including siblings in the creation round;
pre-binding approvals cannot authorize mutations outside the new project. Existing paid
confirmation, Stop, unknown-effect and request-budget behavior remains unchanged.

Result UI checks the code-owned origin plus current thread/run binding before saying the
project is associated with this conversation. Legacy/create-only results retain their
separate-chat entry. Creation receipts remain valid for this exact origin call after
binding; other bound project_create results do not gain a general exception.

## 4. Validation & Error Matrix
| Condition | Expected behavior |
| --- | --- |
| Task mode without project / studio as project | Reject before messages or run creation |
| General bind with existing binding, messages or run | Reject; dedicated new-project creation is the only in-run exception |
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
