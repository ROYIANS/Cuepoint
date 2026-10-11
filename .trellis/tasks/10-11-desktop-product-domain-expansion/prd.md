# Desktop Product Domain Expansion and Sync Preparation

## Goal

Continue product development in the native desktop runtime by moving one complete, user-visible product domain from the current browser/Dexie implementation into the application-owned SQLite workspace. Keep browser mode available as a separate runtime and leave a clean boundary for a later sync-provider layer; this task does not implement cloud synchronization yet.

## Background and confirmed constraints

- The native product foundation is complete for fresh workspace identity, SQLite metadata, managed asset files, project summaries, asset availability, and the native `/projects`, `/assets`, and `/p/$projectId` views.
- Browser mode remains a supported local runtime backed by IndexedDB/Dexie. Native rows must not be mirrored into Dexie, and existing development data does not need a migration or compatibility reader unless explicitly requested later.
- The desktop runtime is the product priority. The user is one person using multiple devices sequentially; collaboration and simultaneous multi-user editing are out of scope.
- Sync will later be implemented through an internally controlled provider/plugin boundary. Providers must transport validated checkpoints and must not write arbitrary SQLite tables or execute tools. This task only prepares the domain data boundary needed by that future protocol.
- The parent design already identifies full native domain coverage, complete checkpoint codecs, and provider adapters as later stages. This child must leave those stages possible without prematurely coupling the product domain to a provider or third-party folder.

## Requirements

1. Select one native product domain after repository evidence review and implement it as a bounded vertical slice in the real Tauri application. The selected domain must have a visible route, typed renderer/native DTOs, SQLite ownership, and restart-safe state.
2. Keep the browser implementation working unchanged under browser runtime detection. Do not add a browser-to-native migration, legacy reader, compatibility alias, or data mirror.
3. Keep canonical structured records in SQLite and copied binary data in the application-owned workspace. External absolute paths and provider folders are never canonical authorities.
4. Preserve explicit missing/corrupt file state and stable references when managed bytes are unavailable. A missing file must not silently delete logical records.
5. Add a narrow export/read boundary for the selected domain that can later feed an immutable checkpoint, while excluding device credentials, caches, continuation tokens, active execution claims, and provider-specific transport state.
6. Keep the future sync boundary explicit: local save, checkpoint creation, provider publication, and receiving-device application remain separate states. Do not add a live provider, account flow, conflict resolver, or plugin marketplace in this child.
7. Add native, renderer, and route-level regression coverage for the selected domain's create/read/update/reopen and missing-file behavior, plus the browser/native runtime split.

## Candidate domain decision

Repository evidence shows three major native gaps:

- **Video production core:** episodes, story beats, shots and their references under `/p/$projectId/e/$episodeId`.
- **Audio/music workspaces:** chapters, speakers, segments, takes, tracks, clips, drafts, works and generation history.
- **Agent/project history:** durable conversations, tool calls, results, approvals and dormant cross-device history.

The user selected the **video production core** (project mode → episode → story/shots) as the first native domain. It is the central project workflow, exercises relational ownership and ordering, and creates the most useful checkpoint boundary before the more specialized audio or history codecs. Audio/music and complete agent-history retention remain later native slices.

## Acceptance Criteria

- [ ] The selected native domain is reachable from the real packaged product route tree and does not use the browser/Dexie repository in Tauri mode.
- [ ] Creating and editing the selected domain persists typed SQLite records and reopens with the same stable IDs and ordering after restarting the app.
- [ ] The selected domain's managed media references resolve only inside the application-owned workspace; missing or corrupt bytes remain visible without deleting logical records.
- [ ] Browser mode continues to use the existing IndexedDB behavior, with tests proving that native commands are not invoked in browser mode.
- [ ] A deterministic, immutable read/export boundary exists for the selected domain and excludes credentials, caches, active execution authority and provider transport state.
- [ ] Native Rust tests, renderer tests, route/product tests, root quality gates and desktop quality gates pass.
- [ ] No migration, compatibility shim, cloud provider, arbitrary plugin code loading, or sync UI is introduced in this child.

## Notes

- Technical design is recorded in `design.md`; execution ordering and validation gates are recorded in `implement.md`.
