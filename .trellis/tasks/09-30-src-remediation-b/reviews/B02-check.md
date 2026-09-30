# B02 AU-01 independent check

**PASS after scoped self-fixes.** Reviewed 2026-09-30. This result covers B02 candidate/editor sessions only; coordinator owns acceptance, specs and ledger. No remaining concrete B02 defect was found after the fixes below.

Read check.jsonl, PRD/design/implementation plan, B02-session-contract.md and B02-implementation.md, and applicable frontend/memory guidance. Reviewed the three product files, actual TaskInspector key boundary, ordinary ProjectMemoryPage editor ownership, and candidate/promotion/update repository paths. Did not spawn agents, install dependencies, commit, push, archive or change task status, metadata, specs, ledger, B01 source, or E01 summary exit behavior.

## Concrete findings and self-fixes

- **Saved callback could submit again.** Capture MemoryEditor's form submit, complete a promotion, then invoke that callback after onSaved (either before a close render or after synchronous unmount). The handoff code released its lock and called promoteProjectMemory again. Repository deduplication limited duplicate rows but did not prevent repeat callbacks and old state writes. The editor now retires a successful session synchronously before onSaved; completed controls are disabled and saved drafts no longer block closing.
- **Unmounted save could publish.** Start a deferred promotion, unmount, then resolve/reject it. The handoff code still called onSaved/toast or wrote error/pending state. A captured submit could dispatch again after completion. A captured mounted lifetime/epoch now gates entry and async completion, error and pending updates. An already initiated repository write can finish for its original validated owner; its unmounted UI does not publish results or dispatch another save.
- **Changed owner could receive the old completion.** Begin save, change the same mounted editor's project/source, then finish the original save. The handoff code invoked the old onSaved without checking the current target. The fix preserves the original write target, suppresses that callback and explicitly reports “原编辑目标已保存…” in the still-mounted editor. It retires the completed session and requires reopening rather than silently accepting another submission. Ordinary task replacement is already keyed at TaskInspector; the test exercises the editor's additional mismatch boundary.
- **Two new static signals were legitimate.** TaskWrapup now gives useRef an explicit phase union instead of asserting its initial phase, and captures `const session = promotion.current` inside the mount effect for setup/cleanup. No lint suppression was added.

The parent still serializes latest/previous/history candidate reads before awaiting, captures owner/source/epoch and clones the selected candidate. Old completion cannot publish to an unmounted or changed owner. Candidate-read pending still reaches the inspector. Active source refresh keeps the editor key; the epoch key distinguishes explicit close/reopen, including a batched close/reopen. The editor still freezes baseline/body/tags/source/excerpt/owner/ID/initial revision, compares source identity fields independently of property order, reads its frozen target, rejects mismatched old-render submits, and retains dirty blockers and explicit latest-revision CAS reconciliation.

## Validation and evidence

The original 8 actual-component/Dexie tests remain. Six additional cases cover saved callbacks before/after close, pending save resolve/reject after unmount, changed-owner completion, and initial effect cleanup/setup replay followed by save and unmount. The first bounded red run recorded **8 passed / 6 failed** on the handoff source; the green run passed **14/14**. Async repository promises are explicitly drained in the final tests so late completions are included in assertions.

Final checks after the last test edit:

- **7 files / 71 tests passed**, exit 0, started **2026-09-30 15:06:59 Asia/Shanghai**. B02 contributes 14; the other six files cover project memories/packages, memory tools/inclusion/retrieval, and task wrapup. This supersedes the implementation handoff's 7-file/65-test count.
- **`pnpm run lint` passed**, exit 0 (`tsc -b --pretty false`), and **`git diff --check` passed**, exit 0. Exact commands/timing and logs: `B02-check-runs.json`, `B02-check-focused.log`, `B02-check-lint.log`, `B02-check-diff-check.log`.
- Existing isolated ESLint config, **only the three B02 product files**: exit 0. Raw diagnostics/command: `B02-check-eslint.json`, `B02-check-eslint-run.json`; signature comparison: `B02-check-eslint-summary.json`. Both reported new signatures are removed. **No new non-complexity signatures** versus the inherited pre-B baseline. A's integration scan has no B02 rows, so comparison uses their original full-audit rows; B's integration diagnostics additionally confirm removal of the two handoff signals. Inherited boolean-expression dependency warnings and nested ternaries remain; the editing-notification effect consumes the same boolean values used by its dependencies, so that existing static warning does not demonstrate a stale editing notification. Complexity remains later-unit work, not certified as resolved.
- Commands invoked the authorized local pnpm path explicitly. Captured tool versions: Node **v24.11.0**, pnpm **10.15.0**, isolated ESLint **v9.39.5**. The observed pnpm version is recorded as returned; no install or dependency mutation was performed.

Raw red/green evidence: `B02-check-red.log`, `B02-check-green.log`. No product/test changes followed the final checks.

## Limits and coordinator follow-up

Tests execute real component functions/effects/callbacks with a deterministic hook host and real repositories against fake IndexedDB. Effect replay models initial cleanup/setup; it is **not a real ReactDOM StrictMode fixture**, native event scheduling, Radix focus/unload UI, or the full route tree. No browser or full-suite claim. The implementation's optional browser attempt had **0 passed** and a history-button locator timeout; its removed fixture was not acceptance evidence and was not expanded here. No concrete remaining risk required browser/full-suite expansion for this bounded check.

Coordinator spec follow-up: document that a mounted editor's successful save retires its callbacks before notifying the parent; async UI publication requires the initiating mounted epoch; a target change during an already initiated save does not redirect that write, and a still-mounted editor reports its original-target completion explicitly. Existing read/source validation and CAS contracts remain unchanged. This checker did not edit specs or close the ledger.

## Tested source fingerprints

| Path | SHA-256 |
| --- | --- |
| `src/components/memory/MemoryPromotion.tsx` | `03d00066422847126d56b74fb256a345118c0da51a0d1951fea91049b5de38fa` |
| `src/components/agent/TaskWrapup.tsx` | `e3dfd7266c829e9201fe40de48a04edfdf5db05a2e43de31cc09a4af28d77403` |
| `src/components/memory/MemoryEditor.tsx` | `a2edba2fe43c8bb1585061000403fc32c24b259ccac692b6b4fd4a8ceb241451` |
| `tests/b02MemoryPromotion.test.ts` | `7036d8e7cfd72e864872126f07c352f3500824f27b3285c5b2fb2dec23a117f6` |

`B02-check-snapshot.json` records these deliverables and hashes the report and raw evidence. Scope remains B02; B01/unrelated working-tree changes are not certified by this report.
