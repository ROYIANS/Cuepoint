# AI creative skills and business tools

Status: implementation verified; user approved submission on 2026-09-19. User approved implementation on 2026-09-19.

## Goal
Let the general creative assistant maintain all creative business entities and generate images/videos into the correct production targets. An observable persisted result, not a model's claim, determines success. Preserve the user's Trellis-style goal → plan → execute → verify → summarize direction.

## Confirmed scope
The user selected all creative business entities on 2026-09-19. Connector configuration, credentials, chat history, Agent settings and execution/approval records are not business CRUD targets. Existing task plans remain linked to execution; a new task/memory lifecycle is deferred.

| Entity / domain | Required operations |
| --- | --- |
| Project | List/search/detail, create, edit metadata/logline/world setting/output defaults, delete with cascade impact |
| Episode | List/detail, create, edit title and story draft, reorder, delete with cascade impact |
| Story beat | List/detail, create, edit, duplicate, reorder, delete; preserve linked shot semantics |
| Shot | List/search/detail, create, update text/duration/status/relationships, duplicate, reorder, delete; bounded batches |
| Character | List/search/detail, create/update/delete in studio or project; copy studio assets into a project; maintain image slots |
| Scene | Same domain CRUD/reuse operations with scene fields and slots |
| Prop | Same domain CRUD/reuse operations with prop fields and slots |
| Visual style | Same domain CRUD/reuse operations with style fields and slots, including default-style associations |
| Media and generation slots | Read metadata/usage, store genuine generation results, set prompts/references/results, clear associations, delete only unreferenced media through domain cleanup; never fabricate Blob data or expose arbitrary database writes |

Nested project world settings and episode scripts are included as business content. Physical media replacement uses a new media record and updates associations; used media must not be silently removed. Importing new user attachments and parsing documents is a separate future capability.

## Requirements
- R1: All rows above have explicit supported operations, strict argument schemas, bounded reads/batches and verifiable results. Resolve scope and stable IDs; ambiguous names require disambiguation.
- R2: Reuse domain repository operations and preserve project/episode/studio ownership, references and cascade semantics. Deletion impact and proposed changes are human-readable. Existing ask/assist/full modes apply; full access retains validation and conflict checks without unconditional extra approval.
- R3: Persist business mutations and successful tool outcomes atomically where local transactions allow it. Repeated continuation cannot duplicate creates or apply the same mutation twice. Pending drafts and stale targets are checked before changes.
- R4: Discover sanitized capabilities from configured connectors and existing media adapters. Prepare, submit and track image/video generation; freeze target, parameters and references; persist provider job identity; download real outputs and associate them with the intended slot. Unsupported provider/model combinations are explicit, with no silent paid fallback.
- R5: Distinguish remote completion, local media download and target application. Resume known jobs by querying them; unknown submission outcomes cannot be auto-resubmitted. Stop local monitoring is not proof of remote cancellation. Target modification/deletion retains a visible conflict/missing-target outcome rather than applying stale content.
- R6: All foundational skill groups are enabled by default, including a one-time upgrade of existing configurations (user clarification2026-09-19); later manual switch choices persist. Skill groups expose actual tools only. Flat action rows show affected entity, progress, result preview and navigation. Approval/error/conflict actions remain visible; completed details can collapse. No extra nested cards or permanent composer button clutter.
- R7: Work stays in the pure frontend. A closed page cannot run local polling; reopening restores durable state and uses explicit continuation. Existing ordinary-chat restrictions, context budgets and permission snapshots remain intact.

## Acceptance
- AC1 (R1-R3): Every entity row has successful CRUD/domain-operation coverage, invalid ownership/schema cases and deletion/reference integrity checks.
- AC2 (R1-R3): A request can create a project, update its first episode, create beats/shots and associate newly created/reused assets; UI immediately reflects persisted results.
- AC3 (R2-R3): Ask/assist/full retain existing behavior, approval previews match execution, and replay/refresh cannot duplicate completed changes.
- AC4 (R4-R5): Fixture-backed APIMart and AIHubMix image/video flows reach actual local media and correct target association; unsupported combinations fail before submission.
- AC5 (R3-R5,R7): Reload during submit, polling, download and apply is covered; known paid jobs never silently resubmit, unknown outcomes remain actionable, and changed/deleted targets are preserved.
- AC6 (R6-R7): Desktop/mobile action, approval, result and recovery UI is usable; ordinary chat cannot invoke the new tools. No fabricated usage, price, progress or output is shown.

## Delivery order
1. Business read/search and entity CRUD, permissions, atomic execution and review UI.
2. Durable generation jobs for existing supported image/video adapters, monitoring and target association.
3. Cross-entity workflow verification, interruption/conflict tests and visual polish.
All three belong to this task. Implement and verify each slice before moving on.

## Out of scope
Administrative CRUD, new provider integrations, MCP, independent Agent teams, background server scheduling, arbitrary remote-file ingestion, document parsing, web search, new export features and automated cross-task long-term memory. These remain recorded follow-ups, not silently added to this batch.

## Evidence and artifacts
research/current-capabilities.md records the inspected source entry points. design.md specifies execution boundaries; implement.md records ordered work and verification. The latest user clarification resolves the entity-scope decision. Final planning review precedes implementation.

## Follow-up: AI-prepared generation confirmation
User approved2026-09-19: AI prepares connector/model/prompt/parameters, then the user can adjust and confirm before submission. Paid submit_generation requires this confirmation in every permission mode. Other tools keep their existing policy. Preserve the model's original tool-call envelope; execute a separately recorded, validated user override. Save optional per-kind defaults, expose project/global recommendations to AI and allow one-click use in the form. No unsupported model is advertised as executable.

Acceptance: choose APIMart versus AIHubMix for the same image model; edit prompt and valid profile parameters; only one POST after confirmation; stale/missing inputs/targets and competing approvals fail before submit; Chat and Responses preserve original envelopes while executing actual user values; preference save/clear and later model drafts use discoverable recommendations; desktop/mobile keyboard form works.

## Follow-up: resumable execution segments
User approved replacing the eight-request lifetime cap with a larger, explicitly resumable allowance. Each segment permits 32 model requests. Exhaustion pauses with saved work and clear continuation/end actions, never reports a generation failure. User continuation grants a new segment; approvals, reload and ordinary interruptions do not refresh allowance. Completed tool calls and paid submissions must not replay.
