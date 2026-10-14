<!--
维护者使用说明：这是 Cuepoint 0.1.3 的具体 GitHub Release 正文草稿，不会被发布器自动读取。
1. 仅在 desktop-v0.1.3 的流水线上传完成后复制正文；核对五个安装包、SHA256SUMS、
   release-manifest.json，以及既有 ownership marker 的 status 为 complete。
   不要在工作流运行或重试期间编辑，发布器的完成步骤可能重写草稿正文。
2. 只替换面向用户的说明。保留原草稿的上传状态提示与 cuepoint-desktop-release HTML
   ownership marker 原文，不修改、删除或复制其他版本的 marker，也不由此改变 draft/prerelease 状态。
3. 对照实际 release-manifest.json，保留 manifest.limitations 的全部版本特定限制。
   下方通用限制与源码测试结果均不能代替这份发布记录，也不能证明安装版已验收。
4. 源码与文档使用 desktop-v0.1.3 链接，准确构建 SHA 由 manifest.context.sourceSha 提供。
   上传后核对标签来源、五个实际文件名和文档/配图链接，再由维护者完成功能检查并决定是否公开。
-->

# 小光点 Cuepoint 0.1.3 · 桌面体验版

感谢你体验小光点。它把创作助手、分镜、音频与音乐放进同一个工作室，让你围绕项目逐步整理和完成作品。

**第一次安装？选好下方的安装包，再看对应系统的两步图解即可。** 当前 Windows 包未进行代码签名，Mac 版本使用临时签名、尚未完成 Apple 公证，因此首次安装或打开时可能出现系统提示。下面会解释原因，并说明如何在确认来源后选择是否继续。

## 下载适合你的版本

| 你的设备 | 下载 | 要求 |
| --- | --- | --- |
| Mac · Apple 芯片（M 系列） | [下载 Apple 芯片版 DMG](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/Cuepoint_0.1.3_macos_arm64.dmg) | macOS 14 或更新版本 |
| Mac · Intel 处理器 | [下载 Intel 版 DMG](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/Cuepoint_0.1.3_macos_x64.dmg) | macOS 14 或更新版本 |
| Windows · x64 | [下载 Windows 安装包](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/Cuepoint_0.1.3_windows_x64_setup.exe) | x64 Windows；缺少 WebView2 时安装需要联网 |
| Linux · x64（Debian / Ubuntu 系） | [下载 DEB](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/Cuepoint_0.1.3_linux_x64.deb) | Ubuntu 22.04 构建基线，需满足运行依赖 |
| Linux · x64（AppImage） | [下载 AppImage](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/Cuepoint_0.1.3_linux_x64.AppImage) | 需满足运行依赖，部分环境需要 FUSE |

Mac 可在 **Apple 菜单 → 关于本机** 查看芯片；Windows 可在 **设置 → 系统 → 系统信息（关于）** 查看是否为“基于 x64 的处理器”。当前没有 Windows ARM、Linux ARM 或 Mac 通用安装包。

页面底部 **Assets** 里也有这些文件。**Source code (zip / tar.gz)** 是源码，不是桌面安装包。

## 关于首次打开的系统提示

系统会检查下载程序的发布者身份和软件信誉。当前版本尚未完成上述正式签名与公证，所以系统可能暂时无法验证发布者，或无法确认这份新程序的信誉。**出现这类提示，并不等同于系统已经检测到病毒；也不代表软件一定安全。**

