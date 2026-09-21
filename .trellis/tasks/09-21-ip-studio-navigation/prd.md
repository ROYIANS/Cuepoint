# IP-driven studio navigation foundation

## Goal
Expose the approved IP-driven creative studio structure while retaining the working video product and chat landing. User explicitly requested implementation after reviewing the plan, added music, and clarified new capabilities are placeholders to be completed gradually.

## Confirmed product decisions
- Chat stays the default home.
- Global navigation: 创作助手 / 我的 IP / 项目 / 素材库 / 任务; utilities: 连接与模型 / 设置与帮助.
- IP is a long-lived creative identity, not a project type. Projects may be independent.
- Five project types: 视频 / 图片 / 文案 / 播客 / 音乐. Type is fixed after creation; no cross-type copy.
- Future chat creation uses a confirmation card; no automatic project creation from tentative ideas.

## This increment
R1. Implement navigation and useful destination pages. 我的 IP is an honest coming-soon surface describing identity, projects and assets, with no fake profiles or writes.
R2. Project gallery and creation expose all five types. Only video creation is available; other types display 即将推出 and cannot create records. Existing video gallery, search, sorting, opening, rename, backup and delete continue working.
R3. Consolidate existing character/scene/prop/style destinations under 素材库 while preserving old URLs and detail editors. Existing library routes expose a way back to the consolidated hub.
R4. Task entry opens existing /agent/tasks and is highlighted independently from chat. Utility destinations remain usable; do not advertise nonexistent settings.
R5. Responsive desktop/mobile navigation, visible keyboard focus, no horizontal page overflow at 390px. Keep the existing restrained monochrome theme and 76px desktop rail.

## Acceptance
- / still reaches /agent; no new modal or onboarding interrupts chat.
- Desktop and mobile menus have identical destinations, correct current-state highlighting including library details and /agent/tasks.
- All five types are discoverable in gallery and creation; placeholders show truthful copy and no fabricated projects/counters/waitlist.
- Video create still reaches the actual workspace; existing data is interpreted as video without database or ZIP migration.
- IP association, IP editing, AI context inheritance, new editors and chat confirmation-card runtime remain future capabilities in this placeholder-only increment.

## Out of scope
Database/schema/tools changes, actual IP persistence or binding, new media generation capabilities, account publishing, scheduling, analytics, automatic commits and pushes. Preserve unrelated dirty journals and audit archive.

## Approval
The prior conversation established the product design; latest user authorized starting, explicitly including music and placeholder-first delivery. No further product decision blocks this increment.
