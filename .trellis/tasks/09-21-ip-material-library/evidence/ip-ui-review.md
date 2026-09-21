# IP 界面交付与验证

## 实现
- `/ips` 使用中/归档列表、名称定位主题搜索、项目/专属素材数量、空态。
- `/ips/$ipId` 持久详情，档案/关联项目/专属素材导航。素材入口携带 `ip` / `view` scope；关联项目来自真实绑定。
- IP 创建/编辑显式保存，以打开编辑器时的 revision 做 CAS；失败保留输入，不被 liveQuery 刷新覆盖。脏稿关闭或 SPA 后退均弹出应用内确认，支持继续编辑或放弃。
- 归档/恢复确认，保留项目和素材；归档后编辑入口禁用。衍生形象、表情包和周边明确标注即将推出。文案明确聊天未自动继承 IP 档案。
- `ProjectIpPicker` 采用现有 Radix Select，支持独立项目、使用中 IP、当前已归档绑定。所有标准输入/按钮使用现有 UI primitives。

## 文件
- `src/components/studio/IpProfilesPage.tsx`
- `src/components/studio/IpProfileEditor.tsx`
- `src/components/studio/ProjectIpPicker.tsx`
- `src/components/studio/ipProfiles.css`
- `src/routes/_studio.ips.tsx`
- `src/routes/_studio.ips.index.tsx`
- `src/routes/_studio.ips.$ipId.tsx`

## 验证
本机指定 pnpm `lint` 通过。完整测试/构建由主会话统一负责。

`ip-ui-smoke.cjs` 在 4173 独立 Chromium context 中验证12项，无 pageerror，不读取或修改用户现有浏览器数据库：
1. 创建 IP。
2. 刷新重开数据保留。
3. 脏稿取消→继续编辑内容保留。
4. 显式保存并更新详情。
5. 归档/恢复。
6. 390px 详情无横向溢出。
7. 390px 编辑弹窗在 viewport 内、内容可滚动。
8. 并发 revision 更新时保存拒绝，本地输入保留。
9. browser back 触发 SPA 离开保护。
10. 放弃编辑后显示数据库最新版本。
11. 真实绑定项目出现在关联项目页。
12. 专属素材链接打开当前 IP scope。

截图已实际打开检查：`ip-desktop.png`、`ip-mobile.png`、`ip-editor-mobile.png`。
