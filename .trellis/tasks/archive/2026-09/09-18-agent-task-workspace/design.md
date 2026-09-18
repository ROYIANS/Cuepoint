# Shared task workspace design

## Boundary
Implement the approved third child using existing run/tool contracts. Add AgentTask
and Dexie v10, an atomic task repository, task-aware begin/run-plan writes, a board
route and task inspector. Keep chat route identity, provider compatibility, locks,
retry snapshots, approval and recovery semantics unchanged. No business mutations,
media jobs, scheduling, delegation, attachments or memory.

## Identity and lifecycle
One task per linked thread; multiple runs per task. Task stores title, goal,
general-Agent assignee, ordered plan, explicit open/completed/archived lifecycle,
and result references (runId/messageId). Every run on its linked thread records
taskId. Ordinary chats do not acquire tasks unless explicitly converted or sent
from home task mode. Create-from-draft is atomic with run creation; manual board
creation atomically creates a thread and task with no provider needed.

Task display state derives from the latest run plus explicit lifecycle:
no run -> pending; running -> running; waiting approval/failed/interrupted/cancelled
-> attention; successful reply -> review; user-confirmed completion -> completed.
A model reply never auto-completes a goal. Reopen is explicit. Archive disallows
unsettled runs; archived tasks remain searchable and reopenable. Thread deletion
cascades task/result references. Project exports continue to exclude Agent tables.

## Shared plan and context
Task plan is authoritative for the board/inspector. update_run_plan commits task
plan, run plan and ledger result together. Run snapshots remain historical. Manual
editing is blocked during active, approval-waiting or recoverable tool execution.
New task requests include the goal/plan in the saved system context; retries preserve
the original request and task identity. UI preview uses that same assembly.

## UX
Dark restrained work surface consistent with current chat. Board: spacious heading,
search and status filters, four quiet columns with thin dividers and single-level
cards. Visible counts, clear empty states, large hit areas, no nested cards or fake
controls. On narrow screens columns become vertically stacked sections. Card opens
linked conversation. Inspector is a focused right sheet with goal, progress checklist,
explicit result references and execution history. Actions remain keyboard reachable.
Home task mode exposes recent tasks and board access; detail has task summary/header
entry and can explicitly convert a conversation. Result pinning only references
complete nonempty assistant messages in the same task thread, no copied output blobs.

## Verification
Repository tests for create, one-to-one mapping, no ordinary-chat task, multi-run retry,
plan atomicity, honest states, edit/complete/archive guards, artifacts ownership and
delete cascade. Browser fixture smoke for board/manual creation, task-mode send,
AI plan + reply, result pin, complete/reopen, reload and mobile responsive UI.
