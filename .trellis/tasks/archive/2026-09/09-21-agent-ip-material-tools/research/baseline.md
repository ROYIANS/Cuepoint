# Evidence — 2026-09-21

本机4173开发服务，独立Playwright browser context导入实际 tools.ts/skills.ts/contextUsage.ts 测量，无模型请求。

| Item | Count/size |
| --- | --- |
| Registry | 57 tools |
| Default enabled skills | 8 (web-research disabled) |
| Default deduplicated tool set | 50 |
| Default schema serialized chars | 35,308 |
| Schema estimated tokens | 11,865 |
| Skill instruction estimated tokens | 1,951 |
| Unbound filtered set | 44 tools; 32,286 chars; 10,661 estimated schema tokens |

不含eligible任务额外5工具，不含任务提示和用户资料。估算器ASCII 0.25/non-ASCII 1.5，不是实际tokenizer或账单。

代码：skills.ts assembleSkills去重但拼全部说明；runChat.ts每轮三次toolSchemas(enabledToolNames)供预算/请求；agentRuns.ts保存完整权限工具集；无IP/material新库tools。纯conversation零工具已实现。

Largest schemas estimates: project_update769, prepare_generation_batch589, submit_generation529, shot_update513, shot_create510, slot_update417, discover_project_images371, project_history_read333。

Official docs read:
- https://developers.openai.com/api/docs/guides/tools-tool-search — deferred discovery reduces exposed definitions, adds lookup step; native hosted/client types exist. We choose application-level discovery for existing compatible providers.
- https://developers.openai.com/api/docs/guides/prompt-caching — repeated prefix caching; keep separate from reducing definitions/context; actual cached usage is provider dependent.
