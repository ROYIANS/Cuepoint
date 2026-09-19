# Independent search service feasibility

Date: 2026-09-19. Planning evidence only.

## Accepted route
User approved independent search/key configuration. Tavily is the first candidate because it exposes distinct search and page extraction operations matching the requested research flow. Sources:
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/documentation/api-reference/endpoint/extract

## Transport probe
Unauthenticated OPTIONS requests to `https://api.tavily.com/search` and `/extract`, with `Origin: http://localhost:5173`, `Access-Control-Request-Method: POST`, and `Access-Control-Request-Headers: authorization,content-type`, each returned HTTP 200 with:
- `access-control-allow-origin: http://localhost:5173`
- `access-control-allow-headers: authorization,content-type`
- `access-control-allow-methods` including POST

No credentials, searches or page extraction were submitted. This confirms current preflight acceptance; it does not prove authenticated response CORS, account availability or output quality. Verify in native browser during implementation.

## Existing integration constraints
`ConnectorConfig.definitionId` is a chat/generation-provider union. Do not insert a search-only service into model discovery/dropdowns without capability separation. Prefer a dedicated search setting on the existing connection page. Current tool effects include network, with confirmation in ask mode and existing assist/full behavior. Tool snapshots, cancellation and provenance must apply to both new operations. No server/background runtime is currently part of the app.

## Native browser follow-up

The credential-free native Edge probe at localhost:5185 observed readable HTTP 401 JSON from GET `/usage`. POST `/search` and `/extract` without credentials returned `TypeError: Failed to fetch`. Curl confirmed those gateway 401 responses omit Access-Control-Allow-Origin. Thus preflight success does not establish actual error-response CORS; authenticated POST success remains unverified. The UI must use the readable connection test for auth checks and describe opaque POST failures as network/CORS/service failures without claiming a known billing outcome. No backend/proxy is introduced. Reproducer: `../validation/cors-browser.cjs`.
