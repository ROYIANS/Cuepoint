# 运行时与部署选项

在「本机数据 + BYOK、不默认上云库」前提下，几种形态能做什么。

## A. 纯静态前端 + BYOK（推荐先做）

- 托管：Pages / 对象存储即可，**你们可不养应用服务器**。  
- 创作数据：Dexie。  
- 出图/视频：供应商异步 API（如 apimart）→ 返回 `taskId` → 写入本机 → 用户关页后再打开轮询。  
- Agent：浏览器内调模型；Tools 读写本机表；Skills/约定在本机。  

**关页不能继续的**，是「必须开着页才能一步步调」的同步链路；**供应商侧的异步生成可以继续**。

## B. 可选弱 Node（无用户数据库）

服务器**不当**项目/AI 数据后台，只做：

| 用途 | 说明 |
| --- | --- |
| CORS / API 代理 | Key 可短时过路、不落盘 |
| 短时 Webhook 收件箱 | 可选；取走即删 |
| WebRTC 信令 / TURN | 多设备同步辅助 |
| 静态资源 / Skills 模板分发 | 公共内容 |

仍不存：项目明文、长期 Key、成片库。

## C. 桌面端（Electron / Tauri）

等于自带「本机弱后端」：

- 托盘/后台轮询 taskId、排队  
- 真 MCP（stdio）、本地 ffmpeg  
- Key 进系统钥匙串、SQLite/文件记忆  
- 少 CORS 问题  

数据仍可全在用户机器；与 Web 可共用一套 UI 代码。

## D. P2P 跨设备同步

- 可行，但浏览器里很少「零中继」；常要信令/TURN。  
- 与「异步出片」解耦：出片靠供应商；同步用导出包或可选 CRDT/WebRTC。  
- MVP 不依赖 P2P；ZIP 备份已具备。

## 能力对照（相对 ChatGPT Web = 100）

面向「AI 分镜成片工具」而非通用助手时，纯前端 + BYOK + 异步生成大约 **域内 50–65**；有桌面后台队列可到约 **70–80**（主要是可靠性，不是更闲聊）。

详见 [ai-capabilities.md](./ai-capabilities.md)。

## 建议路径

```text
静态 Web + Dexie + BYOK + taskId 轮询
  → 影视任务 / Canon / Skills（见 product/film-agent-workflow.md）
  → 需要时再加：无库 Node 代理 或 桌面壳
```
