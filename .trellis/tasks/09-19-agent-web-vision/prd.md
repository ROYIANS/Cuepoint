# Web research and natural-language project image inspection

Status: integrated implementation approved by user with “ok” on 2026-09-19. Web research activated first; image discovery follows verification.

## Goal
Let the Agent research public web information and inspect existing project images referred to in natural language, without requiring the user to upload those images again.

## Confirmed decisions
- User requested both missing capabilities after the prior seven-child roadmap completed.
- User accepted an independent search service with a separate API key (first “按你推荐的来吧”).
- User accepted project-name-based read-only image access in unbound smart conversations (second “按你推荐的来”). Bound conversations retain their existing project boundary; names with ambiguity require clarification.

## Requirements
- R1: Configurable web-research skill: search, read sources and cite evidence through the current AI.
- R2: Natural project/episode/shot/asset descriptions resolve real current images; actual pixels reach the selected vision-capable model.
- R3: No reattachment or manual media-ID entry required. Separate current slot output, reference images and unselected candidates.
- R4: Preserve sources, truthful search/read/visual states, project ownership and existing attachments/Chat/Responses behavior.
- R5: Keep pure-frontend operation, established permission modes, durable execution and local secret configuration.

## Deliverables and order
1. `09-19-agent-web-research`: Tavily search/extract, configuration and source presentation.
2. `09-19-agent-project-image-discovery`: scoped discovery and tool-proven image input for bound/unbound smart conversations.

The child designs are reviewed together. Implement and verify the first before activating the second; shared tool/skill changes are sequential. Parent owns final combined acceptance.

## Cross-child acceptance
- AC1: Research requests execute search/read tools and produce traceable links; snippets and fetched text are distinguished.
- AC2: No-attachment request to inspect a named project's shot image resolves the correct image and sends pixels before analysis, without changing the conversation's binding.
- AC3: A combined research-plus-image request preserves external-source and local-image provenance.
- AC4: Ambiguity, missing outputs, changed/deleted images and unsupported vision produce truthful actionable outcomes; bound conversations cannot read another project.
- AC5: Both children pass focused/full checks, independent review, native browser verification, specification updates and authorized commit/archive steps.

## Boundaries
Public web search/page extraction and existing project images in smart mode. Preserve ordinary conversation mode's no-tools behavior. No login browser automation, website crawling, image web search/download library, video understanding, new generation provider, hidden vision model, automatic project rebinding or automatic promotion of web facts into memory.

## Deferred verification
Tavily CORS preflight passed; authenticated service quality/account availability requires a configured key. Automated/native fixtures must not imply live-provider verification. Development uses mocked billed requests unless explicitly authorized otherwise. No unresolved product question remains before integrated design approval.
