# Root remediation evidence

## PERF02: Agent route loading

Rollup module output from the original source showed a ~8.15 MB route chunk. Largest contributors included elkjs (~1.61 MB rendered module), Octicons JSON (~1.02 MB), KaTeX (~602 KB), and the full model/provider icon mapping. MessageList is now a lazy boundary loaded only for nonempty conversations; it preserves the original scroll element, ResizeObserver, memo rows, and the long-lived AgentChatPage runtime. Model/provider icons load through a named export adapter with stable-size decorative placeholders. No library or provider protocol is replaced.

An intermediate production build emits Agent route 1,608.56 KB (gzip 515.28 KB), lazy MessageList 3,530.27 KB (gzip 910.10 KB), lazy ModelIconCatalog 3,033.36 KB (gzip 579.25 KB). This defers costs, not deletes features; nonempty history still downloads rich rendering and a configured model downloads the vendor catalog. Large-chunk warnings remain truthful.

Same baseline scenario: fresh Edge 153 context, 1440x900, Vite preview, CDP 5 Mbps / 40ms, no configured connector. Observed Agent JavaScript transfer fell from ~2,415 KB to 900.5 KB, and no MessageList/ModelIconCatalog was requested. The page content was visible at 2,476 ms. Network-idle occurred at 16,648 ms vs original ~19,000 ms; this includes external resources/loading and must not be presented as an interaction latency. Projects transfer remains ~316.9 KB. Raw records: cold-routes-after.json. These are local samples, not production SLOs.

## Q01: publication checks

GHCR workflow has a quality job for pull requests, main, tags, manual runs. It installs the locked dependencies with package.json-pinned pnpm and Node22, then runs TypeScript, full Vitest, model snapshot verification and production build. Docker needs the quality job, never publishes on pull_request, and alone has packages write permission. Workflow was reviewed locally; no remote CI run or image publication performed.

## D01–D04 bounded cleanup

- Retained documented local generationIntent/productionContext contracts; aligned quality/version projection and validation with domain/output. Added 4 integration cases through context -> prepare -> validate; video and incompatible model parameters reject. Spec distinguishes this legacy APIMart-only contract from the active Agent's separate AIHubMix adapters.
- Agent worker owns obsolete SSE parser removal and meaningful active streaming tests (D02).
- Common final-submit checks and credential redaction owned by Agent; no protocol-level merger (D03).
- Removed unused StudioField plus PropLibraryPage/StyleLibraryPage re-export files, using repository-wide reference search. Updated references in specs. Removed only-tested context wrapper getModelContextReference and moved assertions to active resolveModelMetadata. Consolidated duplicate task sheet width CSS to its existing effective 600px. UI worker unified generated-target typed links including exact shot search (D04).

## Independent browser checks

- draft-browser.json: clean cross-tab rebase, unrelated field preservation, same-field conflict retains local/remote, explicit latest action and navigation flush passed; no page errors.
- integrated-agent-browser.log: real browser execution with mock providers, both Chat Completions and Responses, exact image pixels + research, foreign project rejection and ambiguous image disambiguation passed; no page errors.
- Production shot performance + UI/blocker checks are recorded by UI worker. Final full suite/build and independent review follow after all workers settle.

## Final production validation

After the final build, lazy-chat-production.json verifies empty home defers rich transcript/icons, a 50-message conversation renders Markdown, the model picker loads icons, the list initially pins to bottom, and user-selected reading position remains unchanged; no page errors. Shot benchmark repeated on final build: 10/200/1000 ready135/131/165ms; DOM684/874/1674; input25,16,16 / 15,35,18 / 65,86,31ms. Interim measurements retained in shot-production-interim.json; final report uses final samples. Route smoke: 22 routes × 3 widths, no page errors/document overflow.

Final gates after the independent alias-summary fix: 79 files / 975 tests passed, TypeScript passed, Vite build passed, git diff --check passed. Model snapshot verification passed (197 files, 85 providers, 1855 models). Independent reviewer passed72 targeted tests and found no remaining confirmed blockers.
