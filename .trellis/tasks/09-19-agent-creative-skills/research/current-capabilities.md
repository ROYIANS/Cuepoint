# Current capability inventory

Inspected 2026-09-19 in the local repository; these are code findings, not external API promises.

- src/lib/agent/skills.ts: only workspace and planning skill groups; each owns an explicit tool allowlist.
- src/lib/agent/tools.ts: workspace_overview and update_run_plan only; strict parsing and code-owned risk/effect classification. ask gates writes/network, assist gates high risk, full bypasses manual approval but not validation.
- src/db/repo.ts: domain functions for projects, episodes, characters, scenes, props, styles, beats, shots, media, connector and chat records. Duplication, ordering, cascade deletion and selected restore methods already exist. Reuse these invariants; never infer that every record has safe generic CRUD.
- src/db/agentTasks.ts: task create/update/lifecycle/result references exist, not yet exposed through business tools.
- src/lib/ai/apimart.ts: image/video submissions and getApimartTask.
- src/lib/ai/aihubmix.ts: image/video submissions, task queries, model schema discovery and downloadAIHubMixResult.
- src/lib/generationIntent.ts: validated target, source revisions, prepared/submitted/running/succeeded/failed/cancelled transitions and result-to-proposal conversion. In-memory intent helpers are not by themselves a durable Agent background-job executor.
- src/db/productionProposals.ts and src/lib/productionContext.ts: reusable production change/context boundaries with ownership/revision checks.
- src/db/agentTools.ts and .trellis/spec/frontend/agent-tools.md: durable calls, approval snapshots, resume and unknown effects. Network crash windows need reconciliation; never automatically replay uncertain paid work.
- docs/agent-workflow-direction.md: confirmed Trellis-style verify/summarize/archive/memory direction. Automatic cross-task memory remains a future layer, distinct from context compaction.

Primary planning concern: establish which administrative entities the user includes in “all entities,” then make a complete business-operation matrix and design durable job/result coordination before implementation.
