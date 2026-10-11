# Research: Packaged Agent fixture acceptance

- Query: Reuse the existing synthetic loopback supplier in the normal shared packaged SQLite UI to verify write approval, rejection, Stop, failures, original records and reopen without paid calls.
- Scope: internal
- Date: 2026-10-12

## Findings

### Existing files and contracts

| File | Purpose and relevant anchors |
| --- | --- |
| `scripts/native-product-fixture.mjs` | Actual executable synthetic provider: entry point at243–246, loopback bind at234–235, receipt at236–238. |
| `scripts/native-product-fixture-check.mjs` | Existing fixture/parser checks; lines92–110 check tool loading and stream decoding;229–239 demonstrate the disconnect evidence contract. It runs Node fetch and does not prove packaged native acceptance. |
| `desktop/tauri/scripts/sse-server.mjs` | Historical probe stream server requiring `Origin: tauri://localhost` and offering CORS; not the correct substitute for the current normal-product no-CORS fixture. |
| `src/lib/ai/catalog.ts:15` | Generic OpenAI-compatible connector has chat capability and `/v1` default contract. |
| `src/lib/ai/chatModelPolicy.ts:26` | Generic connector does not require provider catalog verification; manually searched fixture model names are valid selections. |
| `src/components/studio/ConnectorsPage.tsx:310` | Current Base URL / API Key fields, probe/test/save owners. |
| `src/components/agent/AgentControls.tsx:27` | Ask/assist/full permission options; default ask at44; changes apply to new executions. |
| `src/components/agent/AgentRunDetails.tsx:135` | `参数与返回结果` renders exact saved `call.arguments` and `call.result`; approval/reject buttons at154–156. |
| `src/components/agent/ModelSelectTrigger.tsx:285` | Actual composer Stop action has accessible label `停止`. |
| `src/lib/agent/businessTools.ts:539` | Existing shared `project_create`; no alternate fixture business writer. |
| `src/db/agentTools.ts:184` | Approval is saved against the original run/call; reject saves its original result. Completed replay at376 returns saved result without executing the mutation again. |
| `src/db/agentRuns.ts:242` | Reopen recovery marks interrupted running state or restores saved waiting approval; it does not submit a model call. |

### Safe fixture launch and connection

