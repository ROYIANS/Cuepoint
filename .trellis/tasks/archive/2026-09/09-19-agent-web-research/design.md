# Web research design

Status: ready for integrated review; no product edits.

## Change boundary
Add one search-only configuration repository/adapter and two Agent tools. Reuse tool ledger, permissions, cancellation, source-linked task records and Connections UI. No global connector-union widening, general tool-runtime rewrite or new backend.

## Configuration and service adapter
Add the next additive Dexie version (currently v19) with a `searchConnections` table and a singleton Tavily row `{id:'tavily',provider:'tavily',apiKey,enabled,revision,updatedAt}`. No legacy data rewrite. Never include this global secret table in project ZIPs, task contexts or business projections. Repository getter exposes a redacted state to UI; only adapter reads the key. Remove clears it. Saving/enabling explicitly adds web-research to future skill selection; preserve all other choices, and respect later manual skill disable. Do not reset skill defaults for existing installations.

Fixed base URL `https://api.tavily.com`; do not accept destination/key fields from AI. Configure through a small search section on Connections with save/remove and GET `/usage` test. Test reports authentication/connectivity, not search success or a spending quote; never fall back to a paid search for testing. Draft key values remain masked and request errors are normalized/redacted. Keep previous draft on errors.

## Tool contracts
- `web_search({query, maxResults?, timeRange?})`: strict query 1–500 chars, maxResults default 5/range 1–10, optional day/week/month/year mapped to provider values. POST `/search`, `search_depth:'basic'`, `include_answer:false`, `include_raw_content:false`, `include_images:false`, `auto_parameters:false`. Return `ok`, query, retrievedAt, sources with stable local source IDs, title, validated URL, snippet (max 1500 chars), optional publication date and provider request ID. Empty successful list differs from failed search.
- `web_read({url})`: strict one public HTTP(S) URL, max 2048 chars. POST `/extract`, one URL, `extract_depth:'basic'`, `format:'markdown'`, images disabled. Return requested/returned URL, retrievedAt, extracted text (max 24000 chars), available length/truncated/coverage information and normalized failure. Do not claim full-page completeness merely because the returned extraction fits. No crawl or automatic navigation.
- Limit JSON response body before parsing (2 MiB), search output total below 32K chars and serialized tool result below existing 65536-char limit. Use bounded stream reading and 30-second client timeout. A tool call sends at most one service request; no fallback or automatic retry.
- Reject credentials, localhost, private/link-local literal IPs and non-web URL schemes; validate returned display links too. Server-side extraction is not a browser session and must not forward user cookies. App does not claim control over provider DNS/redirect execution. No downloaded remote images or HTML execution in results UI.

## Permission, lifecycle and failure behavior
Both tools have `effect:'network'` and use existing ask approval / assist/full policies. Prepare captures configuration identity/revision in preview without keys; execution rechecks enabled configuration. Changing configuration after preview fails before HTTP. Credential replacement requires fresh preparation. Completed tool results are durable and never replay on resume.

Expected preflight/HTTP/extraction/timeout errors return structured `ok:false` results with accurate state and no success sources; model can explain or propose an explicit new search. A transport timeout never proves service billing did not occur. Cancellation stops local waiting, does not promise server cancellation. Do not mark tools generally repeatable or change ambiguous-generation handling. If result persistence fails after service execution, retain the existing conservative unknown boundary; no auto-retry. Recheck run/thread ownership before publication, with existing ledger guards preventing resurrection after deletion.

## Sources, tasks and UI
Use completed tool ledger as durable research provenance, with query/URLs/fetch time/coverage. Reuse `TaskRecordSource.type:'tool'` for research observations; `provesCompletedEffect` must remain false for search/read. Web snippets never become verified creative deliverables or project memory automatically. History preserves the retrieved snapshot and date, not a promise of live freshness. For changed information, explicitly search/read again.

Expose a compact source list in tool details and readable tool activity/approval copy. Render titles/URLs safely, not provider HTML or automatically loaded images. Skill instructs AI to search, read relevant pages as needed, compare evidence and cite returned links. Explain partial/unread sources. Ordinary conversation mode retains an empty tool set. Do not insert an extra reasoning model between service results and the user's selected model.

## Expected files and risk points
New domain/search configuration, db/searchConnections, lib/ai/tavily, lib/agent/webTools/webToolNames modules and small Connections/source components. Integrate database, tools/skills, Agent tool details and task evidence presentation as needed. Keep model/generation connector registries unchanged. Tests target mocked fetch shapes, auth/error redaction, exact network counts, both protocols, configuration changes, deletion and native UI. Preserve behavior with the new skill disabled/unconfigured.

## Verification and rollback
Use native browser real IndexedDB with intercepted service/model responses; real preflight checks are separate feasibility evidence. Authenticated live service verification remains explicitly untested without an authorized key. Hide/disable new skill if a regression occurs, preserving source records and credentials until the user removes them. Do not weaken prior runtime recovery to make search resume.
