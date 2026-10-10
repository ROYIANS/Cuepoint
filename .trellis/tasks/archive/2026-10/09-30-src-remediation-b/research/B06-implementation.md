# B06 implementation evidence

2026-09-30. Scope: ConnectorsPage, StoryPage, tests/b06EditorSessions.test.ts only; implementation agent does not change specs, ledger, task status or commits.

## Risk proof before implementation

Actual production component callbacks in a deterministic hook host, with deferred provider/File.text promises and real useDebouncedDraft + fake IndexedDB. No copied callback logic. Command: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b06EditorSessions.test.ts`. Exit 1; **2 tests / 2 failed**. Log: `/tmp/b06-red.log`.

- SS-07: A probe pending → dialog close → open B → B probe pending → A resolves. Actual toast published `探活成功，可见 1 个模型` despite B owning editor. Assertion for no stale toast fails.
- PU-07: File.text pending → actual textarea callback edits script → same callback reverts to original → file resolves. Actual script became `imported`, expected `original`. Detecting only text equality cannot protect edit-then-revert.

These observations demonstrate triggers behind the prior risks; coordinator retains finding/ledger closure authority.

Baseline SHA256:
- ConnectorsPage.tsx: `0554575f0d59926d53ad3b0884af0a7bf523599c8e463eb12e050c9fb4c64dd0`
- StoryPage.tsx: `b81972c3ce4d63879857b9ced56528762ca58be67dbccffcabc74b6ed87e56c6`
- Initial two-test proof: `fdc055096473ac812faf42fa52617335208fb47692194101dc08f77666c2a82a`

Read state-management.md directly from disk: reliability/concurrent drafts (486–530), manual CAS (653–725), B01 lifecycle (727–766). Keep changedDraftFields and actual draft hook/CAS; useLatest must invalidate file ownership. Mounted effects must restore true on setup after cleanup. Tests model actual setup→cleanup→setup, without claiming ReactDOM StrictMode coverage.

## Final implementation

`ConnectorsPage.tsx` uses a local editor-session object identity (the editor epoch) and a separately owned operation identity. Ref acquisition happens synchronously before awaiting provider/repository calls. Each operation freezes a credential object; test and nested model list share that object. Each post-await publish, catch and finally verifies mounted + editor identity + operation identity. A credential edit cancels the current read's ownership synchronously, clears that read's visible busy/models, and permits a new operation; the old finally cannot release it. Close/reopen similarly retires old ownership. Old-render action/close/input callbacks reject when their session differs. Provider signatures are unchanged; no transport AbortSignal is available and no transport cancellation is claimed.

Save/disconnect share the same synchronous lock; repeated same-render callbacks cannot overlap either write or read. The pending form is retained. Credential inputs/card opens/actions are disabled, the standard close button is hidden, and Escape/outside dismissal is prevented; onOpenChange and direct open/change/action callbacks enforce the lock even before rerender. Disconnect remains only in the dialog footer. Successful writes finish the initiating editor; failures retain it and unlock retry. Current errors redact the frozen key and Bearer credentials before a 300-character bound. Unmounted completions publish neither state nor toast. Effect setup restores mounted=true after cleanup/setup replay.

`StoryPage.tsx` adds a component-local import session with episode/project scope, request sequence and script revision. Every manual script change increments revision, including reverting to the original text. Supported reads clear older candidates immediately; only the latest still-mounted request can complete. An unchanged revision accepts the file normally; edits during reading preserve current script and display the frozen filename/text with explicit adopt/discard. Captured candidate callbacks check current candidate identity, so superseded/discarded/adopted candidates cannot act again. Further script editing while a candidate is visible preserves the candidate until explicit choice. Title/logline update closures capture event values and merge into current draft. File failure reports a generic retry message and keeps the draft. Actual DraftStatus useLatest retires request/candidate before delegating to existing baseline adoption; its original in-flight/CAS behavior is unchanged. Unmount/scope replacement retires imports. The drop callback also rejects after unmount before setDragging. Filename/MIME acceptance and no automatic scene splitting are unchanged. Existing useDebouncedDraft/changedDraftFields/repository CAS remain the persistence path.

## Verification and limits

Final command (exit **0**):

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b06EditorSessions.test.ts tests/debouncedDraft.test.ts tests/draftConcurrency.test.ts tests/connectors.test.ts tests/connectorMigration.test.ts
```

