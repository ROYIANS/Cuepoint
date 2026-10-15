# E01 implementation and focused verification

## Delivery state

Implemented on `codex/agent-parallel-details` against base `9d1a41739b17be27cf832326de15a9489017825a`. Product changes are ready for the owner-authorized stage commit; no push or release has occurred. Independent Trellis review found no remaining in-scope defect after the fixes below. Full batch integration remains deferred by the owner's latest instruction.

## Result and ownership

- App composes stable ShotDetailsProvider/ShotDetailLink and a bounded canonical-link parser. Agent remains mounted and owns its existing controller/session. Video owns the lazy, single-shot editor and its scoped project/episode/shot read envelope. No episode grid or filter repair is mounted.
- Shared ContextPanel keeps one editor portal and complementary-region semantics. Adequate measured width docks details; insufficient width fills only the working surface and exposes Return to conversation/workspace. The retained main subtree stays mounted and inert with preserved geometry/scroll; chrome remains available.
- Existing text/numeric/relation/media controls use original commands, field/slot baselines and frozen targets. Local A/B/C selection, close and replacement read synchronous descendant draft state. Actual route navigation retains the existing execution and nested-media protection.
- Nonmodal shot links in message/process/reasoning Markdown, previews, creation/history results, ordinary generation review/results, provenance and wrap-up open in place. Real anchors, external/citation/footnote rendering and modifier intent remain. Other entity editors and batch-review modal handoff remain E16; optimistic Send remains E02.

## Defects found and corrected

1. URL normalization could expand a path allowlist: match the original path and reject malformed encodings, ambiguous queries, overlong IDs and control/path delimiters.
2. Invalid duration raw text survived adopting the latest value: conflict recovery now resets raw and controller drafts together.
3. Clean open media sessions appeared permanently pending to the pane's route guard: local departure still retains media, while route confirmation and before-unload delegate through routeDirty/routePending. Aggregate comparisons include all four flags so inline saves settling update an already-open confirmation.
4. An antd textarea measuring mirror explicitly restored visibility under a hidden conversation and painted draft text over narrow details: ancestor opacity now prevents the entire retained subtree from painting; print restores it. Screenshot review and a negative-paint assertion verify the fix.
5. Queued Agent focus/scroll callbacks could target the inert conversation: execution-time inert checks now yield while runtime streaming continues.
6. Shot order is already one-based: metadata uses the existing order directly.

## Focused evidence

| Check | Observed result / qualification |
| --- | --- |
| Independent Trellis review | No unresolved in-scope defect; ownership, link/query lifecycle and seven-section spec reviewed |
| Final necessary guard regressions | shotDetailPanel + e01ManualDraftDeparture: 2 suites, 15 tests passed |
| Read lifecycle regressions | 3 tests passed using actual StoreTx reads, controlled observation delivery and an actual shot read failure: late target isolation, local retry and retained read-only draft |
| Other affected regressions during implementation | Layout coordinator/DOM/focus 3 suites/19 tests passed; broader focused draft/Agent/store regressions passed during development. Earlier counts reflect earlier revisions and are not summed as a final whole-repository run |
| Final direct TypeScript check | `tsc -b --pretty false` passed after review fixes |
| Scoped ESLint | 25 changed Studio sources: 0 errors, 60 nonblocking complexity/nested-ternary warnings; final order fix rechecked |
| Architecture during review | 638 files, 2539 static edges, 11 dynamic edges, 0 cycles/failures; later guard/order changes add no dependency edges |
| Final browser fixture | 24/24 scenarios passed on frozen listed inputs; 0 page errors, one main-document load, 23 selected file hashes unchanged across run |
| Responsive visual review | Actual 1440/1024/760/390 screenshots checked; same editor/caret, wide independent scroll, narrow return, no hidden composer paint or horizontal overflow |
| Whitespace | Tracked diff and new owned source/spec/E01 artifacts passed |

The browser fixture uses the actual AgentChatPage, controller/session, domain commands and IndexedDB ProductStore. Model transport is deterministic SSE; held manual writes pause before the real command and then exercise the original transaction/CAS. One request continues without abort or duplicate dispatch while opening/editing/returning. It includes a real TaskInspector consumer as the representative shared-host regression. It does not exercise every audio/music/material/memory consumer in a real window, the entire production root, paid providers or WebKit.

Temporary final browser evidence was written to `/var/folders/m6/x3vx_lld0kg8rcgth931pll40000gn/T/agent-parallel-evidence-rT1e95` and `/tmp/agent-parallel-browser-final.log`. These disposable paths are observations, not permanent task artifacts.

## Owner-directed validation cadence and remaining batch gate

Owner instruction: “我们任务比较多，测试只做必要的就行，像打包啥的，最后所有任务做完再做”. Per-child work now stops at affected tests, scoped review and types. At batch completion run full repository tests/formal quality, production builds/landing budget, actual native-store integration and final packaged acceptance, including remaining shared consumers.

Before that instruction, root typecheck, quality self-test (88 cases plus 7 tooling tests), model baseline (381 entries) and desktop types/lint/unused completed successfully. A preliminary isolated SQLite product package also built and opened, and its persisted Agent link opened a real side panel. Subsequent product fixes were not rebuilt. This is explicitly not final-source packaged acceptance, nor verified native save/resize persistence; no further package/native runs are being performed for this child.

The native experiment used a dedicated `dev.cuepoint.review.parallel-20261015` profile with synthetic records and was closed. It did not use the normal user profile or a live provider. Windows/Linux runtime evidence was not collected.
