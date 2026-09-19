# Agent web research

## 1. Scope / Trigger
Read before changing web search/extraction, search connection settings, source display or network-tool recovery. Extends [Agent tools](./agent-tools.md), [execution](./agent-execution.md) and [task wrap-up](./agent-task-wrapup.md). The selected model reasons over service results; no hidden reasoning model or backend proxy is introduced.

## 2. Signatures
- Dexie v19 adds global `searchConnections`. Singleton Tavily row stores local key, enabled state, opaque revision and timestamps; exclude it from project ZIPs and model snapshots.
- `getSearchConnectionState(): {configured,enabled,revision?}`, `saveSearchConnection({apiKey?,enabled})`, `removeSearchConnection()` in `db/searchConnections.ts`. Blank key preserves a saved key; UI never reads it back.
- `testSearchConnection(apiKey?,options?)` calls authenticated GET `/usage`; no paid-search fallback.
- `web_search({query,maxResults?,timeRange?})` and `web_read({url})` in `lib/agent/webTools.ts`, both strict network tools.
- `executeWebRequest(kind,args,revision,options?)` returns discriminated `WebResult`. Expected failures are `{ok:false,code,message,serviceMayHaveRun,retrievedAt}`.
- `webResultSources(name,result)` normalizes safe persisted source presentation. Task research observations cite existing tool-call IDs.

## 3. Contracts
Configuration is separate from chat/generation connectors. Enabling a saved search connection adds only web-research to future skill selection, preserving all other choices. Manual skill disable remains effective until explicit enabling. Ordinary conversation mode exposes no tools. Setup does not send service requests; test checks authentication, not search quality or paid availability.

Fixed service endpoint is `https://api.tavily.com`; only adapter reads saved credentials. Never accept API keys or destination endpoints from tool arguments. Prepare captures redacted configuration revision; execute rejects changed/disabled config before HTTP. Existing ask mode requires network approval; assist/full follow their established policies. Global changes do not modify frozen permissions or enabled tools on an existing run.

Search uses basic depth, 1–500 character query, 1–10 results (default five), optional time range; answer/raw content/images/automatic parameters disabled. Read extracts one validated public HTTP(S) URL with basic depth and Markdown output. Return safe source URLs, retrieval time, optional provider publication date, coverage and truncation. Search snippets are not full reads; extraction is provider output, never a claim that every page element was read.

Response bytes are capped at 2 MiB before JSON parsing; client timeout is 30 seconds. Search snippets and read text are bounded, with final serialized result size below the ledger limit. JSON escaping counts toward that limit. Do not truncate link targets into different URLs; reject overlong/invalid provider links. Preview text may truncate while original validated arguments remain intact. Secret-bearing service text is redacted; errors do not echo raw service bodies or keys.

One tool attempt makes at most one service request. No automatic network retry or general repeatable flag. Completed results replay locally. Expected HTTP/extraction/network errors return structured failure; they do not claim no server work or no charge. Storage failure after transport retains the conservative unknown boundary. Cancel stops local waiting, not remote billing; deletion blocks late ledger publication. Preserve generation recovery semantics.

URLs reject non-web schemes, credentials, local/private literal addresses and unsuitable local hostnames. Do not execute returned HTML, auto-load remote images or forward browser cookies. Provider-side redirects/DNS remain provider behavior; do not claim the browser controls them.

Keep source records in the tool ledger and use research/observation claims. A search or page read never proves a creative business result, never grants authority and never auto-promotes facts into project memory. History is dated retrieved evidence, not live freshness. Source UI displays plain text, safe links and coverage, fits 390px and remains keyboard accessible.

## 4. Validation & Error Matrix
| Condition | Required result |
| --- | --- |
| Missing/disabled configuration | Setup guidance, no service request |
| Configuration revision changed | Fresh preparation required, no HTTP |
| Ask mode awaiting approval | Durable pause, zero search before approval |
| Authentication/rate limit/quota | Explicit structured error, no auto-retry |
| Network/CORS/timeout | Retrieval unavailable; service may have run |
| Empty valid search | Successful empty results, not a transport failure |
| Missing/empty extracted body | Extraction failure, no false page-read claim |
| Response/result exceeds bounds | Bounded failure/truncation, no invalid ledger result |
| Deleted thread/project | No late publication/resurrection |
| Reload with completed tool | Reuse saved result, no duplicate service request |

## 5. Good / Base / Bad Cases
Good: search rain lighting → read a returned source → cite its URL and save a source-backed observation.
Base: unconfigured skill explains where to configure; normal chat/generation remains unchanged.
Bad: test connection with a paid search, cite a shortened URL, treat a network error as an empty search, or label browsing as a completed creative deliverable.

## 6. Tests Required
Focused adapter/config/tool tests cover secret redaction and export exclusion, strict schemas, provider errors, response byte/serialized limits, config revisions, permissions, cancellation, unknown persistence, deletion and no replay. Both Chat and Responses real tool loops must receive returned source text without keys. Native browser tests exercise connection save/test/remove, source lists, task observation, 390px and reload counts. Do not call mocked responses live-account validation.

Official service feasibility (2026-09-19): OPTIONS accepts search/extract requests, but credential-free POST gateway 401 omits CORS headers, while GET `/usage` gives readable 401. Authenticated success requires separate verification with an authorized key. Source contract: [Search](https://docs.tavily.com/documentation/api-reference/endpoint/search), [Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract), [Usage](https://docs.tavily.com/documentation/api-reference/endpoint/usage).

## 7. Wrong vs Correct
Wrong: `url.slice(0, 2048)` followed by validation and presentation. Correct: validate the original URL; reject if too long rather than invent a different destination.

Wrong: cap read text by raw length only. Correct: enforce both readable text bounds and `JSON.stringify(result).length` so escaped control characters cannot break persistence after a billable call.