**5 test files / 171 tests passed**, including **51 B06 cases** and 120 existing focused draft/connector cases. Final log: `/tmp/b06-focused-integration.log` (17:40:02 local run). The earlier standalone 51/51 run is `/tmp/b06-focused.log`; final useLatest tests were then strengthened to execute the actual DraftStatus conflict button after an actual failed CAS write.

`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint` (tsc -b) exited **0**. Final log: `/tmp/b06-lint-final.log`. `git diff --check` exited **0**. For the new untracked test, `git diff --no-index --check /dev/null tests/b06EditorSessions.test.ts` emitted no whitespace diagnostics and exited **1** (no-index reports a content difference against /dev/null). No install/build/full Vitest/full-source gate was run in this implementation turn; coordinator owns the batch gate.

B06 test coverage:
- Both A/B completion orders for reopened editors, nested directory reads and file reads; stale returned errors/rejections; old finally while a newer operation is pending.
- API-key/base-URL changes, saved-key fallback, frozen first/nested credentials, first-stage cancellation without starting the old nested request, nested cancellation before publication.
- Same-render duplicate probe/test/save/disconnect callbacks; save versus disconnect serialization; inputs/card-open/dismissal locks, direct stale callbacks, successful real IndexedDB writes/deletion, error redaction and retry.
- Probe/test/save/disconnect success and failure after unmount; nested-read failure after close; real effect cleanup/setup replay.
- Script edits/revert, explicit adoption/discard and repeated old choices, edits after candidate creation, title/logline preservation, superseded candidate/read failure/retry, actual auto-save to IndexedDB, no scene splitting.
- Pending/candidate retirement via actual DraftStatus's visible useLatest action after real repository CAS conflict; file resolve/reject/candidate callbacks after episode unmount; filename/MIME compatibility; unsupported file behavior.

The fixture executes production component functions, their callbacks, useDebouncedDraft, actual effects and actual Dexie repository mutations over fake-indexeddb. It preserves useMemo/useCallback dependency identity; an initial overly simple callback mock caused repeated draft-effect cleanup and was corrected before final results. Setup→cleanup→setup runs actual effect bodies but **is not ReactDOM StrictMode coverage**. No DOM/Radix event delivery, browser drag/drop/File decoding, Dexie live-query scheduling, real-provider calls or paid requests are exercised. Deferred File.text and provider promises are controlled test boundaries. Unmount followed by a separate episode editor tests old file completions against a fresh editing scope; the test does not claim a new global cross-page draft policy.

## Coordinator contract comparison / handoff

Read the coordinator's 7-section B06 executable contract appended to `.trellis/spec/frontend/hook-guidelines.md`. No implementation mismatch identified: old finally requires operation ownership, script revisions count edit-then-revert, and useLatest invalidates pending/candidate before adoption. Session object identity implements the requested local epoch without a global registry/action factory. Closing/credential editing cancels publication, not the physical provider request, matching the stated API limitation.

Final SHA256 (source/test content, 2026-09-30):

| File | SHA256 |
| --- | --- |
| `src/components/studio/ConnectorsPage.tsx` | `98df061541d783f27e0942c28a8a8424f26dd2ff61212ca655b284f7dee09313` |
| `src/components/story/StoryPage.tsx` | `324c0fc0aae26791e298fc3e8a269287476c56dfcbc81431afd7a07884cb68c1` |
| `tests/b06EditorSessions.test.ts` | `85596f99c51f638a75775ff0f6c90c783a37890a17d09cc9cdf2d0adce3b5b0e` |

Ready for coordinator independent check; no independent PASS or ledger closure is claimed. No blocker. Only the two owned product files, the focused test and this report were authored in this turn. Existing B01–B05/coordinator changes remain in the shared working tree. No specs/ledger/task/status/commit/install changes, and no B07/E01/D03 expansion.
