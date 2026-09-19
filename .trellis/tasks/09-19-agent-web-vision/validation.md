# Integrated acceptance

Date: 2026-09-19. Both implementation steps were approved in one integrated review; web was verified before image activation.

| Requirement | Evidence | Status |
| --- | --- | --- |
| AC1 web research and traceable sources | web child native UI + both protocol loops + task observation + network lifecycle tests | PASS |
| AC2 named-project image with no attachment | image child native exact PNG, Chat and Responses, project-references alone, unbound conversation remains unbound | PASS |
| AC3 combined research and image | same native run discover/read/search/extract; both protocols final request includes exact image bytes and external extracted source text | PASS |
| AC4 ambiguity, absence, lifecycle, capability and scope | native duplicate project/bound foreign checks; focused discovery/transport tests and independent review | PASS (including post-digest replacement regression) |
| AC5 gates and closeout | independent final lint, 72 files/891 tests, production build and native post-fix verification; both child reviews passed | Engineering PASS; commit approval/archive pending |

## Cross-child regression
After image integration, web-browser.cjs passed again: Connections UI save/test/remove, GET usage only on testing, full Chat/Responses search/read loops, task research observation, ask-mode rejection, no-tools conversation, no secret leak, reload without service replay and mobile/keyboard behavior. No page errors.

## Native image and combined evidence
image-browser.cjs passed after episodeLabel update. Four real runtime loops in isolated Edge IndexedDB: two image-only runs (3 model requests each), two combined runs (5 model requests each). Combined requests make exactly two mocked search POSTs and two mocked extract POSTs in total. Source links retain shot identity, keyboard Enter opens the actual storyboard page, desktop and 390px layouts have no horizontal overflow. Screenshots are held under the child validation directories.

## Truthful limits
The model tool sequences and service responses are fixtures. They prove the application sends exact pixels and source text, not every live model's discovery choices or search quality. Tavily credential-free GET usage works; rejected POSTs can be opaque because the gateway omits CORS headers. Authenticated POST quality remains untested; no paid service or extra hidden model was used. Production build retains the existing large-chunk warning.

## Git closeout
No commits, push or task archival for this feature until the concrete work commit batch is approved. All dirty paths belong to this integrated task; no unrelated user modifications have been observed.
