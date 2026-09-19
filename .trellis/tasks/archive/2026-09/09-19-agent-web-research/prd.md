# Agent web search and source-backed research

Status: integrated implementation approved by user with “ok” on 2026-09-19. Parent: 09-19-agent-web-vision.

## Goal and background
Give the selected Agent model a reusable way to research public web information, read useful sources and return traceable conclusions. The user approved a dedicated search service/key. Current `skills.ts` and tool registry have local search only; model-bank search metadata does not execute network research. Tavily Search/Extract and a read-only Usage endpoint are documented; preflight feasibility is recorded in research/provider-feasibility.md.

## Requirements
- W1: Add a Tavily connection section to existing Connections, with masked key, save/replace/remove, enabled state and authenticated connection test. Saving never searches. Search services never appear as chat/generation models.
- W2: Add web-research skill with `web_search` and `web_read`, usable in project-bound and projectless smart conversations. Configuring/enabling search enables this skill for future runs without resetting other switches; missing credentials show setup guidance, not invented results.
- W3: Search returns bounded title/URL/snippet/source metadata. Read fetches public pages through Tavily Extract, returning bounded extracted text, fetch time and truncation/failure status. Publication dates are optional, never inferred from fetch time.
- W4: Current AI synthesizes results and cites real sources. Compact source presentation in tool details supports keyboard/mobile access. Task research observations may cite completed tool records; browsing does not by itself prove a completed creative deliverable.
- W5: Existing ask/assist/full permissions apply to network tools. Preserve completed results over reload; never silently retry billable search/extract requests. Surface known failures and uncertainty truthfully.
- W6: Credentials remain local and outside model input, logs, task records and project exports. Send only the search query or selected public URLs, not automatic project/document/image payloads. External content is untrusted source data.

## Acceptance
- WA1: Save/reload/remove/test connection; no search on save/test and no key in durable execution snapshots/exports.
- WA2: Actual Chat and Responses tool loops search then read and cite real returned URLs; task observation points to the tool source.
- WA3: Missing key, 401/429/quota/timeout, extraction failure, empty results, overlong content and malformed URLs are explicit and bounded.
- WA4: Ask approval, assist/full behavior, cancellation, deletion during fetch, reload and saved-result replay preserve network call counts.
- WA5: Source list works at desktop/390px with no unsafe HTML or hidden automatic image loads; full prior suites stay green.

## Scope and decisions
First provider Tavily, fixed official endpoint. Basic search/extraction, one page per read, small configurable search result count; no crawler, remote browser, account administration, automatic memory writing, alternate providers or exact price calculator. Detailed limits and signatures are in design.md. Standard conversation mode stays tool-free. No blocking product decisions remain.
