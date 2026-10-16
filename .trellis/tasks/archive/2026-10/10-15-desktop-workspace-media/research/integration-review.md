# E08 Stage 3 integration review

Date: 2026-10-16. Scope: Studio's finite native-media transport, installation
beside the actual native ProductStore, library orchestration, Agent group and
inline library/Agent reports. The independent foundation review owns Rust,
decoder resources, staged claims, durable commands and derivative lifecycle.
Review read the task PRD/design/plan, curated check context, complete native
runtime tail, storage/tool/job contracts and interaction/lifetime guidelines.

## Result

Stage 3 source review passes after the fixes below. The cross-layer expired-grant
dependency is also resolved: the foundation reviewer made same-scope
expired/absent directory revocation idempotent while retaining rejection of an
existing foreign-scope grant. Otherwise replacing a candidate could remain
blocked on revoking its old expired grant. The root reported the actual focused
Rust result as 16 passed and one explicitly ignored resource fixture; that native
command was not redundantly run by this reviewer.

No second store, fake human Agent run, renderer filesystem/shell authority,
automatic import replay, drawer or chat navigation was introduced. Copy/decode
stays outside product transactions. Only newly admitted durable intent dispatches
work, source/thumbnail publication retains the existing atomic command, and the
UI counts committed receipts.

## Findings fixed during review

- `platform/runtime/desktopMedia.ts`: all rejected invokes were classified as
  uncertain, including the exact native platform refusal before reservation.
  The reviewer added recognition of only the closed Rust
  `{code: "platform", message: string}` rejection and fixed unavailable guidance.
  Unstructured errors, additional fields and other codes remain uncertain.
  `tests/desktopMediaTransport.test.ts` covers the distinction with six cases,
  one invoke and no replay. No arbitrary native error text is displayed.
- `library/ui/DesktopMediaImportPanel.tsx`: cleanup-only lifetime assignment
  left `alive` false after actual StrictMode setup replay. The implementer now
  restores it during setup, and the DOM regression runs under StrictMode.
  The keyed project boundary rejects stale completion; initial/error record reads
  do not admit a new directory gesture.
- The same panel previously generated another import identity after unresolved
  admission. It now retains the uncertain original intent and exposes only
  inspection. Same-tick picker/import gestures remain synchronously excluded.
- `library/services/desktopMediaImport.ts`: an unmount during paged scan read
  could leave a newly completed grant orphaned. The service now observes abort
  after the page read and revokes that known candidate. Unknown results still
  retain their original authority/evidence.
- The service previously released cancellation ownership after a single early
  cancel rejection. Tauri may schedule cancellation before native reservation.
  Abort now reads/cancels the same operation until the original producer settles;
  no next producer starts. The fixture now rejects cancellation of an absent
  operation, matching Rust, and covers the held pre-reservation race.
- Lost publication acknowledgement could show a committed receipt while
  retaining the prepared operation indefinitely. Fresh exact receipt readback
  now permits release of that adopted operation, without discarding its claims
  or repeating decode/publication. An unresolved receipt still quarantines work.
- Unused candidates previously accumulated through Agent scans. A new selection
  replaces the same project's unused candidates, refuses an active/unknown
  project intent and bounds renderer scan summaries to eight. Evicting a renderer
  summary does not revoke or discard unknown native work.
- `library/agent/desktopMediaTools.ts`: an uncertain native scan error could be
  reduced by the generic read-tool catch to an ordinary failed call. It now
  throws the existing `ToolPendingError`, preserving unknown original-call
  ownership. Scan/import retain explicit confirmation; neither is atomic or
  repeatable IO. Import preview rechecks the exact frozen selection.
- `agent/ui/AgentDesktopMediaReport.tsx`: reconciliation can write durable
  status, so read-only reports no longer offer that action. The inspection
  handler now uses a synchronous ref lock. The original run/thread/call/project
  and actor relation gate report reads; an ID or display JSON grants no access.
- The implementer corrected the new tool fixture's decision from `approved` to
  the actual `approve` literal and the new UI's body sizes to shared 14px.

The separate foundation reviewer handles explicit confirmed-call metadata and
preview validation at the shared admission/publication command itself. Stage 3
does not weaken that boundary or duplicate its implementation.

## Verification

- Explicit machine pnpm 9 path used; no install, lockfile rewrite or package
  build ran.
- `pnpm exec tsc --project tests/typecheck/tsconfig.desktop-media-source.json
  --pretty false`: **pass** after the final Stage 3 changes, including the
  renderer candidate-cache bound.
- Scoped ESLint over the eleven changed Stage 3 production TS/TSX files:
  **pass, zero errors and 21 warnings**. Warnings are the repository's enabled
  complexity/depth/nested-ternary rules, including existing Agent/material page
  warnings. No lint suppression was added. The repository ESLint config does
  not select test files; test-file lint was not claimed.
- Reviewer executed `desktopMediaTransport.test.ts`: **six tests passed**.
- Reviewer executed the final `desktopMediaUi.test.ts`: **six tests passed**,
  including exact owned Agent report, passive read-only recovery and changed
  durable thread/project rejection. That final added case changed only tests.
- Root session reported its finite six affected suites: **34 tests passed**.
  Those include production transport/tool parsers, actual shared ProductStore
  commands, service Stop/unknown/lost-ack cases and ReactDOM scope/gesture cases.
  That earlier batch included five UI cases; the reviewer then verified all six
  final UI cases as above. The DOM tests explicitly control observation delivery;
  they are not native WebView or full browser invalidation acceptance.
- Root reported architecture: **669 files, 2,635 static and 14 dynamic edges,
  zero static value cycles and zero failures**. No architecture command was
  redundantly run by this reviewer.
- `git diff --check`: **pass** at review time.

## Limits and deferred evidence

Missing or foreign original native owners remain unknown. They do not prove
termination, authorize dispatch, or permit cross-session cleanup. The retained
unknown row intentionally blocks another project import until safe inspection
can establish an actual outcome. No forced reset or replay was added.

Actual macOS/Windows installed picker/process/media behavior, Windows fixed-NTFS
and executable handling, packaged resource identity/signing, corresponding-host
Stop/reap and full build/emitted/package/native integration remain the owner's
end-of-epic acceptance gates. Source tests and this review do not establish them.

Root-owned spec sync must retain these exact contracts in
`frontend/desktop-media-import.md` and the existing shared-storage table/version
description, preserving the historical named 49-to-50 transition.
