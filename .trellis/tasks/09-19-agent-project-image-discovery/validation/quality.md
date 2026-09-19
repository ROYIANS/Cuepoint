# Project image discovery quality record

Date: 2026-09-19. Implementation approved together with the web child. Web source review, native browser verification, lint, 873 tests and production build passed before this child was activated.

## Native Edge verification
PASS: `image-browser.cjs` uses isolated real Edge IndexedDB and real Agent runtime with intercepted model/Tavily calls.
- Image-only: project-references alone enabled; Chat and Responses each run discovery → read → answer. Unbound natural-language request has no attachment. Exact canvas PNG bytes reach the next model request in the correct wire format.
- Combined: Chat and Responses each run discovery → read → search → extract → answer. Both exact PNG and external extracted text reach the final request. Exactly two searches and two extracts across both runs.
- No conversation binding mutation, no persisted encoded pixels and no search key in model or tool records.
- Bound foreign project discovery fails. Duplicate project names return explicit ambiguity and no candidates.
- Desktop/390px source labels; keyboard Enter on the actual source link opens the correct shot route and retains shot identity. No horizontal overflow and no page errors.

Screenshots: desktop.png, mobile.png, combined-mobile.png, combined-web-mobile.png. The first UI check used an incorrect expected page heading; fixed the fixture to match actual “制作分镜” and reran successfully. This was a fixture-only adjustment.

Main noted an empty default episode title could hide episode identity in source labels. Implementer reused episodeLabel for labels and matching; final native rerun PASS with the corrected labels and both combined-source screenshot positions.

## Automated and review gates
Implementer handoff: lint/type-check PASS; full suite PASS, 72 files / 890 tests; diff check PASS. Independent reviewer reproduced and fixed a post-digest locator race, then independently reran lint/type-check, all 72 files / 891 tests, production build and diff check: PASS. Main reran the complete native fixture after the fix: PASS. Review: research/review.md.

## Verification limits
All source/result/model text is deterministic fixture data. No authenticated Tavily POST or live model reasoning is certified, and no paid requests were made.
