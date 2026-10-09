# E01 AU02/PU10 bounded static correction

Producer: native `trellis-implement`, 2026-10-09. Corrected only `TaskInspector.tsx` and `VoiceLibrary.tsx` after main's same-version checkpoint reported two new exhaustive-deps warnings. Scope excludes SS06 and all other product/test/fixture/runner files.

Each owner now destructures `requestDeparture` from the existing guard result. The callback is memoized by the guard; the effects call and depend on this stable binding directly. TaskInspector's registration effect and child prop use the same binding. The freshly allocated `departure` object stays outside effect dependencies and is used only to render confirmation. No suppression, global registry or effect loop workaround was added.

## Exact correction attribution

Before values match the source reported at main's E01 checkpoint and the completed implementation report. Snapshots of both states are under `e01-drafts-static-fix/before/` and `after/`; `source-snapshot.json` stores the two pairs. Current source matches the final values.

| Path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `src/components/agent/TaskInspector.tsx` | `9e35b5c1fce11029e0ff4b6550141b2f06588cfd9f1fa40364f6ed2c50cd4068` | `df65fc0f2e554bef8a7824a62bb6e2576232203787524df2989db2f0ab760c53` |
| `src/components/audio/VoiceLibrary.tsx` | `74763a35d6fb7093afa5047fb094354ea7de9083b0a675d45f8afac0b48ce71a` | `26f9c8b7cc7a4aba3731d76fa987330726fbd4604397d75a8fe39ea8e361ca4e` |

## Executed verification

- `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint` — exit 0; `e01-drafts-static-fix/typecheck.log`.
- `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/e01ManualDraftDeparture.test.ts tests/b02MemoryPromotion.test.ts tests/manualDraftBaseline.test.ts tests/manualDraftWiring.test.ts tests/agentTaskWrapup.test.ts tests/agentTaskOrchestration.test.ts tests/mimoSpeech.test.ts tests/mimoRuntime.test.ts tests/audioFoundation.test.ts --maxWorkers=4` — exit 0; 9 files and 119 tests passed; `e01-drafts-static-fix/focused.log`.
- `E01_PLAYWRIGHT_PATH=/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs E01_CHROMIUM_PATH=/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell E01_OBSERVATIONS=.trellis/tasks/10-09-src-remediation-e/research/e01-drafts-static-fix/native-observations.json /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/e01-drafts-browser-regression.mjs` — exit 0; all 19 existing native cases passed; `e01-drafts-static-fix/native.log` and `native-observations.json`.
- `git diff --check -- src/components/agent/TaskInspector.tsx src/components/audio/VoiceLibrary.tsx` — exit 0.

The unmodified permanent runner again executes production Radix/TanStack/native IndexedDB owners, including repeated continue/reject/switch operations for the two corrected effects, pending/failure retry, actual sidebar/board/new-topic/current-thread deletion callbacks, stale completion, reference imports, durable offline audition/media retention and generic non-text focus restoration. It asserts a single explicit fixture main-document request and zero browser errors. No paid provider call or browser installation occurred.

## Evidence preservation and limits

The two original implementation reports and all 82 files under `research/e01-drafts/` remain byte-identical: 84 preserved files verified against `e01-drafts-static-fix/preserved-evidence-before.json`. This includes original source snapshots, freeze manifest, successful logs/observations and preserved failure artifacts. New correction reports and all new proof live separately; the original report remains a historical producer snapshot.

No stage/commit/push, task-status/spec/ledger changes or SS06 source edits were made. Main's complete static/AST rerun and independent integrated acceptance remain pending; this report claims actual type/focused/native proof, not a completed global static gate.
