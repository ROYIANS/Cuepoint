# B02 AU-01 implementation checkpoint

Date: 2026-09-30. Implement role only. **Ready for independent check; B02 remains in progress.** No independent-check or finding-closure claim.

## Scope and resulting behavior

Changed product files are limited to:

- `src/components/memory/MemoryPromotion.tsx`: intention button emits a source reference; parent supplies shared disabled/preparing state.
- `src/components/agent/TaskWrapup.tsx`: one synchronous ref lock serializes candidate requests across latest, previous confirmed and history documents. A request captures owner/source and epoch before reading. Only its mounted, matching preparing session can publish a cloned candidate. Failed reads unlock for retry; late unmounted completion cannot publish or toast. Editor callbacks validate their epoch, so old close/save/pending callbacks cannot alter a reopened session. Candidate-read pending is reported to the inspector. A session epoch key changes only after explicit close/reopen; active source refresh keeps the same editor. It prevents a batched close/reopen from reusing the explicitly closed editor's frozen snapshot, and is not used to discard an active draft or bypass the lock.
- `src/components/memory/MemoryEditor.tsx`: mount snapshot freezes normalized input baseline, tags, source, excerpt, owner, memory identity and initial expected revision. Current memory reads and conflicts use that frozen owner/identity. Incoming owner/memory/source identity mismatch preserves the draft and rejects writes, including an old-render submit callback. Source identity compares explicit fields, so equivalent sources reconstructed in different property insertion order remain valid. Live revisions preserve local edits and require existing explicit latest-revision reconciliation before advancing CAS.

Additional changed paths:

- `tests/b02MemoryPromotion.test.ts`: eight actual-component/callback regressions with actual Dexie repository validation and saves.
- `.trellis/tasks/09-30-src-remediation-b/research/B02-implementation.md`: this handoff.

No repository validation, A04 protocols, B01 product files, TaskInspector design, summary dirty-exit behavior, specs, metadata, status, ledger, dependency declarations or installs were changed. No commit/push/archive/spawn. No B03 implementation.

## Regression coverage

The new test file invokes actual TaskWrapup, ReviewDocument, MemoryPromotion and MemoryEditor functions/callbacks. A deterministic hook host retains state/ref cells, effect cleanup, old-render callbacks and supplied live-query results; captured editor queries execute against fake IndexedDB. Candidate reads are controlled deferred promises; real candidate lists are built from confirmed current/historical wrapups. Real promote/create/update repository operations remain in use.

Eight passing cases cover:

1. Rapid latest/history and repeated old-render callbacks before rerender issue exactly one repository candidate request. Source argument mutation after initiation cannot rebind selection. External candidate mutation and live summary refresh preserve cloned source/body/excerpt/owner; actual promotion persists coherent edited body and exact frozen ref/excerpt.
2. Failure releases shared lock; historical retry dispatches the correct summary. Active-session old callbacks issue no second read. Close/reopen rejects old close/save/pending effects and preserves current inspector pending state.
3. Explicit close and reopen before an intermediate rerender gets a fresh editor mount identity; active requests keep the same key and cannot replace an open editor.
4. An old request resolving after unmount cannot replace a remounted inspector's active editor; no old state writes/toast.
5. The same unmount/reopen boundary for an old rejected request.
6. Task/project replacement during a pending request cannot publish its candidate or dispatch old-owner callbacks.
7. Frozen baseline/tags/excerpt retain dirty close/route/unload blocker configuration. Changed identities reject both current and stale submit callbacks; restoring an equivalent source with reordered fields permits coherent original-session save.
8. Actual edit/CAS conflict preserves dirty draft through live revision changes. Explicit latest-revision acknowledgment advances CAS; subsequent real DB save retains the local body/tags and frozen query ownership.

Serialized alternative is intentional: concurrent same-parent requests are prevented rather than testing publication ordering for two accepted requests. Separate old/unmounted requests and old-session callbacks are exercised while a newer editor is active.

## Final validation on current source

Final focused command:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/b02MemoryPromotion.test.ts tests/projectMemories.test.ts tests/projectMemoryPackage.test.ts tests/agentMemoryTools.test.ts tests/memoryInclusion.test.ts tests/memoryRetrieval.test.ts tests/agentTaskWrapup.test.ts
```

Result: **7 files passed, 65 tests passed**, exit 0 (14:47:06 local run). The new B02 file contributes **8 tests**. This is the final focused set, not the previously reported B01 baseline or a full-suite result.

Final lint command:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm run lint
```

Result: **passed**, `tsc -b --pretty false`, exit 0. Completed after the last product/test edit. `git diff --check` at handoff: passed, exit 0.

No product/test mutations followed these final checks. Only this report is written at the checkpoint.

## Evidence limits and abandoned optional attempt

The committed-to-handoff test artifact is a hook host, **not ReactDOM**, browser event scheduling, real Radix focus behavior or the full application route tree. Supplied live-query results model refreshes; fake IndexedDB plus real repository operations validate persisted source/coherence/CAS boundaries. No full-app/browser acceptance claim and no whole-batch suite claim. Existing blocker assertions verify actual MemoryEditor callback/configuration under the host, not browser-native unload rendering.

An optional isolated browser fixture was briefly created before the coordinator requested a bounded handoff. Its first scenario failed with a 10-second history promotion button locator timeout, **0 scenarios passed**; diagnostic files are at `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/b02-browser-failure-fTfqCy`. The new optional runner and two fixture files were removed, and no browser claim is made. That fixture failure was not resolved or treated as product acceptance evidence. Final hook/DB focused tests and lint above passed after removal and the final close/reopen regression. No further fixture expansion is pending in this implementation checkpoint; independent checker can assess scheduling limits.

## Final source fingerprints

SHA-256 of the current handoff product/test files:

| Path | SHA-256 |
| --- | --- |
| `src/components/memory/MemoryPromotion.tsx` | `03d00066422847126d56b74fb256a345118c0da51a0d1951fea91049b5de38fa` |
| `src/components/agent/TaskWrapup.tsx` | `53b905f97104059ecbb635b3d6ca0abddd026615173d04888773b9d1d6bcb7b2` |
| `src/components/memory/MemoryEditor.tsx` | `b61f8095edd1bdedaa6433f95111c7d33c3aeac1c0ba0e25800be8a70ab6d4b6` |
| `tests/b02MemoryPromotion.test.ts` | `6ce65fedde2a38a0895ac3fd9be32679bebc3e011db104b6e5a5be96dcd1ab58` |

B01/unrelated modifications were present on entry and remain owned by the coordinator/other work. This report does not certify those files or close any finding. Next action belongs to independent review; task remains in progress.
