# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

小光点 Cuepoint is a Vite + React + TanStack Router client with Dexie IndexedDB as the system of record. Specs in this directory describe how routes, components, hooks, domain types, and tests are actually structured so agents match existing patterns.

---

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Directory Structure](./directory-structure.md) | Studio layout+index+$id vs project workspace | Filled |
| [Component Guidelines](./component-guidelines.md) | Thin routes, feature pages, ui primitives, slots | Filled |
| [Agent Tools](./agent-tools.md) | Strict tools, permission snapshots, approval ledger and continuation | Filled |
| [Creative Skills](./agent-creative-skills.md) | Business CRUD, frozen previews, atomic writes and durable media generation | Filled |
| [Batch Generation](./agent-batch-generation.md) | Reviewed 20-item queue, two-worker safety, candidate selection and current evidence | Filled |
| [Agent Tasks](./agent-tasks.md) | Shared task/chat identity, plan ownership, artifacts and explicit completion | Filled |
| [Task Wrap-up](./agent-task-wrapup.md) | Evidence-backed review, durable summaries and explicit completion | Filled |
| [Project Memory](./project-memory.md) | Reviewed project knowledge, provenance, revision CAS and ZIP transfer | Filled |
| [Memory Retrieval](./agent-memory-retrieval.md) | Scoped lexical selection, independent request envelopes, audits and read tools | Filled |
| [Project Context](./agent-project-context.md) | Project binding, bounded facts, tool scope and deletion guards | Filled |
| [Project References](./agent-references.md) | Local reference parsing, shared source library and native model image input | Filled |
| [Agent Context](./agent-context.md) | History policy, shared budgets and durable compaction | Filled |
| [Agent Execution](./agent-execution.md) | Durable runs, ordered checkpoints, explicit retry and cross-tab recovery | Filled |
| [Chat Performance](./chat-performance.md) | Agent transcript scroll + memo vs LobeHub virtua | Filled |
| [AI Connectors](./ai-connectors.md) | Provider capabilities, APIMart/AIHubMix generation contracts and discovery | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Dexie liveQuery loading vs missing | Filled |
| [State Management](./state-management.md) | IndexedDB owner id, episodes, STUDIO_LIBRARY_ID | Filled |
| [Asset / Output Foundation](./asset-output-foundation.md) | Optional metadata, prop/style relationships, media reuse and APIMart output profiles | Filled |
| [Production Contracts](./production-contracts.md) | Handoff ZIP, scoped context, reviewed proposals and Dexie v7 | Filled |
| [Delivery Export](./delivery-export.md) | Episode-scoped CSV and printable storyboard contracts | Filled |
| [Quality Guidelines](./quality-guidelines.md) | tsc lint, Vitest lib/repo tests, forbidden patterns | Filled |
| [Type Safety](./type-safety.md) | Domain types, normalizers, Zod package boundary | Filled |

---

## Pre-Development Checklist

- [ ] Studio asset create stays on `/characters|scenes|props|styles/$id` with `STUDIO_LIBRARY_ID`
- [ ] Detail `useLiveQuery` uses `get(id) ?? null` so missing ids are not stuck on 加载中
- [ ] `touchProject` no-ops for `isStudioLibrary`
- [ ] Project landing is the episode list; story/shots/produce take `episodeId`
- [ ] Agent list scroll uses `snapChatToBottom` / `isChatNearBottom` (`src/lib/chatScroll.ts`), not `scrollIntoView` smooth

## Quality Check

- [ ] Studio create does not open a project picker or `/p/$projectId/...`
- [ ] `/characters/$missing` shows 找不到, not 加载中
- [ ] Dexie v2 `props` / `styles` tables stay in `collectMediaIds` / delete cascade
- [ ] `/p/$projectId` is the episode list; story/shots/produce live under `/p/$projectId/e/$episodeId`
- [ ] Shot queries and create/delete use `episodeId`, not the whole project table
- [ ] Delivery exports filter by both project and episode and wait for live queries to load
- [ ] Shot `status` defaults to draft; filters live on `Episode.shotFilters` (v6 migrates legacy project filters) (empty arrays = all)
- [ ] Agent stream does not `scrollIntoView({ behavior: "smooth" })` on a sentinel; history ChatItems memo by content/status/reasoning/reasoningDurationMs

---

**Language**: All documentation should be written in **English**.
