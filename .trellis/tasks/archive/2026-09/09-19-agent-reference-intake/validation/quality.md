# Reference intake quality gate

Date: 2026-09-19. Scope: the single frontend package, including domain, IndexedDB, parser workers, provider transports, agent runtime, business media ownership, task evidence and composer UI.

## Checks

- Explicit machine pnpm: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
- Full Vitest suite: **67 files, 818 tests passed**.
- `pnpm lint` (TypeScript): passed.
- `pnpm build`: passed. Vite reports large output chunks; lazy parser workers build successfully. This feature does not include a general bundle-size redesign.
- `git diff --check`: passed.
- Independent implement/check workflow: `research/review.md`; all identified findings fixed with regression coverage.

## Native browser evidence

Disposable headless Microsoft Edge profile at `http://127.0.0.1:5185`, isolated IndexedDB, generated fixtures and mocked providers. No user database, real provider credentials or paid requests.

`validation/browser-regression.cjs` verifies:
- Native PNG, Markdown, selectable PDF and DOCX import; actual workers, extracted content and source preview.
- Same-project duplicate reuse and search, foreign-project rejection, project media generated-image reuse.
- Both Chat Completions and Responses through `executeChatRun`: selected image+DOCX and tool-requested generated image. Assert real inline pixels, current selected model, one paired tool call, exact request count, and no persisted Base64.
- A 180-descriptor task evidence fixture in native IndexedDB; deduplication, snapshot and withdrawal staleness without premature transaction commit.
- Real file input, library search, attachment selection/preview, nested Escape handling, removal of the empty attachment strip, draft context coverage, and 390px layout without horizontal overflow.
- Home project/model selection → attach image → send with a known non-vision model → new thread preflight rejection: both text and attachment survive; provider POST count is zero.
- No browser page errors during the full UI/protocol regression.

`validation/pdf-browser.cjs` invokes `pdf-fixtures.py` using the desktop dependency Python, then verifies real browser PDF.js behavior:
- Chinese CID-font text: ready, correct Chinese extraction.
- Raster-only PDF: explicit failure explaining no OCR and supported alternatives.
- Mixed text/raster PDF: partial, exact missing page 2 disclosed.
- Password-protected PDF: explicit unlock-and-upload guidance.
- Invalid PDF: explicit re-export guidance.

Reproduction: start Vite on port 5185 using the explicit pnpm, then run the two `.cjs` scripts. Scripts use the installed desktop Playwright/Edge and Python fixture libraries; no new application test dependency. Generated PDFs/screenshots remain under `/tmp/reference-intake-*`.

## Scope limits

This gate verifies provider payloads with mocked HTTP, not a paid end-to-end provider response. Actual visual interpretation quality depends on the chosen provider/model. Only verified native visual capability is accepted; unknown models are rejected rather than guessed. No OCR, audio/video parsing, DOCX layout fidelity, vector search or automatic long-term-memory promotion. Image token counts are explicitly approximate.
