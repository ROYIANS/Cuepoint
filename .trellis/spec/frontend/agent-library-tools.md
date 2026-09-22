# Agent IP, Material Library and Progressive Tools

## 1. Scope / Trigger

Chat can operate existing IP/material repositories through strict adapters. This extends the existing confirmation ledger; it does not provide media editing, audio listening, video understanding, arbitrary filesystem access or permanent material deletion. Tool discovery uses ordinary function calls for both Chat Completions and Responses.

## 2. Signatures

- `createToolLoading(skillIds, allowedNames, projectKind?)`, `getOfferedToolNames(run)`, `toolNamesForCall(run, step)`, `toolLoadingInstructions(state)` in `lib/agent/toolLoading.ts`.
- `load_tool_groups({groupIds: string[], query?: string})`: at most two authorized groups; empty IDs query the catalog without clearing prior groups. Selected groups replace the prior selection on the next request.
- `ip_search`, `ip_read`, `ip_create`, `ip_update`, `ip_set_archived`, `project_bind_ip` in `ipTools.ts`.
- `material_search/read/read_text/read_image/update_metadata/promote/use/update_use/archive/release` in `materialTools.ts`.
- `queueMaterialImage(materialId, revision, context, mediaId?)`; `resolveMaterialInput(input, projectId, runId)` resolve immutable content immediately before HTTP.

## 3. Contracts

`AgentRun.enabledToolNames` remains the frozen permission ceiling. Optional `toolLoading` holds frozen capability descriptions, instructions, base tools and loaded groups/names. `offeredTools[{step,names}]` records actual per-request definitions; saving and executing calls enforce both this record and the ceiling. Legacy runs without this state retain their original tools. Conversation mode offers none. Base tools are workspace, plan, applicable task bookkeeping and the loader. At most 36 tools are loaded; pending calls retain their definitions and guidance until settled.

Request building, budgeting and the context panel use `getOfferedToolNames`. Refresh only the next system skill envelope, keeping immutable dispatched input and paired continuation items. Old ledger tests can seed a simulated offer through `tests/helpers/toolDispatch.ts`; runtime tests must exercise discovery or explicitly declare a preloaded fixture. Never weaken production authorization for old tests.

New bound audio/music runs preload only their matching enabled group, intersected with
the frozen allowed names and within the 36-tool cap. Durable project kind comes from
the shared task-context assembly; the context inspector uses the same initializer.
Video/projectless runs retain discovery. Conversation mode and disabled skills never
gain tools. Retries reuse the original loading snapshot, not today's project defaults.

Shared smart execution guidance applies before and after discovery, including
foundation-only configurations. “Next round” means the next model request in the same
execution, not another user message. Clear action requests should progress through
actual calls; loading/planning alone is not completion. Paid tools open the existing
confirmation flow; a textual “start” does not approve a paid call. Advice-only requests,
missing necessary information, rejection, uncertainty and Stop retain their boundaries.
This is guidance and capability readiness, not a semantic completion validator or a
guarantee that a model will call tools. No forced no-call retry loop is introduced.

IP creation, shared edits, archive/restore and project binding always require readable confirmation. `libraryWriteTool` checks scope before flushing drafts; preview hashes arguments and affected state, then recomputes inside the atomic transaction before repository mutation and ledger completion. Material adoption/update/release follow existing permission modes. Shared metadata/archive/promotion always require confirmation. Promotion creates an independent snapshot; project adoption fixes the revision and does not update slots automatically.

Bound chats see global, their own project and linked-IP materials. Releasing an already adopted project-owned copy checks its durable use/project and references, independently of later source-IP unlinking; it must not read source content or allow new adoption. Unbound chats require explicit targets. Project facts include bounded IP fields and revision; archive/unlink yields `ip:null`, and settled request boundaries send updated facts. Profiles and material bodies are untrusted creative data, never instructions.

Material reads persist identities, not binary content: `referenceInput.material={kind,materialId,revision,readCallId,mediaId?,digest}`. The saved completed same-run read and its arguments must match exactly. Optional absent fields must be omitted to survive JSON roundtrip. Revalidate scope, owner/material archival, immutable version and SHA-256 before and after encoding. Actual image bytes appear only in wire `image_url`/`input_image`; documents are bounded to three 4,000-character chunks with original locators. Audio/video are metadata-only. History/wrap-up projections retain material read identity and coverage rather than cached source bodies.

Context usage separates skill/catalog text, offered tool schemas and results. `AgentTokenUsage.cachedInputTokens` uses provider-returned `prompt_tokens_details.cached_tokens` or `input_tokens_details.cached_tokens`; absent remains unknown, and aggregate exists only when every model step supplies it. Heuristic estimates do not claim billing savings. Settings version 2 appends new groups once to version-1 configurations, preserves previous group opt-outs and preserves an empty all-off list.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Disabled group / unknown group | Fail loading; do not expand permissions |
| Load and use a never-offered tool in one response | Reject before business execution |
| Pending approval during capability switch | Preserve dependencies; do not change issued approvals |
| IP/material revision or shared impact changes | Reject stale preview; reread and request a fresh operation |
| Cross-project or unlinked IP material | Reject before reading content or flushing foreign drafts |
| Archived material/owner | Metadata only; content/queue/adoption rejected |
| Non-vision model, too many queued images or malformed image | Fail the tool before persisting an unusable image envelope |
| Source removed/changed after reading | Block dispatch with retained history; never substitute another source |
| Referenced project copy | Refuse release after pending project drafts are flushed |
| Missing provider cache usage | Display no invented cache measurement |

## 5. Good / Base / Bad Cases

- Good: load IP group, create readable proposal, approve once, persist profile and success ledger atomically.
- Base: a workspace-only configuration stays small without unnecessary discovery; a legacy run retains its frozen envelope.
- Bad: treating a catalog name as execution permission, automatically applying a newer material version, inferring image contents from a filename, or replaying archived document bodies through task history.

## 6. Tests Required

`toolLoading.test.ts`: both protocols, group replacement, forbidden same-step tools, disabled groups, approvals/resume, legacy/conversation and >=60% first-request reduction. `toolLoadingMeasurement.test.ts` records all fixture request estimates including discovery overhead.

`agentIpTools.test.ts`: actual create, reject, no replay, CAS/impact conflict, scope, bounded facts and both protocol refreshes. `agentMaterialTools.test.ts`: snapshots, ownership, immutable reads, release reference guards and pending drafts. `materialReferenceWire.test.ts`: actual pixel data in both protocols, no durable base64, no duplicate append, same-run proof, archive/unlink/content-change blocking and text provenance. `providerCacheUsage.test.ts` checks real cache fields and history projection. Browser evidence uses isolated contexts and mocked providers; PDF/DOCX worker checks use actual local parsers.

## 7. Wrong vs Correct

Wrong: `toolSchemas(run.enabledToolNames)` on every request, then accept any enabled call.

Correct: `toolSchemas(getOfferedToolNames(run))`, record that request's offer, and validate calls with `toolNamesForCall(run, call.step)` intersected with the frozen ceiling. Discovery results describe capability; only code updates authority-preserving state.
