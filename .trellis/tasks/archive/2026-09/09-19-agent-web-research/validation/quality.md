# Web research quality record

Date: 2026-09-19. User approved implementation with `ok`. Product source/tests belong to the assigned implementer and final reviewer; main independently owns native browser verification.

## Native browser verification

PASS: `validation/web-browser.cjs` uses actual Edge, isolated IndexedDB and real Agent runtime with intercepted model/Tavily requests. It exercises:
- actual Connections UI configure, enabled checkbox, GET usage test, save and reload;
- one usage GET, no search on testing/saving;
- real Chat and Responses tool loops: search → read → answer, three model requests each;
- exactly two search POSTs and three extract POSTs (third is task research);
- no key in model payloads, run/tool/message records;
- actual task research observation saved in native IndexedDB; web read does not prove creative completion;
- ask-mode durable approval and rejection without service request;
- ordinary conversation mode has no tools;
- source details at 1440px and 390px, no horizontal overflow;
- saved key not repopulated, keyboard Escape, mobile connection dialog, key removal;
- reload/removal causes no additional service request; no page errors.

Screenshots: desktop.png, mobile.png, connection-mobile.png. All source/result text is fixture data; screenshots do not certify a live search or live model's reasoning behavior.

## Live credential-free feasibility

`cors-browser.cjs` confirms readable 401 JSON from GET usage. Unauthenticated search/extract gateway responses omit CORS and surface generic fetch failure in the browser. OPTIONS succeeds. See research/provider-feasibility.md. No valid account key or successful billed provider call was used; authenticated search/extraction quality remains unverified.

## Automated and independent gates

Implementer final gate: lint/type-check PASS; full test PASS 71 files / 873 tests; new suites plus schema upgrade PASS 3 files / 43 tests; git diff --check PASS. Independent source review fixes verified. Independent reviewer production build and diff check PASS; final report: research/review.md. No unresolved scope findings. No commit or archive yet.
