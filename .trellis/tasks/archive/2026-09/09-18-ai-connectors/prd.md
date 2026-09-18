# OpenAI-compatible AI connectors

## Goal

Add a **studio-global BYOK connector** system with a WordPress-inspired「连接」list UI. MVP: **OpenAI-compatible** protocol (Base URL + API Key + default model) + save + **测试连接**. Keys stay on-device. Prepares for later Agent chat (separate task).

## Confirmed facts

- Local-first Dexie; no backend user DB.
- No AI client yet; project settings are aspect/cover only.
- Studio shell is the right home for global「连接」.
- Agent chat / film tasks will consume these connectors later (`docs/product/film-agent-workflow.md`).

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Studio-global (not per-project) |
| MVP depth | **A** — connectors UI + persist + test connection; **no** Agent chat UI in this task |

## Requirements

- **R1** Studio route/page「连接」: card list (name, short blurb, status, 安装/编辑). Visual language matches Cuepoint studio (not a WP clone).
- **R2** At least one live connector type: `openai-compatible` with fields **Base URL + API Key** only. Model choice belongs to Agent chat later.
- **R3** Persist credentials in IndexedDB (app-level settings table or equivalent); **exclude** from project ZIP export.
- **R4**「测试连接」and「拉取模型探活」use `GET /v1/models` (chat fallback for test only) to verify reachability; model ids are displayed for probe, not saved as connector preference.
- **R5** Card registry is extensible (e.g. DeepSeek preset card with same protocol + preset base URL).
- **R6** Document in `docs/product/ai-connectors.md` stays aligned.

## Out of scope

- Agent chat UI / film-task runner
- Per-project key overrides
- Server-side key storage
- Native Anthropic / Google protocols
- Shipping real provider logos under unclear license — use simple marks or text avatar if needed

## Acceptance criteria

- [ ] From studio, user can open「连接」, add OpenAI-compatible config, see 已连接.
- [ ] Test connection succeeds against a compatible endpoint with valid key (and fails clearly with bad key).
- [ ] Reload app: config still present; project export ZIP does not contain API keys.
- [ ] `pnpm lint` / `pnpm test` pass.
