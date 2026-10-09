# E01 AU02 / PU10 implementation report

Producer: dispatched native `trellis-implement`; date 2026-10-09. Owned implementation and verification are complete. Integrated independent acceptance/static comparison remains with the coordinator. No task status, spec, parent ledger, package/lock/CI, staging, commit or push was changed by this producer.

## Behavior and ownership

`useManualDraftGuard` keeps its existing route-only return/API and same-path search semantics. The compatible `useManualDraftDeparture` extension accepts owner-local departure requests and a synchronous state reader. Clean owners leave directly; dirty owners expose continue/discard; pending owners cannot discard. Capture/continue restores connected focus, supported numeric caret positions and scrolling panes. Checkbox/number/range/date/color inputs never call an unsupported selection API.

Records freeze task/thread/project, input and expected record revision when opening. Every field, including source/Todo relations, participates in the opening JSON baseline. Input changes and pending locks publish synchronously to the inspector. Rejected persistence retains input/error/retry; successful save closes its initiating editor. Retired sessions cannot publish completion to a newer editor.

Wrapup drafts freeze content/revision and task/thread/project scope. Content and nested source IDs compare against the opening baseline. Manual creation/save publishes owner state synchronously, keeps CAS errors actionable and suppresses retired UI completion. Existing promotion epoch/session and source-body logic remains intact.

The inspector retains the previous task/thread/project before replacing its keyed content and before an external close. Its owner guard combines record/wrapup/editor states. Chat registers that departure callback and consults it before sidebar selection, opening the board, creating a new topic or deleting the current thread. New topic creation/deletion persistence begins only after dirty departure resolves. A cancelled board transition does not eagerly close the inspector.

Voice-library ownership similarly retains the prior project/editor before close or project replacement. Baselines cover name/mode/voice/instruction/reference/sample text. Reference import, audition and save publish synchronous pending state. Speakers retain their captured revision and project; failure keeps the draft/error. Successful preview/reference media stays in native project media after local discard. No generation-media cleanup was added.

## Final commands and observed results

- `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint` — exit 0; `e01-drafts/typecheck-final.log`.
- `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/e01ManualDraftDeparture.test.ts tests/b02MemoryPromotion.test.ts tests/manualDraftBaseline.test.ts tests/manualDraftWiring.test.ts tests/agentTaskWrapup.test.ts tests/agentTaskOrchestration.test.ts tests/mimoSpeech.test.ts tests/mimoRuntime.test.ts tests/audioFoundation.test.ts --maxWorkers=4` — exit 0; 9 files / 119 tests; `e01-drafts/focused-final.log`.
- `E01_PLAYWRIGHT_PATH=/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs E01_CHROMIUM_PATH=/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell E01_OBSERVATIONS=.trellis/tasks/10-09-src-remediation-e/research/e01-drafts/native-observations.json /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/e01-drafts-browser-regression.mjs` — exit 0; 19 native cases; `e01-drafts/native-run-15.log` and `native-observations.json`.
- `B01_PLAYWRIGHT_PATH=/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs B01_CHROMIUM_PATH=/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/b01-browser-regression.mjs` — exit 0; 19 existing B01 native compatibility cases; `e01-drafts/b01-compatibility-01.log`.
- Owned tracked whitespace check — exit 0. Frozen current file hashes still match `frozen-inputs.json`.

The E01 runner creates its own Vite cache and explicit permanent HTML entry, uses port 5197 with strict binding and disables HMR/task-evidence watches. It asserts that the only main-frame document request is the initial `/tests/fixtures/e01-drafts/` entry. TanStack browser-history PUSH/POP transitions and IndexedDB are native. Persistence wrappers wait/reject before the business command and call that real command on successful paths. Reference imports run actual validation/decode/storage; audition intercepts only offline MiMo HTTP transport and runs actual durable prepare/submit/result/media logic.

## Native observed cases

- PASS: record unchanged new/existing forms leave clean; edit then revert is clean
- PASS: record source-only edits dirty the actual form and revert cleanly
- PASS: record Escape/close/backdrop continue preserves exact input, caret and scroll
- PASS: record local task replacement/SPA/back cancel retains owner; discard replaces deliberately
- PASS: record failed save and pending departure/duplicate actions retain frozen input and retry
- PASS: wrapup opening baseline clean; exact dirty text survives cancel and owner board
- PASS: wrapup pending Escape/route, failure retry, sources and deliberate discard
- PASS: voice unchanged baseline clean; name/mode/instruction/sample revert and dismissal
- PASS: voice project switch/external close/SPA/back/forward cancellation freezes owner
- PASS: voice pending/failed save preserves text; retry writes captured revision/project
- PASS: native forward blocked then discard; discarded voice never saved
- PASS: voice reference import pending/failed retry uses owned bytes and dirty reference retention
- PASS: voice actual durable audition pending/failed retry and preview media survive discard
- PASS: actual AgentChatPage thread selection and task board route retain record draft
- PASS: retired pending record completion cannot publish into a newer mounted editor
- PASS: retired voice save completes only for captured owner and preserves new record input
- PASS: retired wrapup save completes without replacing a newer voice editor
- PASS: shared guard continues number/range/date/color input focus without unsupported caret APIs
- PASS: actual AgentChatPage current-thread deletion waits for deliberate draft discard

