# Verification — APIMart adapter foundation

Date: 2026-09-18

## Approved chat-model restriction follow-up (R8)

- Implemented shared connector-scoped policy for discovered, manual-search and saved model options. Known APIMart image/video/audio IDs cannot be reinserted; unknown custom IDs remain allowed after successful metadata discovery.
- Old incompatible selections show a warning and disable sending without modifying history. The independent send guard validates before thread/message writes and chat transport, preserving drafts on rejection. Selection changes/abort during verification prevent downstream execution.
- Added policy and executable send-guard regressions using fake-indexeddb and the real chat transport with mocked HTTP; rejection asserts zero new messages/threads and zero chat POSTs.
- Final full-scope review: no remaining concrete findings, no corrective edits.
- Final lint/TypeScript: passed. Final Vitest: **21 files / 187 tests passed**. Production build: passed in **17.40 seconds**. `git diff --check`: clean.
- Build warning remains: Agent chunk approximately 7,895.78 kB / 1,903.68 kB gzip. No paid provider or credential-based browser calls were made; follow-up interactions are covered by code review and automated tests, not a live authenticated browser session.

## Results

The following results describe the original adapter implementation before R8; final counts are above.

- Full-scope Trellis check: no remaining concrete task-scope findings; no corrective changes required.
- TypeScript / lint: passed.
- Vitest: 20 test files, 164 tests passed, including 53 APIMart client contract tests.
- Production build: passed in 27.40 seconds. Vite warns about chunks over 500 kB; the Agent chunk is approximately 7.895 MB / 1.903 MB gzip.
- `git diff --check`: passed before final bookkeeping edits.

Commands used the explicit machine pnpm executable `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`, not the Codex Runtime pnpm.

## Browser smoke

Opened `http://127.0.0.1:5173/connectors` through the in-app browser:
- APIMart card appears alongside existing providers.
- Install dialog displays `https://api.apimart.ai/v1` and provider-specific description.
- Testing without a key displays `请填写 API Key`.
- Final connection page visually renders correctly.

Configuration save/edit/reload/disconnect and ZIP secret exclusion were verified in isolated fake-indexeddb tests rather than saving test credentials in the user's browser.

## Scope and limits

No real credentials were accessed and no paid generation request was submitted. Live APIMart browser CORS, account-specific models and actual generated assets remain unverified. API tests use official-contract fixtures. No generation entry point, persistent job, scheduler, result download or slot mutation was introduced.

Pre-existing `.tanstack/` remains untouched and excluded from the proposed commit. The user authorized committing the product code and planning artifacts on 2026-09-18; archive bookkeeping follows the code commit.
