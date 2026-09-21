# 最终独立 UI 复核

范围：IP 列表/详情/编辑/选择器，素材列表/预览/导入/详情/历史/复制/使用/释放/归档删除，Gallery 与 Workspace 集成。按最新 `frontend/ip-material-library.md` 复核；未修改其他任务的 HomeWelcome、Grainient、package 文件。

## 确认问题

### P2（已修复）：切换素材视图会重置明确选择的归属范围
- 文件：`src/components/studio/MaterialLibraryPage.tsx`。
- 可复现：`/assets?ip=fixture` → 归属选“全局素材” → 切换“创作设定”。筛选变为“共享素材（全局与 IP）”。
- 原因：`changeView` 根据本地 scope 清除 URL 原 ip，而 routeSearch effect 因 ip 变化又将 scope 重置成 shared。
- 影响：视图切换意外扩大筛选范围，将用户排除的 IP 内容混入。
- 主会话已改为 URL 派生单一来源，scope 支持 global/all/shared，范围与视图切换统一写入 URL。
- 独立浏览器复验通过：IP route → 全局 → 创作设定后保持全局；刷新保持全局；切全部含项目 → 媒体后保持全部；刷新仍保持全部。最后 URL 为 `/assets?scope=all&view=media`。
- 最终无遗留 P1/P2。主会话另同步禁用未归档素材的永久删除按钮并说明先归档，修正操作事件名称映射。

## 实际浏览器验证

独立 Chromium context、原生 IndexedDB 数据、4173 开发服务，无付费网络请求。`gallery-ui-review.cjs` 验证六组操作，全部通过且无 pageerror：
1. Gallery 新建项目通过现有 Radix 选择 IP 甲，实际创建绑定。
2. Workspace “项目素材”导航携带正确 project scope。
3. 项目卡菜单修改为 IP 乙，真实记录更新。
4. 解除 IP，恢复独立项目。
5. 归档后移出使用中列表，归档列表可恢复。
6. 390px Gallery 与 Radix 选择器无页面横向溢出。

截图：`gallery-mobile-review.png`。先前 IP 12 项完整回归保留于 `ip-ui-smoke.cjs` 与 `ip-ui-review.md`。

## 其他复核结果

未发现其他 P1/P2。IP CAS 错误保留本地输入、dirty close/SPA back guard、关联项目/归档事实和 upcoming 文案均一致。素材表单捕获 revision，失败不清草稿，pending 阻止关闭；操作不自动替换项目旧内容。项目归属只通过独立选择和保存变更。版本详情明确预览历史但采用最新版本，释放副本说明保留库原件，归档保留引用，永久删除由 repository 再次校验。

所有新增选择器均为项目现有 Radix Select，表单使用 Input/Textarea/Button/Dialog/Sheet/AlertDialog，hidden file inputs 仅作为文件选择入口。媒体控件只在独立详情内开启 controls，列表卡片不嵌套播放按钮。素材文件 Blob URL 随版本变化回收。采用媒体进入项目后使用项目自身复制记录，Workspace入口可访问；项目 ZIP 备份范围文案已明确。

全量质量门禁由主会话统一完成，主会话提供1036测试、lint、build通过的证据，本review未重复运行全量。
