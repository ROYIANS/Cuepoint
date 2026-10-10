# Initial persistence inventory

Date: 2026-10-10. Repository: main, based on commit `8b8b709e`. Research only; no user records or credentials were read.

This is a declaration-level inventory and a focused inspection of ZIP, media, secrets and execution owners. It does not establish that every field is safe to synchronize. Field-level export/merge contracts remain planning work after the product direction is chosen.

## Current durable state

`src/db/database.ts:56` declares 49 tables; schema migrations reach v24 at `src/db/database.ts:310`. Dexie is currently the system of record. Ownership is significant: `projectId: "studio"` identifies studio library ownership rather than a project row (`.trellis/spec/frontend/state-management.md:54`).

| Group | Tables | Scope / synchronization concern | Current project ZIP coverage |
| --- | --- | --- | --- |
| Visual projects (7) | projects, characters, scenes, props, styles, episodes, shots | Project content; characters/scenes/props/styles can also belong to the studio. Ordering, references and deleted owners must remain consistent. | Project snapshots included; studio source rows excluded |
| Audio/music content (9) | audioChapters, audioSpeakers, audioSegments, audioTakes, audioTracks, audioClips, audioExports, musicDrafts, musicWorks | Project-owned scripts, selections, clips, timing and exports; concurrent timing/selection edits require business validation. | Included for audio/music projects via audioProject.json |
| Media (1) | media | Metadata plus Blob bytes; project and studio owners. Immutable replacement IDs are already used. | Referenced/retained project media selected by collectMediaIds; not a whole-workspace binary export |
| IP/material library (6) | ipProfiles, projectIpLinks, libraryMaterials, materialVersions, materialUses, materialEvents | Global, IP and project scopes. MaterialVersion payloads contain file Blobs or setting snapshots with media. Source revisions differ from adopted project copies. | Source library/IP/history tables excluded; adopted project content can be represented through copied target rows/media |
| References/memory (4) | projectReferences, referenceChunks, projectMemories, projectMemoryVersions | User material, extracted chunks and immutable memory history; distinguish source content from rebuildable extraction/index data. | Included for the selected project |
| Agent/conversation (8) | chatThreads, chatMessages, agents, agentTasks, agentRuns, agentToolCalls, contextCompactions, productionProposals | Studio/project-linked content and mixed runtime/approval state. General agent settings also store generation preferences. | Not a complete conversation/runtime export |
| Task evidence (4) | agentTaskRecords, agentTaskRecordVersions, agentTaskWrapups, agentTaskWrapupVersions | User-visible task history, source evidence and historical snapshots; references must not become executable instructions on another device. | Excluded |
| Generation workflow (7) | audioGenerationJobs, audioGenerationBatches, audioGenerationBatchItems, audioArrangementProposals, agentGenerationBatches, agentGenerationBatchItems, agentGenerationJobs | Historical inputs/results mixed with paid submission state, local claims, approvals and provider task identifiers. | Audio records included with dormant/sanitized runtime state; agent generation records excluded |
| Connections (3) | connectors, connectorAliases, searchConnections | BYOK credentials, endpoints and historical connector aliases. Explicit device-secret handling needed. | Excluded |

The group counts sum to 49; each declaration is listed once. ZIP observations come from `src/lib/projectPackage.ts:71`, `src/db/audioShared.ts:7` and `src/lib/audioProjectPackage.ts:23`, rather than an assumption that all project-linked tables are exported.

## Other persistence and temporary state

- `src/components/music/MusicWorkspacePage.tsx:62`: project-scoped music variant-to-draft links in localStorage. The drafts themselves remain durable in Dexie. Decide whether links become portable state or can be reconstructed without losing expected navigation.
- `src/components/agent/FloatingComposer.tsx:237`: localStorage send-shortcut preference. Its multi-device behavior is a product choice, not automatically part of content sync.
- `src/components/agent/ChatWorkspace.tsx:28`: sessionStorage sidebar collapse. A likely device/session-local presentation setting.
- Waveforms, decoded audio, search/sort controls and pending form edits require separate cache/unsaved-edit treatment. No complete cache inventory is claimed by this first pass.

## Existing contracts to retain

| Evidence | Current behavior | Consequence for future planning |
| --- | --- | --- |
| src/db/media.ts:56 | Physical media replacement creates a new record; owner is validated transactionally | Preserve business IDs and owner references; optionally introduce content hashes separately for transfer deduplication |
| src/domain/materials.ts:47 | Material-version payloads can contain Blob bytes and nested media snapshots | A plain JSON dump would omit binary contents; extraction must cover nested payloads as well as media.blob |
| src/db/projectMemories.ts:34 and :42 | Ownership validation and local revision comparison | Local numeric CAS cannot identify two offline devices independently deriving different revision N+1 values |
| src/db/agentGeneration.ts:6 | Local transaction prevents duplicate submissions for a call/fingerprint | Cross-device replication does not turn this local guard into a distributed execution lock |
| src/domain/audioGeneration.ts:67 | Job has claim and dormant fields | Device execution authority must be separate from replicated history |
| src/lib/audioProjectPackage.ts:23 | Export makes audio jobs/batches dormant and clears claims/confirmation details | Useful existing safety precedent; live sync must define its own state policy rather than reuse import blindly |
| src/db/searchConnections.ts:11 and src/domain/types.ts:523 | Search and AI connection records include apiKey | Do not treat credential-bearing records as ordinary content files; proposed default exclusion requires product confirmation |
| src/db/generationPreferences.ts:14 | Settings reference connectors via the general agent record | A synced preference may point at a missing local connection; preserve intent and show repair instead of creating credentials |

## Why current ZIP is not live synchronization

`exportProjectZip` snapshots related rows and Blobs in one read transaction, and compresses after that transaction closes. This is a useful portable package contract.

`importProjectZip` starts at `src/lib/projectPackage.ts:194`; it creates a new project ID at line 254, remaps media IDs at line 266 and remaps related rows at line 298 before adding them. This is deliberate copy/import behavior. Repeatedly importing a synchronized ZIP would create independent identities and would not resolve edits, deletion or global content coverage.

The future migration path and the existing copy-import action must be distinguishable: joining an existing synchronized workspace preserves identity; importing a project copy continues to create new IDs.

## Proposed classification for the next planning pass

1. User content: project/library/IP/chat/task records and historical results. Decide initial coverage and retention.
2. Binary content: media and nested library payloads. Decide whole-library versus selective/on-demand transfer, maximum file sizes and missing-file behavior.
3. Rebuildable state: indexes, extraction caches, waveforms and decoded audio. Preserve source inputs and avoid transferring unnecessary caches.
4. Device secrets/preferences: API keys, local endpoints, shortcuts and sync credentials. Decide exclusions, secure local storage, recovery and any explicit encrypted opt-in.
5. Executable state: running jobs, claims, approvals, callbacks and prepared paid batches. Remote data arrival must not authorize submission, replay or takeover.

This initial inventory predates the approved decisions now recorded in the parent PRD: managed copies, automatic full delivery, device-local credentials, dormant execution history and a Cuepoint-managed default service. Its classification list remains field-level work rather than unresolved product intent. Before a real migration, each persisted field needs an owning export/import contract and at least one acceptance scenario covering referential integrity and restart recovery.
