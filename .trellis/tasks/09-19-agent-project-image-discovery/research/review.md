# Independent image discovery review

Date: 2026-09-19. Reviewer: trellis-check. Scope: project-image discovery and coexistence with the verified web-research child.

## Findings (fixed)

- File: `src/lib/agent/imageDiscovery.ts`
  - Issue: `validateDiscoveredInput` resolved the current locator before asynchronous media hashing, but did not resolve it again afterward. During the final post-encoding digest, a user could replace a slot association while the old media remained available. The remaining media/project/run checks did not detect that change and old-slot pixels passed materialization.
  - Fix: re-resolve the same saved discovery candidate after hashing, retaining source revision, ownership, withdrawal and association checks. The regression changes the slot during the third Blob read (pre-encoding digest, encoding, post-encoding digest); it failed before the fix and passes afterward.
- File: `tests/imageDiscovery.test.ts`
  - Fix: added the above race regression. Existing six encoding-race cases remain green.

## Findings (not fixed)

No remaining concrete in-scope defect found. The main session owns spec edits and was notified to capture the post-digest source recheck in the new image-discovery spec. Its approved contracts otherwise match the inspected code.

Live model interpretation is not certified by deterministic fixtures. Tests establish discovery, scope, provenance and exact pixel delivery, not that every live model will interpret every natural-language request correctly. Authenticated live Tavily service behavior remains separately unverified as recorded by the web child.

## Verification

- Lint: PASS, independently rerun after the fix with explicit local pnpm.
- TypeCheck: PASS, project lint runs `tsc -b`.
- Tests: PASS, independently rerun full suite after the fix: 72 files / 891 tests. The new image suite has 18 tests. The regression was observed failing before the fix.
- Production build: PASS, independently rerun after the fix; existing bundle-size warnings remain outside scope.
- `git diff --check`: PASS.
- Native browser: main-session initial and source-UI checks passed before the final fix; main is rerunning the fixture after the fix and records authoritative native results in its validation artifacts.

## Reviewed integration paths

- Unbound reference skill retains only discovery and image reading; ordinary conversation mode remains tool-free. Existing bound attachments/document reads retain their scope rules.
- Discovery resolves exact project/shot names before partial matches, preserves ambiguity and pagination, distinguishes current/reference/candidate sources, and reports unavailable current images without fallback.
- Discovered reads derive project/media/locator from a completed same-run discovery ledger. Materialization additionally requires the completed same-run read ledger and exact saved input; raw unbound media access and cross-run provenance fail.
- Both wire protocols preserve selected-model capability, ten-image and 10 MiB limits, pre/post encoding checks, response envelopes and idempotent image pairing. Immutable media IDs remain the repository contract; digest checking also detects changed bytes at the saved identity.
- Later turns use persisted chat history, not old tool continuation inputs; historical reference-tool reads remain suppressed, and evidence retains source identity without claiming creative completion.
- Source UI uses internal project targets and explicit project/episode/entity/slot labels and source category; it does not execute source HTML or load external images. Web and local image source components coexist independently.

No installs, commits, external messages or paid requests were performed by this reviewer. Product source ownership returns to main after this report.
