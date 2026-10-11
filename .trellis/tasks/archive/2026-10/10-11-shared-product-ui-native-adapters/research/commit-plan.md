# 一次性本地提交与归档计划

日期：2026-10-11。当前分支：`codex/shared-product-ui-native-adapters`。基线：`55a4ad54`。

开发与验收全部通过。当前清单覆盖 git status 的每一个修改、删除和新增路径；均为本任务主会话/受派子代理编辑、生成或审查的成果。来源不明的修改：**无**。应用包、工具链、dist、临时数据库位于 ignored 输出中，不加入提交。

## 按序执行三笔工作提交

### 1. `feat(desktop): share product video UI across runtimes`

共享页面/repository、浏览器/原生数据边界、schema 4 和事务/基线/撤销/路由；含全部对应测试与 Knip 配置。 共 **47 个路径**。

- 修改：`desktop/tauri/src-tauri/src/contracts.rs`
- 修改：`desktop/tauri/src-tauri/src/database.rs`
- 修改：`desktop/tauri/src-tauri/src/desktop.rs`
- 修改：`desktop/tauri/src-tauri/src/workspace.rs`
- 修改：`desktop/tauri/src-tauri/tests/native_workspace.rs`
- 新增：`desktop/tauri/src-tauri/tests/shared_video_contract.rs`
- 修改：`desktop/tauri/ui/bridge.ts`
- 修改：`knip.json`
- 修改：`src/components/shots/DurationInput.tsx`
- 修改：`src/components/shots/ShotEditorPage.tsx`
- 修改：`src/components/shots/ShotRelationsEditor.tsx`
- 修改：`src/components/shots/ShotRow.tsx`
- 修改：`src/components/shots/ShotTextField.tsx`
- 修改：`src/components/shots/shotEditorCommands.ts`
- 修改：`src/components/story/BeatTextField.tsx`
- 修改：`src/components/story/StoryPage.tsx`
- 删除：`src/components/studio/NativeProjectGalleryPage.tsx`
- 修改：`src/components/studio/ProjectGalleryPage.tsx`
- 修改：`src/components/workspace/EpisodeListPage.tsx`
- 删除：`src/components/workspace/NativeProjectWorkspacePage.tsx`
- 修改：`src/components/workspace/ProjectHomePage.tsx`
- 修改：`src/components/workspace/ProjectSettingsPanel.tsx`
- 新增：`src/components/workspace/VideoWorkspaceReadNotice.tsx`
- 新增：`src/components/workspace/WorkspaceCapabilityState.tsx`
- 修改：`src/components/workspace/WorkspaceChrome.tsx`
- 新增：`src/domain/videoWorkspace.ts`
- 修改：`src/lib/media.ts`
- 修改：`src/lib/nativeWorkspace.ts`
- 新增：`src/lib/nativeWorkspaceContract.ts`
- 新增：`src/lib/productRouterHistory.ts`
- 修改：`src/lib/useShotMedia.ts`
- 新增：`src/lib/videoWorkspaceRepository.tsx`
- 修改：`src/main.tsx`
- 修改：`src/routes/_studio.index.tsx`
- 修改：`src/routes/_studio.tsx`
- 修改：`src/routes/p.$projectId.plan.tsx`
- 修改：`src/routes/p.$projectId.produce.tsx`
- 修改：`src/routes/p.$projectId.report.tsx`
- 修改：`src/routes/p.$projectId.shots.tsx`
- 新增：`tests/nativeAcceptanceBridge.test.ts`
- 修改：`tests/nativeWorkspace.test.ts`
- 新增：`tests/nativeWorkspaceConcurrency.test.ts`
- 新增：`tests/nativeWorkspaceDeletion.test.ts`
- 新增：`tests/productRouterHistory.test.ts`
- 新增：`tests/sharedVideoPageParity.test.ts`
- 新增：`tests/videoWorkspaceBrowserRepository.test.ts`
- 新增：`tests/videoWorkspaceRepository.test.ts`

### 2. `fix(desktop): use opaque dark application icons`

原生图标和可复现生成/验证脚本；不修改 Web 品牌资源。 共 **12 个路径**。

- 新增：`desktop/tauri/scripts/generate-native-icons.py`
- 新增：`desktop/tauri/src-tauri/icons/128x128.png`
- 新增：`desktop/tauri/src-tauri/icons/128x128@2x.png`
- 新增：`desktop/tauri/src-tauri/icons/16x16.png`
- 新增：`desktop/tauri/src-tauri/icons/32x32.png`
- 新增：`desktop/tauri/src-tauri/icons/64x64.png`
- 新增：`desktop/tauri/src-tauri/icons/README.md`
- 修改：`desktop/tauri/src-tauri/icons/icon.icns`
- 新增：`desktop/tauri/src-tauri/icons/icon.ico`
- 修改：`desktop/tauri/src-tauri/icons/icon.png`
- 新增：`desktop/tauri/src-tauri/icons/provenance.json`
- 新增：`desktop/tauri/src-tauri/icons/source.png`

### 3. `docs(desktop): record shared UI contracts and acceptance`

