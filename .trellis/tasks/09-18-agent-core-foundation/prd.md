# Agent core foundation

## Approved outcome
Build one general creative assistant with durable execution, validated tools and one shared chat/task workspace. Preserve a path to independent specialist teams without implementing delegation now. User approved task creation and sequential implementation on 2026-09-18.

## Task map (in order)
1. `09-18-agent-run-foundation`: execution identity, message durability, interruption recovery and explicit retry.
2. `09-18-agent-tools-permissions`: tool registry, multi-step execution, durable approvals and skill assembly.
3. `09-18-agent-task-workspace`: persistent goals/checklists/assignee/artifacts, shared chat/board references and multiple runs per task.

## Product contracts
- One persisted general Agent initially; tasks, runs, conversations and business entities have distinct identities.
- Request approval: business edits and internet tools require approval. Assist approval: only high-risk operations require approval. Full access: autonomous within validated available tools.
- Clicking Send authorizes the basic model request and local conversation/task/execution bookkeeping; these are not tool approvals.
- Connector can describe model or other services. Search may be provider-native or a separate connector. Gate native search before submission if internal subcalls cannot be intercepted.
- Pure frontend: no guarantee of execution after close/freeze. Recovery reconciles durable state, never pretends a browser is an always-on server.
- Preserve provenance, user control and honest failure states. Never automatically re-submit ambiguous paid operations.

## Deferred
Real business CRUD tools, image/video task execution, search integration, attachments, long-term memory, specialist delegation. User expanded child 2 on 2026-09-19 to include model-aware reasoning control inside model settings, conversation persistence, usage/context inspection and Responses compatibility for Luna reasoning with tools.

## Cross-child acceptance
A user can follow one goal across conversation, execution and board; stop/reload/failure never produces false completion or duplicate actions. Permission decisions remain auditable across interruptions. Existing project workflows and provider adapters remain intact.
