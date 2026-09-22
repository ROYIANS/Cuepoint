# Film workflow feedback — 2026-09-22

## Source and evidence boundary
User-supplied AI retrospective: `/Users/xiaomengdao/.codex/attachments/5db20de3-1de1-4a9e-904a-cb8d8121f7b4/已粘贴的文本.txt`.
Reported project: 最后一班电车, `prj_8bed45ef-e8ad-4a4c-8eef-98ed2e493a1a`; one episode/script, three beats, two characters, two scenes, one prop, one style and six shots. The author reports a corrected owner-ID failure and no image/video generation. These are reported historical outcomes, not independently inspected database or tool-ledger evidence. Do not recreate, modify or generate media in that project to validate this report without a separate concrete test scope.

## Source-checked findings and disposition
| Feedback | Current source evidence | Initiative disposition |
| --- | --- | --- |
| Creation breaks conversation continuity | `businessTools.ts` project_create explicitly returns `new_project_conversation`; project-context contract permits binding only before messages/runs exist | P0 R1 follow-up: seamless creation-to-editing continuity. Design an explicit durable transition or context-preserving handoff; do not merely assign thread.projectId during an active run |
| Repeated owner IDs invite mistakes | `businessSchemas.ts` requires ownerId in owner/episodeTarget; `businessStore.ts` checks owner and episode relationships | P0 R1 follow-up: infer omitted ownership only from authoritative bound context, retain explicit studio/cross-project semantics, reject conflicting supplied IDs. Do not infer a current episode/beat from an arbitrary first row |
| First episode is implicit | project_create preview says it initializes the first episode and returns firstEpisodeId | R1/R2: expose seeded entities and the direct next operation clearly. Nested episode input is a design option, not yet a required API |
| Script/beat synchronization is fragile | StoryBeat already has scriptRange with start/end/excerpt; normalization removes invalid ranges; episode_update preserves beats and returns a summary | P1 impact reporting under R2; P2 R7 explicit synchronization policy. Reuse ranges, report invalidations and affected links, preserve manually authored structures; do not claim ranges are absent or already provide stable rebasing |
| Different shots cannot be created in one payload | shot_create accepts count 1–20 and one shared fields object | P1 R6 film backlog: bounded heterogeneous shot array with validated references, numbering, ordering and retry identity |
| Write returns require extra reads | rowResult returns summarize/target/revision, while business_detail provides whitelisted bounded projection | P0 R2: bounded authoritative write receipt with effective references, normalized relevant fields, revision and side effects. Reuse projection; do not default to unbounded full_with_parent or expose extension bags |
| Recovery information is prose | requireOwner/requireEpisode emit text; writeTool already uses executeAtomicTool and rollback errors | P0 R1/R2: typed error category, effect certainty and permissible recovery action. Reuse rollback/ledger guarantees rather than rebuilding them; retryability alone does not authorize a retry |

## Required distinctions
- A validation failure followed by a successful corrected request does not prove create idempotency. Test duplicate delivery, committed writes with lost responses and resume after reload separately.
- An atomic local batch either commits or rolls back. An intentionally partial batch needs explicit per-item transactions/status and retry identities. Do not promise all-or-nothing and partial commits for the same mode.
- Structured recovery must preserve ownership, frozen approval, Stop, revision checks and unknown remote outcomes. Never silently replace an explicitly supplied conflicting owner, or resubmit an uncertain paid operation.
- Creation continuity crosses durable binding, run scope, tool offers, history, memory, approval and recovery. Existing binding immutability is a deliberate contract requiring reviewed evolution, not an incidental UI field to bypass.
- The application is local-first: move shared responsibility into tool/domain/repository contracts; this feedback does not require introducing a server.
- One-call creation of an entire film skeleton is an exploratory later composition, after contextual scope, receipts and batch semantics work. It is not the immediate P0 delivery.

## Additional acceptance scenarios
1. From an unbound conversation, create a film project and continue writing its first episode without requiring the user to repeat the goal. Preserve context and plan through the chosen transition; existing bound conversations cannot silently move projects.
2. In a bound project, omit ownerId where supported and resolve the durable owner. Explicit wrong-project IDs, mismatched episode/beat, ambiguous episode context, studio writes and deleted projects fail before effects, with actionable scoped recovery.
3. Return seeded episode identity and normalized effective relationships from actual committed writes. Distinguish inherited project style from explicit style, and current-run effects from previously existing entities.
4. Create six distinct shots with consistent references/order; inject an invalid sixth item and verify the chosen atomic/partial contract, then retry without duplicating the five earlier effects or reusing stale approval.
5. Edit script text so one source range no longer matches: report that invalidation, preserve the beat and manual shots, and identify review needs without implying semantic synchronization was performed.
6. Keep IDs, technical error codes and full receipts in details; show a concise next action and actual outcome in the main flow using existing components.

## Status
Feedback incorporated into planning and source-checked on 2026-09-22. No historical run/database verification or product implementation is claimed by this document. R1 first delivery remains separate from these follow-ups; R6/R7 are parent-owned backlog until dedicated child design and execution plans exist.
