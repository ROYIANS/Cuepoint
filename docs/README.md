# 小光点 · 规划文档

本目录存放产品与架构规划，避免口头结论丢失。实现以代码与 `.trellis/tasks` 为准；此处是方向备忘。

| 文档 | 内容 |
| --- | --- |
| [product/film-agent-workflow.md](./product/film-agent-workflow.md) | 模仿 Trellis 的「影视任务」工作流：聊天建任务、约定/经验、Skills |
| [product/ai-connectors.md](./product/ai-connectors.md) | 全局 BYOK 连接器（OpenAI 兼容优先） |
| [architecture/runtime-options.md](./architecture/runtime-options.md) | 纯静态 BYOK / 弱 Node / 桌面端 / P2P 能做什么 |
| [architecture/ai-capabilities.md](./architecture/ai-capabilities.md) | AI 能力边界（相对 ChatGPT）、异步生成、记忆 / Skills / MCP |

**已拍板的产品原则（摘要）**

1. **本机优先**：创作数据在浏览器 Dexie（或未来桌面本地库），不默认上云库。  
2. **BYOK**：模型与出图/出视频 Key 由用户自备。  
3. **长任务靠供应商异步**：如 apimart 返回 `taskId`，本机存单、回访轮询；不依赖页签一直开着。  
4. **Agent 价值在工作流**：任务状态机 + 项目约定/经验可复用，而不是做成第二个通用 ChatGPT。  
5. **服务器可选且「无用户库」**：若自备 Node，只做代理/信令/公共资源/短时 webhook，不当 AI 与项目数据后台。
