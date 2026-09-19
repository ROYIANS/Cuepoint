# Independent web research review

Date: 2026-09-19. Reviewer: trellis-check. Scope: web research child only.

## Findings (fixed)

- File: `src/lib/ai/tavily.ts`
  - Issue: a 24,000-character page excerpt could exceed the durable tool-result ceiling after JSON escaping.
  - Fix: implementer added a 60,000-character serialized read-result ceiling and truthful truncation; worst-case escaped response regression is present.
- File: `src/lib/agent/webTools.ts`
  - Issue: an accepted 2,048-character URL exceeded the 2,000-character approval-preview entry ceiling.
  - Fix: implementer bounded the display preview separately, preserving exact arguments; actual runtime preparation regression is present.
- File: `src/lib/ai/tavily.ts`
  - Issue: clipping provider URL strings before validation could fabricate a different link target.
  - Fix: implementer validates complete provider links and rejects overlong or secret-bearing targets; search and extraction regressions are present.

All three findings were communicated during read-only review and confirmed fixed after source handoff. Reviewer made no product-source edits.

## Findings (not fixed)

No remaining concrete in-scope defect found. Authenticated live Tavily search/extraction is unverified; mock transport/native browser results do not establish live account behavior. Existing production bundle-size warnings remain outside this feature's scope.

## Verification

- Lint: PASS, implementer handoff (`pnpm lint`, TypeScript build).
- TypeCheck: PASS, same lint command; no separate ESLint configuration exists.
- Tests: PASS, implementer handoff: 71 files / 873 tests; focused web + upgrade suites 3 files / 43 tests. Full suite was not repeated because no source edits followed the successful gate.
- Production build: PASS, independently executed with explicit local pnpm; Vite completed in 19.48 seconds, retaining the existing large-chunk warning.
- `git diff --check`: PASS, independently executed.
- Native browser: main-session PASS; reproducible fixture, screenshots and limitations are documented in `../validation/quality.md`.

Final source inspection covered strict argument/URL boundaries, secret redaction and export isolation, configuration revision capture, network permissions, both actual tool protocols, saved-result replay, cancellation, late deletion, post-service persistence failure retaining unknown outcome, source presentation, skill defaults and task observation versus completed-result evidence. UI links render plain text and use safe external-link attributes without automatic remote images or HTML execution.

Web child source is ready to freeze for the subsequent image-discovery implementation. No installs, commits or paid requests were performed by this reviewer.