项目规范、父子任务关联、当前任务计划、独立审查、原始检查日志、实际浏览器/macOS 界面和 SQLite/托管文件证据；含本提交计划。 共 **114 个路径**。

- 修改：`.trellis/spec/frontend/index.md`
- 修改：`.trellis/spec/frontend/native-workspace.md`
- 修改：`.trellis/spec/frontend/state-management.md`
- 新增：`.trellis/spec/frontend/video-workspace.md`
- 修改：`.trellis/tasks/10-10-desktop-storage-sync/task.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/check.jsonl`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/design.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/implement.jsonl`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/implement.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/prd.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke.mjs`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/01-empty-projects.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/02-episodes.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/03-story.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/04-shot-workbench.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/05-missing-owner.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/06-unavailable-kind.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/07-compact-shared-workbench.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/failed-1791697976696.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/failed-before-stable-run.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/failure.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/report.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/browser-product-smoke/trace.zip`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/build-receipt.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/change-boundary.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/commit-plan.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/final-resumption-review.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/final-resumption-source.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-evidence.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/acceptance-frontend-build.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/desktop-lint.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/desktop-quality.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/desktop-types.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/isolated-product-app-build.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/model-bank-verify.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/normal-app-build.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/normal-frontend-build.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/normal-native-bundle.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-build.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-lint-resumption.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-lint.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-quality-resumption.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-quality-self-test-summary.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-quality-self-test.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-quality.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-tests-bounded.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-tests-resumption.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/root-tests.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/rust-clippy.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/rust-final-receipt.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/rust-fmt.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/rust-tests-combined.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/full-check-logs/studio-route-targeted.log`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/icon-artifact-check.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/icon-generation-plan.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/icon-generation-report.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/icon-implementation-evidence.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/icon-independent-checks.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/icon-reproducibility.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/implementation-evidence.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke.py`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke.swift`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/01-empty-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/01-empty.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/02-fixed-empty-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/02-fixed-empty.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/03-create-dialog-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/03-create-dialog.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/04-episodes-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/04-episodes.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/05-story-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/05-story.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/06-shot-edit-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/06-shot-edit.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/07-story-saved-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/07-story-saved.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/08-capability-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/08-capability.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/09-story-saved-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/09-story-saved.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/10-shot-saved-ax.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/10-shot-saved.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/11-final-reopen-story-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/11-final-reopen-story.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/12-status-filter-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/12-status-filter.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/13-multiadd-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/14-core-saved-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/14-core-saved.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/15-managed-asset-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/15-managed-asset.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/16-final-reopen-settings-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/16-final-reopen-settings.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/17-final-capability-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/17-final-capability.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/18-final-reopen-assets-ax.txt`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/18-final-reopen-assets.png`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/final-sqlite.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/first-entry-failure.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/interim-sqlite.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/multiadd-sqlite.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/operations.jsonl`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/pre-reopen-sqlite.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/reopen-expected.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/mac-product-smoke/report.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/native-icon.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/packaged-icon-check.json`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/rust-implementation-evidence.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/shared-contract.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/shared-pages-evidence.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/shared-video-ui.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/typescript-implementation-evidence.md`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/research/verify-mac-product-sqlite.py`
- 新增：`.trellis/tasks/10-11-shared-product-ui-native-adapters/task.json`

## 工作提交之后的两笔记录提交

4. 使用 `task.py archive 10-11-shared-product-ui-native-adapters` 归档本子任务，脚本生成 `chore(task): archive ...`；归档目录按脚本规则移动到 `.trellis/tasks/archive/2026-10/`。父任务 `10-10-desktop-storage-sync` 继续进行。
5. 使用 `add_session.py` 记录本轮成果与前三笔工作提交的 hash，脚本生成 `chore: record journal`。

全程不 amend、不推送、不合并 `main`。当前任务的完成状态与归档元数据由归档脚本处理；journal 使用工作提交 hash，不使用记录提交 hash。

## 验收依据

- 当前全量前端：196 files / **3400 passed / 1 skipped**。
- Rust combined acceptance,test-hooks：**51 passed**；fmt/Clippy -D warnings 通过。
- Root/desktop 类型、lint、quality、quality:self-test、本地 model-bank verify 与全部计划构建通过。
- 浏览器真实 UI：12 项通过；最终 macOS 普通产品代码包完成编辑、设置、筛选、复制撤销、托管文件复制和关闭重开验收。
- 原生图标各尺寸为不透明 `#0c0c0c`，实际正常 bundle 的 ICNS hash 与原生资源一致。
- 独立审查的59个产品/测试/原生资产/配置路径在最终构建和验收后无源码漂移。

详细结果：`implementation-evidence.md`、`final-resumption-review.md`、`build-receipt.json`、`mac-product-smoke/report.json`。

## 确认来源

`.trellis/workflow.md` Phase 3.4 明确要求：**“Present the plan once, ask for one-shot confirmation.”** 本计划一次确认覆盖三笔工作提交及随后的本子任务归档、journal；不会在每笔提交前重复询问。

## 来源不明的修改

无。
