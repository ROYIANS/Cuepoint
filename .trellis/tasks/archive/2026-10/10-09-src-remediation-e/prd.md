# Requirements: Source remediation E

## Goal

Finish the remaining 13 findings in the approved A→B→C→D→E remediation sequence, preserving user edits and production contracts, improving measured runtime work, and making the verified quality baseline enforceable. Tooling supports the existing source review rather than replacing it.

## Background and confirmed facts

- Baseline: `1ecaf5ceec92e022c2b2b8d662e2a92e8eee36c7` on local `main`, recorded 2026-10-09. D is committed and archived; the working tree was clean before task creation.
- Parent inventory: 51 findings across 32 units, 38 fixed and 13 pending. EX01 is verified ancillary work; QG01 is required ancillary work and does not create a 52nd finding.
- Scope primarily covers `src`, plus regression fixtures/runners, necessary pinned dev tooling/configuration, CI quality and specs. Vendor remains excluded; generated route files are excluded from manual edits. Tests are behavior evidence, not a fresh exhaustive test audit.
- Original audit locations below are historical anchors; refresh actual file ownership and line numbers before each unit because D moved modules.
- Current `lint` invokes TypeScript, not ESLint. CI uses Node22; packageManager is pnpm10.15.0. All local pnpm operations use the user-authorized explicit machine executable.

## Requirements and acceptance

### E01: Retain manual drafts across departure and failed writes

A dirty record, wrapup, or voice form stays mounted and retains exactly the user input when Escape, close, task/thread switch, route navigation, or back/forward is cancelled. Explicit discard authorizes losing the local draft; save remains explicit. In-flight save/upload/preview cannot dismiss its owning editor. Failure leaves input and current selection intact with an actionable error. Specified gallery/library/episode mutations have caught errors and synchronous duplicate-submit protection. Saved, unchanged forms can leave without a dirty prompt.

Owned findings:

- AU-02 (P2, confirmed-bug): 工作记录/总结草稿的离开保护不完整. Historical anchors: `src/components/agent/TaskRecords.tsx:57`, `src/components/agent/TaskWrapup.tsx:146`, `src/components/agent/TaskInspector.tsx:142`, `src/components/agent/AgentChatPage.tsx:728`, `src/components/ui/sheet.tsx:69`, `src/routes/_studio.agent.tsx:15`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md`.
- PU-10 (P3, risk): 音色未保存配置缺少 dirty 退出语义. Historical anchors: `src/components/audio/VoiceLibrary.tsx:38`, `src/db/materials.ts:348`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/production-ui.md`.
- SS-06 (P2, confirmed-bug): 部分业务写入没有错误出口. Historical anchors: `src/components/studio/ProjectGalleryPage.tsx:373`, `src/components/studio/AssetLibraryPages.tsx:187`, `src/components/workspace/EpisodeListPage.tsx:126`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/shell-shared.md`.

### E02: Preserve keyboard action ownership and narrow layout

Enter/Space on a row selects that row; Enter/Space on child rename/delete/menu actions operates only that child without changing the selected topic. Focus remains usable. At narrow widths the final computed layout keeps intended margins and safe-area padding; existing themes and navigation remain compatible.

Owned findings:

- AU-04 (P2, confirmed-bug): 主题行截获子动作的键盘事件. Historical anchors: `src/components/agent/TopicSidebar.tsx:308`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md`.
- AU-05 (P3, confirmed-bug): 窄屏 CSS 被后置基础规则覆盖. Historical anchors: `src/components/agent/agentChat.css:503`, `src/components/agent/ChatWorkspace.tsx:140`, `src/components/agent/agentTheme.ts:45`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md`.

### E03: Remove proven obsolete workspace CSS

Remove only selectors proven unused across current JSX, string construction, dynamic classes, and responsive consumers. Current audio/music workspace rendering remains equivalent in representative desktop/narrow browser captures.

Owned findings:

- PU-09 (P3, structural-debt): CSS 保留已退出当前渲染树的旧工作台规则. Historical anchors: `src/components/audioMusic/workspace.css:314`, `src/components/audio/story-workspace.css:71`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/production-ui.md`.

### E04: Bound transaction and subscription work without losing atomicity

Simple manual memory mutations use their complete minimal table sets. Protected ownership/revision/evidence checks and writes remain in the same transaction. Batch media cleanup performs fixed/bounded retention scans per transaction while preserving current, historical, proposal, job, batch, material, audio and library references and failure rollback. Gallery/library queries load useful scoped projections/kinds and preserve order, filtering and covers. Instrument query/scan work and observe native IndexedDB behavior separately from fake-indexeddb proof.

Owned findings:

- PD-06 (P2, structural-debt): 全表写事务扩大耦合与锁竞争. Historical anchors: `src/db/projectMemories.ts:340`, `src/db/agentRuns.ts:68`, `src/db/agentTaskWrapups.ts:104`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/persistence-domain.md`.
- PD-07 (P2, structural-debt): 媒体逐条回收重复全库扫描. Historical anchors: `src/db/repo.ts:617`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/persistence-domain.md`.
- SS-09 (P2, structural-debt): library 订阅及派生范围可收窄. Historical anchors: `src/components/studio/ProjectGalleryPage.tsx:49`, `src/components/studio/AssetLibraryPages.tsx:110`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/shell-shared.md`.

### E05: Schedule decorative sparks only when necessary

Idle, hidden, reduced-motion, and unmounted canvas states do not maintain an animation loop. Active sparks animate and pointer behavior remains usable. Count actual executed animation callbacks in the browser and verify listener/RAF cleanup.

Owned findings:

- SS-11 (P3, structural-debt): 装饰 canvas 可按需调度. Historical anchors: `src/components/ui/click-spark.tsx:83`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/shell-shared.md`.