## Exact file attribution and snapshots

Before values below come from `E01-entry.json` and were checked against the baseline Git object. New files have null before hashes. Current owned bytes match the freeze. Self-contained source copies are in `e01-drafts/before/` and `e01-drafts/after/`; permanent fixtures import production source only and never these snapshots.

| Owned changed path | Before SHA-256 | Final SHA-256 |
| --- | --- | --- |
| `src/lib/useManualDraftGuard.tsx` | `a5a93b4da49c5aa67b900d2e57ea531500943309173b5556cacad03450c12722` | `5a03a40952c23b909e772f50b2b58e8488069ed6df5c4eca62bae9033923bde8` |
| `src/components/agent/TaskRecords.tsx` | `d0af44a69eebe5027270cf7ee5be839c52770dc7594eb2a43c70105abc2b4a11` | `d9c6166b7a55d20edc96e0995a5faadfc3a599df155cbaeeefe8297acd67c5d1` |
| `src/components/agent/TaskWrapup.tsx` | `e3dfd7266c829e9201fe40de48a04edfdf5db05a2e43de31cc09a4af28d77403` | `c5e9f1355b0d8007b1c4893f0a6efa93cc66a09744c781451ef06a5b95a42dfd` |
| `src/components/agent/TaskInspector.tsx` | `89486dc294d14aa31aba1ff6f5639e6e233d8f25afc75dfa9f67e3f4f0147649` | `9e35b5c1fce11029e0ff4b6550141b2f06588cfd9f1fa40364f6ed2c50cd4068` |
| `src/components/agent/AgentChatPage.tsx` | `f7ff686baf6314bc1baf0f64463a8e5a0601a56baeffcb76a618b864d54c27b1` | `ea05a790625b4db05cb6f09436039b71b2d627bdece8cbd3346401769e5be806` |
| `src/components/audio/VoiceLibrary.tsx` | `aad7de9f26264e34831c025de307a0251fb473f57737a0b8714d24017ae7414e` | `74763a35d6fb7093afa5047fb094354ea7de9083b0a675d45f8afac0b48ce71a` |
| `tests/b02MemoryPromotion.test.ts` | `620dc5afe0b000915f23c1c43215dc00d485973bbd2869ab4ccea489d7f34cce` | `7bed868e95e387e58f17779ab15200a6f412f78a47dfc189ac01a4c6696968e2` |
| `tests/e01ManualDraftDeparture.test.ts` | `null (new)` | `b44cc1567a4901908d041fab401e64927bc1f9b5db6e8e88f44331c82b36c5f7` |
| `tests/fixtures/e01-drafts/index.html` | `null (new)` | `14177fc1bd95ba9ead5f640c4843a79f1bdf54ee1809eef1123647a64e7d00c1` |
| `tests/fixtures/e01-drafts/harness.tsx` | `null (new)` | `95420c7a8ffe43226d7f6edf331f94b97f62445fb6a1f4c47d7af71b7a083be3` |
| `scripts/e01-drafts-browser-regression.mjs` | `null (new)` | `cd378d61f56a4625a991e5ca528a699cb101e50f022c8b346c1914a6426b1987` |

The B02 test host gains a callback mock so its actual TaskWrapup sessions can execute the shared guard; its existing promotion assertions remain unchanged. Added focused guard cases exercise actual callbacks, synchronous pre-rerender state, captured stale discard refusal and retryable discard failure; they are not a replacement for native outcomes.

## Preserved failures and limits

All native attempt logs remain under `e01-drafts/native-run-01.log` through `native-run-15.log`. Failed attempt artifacts are copied into corresponding `native-run-NN-failure/` directories (HTML compressed without content changes, plus PNG/JSON). Initial failing/repaired TypeScript logs also remain. Earlier failures include the incorrect audio fixture constructor, selectors that did not match production labels/details or stale-summary rules, an unobserved batched local selection, and the real checkbox selection API error fixed in the guard. Later runner assertions use real player/board names and observe repository settlement rather than merely request count. No assertions/timeouts were loosened to manufacture PASS.

The sidebar is correctly inert under the inspector modal; the test dispatches DOM clicks to its actual rendered callbacks for integration. This does not claim ordinary pointer or accessibility reachability behind a modal. Real Escape/close/backdrop and board buttons use browser keyboard/pointer events. Real paid providers, WebKit/mobile and OS beforeunload prompt presentation are not tested. Existing promotion candidates remain conservatively owned while open; epoch compatibility is covered by the existing B02 session suite.

SS06 source/fixture/runner edits were preserved and excluded from this producer's file ownership. Main owns full static/value-graph comparison, full E integration tests, independent check, specs and ledger closure. The machine pnpm/node paths above were used throughout; Codex runtime was used only for the provided browser import/executable, with no browser dependency install.
