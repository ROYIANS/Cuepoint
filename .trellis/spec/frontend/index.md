# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Directory Structure](./directory-structure.md) | Studio layout+index+$id vs project workspace | Filled |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Dexie liveQuery loading vs missing | Filled |
| [State Management](./state-management.md) | IndexedDB owner id, episodes, STUDIO_LIBRARY_ID | Filled |
| [Delivery Export](./delivery-export.md) | Episode-scoped CSV and printable storyboard contracts | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |

---

## Pre-Development Checklist

- [ ] Studio asset create stays on `/characters|scenes|props|styles/$id` with `STUDIO_LIBRARY_ID`
- [ ] Detail `useLiveQuery` uses `get(id) ?? null` so missing ids are not stuck on 加载中
- [ ] `touchProject` no-ops for `isStudioLibrary`
- [ ] Project landing is the episode list; story/shots/produce take `episodeId`
- [ ] Shot picture slots go through `parseShotPictureSlots` (old `frame`/`reference` included)

## Quality Check

- [ ] Studio create does not open a project picker or `/p/$projectId/...`
- [ ] `/characters/$missing` shows 找不到, not 加载中
- [ ] Dexie v2 `props` / `styles` tables stay in `collectMediaIds` / delete cascade
- [ ] `/p/$projectId` is the episode list; story/shots/produce live under `/p/$projectId/e/$episodeId`
- [ ] Shot queries and create/delete use `episodeId`, not the whole project table
- [ ] Delivery exports filter by both project and episode and wait for live queries to load
- [ ] Shot `status` defaults to draft; filters live on `shotSettings.filters` (empty arrays = all)
- [ ] Drag/arrow/keyboard reorder share `reorderBeats` / `reorderShots`; select-all stays visible-only

---

**Language**: All documentation should be written in **English**.