### E06: Reduce measured rich-message and icon loading cost

Measure empty home, selected-model home, plain-text history and code history with bundle contribution and native network/performance evidence. Optimize a proven loading boundary while preserving icon fallback, markdown/code semantics and scroll behavior. Do not attribute shared chunks twice or infer time savings from bytes; a no-change outcome for the risk needs a concrete measured rationale.

Owned findings:

- AU-09 (P2, risk): lazy边界仍承载大目录和富消息依赖. Historical anchors: `src/components/agent/ChatWorkspace.tsx:23`, `src/components/agent/ModelIcons.tsx:6`, `src/components/agent/ModelIconCatalog.ts:3`, `src/components/agent/ModelSelectTrigger.tsx:243`, `src/components/agent/MessageList.tsx:13`, `src/components/agent/AgentRunDetails.tsx:10`, `src/components/agent/ContextUsagePanel.tsx:34`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/agent-ui.md`.

### E07: Retire verified unused code and provide an enforceable quality command

Refresh production and full/test-entry unused-reference analysis including dynamic/config uses. Delete only verified dead contracts/dependencies/selectors; document legitimate retention and handle test-only legacy retirement deliberately. One documented pinned quality command enforces typed lint/SonarJS and value-only dependency/architecture rules, with verified unused-reference checks. Review remaining debt individually; a justified baseline is narrow rule+file+signature+count+reason+owner, fails on additions/increases/stale entries, and shrinks after fixes. No blanket rule disable or broad file ignores. Synthetic new violations must fail; known removals shrink debt. Locked install and configured Node22 must be actually verified. Wire CI quality without triggering or modifying image publication/permissions; keep model verification, tests and build passing.

Owned findings:

- PD-08 (P3, structural-debt): 无调用的导出收窄（可选）. Historical anchors: `src/db/repo.ts:208`, `src/db/materials.ts:389`, `src/components/agent/AgentChatPage.tsx:59`, `src/domain/agentGenerationBatch.ts:2`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/persistence-domain.md`.
- SS-10 (P3, structural-debt): 低影响清理项与误报. Historical anchors: `src/components/ui/separator.tsx:6`, `src/components/ui/skeleton.tsx:3`, `src/lib/brand.ts:8`, `src/lib/shotFilters.ts:4`, `src/styles.css:2`, `src/lib/references/docx.ts:2`, `src/db/materials.ts:348`. Original evidence: `.trellis/tasks/09-30-src-quality-architecture-audit/research/shell-shared.md`.

## Cross-unit acceptance

- Complete E01→E07 in order. Each unit needs real implementation or concrete validated-no-change rationale, relevant tests, independent review, final changed-path/hash evidence, and spec/ledger synchronization before advancing.
- Final 51 findings retain one-to-one mapping to the original inventory and a verified closing unit; every risk/debt retention decision is documented. QG01 closes with executable failure/repair evidence, not a tool name.
- Run final whole-batch typecheck, full tests, model validation, build, applicable native regressions, exact source/evidence inventory and architecture/static comparison on the same frozen inputs. Independently review the full E scope.
- Present concrete local commit groups for human approval at completion; no automatic push.

## Out of scope

- New editor features, automatic save of these manual forms, new styling themes, broad stylesheet rewrites, paid live-provider experiments, database schema migrations without demonstrated need, or replacing existing tool/transaction semantics.
- SonarQube server/container deployment, publication job/permissions changes, and unrelated active task archives. SonarJS local analysis must be named accurately.

## Decisions for final approval

- Default draft departure: continue editing retains the draft; explicit discard leaves; saving is explicit. Pending operations cannot discard or dismiss. Dirty means a real change from the frozen opening baseline, including relevant reference/sample fields, not merely an open form.
- Reuse existing departure/draft/session abstractions where compatible. No registry/factory layer for isolated operations.
- Performance and dead-code decisions follow current measurements/references. Preserve actual compatibility and test-supported behavior; rejected false positives may be validated-no-change with evidence.
- Add only minimal pinned quality tools needed for the specified gate, using the existing package manager and locked install. Review remaining diagnostics before assigning narrowly documented debt.

## Technical notes and deferred evidence

- E01 local task/thread changes are not necessarily route pathname changes: route blocking alone cannot protect these sessions. Child dirty/pending state must reach the owner before a keyed task replacement or Sheet unmount.
- E04 exact minimal table lists and E06 chunk changes are technical decisions deferred to their ordered units after refreshing current source; acceptance above remains fixed.
- E07 exact retained diagnostic count is determined on final post-E source, not copied blindly from the D delta. Node22/clean install and synthetic gate tests remain required pending evidence.
- Final planning summary approval is pending; task remains planning and product implementation has not begun.
