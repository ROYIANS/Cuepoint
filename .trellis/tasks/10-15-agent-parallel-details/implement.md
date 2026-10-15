# E01 implementation and validation plan

State: in progress. The owner approved this reviewed plan on 2026-10-15 with “OK，额。下一步考虑开始任务吧”; E01 is active on `codex/agent-parallel-details`.

## Ordered work

1. Load actual layout, Agent, video/draft/query specs and the focused research. Record the supported nonmodal shot-link surfaces and existing ContextPanel consumer inventory before edits.
2. Extend the current stable host to docked/full-width work-surface presentation, remove its detail drawer/backdrop/modal carryovers and add the return action. Preserve single portal/editor identity and arbitration.
3. Compose a lazy video-owned single-shot detail from existing fields/media/domain commands with scoped read/loading/missing/error and synchronous draft-state aggregation. Preserve current save/conflict behavior; do not embed the episode grid.
4. Add typed target activation and wire recognized nonmodal shot anchors/Markdown targets. Keep canonical href and unrelated link semantics, existing route departure guard and strict ownership checks.
5. Exercise same-registration A/B selection, replacement, close/return, pending failure, concurrent Agent edits and width transitions. Update focused behavioral tests and actual shared-UI acceptance fixtures.
6. Update accepted layout/detail contracts and relevant Agent/video integration specs. Have the Trellis check sub-agent review lifecycle, query identity, draft/CAS, lazy boundaries, accessibility and source coverage; fix findings in the assigned owners.
7. Run necessary checks once changes stabilize and present evidence and limitations. The owner's subsequent 2026-10-15 instruction defers full regressions, build/packaging and packaged/native integration acceptance until the complete task batch is finished. Do not represent compilation or mocked lifecycle as real packaged runtime acceptance.

## File ownership / integration risks

- App layout/theme owns working-surface presentation, focus and host arbitration.
- Video feature owns one-shot loading/editing and domain primitives. Library retains slot/media sessions and cleanup.
- Agent owns detail activation from its link presentation and retained conversation; application integration supplies reviewed cross-feature contracts.
- Tests/fixtures/tooling cover actual callbacks and real DOM. Existing immutable source snapshots remain immutable.
- Risk points: alternate trees that remount editors; old overlay inertness leaking into full-width mode; hidden Agent global keyboard shortcuts; local same-registration selection bypassing draft guards; thrown detail read propagating to the root; Markdown link customization defeating lazy/memo boundaries.

## Focused checks

Use the approved machine pnpm path explicitly. The following are existing commands/paths, to run during implementation rather than this planning turn:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm run agent:build
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/contextPanelCoordinator.test.ts tests/contextPanelDom.test.ts tests/overlayFocusReturn.test.ts tests/createdEntityLinksCollapse.test.ts tests/d03ShotCommands.test.ts tests/d08TextDraftComponents.test.ts tests/manualDraftWiring.test.ts tests/e01ManualDraftDeparture.test.ts
```

Extend these or add meaningful integration cases for the changed behaviors; they do not currently prove a running Agent survives shot activation. Add an actual shared-UI scenario for a deterministic streaming run plus real shot store, independent of a paid model. Follow existing browser-fixture patterns, but do not reuse the historical E03 CSS pixel-equivalence runner as proof of a deliberately changed layout.

## Observable UI/native acceptance

- Running stream: activate each supported nonmodal link with pointer and keyboard; unchanged thread/run/controller, no stop prompt, continuing output and no duplicate provider request.
- Draft/reading: open/close/return with new composer content and an older reading position; preserve both and keep deliberate follow intent.
- Wide/narrow/short: 1440x900, 1024x640, 760x520 and a narrow browser view; evaluate both sides of measured docking threshold, independent scrollports, reachable close/return and no detail backdrop/drawer.
- Resize with dirty text/caret, pending numeric save and media session; same owner and no lost drafts. Existing task/material/memory/audio/music panels follow full-width mode without playback/session regressions.
- Switch shot A to B/C and replace another inspector during dirty/pending/failure. Cancel keeps A; stale confirmation cannot open obsolete targets; no callback saves into B with A payload.
- Foreign/missing/deleted target and delayed/failed reads remain local to details; same-field conflict with Agent preserves manual draft/current row; opening a filtered-out shot does not change episode filters.
- Genuine navigation away still invokes existing appropriate execution/draft protection; detail opening never consumes a future bypass.
- Actual native window smoke for link activation, narrow/full-width return and edited shot persistence is now deferred to batch integration acceptance. A preliminary isolated package built before the owner's testing-scope correction is not final-source acceptance. Report unsupported/unavailable platform execution explicitly.

## Repository gates

Owner override on 2026-10-15: “我们任务比较多，测试只做必要的就行，像打包啥的，最后所有任务做完再做”. Each task runs directly affected regressions, type checks and scoped code/architecture review. Full `test`, formal whole-repository `quality`, `build`, landing budget, native storage suites and final packaged acceptance are deferred to the end of the batch. Do not repeat packaging or broaden testing per child task. Preserve already completed checks as historical evidence and distinguish them from the final changed input set.

Do not install packages or add new dependencies by assumption. No commit/push/release is part of activating this plan unless separately authorized or covered by the applicable finish workflow.
