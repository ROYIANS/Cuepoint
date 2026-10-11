# Agent reuse and native blockers

Date: 2026-10-11. Read-only source research; no product changes, tests/builds or supplier calls. The user wants rapid complete desktop feature parity, with Agent/AI first.

## Reuse conclusion

The existing Agent is the product implementation to keep. Its components, protocols, tools and execution loop should serve both runtimes. SQLite/files and operating-system services require adapter work; they do not justify a separately rebuilt Agent.

The previous native video slice shares React views, but its Dexie and Rust mutations duplicate some business semantics. A whole-product port should reduce that duplication through shared dependencies rather than continue per-domain native business reconstruction.

## Actual Agent chain

`src/routes/_studio.agent.tsx:5` → `AgentChatPage` → `chatExecutionFlows.ts:61` → `createChatThread` / `beginAgentRun` → `src/lib/agent/runChat.ts:219` → context preparation → model stream → checkpoints → tools/approvals → finishing/final review → completed run.

| Layer | Existing code to retain | Actual adaptation |
| --- | --- | --- |
| Presentation | ChatWorkspace, topic list, composer, messages/reasoning, approvals, tasks and activity | Shared query/mutation owner or deliberate existing IndexedDB owner in a temporary desktop stage |
| Model protocols | Chat Completions/Responses, reasoning parameters, model catalog, SSE parser, Stop/error behavior | Central runtime transport through existing `fetchImpl` injection |
| Agent orchestration | Send/retry/resume, permission checks, run writer, tool schemas, context and outcome checks | Shared typed persistence/runtime dependencies; no Rust conversation loop |
| Product tools | Existing project/episode/story/shot/world/media/audio/material/memory commands and schemas | A coherent storage owner and preserved atomic command composition |
| OS services | Existing high-level product behavior | Native network, credential, run ownership and file/dialog adapters where WebKit cannot supply the required behavior |

## Native blockers

- `src/routes/_studio.tsx:16` currently gates Agent and connector routes; removing the gate alone does not provide their storage/runtime dependencies.
- `AgentChatPage.tsx:60`, `ConnectorsPage.tsx:36`, `MessageList.tsx:173` and `src/db/agentRuns.ts:68` directly depend on Dexie queries/transactions.
- `src/lib/agent/businessTools.ts:7` calls existing browser business commands; `businessStore.ts:85` reads their tables. These are reuse targets, not a reason to write alternate native tool definitions.
- `src/db/agentTools.ts:340` commits the business mutation and completed tool result/receipt together. Existing separate native video requests cannot be followed by another history write and called equivalent.
- `src/lib/agent/runOwnership.ts:12` requires Web Locks and exposes a `ThreadLockManager` injection seam. Verify actual packaged behavior or provide that seam; do not assume a prototype proves run ownership.
- `desktop/tauri/src-tauri/tauri.conf.json:13` permits only IPC/self in `connect-src`, so current normal packaged configuration blocks external model requests. WebView CORS is another compatibility dependency.
- `src/lib/ai/chatStream.ts:357` already accepts `fetchImpl`; `requestBoundary.ts:12` centralizes requests; `boundedSse.ts:75` handles response streams/AbortSignal. Reuse those protocol/parser algorithms with a cancellable runtime transport.

## Full Agent scope, not a chat-only claim

`src/lib/agent/tools.ts` registers plan/overview plus IP, audio, music, audio generation/batches/arrangement, materials, tool discovery, tasks, video/world business, generation, memory, references and web research families. First usable chat/video evidence is useful, but it does not prove complete Agent parity. The final parity matrix must include every registered family, approvals/denials, task records/wrap-up, context/memory/reference inputs, generation recovery and full original tool history.

A SQLite-first vertical slice can begin with connector/Agent config, threads/messages/runs/tool calls/context compaction and existing video tools without waiting for all 49 tables. Full remaining tools still need their real data dependencies. An all-Web/IndexedDB stage preserves those existing dependencies with fewer changes, but intentionally changes the first desktop storage owner and requires user selection.

## Scope safeguards

- Keep exactly one authoritative product owner per desktop stage; do not combine SQLite projects with a second independent IndexedDB Agent project database.
- Keep networking/provider execution outside local atomic write transactions.
- Complete raw historical tool records remain a goal; credentials, continuation tokens and execution authority are distinct from transportable history.
- Fresh development means no historical data import/compatibility; it does not mean replacing existing UI or rules.

Source: read-only `next_native_slice` Agent-first follow-up and direct registration inspection. See `shared-storage-feasibility.md` for transaction details.