我们提供公开源码、版本来源、文件校验值和安装说明，方便你了解与核对。请确认文件来自 **[ROYIANS/Cuepoint 官方 Release](https://github.com/ROYIANS/Cuepoint/releases)**，再决定是否继续体验。只为当前应用选择是否运行，无需关闭系统安全功能。

### Windows：更多信息 → 仍要运行

1. 双击安装包。若出现 **Windows 已保护你的电脑**，点击 **更多信息**。
2. 核对文件名为 `Cuepoint_0.1.3_windows_x64_setup.exe`，并确认它来自本页。当前包可能显示 **未知发布者**，这个字样无法验证作者身份；愿意继续体验时，再点击 **仍要运行**。
3. 按安装向导完成安装，从开始菜单打开 **Cuepoint**。没有出现上述提示时，直接按向导操作即可。

![Windows 操作示意：更多信息后核对文件名和来源，再决定是否仍要运行](https://raw.githubusercontent.com/ROYIANS/Cuepoint/desktop-v0.1.3/docs/assets/installation/windows-first-open.png)

*操作示意，非系统截图；按钮名称和位置以你的设备为准。*

### Mac：拖入应用程序 → 按系统提示选择是否打开

1. 双击 DMG，将 **Cuepoint** 拖入 **Applications（应用程序）**，再从“应用程序”启动它。
2. 如果遇到开发者未验证或未公证的提示，先关闭提示。确认下载来源后，打开 **系统设置 → 隐私与安全性**，向下找到 Cuepoint 对应的说明；愿意继续体验时点击 **仍要打开**，按系统要求确认后点击 **打开**。

![macOS 操作示意：先尝试打开，再在隐私与安全性中找到 Cuepoint 并决定是否仍要打开](https://raw.githubusercontent.com/ROYIANS/Cuepoint/desktop-v0.1.3/docs/assets/installation/macos-first-open.png)

*操作示意，非系统截图；按钮名称和位置以你的设备为准。*

**没有对应的继续按钮？** 请反馈完整提示；公司或学校管理的设备请联系管理员。**如果提示病毒、恶意软件、将损坏电脑或文件已损坏，请停止安装并反馈，不要按上述步骤强行继续。**

Linux 用户及需要更多帮助的读者，可查看 [完整安装与首次打开指南](https://github.com/ROYIANS/Cuepoint/blob/desktop-v0.1.3/docs/desktop-installation.md)。

## 本次更新

- **设置页**：新增通用、外观、连接与模型、存储、关于与更新五个分区，支持搜索设置项；统一页头、导航和分组样式，并适配窄窗口。
- **检查与下载更新**：在设置中查看当前版本、检查新版本、打开发布页。符合大小和校验条件的桌面安装包可在应用内下载，经文件大小与 SHA-256 校验后交给系统保存；后续安装仍由你手动完成。启动时自动检查默认关闭。
- **连接配置**：模型连接、网络搜索连接与模型目录统一放在设置中；补齐网络搜索图标。修复打开 Tavily 配置时，浏览器自动填充误触发设置搜索、导致弹窗消失与草稿丢失的问题。
- **模型目录**：刷新内置模型目录，补充模型条目与参考价格。实际模型可用性与费用以你连接的服务为准。
- **窗口与弹层**：宽窗口隐藏导航汉堡按钮，窄窗口保留菜单入口；调整上下文明细、模型选择器等弹层的顶部避让，减少顶栏遮挡。
- **旧工作区兼容**：修复 0.1.2 无法打开 0.1.0 / 0.1.1 创建的工作区的问题。0.1.3 会识别对应的旧工作区结构并补齐设备设置登记，让旧工作区支持新的设置存储；存储错误也会保留具体错误码，方便反馈。

### 从旧版升级

升级前先导出需要保留的项目 ZIP，再退出 Cuepoint 并安装本版本。项目 ZIP 的备份范围见下方说明；它不包含全部连接、API Key 或完整聊天历史。旧工作区迁移的实际安装与数据验收需要在对应设备上确认，不能由打包成功代替。

## 开始使用

- 在 **设置 → 连接与模型** 添加自己的 AI 服务和 API Key；本地项目编辑与素材管理无需配置 AI 连接。
- 在 **项目** 创建视频、音频或音乐项目，再整理稿件与素材。
- 从 0.1.3 起，可在 **设置 → 关于与更新** 检查新版本、打开发布页并下载安装包。桌面应用内下载会核对文件大小与 SHA-256，再通过系统“另存为”对话框保存；超过 64 MiB 或缺少校验值时，提供浏览器下载入口。保存后仍需退出应用并**手动安装**，不会自动安装或重启。也可以直接从本页下载。
- **设置 → 通用** 中的“启动时自动检查更新”默认关闭，可按需开启；成功检查后 24 小时内不再自动检查。
- 更新前请导出项目 ZIP 备份。桌面版与浏览器版的数据目前不会自动同步。

更多用法见 [项目 README](https://github.com/ROYIANS/Cuepoint/blob/desktop-v0.1.3/README.md)。

<details>
<summary>文件校验、版本来源与当前限制</summary>

- 版本：`0.1.3`；标签：`desktop-v0.1.3`。
- 对应源码：[desktop-v0.1.3 源码树](https://github.com/ROYIANS/Cuepoint/tree/desktop-v0.1.3)。准确提交 SHA 记录在下方的 `release-manifest.json` 的 `context.sourceSha` 中。
- 校验值：[SHA256SUMS](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/SHA256SUMS)。操作方法见 [安装指南的 SHA-256 核对步骤](https://github.com/ROYIANS/Cuepoint/blob/desktop-v0.1.3/docs/desktop-installation.md)。
- 发布记录：[release-manifest.json](https://github.com/ROYIANS/Cuepoint/releases/download/desktop-v0.1.3/release-manifest.json)。其中包含本版本实际限制，请以该发布记录为准。
- 当前是早期桌面体验包。发布工作流仅自动打包，未运行自动化测试、应用启动或运行时验收；上传完成不代表功能测试通过，公开发布前仍由维护者完成功能检查。
- 构建来源与安装包哈希核对不代表已验证安装后的架构、界面、SQLite 持久保存、音频、麦克风、打印、PDF、AI 服务或媒体编解码器。
- Linux 使用 Ubuntu 22.04 x64 构建基线；其他发行版、AppImage/FUSE 启动及媒体环境需要在对应设备上确认。
- Windows 工作区要求本机 NTFS。现有恢复机制不保证突然断电或系统崩溃后所有新文件和目录均已持久保存，请定期导出项目备份。
- 项目 ZIP 不包含整个工作室、全部连接/API Key 或完整聊天历史；范围见 [备份说明](https://github.com/ROYIANS/Cuepoint/blob/desktop-v0.1.3/README.md#项目-zip-的范围)。

哈希值一致，可以确认文件内容与本页列出的内容一致；它不能单独证明软件没有安全问题。签名状态、版本来源和实际功能情况应结合查看。

</details>

## 遇到问题，我们一起定位

请在 [GitHub Issues](https://github.com/ROYIANS/Cuepoint/issues) 提供 **系统版本、设备架构、完整安装包文件名、停在哪一步，以及提示文字或截图**。截图请隐藏私人信息和 API Key。

谢谢你帮小光点变得更好。