Root owns launching the service and all CUA operations. From the repository root, using a fresh evidence directory:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node scripts/native-product-fixture.mjs .trellis/tasks/10-11-shared-storage-sqlite/research/packaged-agent-fixture-01
```

No port environment is required: default port0 reserves an ephemeral listener on127.0.0.1 only. The startup JSON and `fixture-ready.json` identify the actual origin. Configure a new generic **OpenAI 兼容** connection in the isolated application, Base URL **`<origin>/v1`**, API Key **`synthetic-local-only`**, model **`fixture-chat`**. The token is intentionally public synthetic text; the fixture does not enforce credential authenticity. Saving the connection explicitly authorizes its configured HTTP origin through the current runtime policy. `GET /v1/models` returns the fixture model catalog; a successful generic connection test reads that catalog without paid provider traffic.

The server deliberately sends no CORS response headers and rejects OPTIONS (`native-product-fixture.mjs:129`). Actual packaged chat success therefore exercises the native HTTP path; Node fetch or another probe page cannot substitute. Keep the origin/port stable across the quit/reopen sequence. Stop the exact service with SIGINT/SIGTERM only after evidence is retained; its signal handler persists events.

### Deterministic UI sequence

Use a **new unbound ordinary chat for each case**, smart interaction mode, and permission **请求批准**. Default enabled creative capabilities already include story-edit/business-read. Do not use task mode or bind a project for `project_create`. The fixture's project/overview marker implementation examines every user message (`native-product-fixture.mjs:203–212`); reusing marker-bearing history can unintentionally select an older scenario.

1. **Read/stream baseline:** model `fixture-chat`, ordinary text. Expect Chinese and 🌹 with reasoning; `[fixture:overview]` instead exercises the existing `workspace_overview` read tool. It automatically loads the workspace tool group if necessary.
2. **Durable pending approval and actual write:** new chat, model `fixture-chat`, send `[fixture:project]`. The fixture first calls `load_tool_groups({groupIds:["story-edit"]})` if needed, then advertises `project_create` with exact arguments `{"name":"原生 Agent 验收项目","kind":"video","mode":"film","continueInProject":false}`. Wait for the existing `创建项目` approval row. Before approval, record baseline projects/POST count, quit/reopen the exact app, and verify waiting approval persists without a new chat POST or project mutation. Click **批准此次操作** once. Inspect the actual new project/initial episode and saved original parameters/result, including real generated IDs and receipt. A generic final synthetic completion sentence alone is not write proof.
3. **Reject:** a separate new unbound chat, same model and marker. Click **拒绝**. Expect saved rejected status/result (`用户拒绝了本次操作…`), no additional project row. The loader read can already have completed; only the business write is denied. Record project count/identities before/after.
4. **Stop and disconnect:** new chat, model `fixture-stop`, ordinary text with **no tool markers**. The Chat Completions route emits the first two SSE entries then holds the socket open (`native-product-fixture.mjs:223–227`). After visible first content, click **停止**. Expect retained partial content/stopped status and a server `disconnect` with `finished:false`; no late completion or automatic follow-up POST. Stop/partial variants are specific to Chat Completions; the Responses branch returns earlier and does not implement these variants.
5. **Provider failure:** new chat, model `fixture-http-error`, ordinary text. The fixture returns actual429 with `Synthetic provider rejection` at196. Inspect failed assistant/run/error record and no automatic retry.
6. **Actual registered-tool failure:** new chat, model `fixture-chat`, send `[fixture:tool] {"name":"business_detail","arguments":{"kind":"project","id":"sqlite-packaged-definitely-missing-project"}}`. This allowed fixture command loads business-read and validates against the product-advertised schema (`native-product-fixture.mjs:43–63`). Existing shared `business_detail` at`businessTools.ts:464` reads the actual store; `businessStore.ts:94` throws `ToolRecoveryError(PROJECT_NOT_FOUND,"项目不存在")`. Inspect the failed tool's original arguments/error/result. No business mutation is expected.
7. **Interrupted transport:** optional new chat, model `fixture-partial`, ordinary text. It closes after two entries without `[DONE]`; expect incomplete/error feedback with preserved partial content, never a claimed terminal success. Do not label this as a failed business tool.
8. **Final reopen:** preserve completed write, rejected write, stopped, provider-failed and tool-failed chats. Quit/reopen the exact app. Inspect history/original arguments/results and project identity again. Compare chat POST counts before/after idle reopen: catalog GETs are permitted; chat POST replay is not. Actual completed replay/unknown guards are additionally covered by the immutable real-native tests; a fixture-only server cannot itself prove a hidden mutation was not replayed.

`从已保存的步骤继续` appears only for recoverable states without pending approval or unknown outcomes (`AgentRunDetails.tsx:319–325`). Cancelled Stop is normally terminal; do not reinterpret a regenerate button as replay of saved completed results. An explicit retry of `fixture-http-error` or `fixture-partial` will intentionally produce another failed fixture request. Keep that user-initiated request distinct from reopen replay.

### Evidence helpers and data boundaries

- `GET <origin>/health`: readiness only.
- `GET <origin>/evidence`: event array and synthetic task IDs (`native-product-fixture.mjs:143–144`). It adds its own ordinary request event; count only POST `/v1/chat/completions` or `/v1/responses` for replay checks.
- `fixture-events.json`: persisted on disconnect and graceful shutdown; request records contain method/path, presence booleans for authorization/cookie, content type; body records contain byte count/hash/model and offered tool names (`native-product-fixture.mjs:121–141`). They do **not** contain keys, full request bodies, original arguments or tool results.
- Capture root CUA observations/screenshots with case labels and actual timestamps, known synthetic projects/chats and pre/post counts. Verify original record text through the UI; if root separately inspects SQLite, restrict it to this known disposable isolated profile and label that evidence separately.
- Preserve same fixture process/origin until all request-count/reopen comparisons are complete. Receipt and endpoint are synthetic fixture evidence, not genuine-provider/model quality or all-platform proof.

### Related specifications and versions

Read `.trellis/spec/frontend/shared-product-storage.md` (local lossless tool records, one shared owner, explicit transaction/replay contracts) and `.trellis/spec/frontend/native-product-runtime.md` (official native HTTP, configured origin policy, no native failure fallback). PRD R1/R3/R4/AC8 and implementation Phase6 require actual packaged Agent/system acceptance rather than parser/probe success. The current runtime spec pins Tauri API2.12.2 and HTTP plugin2.8.2; this investigation changes no dependency or source input. No external documentation was needed because the executable fixture and current UI owners establish the queried behavior directly.

## Caveats / Not Found

- Investigation launched no service, made no product/test/spec edits, read no user profile or connection keys, and used no CUA/osascript. Root independently launched the fixture after receiving the initial source findings.
- No general current-product fixture inspector or UI auto-seeding helper was found; do not inject a second feature implementation or import previous profiles to accelerate acceptance.
- The fixture's fixed project name means approval/reject assertions must use actual IDs/counts, not name alone.
- The fixture validates advertised schema structurally; the product's real strict parser, scope checks, approval and business command remain authoritative.
- Historical `desktop/tauri/scripts/sse-server.mjs` requires an Origin header and offers CORS, so it is not interchangeable with the current no-CORS native-product fixture.
- This new research artifact is outside the1122 frozen product inputs; account for it in the next task-evidence inventory. The dispatched role's mandatory persistence protocol requires this file even though the parent requested a read-only investigation.
