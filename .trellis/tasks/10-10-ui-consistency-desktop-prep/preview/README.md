# 桌面工作台视觉提案

规划用的独立HTML，尚未改造产品；视觉已选，最终方案待审阅。打开index.html或本机 http://127.0.0.1:4175/ 。

可切换项目/素材/分镜，操作筛选、搜索空状态、示例弹窗、分镜选择和窄窗口导航/检查器。其他入口提示范围，不执行业务。所有项目、时长/媒体为静态示例，图形为本文件SVG，Logo复用public/brand/logo.webp；没有数据库/API/收费/用户项目连接。

原型native select/dialog不替换产品Radix/shadcn；“示例工作区”不新增最近项目/持久页签；分镜检查器仅示共同面板语言，正式分镜保留行编辑owner，已有音频/音乐/任务检查器对齐；预览页脚不新增产品保存状态。原型不能认证正式应用业务/可访问性/跨平台原生通过。

CUA实查1280×720、1024×720紧凑、390×844素材/编辑/检查器/弹窗、1280×600矮窗口：整页宽度无横向溢出；390px分镜表580px只内部滚动。检索空状态、Dialog Escape/焦点返回、导航与检查器切换验证。临时viewport已恢复。

[测量](screenshots/checks.json)；[项目](screenshots/projects-1280.png)、[素材](screenshots/materials-1280.png)、[工作区](screenshots/workbench-1280.png)、[紧凑工作区](screenshots/workbench-1024.png)、[窄素材](screenshots/materials-390.png)、[窄检查器](screenshots/workbench-390-inspector.png)、[窄弹窗](screenshots/dialog-390.png)、[矮素材](screenshots/materials-1280x600.png)。正式应用全站before/after仍按覆盖矩阵执行。
