# Desktop persistence and synchronization exploration

Status: in progress. The user approved the complete planning summary on 2026-10-10. Implementation is staged through independently verifiable children; live service integration and real-user migration require their later concrete scope gates.

## Goal and user value

Determine a durable, approachable local-first storage and multi-device synchronization design for Cuepoint's future independent cross-platform desktop app. Ordinary users should not install or administer PostgreSQL or another database server. Experienced users may optionally bring their own storage or self-host. Cuepoint must reserve its own plugin system for synchronization and future extensions. Investigate Obsidian, Anytype, Notion, cloud drives and generic storage channels, along with project folders and optional version management.

## Confirmed intent

- Explore first; do not immediately implement a provider or migrate user data.
- Keep the application usable locally and make synchronization understandable to nontechnical users.
- Investigate borrowing an existing application's infrastructure versus operating our own service.
- Avoid requiring ordinary users to deploy servers. This is a deployment/UX constraint; it does not yet prohibit an embedded local database or managed infrastructure.
- Obsidian is a preference for investigation, not approval to make it a mandatory dependency or bundle its code.
- The user resolved the host/product-shape decision: Cuepoint remains independent and owns its plugin entry point. Connections to other applications/services are Cuepoint plugins, not a decision to turn Cuepoint into an Obsidian plugin.
- Reserve extensibility beyond synchronization. Third-party plugin distribution, marketplace and unrestricted code loading are future considerations, not an approved first-release scope.
- Projects should have an understandable file organization for assets and outputs. Application-owned content is the canonical authority; investigate SQLite and its combination with files. The database layout/engine and one database per project remain technical candidates.
- Database/file consistency and synchronization behavior must be explicit. Git/SVN are candidates for optional file version management; they are not yet selected or mandatory for users.
- The user confirmed single-person multi-device use, with devices normally used in sequence. Multi-person collaboration and intentional simultaneous editing are outside the current product scope. Offline/stale-device divergence still needs loss prevention; ordinary switching must not require both devices to be online at once.
- All first-release editing is managed through Cuepoint. External edits to generated structured project files are ignored as input; the next relevant save/publication regenerates those files from application-owned content. This does not authorize overwriting unrelated files or treating remote protocol changes as manual file edits.
- When a referenced asset file is removed externally, retain its data mapping and project references and show a missing-asset state. Do not erase clips, slots or metadata merely because a file is unavailable.
- All imported files must become independent copies inside the Cuepoint-managed workspace. The application acts as the content container; live projects must not depend on files in Downloads/Desktop/external drives after a successful import. Links to external originals are excluded from the first release. Deleting an original source after import must not make the managed asset missing.
- Connected devices should, by default, automatically download the synchronized project data and required asset/output files into that device's managed workspace. A completed handoff should be usable offline; on-demand delivery is a later optimization for unusually large libraries, not the first-release default.
- Secrets remain device-local by default. Non-sensitive connector metadata and synchronization state may travel with the project, while credentials require local configuration on each device. History, generated results and approval records may be synchronized, but incoming data must not take over a runtime claim, authorize a paid request or automatically retry execution on the receiving device.
- The default onboarding direction is a Cuepoint-managed sync service for ordinary users, with optional provider plugins for self-hosted S3/WebDAV/cloud-folder or other compatible storage. Obsidian, Anytype and Notion remain optional connectors or publication targets rather than runtime hosts or mandatory dependencies. Managed hosting, account, quota and cost details remain future service-design work.
- The user confirmed the first-release extension/version scope: an internal provider contract, one official managed sync provider and basic immutable checkpoints with inspection/restoration. Plugin distribution/marketplace, arbitrary native code, Git/SVN integration and advanced branching/merge interfaces are deferred.
- On 2026-10-11 the user chose complete original tool-history retention and accepted field-by-field review and additional implementation work. Production history codecs must preserve reviewed original tool arguments/results and their historical associations rather than reducing them to summaries; device credentials, provider continuation tokens and active execution authority remain excluded under the existing contract.

## Repository facts

- Dexie IndexedDB is the current system of record, with migrations through v24: `src/db/database.ts:56` and `src/db/database.ts:310`.
- There are 49 declared durable tables. Media bytes occur both in `MediaRecord.blob` and in material-version payloads: `src/domain/types.ts:362`, `src/db/media.ts:56`, `src/domain/materials.ts:47`. A migration cannot serialize only the `media` table and assume all binaries are covered.
- Project ZIP export snapshots related JSON and media in one read transaction, then compresses after transaction completion: `src/lib/projectPackage.ts:71`. ZIP import remaps IDs and adds a new project in a transaction: `src/lib/projectPackage.ts:194`; this is portable transfer, not identity-preserving synchronization.
- Global connectors and Agent chat are explicitly excluded from project ZIP: `src/db/database.ts:100`, `src/db/database.ts:108`, `src/domain/types.ts:523`. Studio-owned library sources are also excluded: `.trellis/spec/frontend/state-management.md:66`. The initial coverage inventory is in `research/data-inventory.md`; synchronizing current ZIP files would not cover all user data.
- Current mutation owners enforce project/entity ownership and local revisions/CAS, e.g. `src/db/projectMemories.ts:34` and `src/db/projectMemories.ts:42`. Those local guards do not by themselves resolve independent device histories.
- Paid jobs, approval state, runtime claims and generated candidates are durable. Remote ingestion must not implicitly resume execution or replay paid requests. Existing audio export already makes imported jobs dormant and clears claims: `src/lib/audioProjectPackage.ts:23`.
- Music-variant draft links also use localStorage: `src/components/music/MusicWorkspacePage.tsx:62`. Draft contents remain in Dexie, but a complete migration must explicitly classify these links and other local preferences.
- Current imports persist independent Blob content (`src/lib/media.ts:53`, `src/db/materials.ts:64`), not a retained OS source path. Preview currently combines loading/unavailable at `src/components/media/MediaThumb.tsx:28`; audio load and delivery export already reject/report missing records (`src/lib/audio/buffers.ts:19`, `src/lib/productionHandoff.ts:54`). Desktop file availability needs a richer contract.

## Initial research checkpoint

Primary sources checked on 2026-10-10 are recorded in `research/provider-comparison.md`. Obsidian's official Headless Sync is a promising standalone-app transport candidate, but is in open beta, requires a Sync subscription, has file-size limits, and its package metadata says `UNLICENSED`. Redistribution and integration permissions are unresolved. Its file-conflict behavior is not a substitute for Cuepoint's semantic conflict handling.

Anytype's documented application API requires a running, logged-in desktop host. Reusing the MIT-licensed any-sync protocol is a separate engineering option and does not establish entitlement to Anytype's managed network. The official self-host stack contains database and object-storage services.

Confirmed product direction: independent Cuepoint with its own extension system, for one person switching between devices. Recommendation for storage research: SQLite-managed local business records, ordinary asset/output files and core-produced portable snapshots/revisions exchanged through provider plugins. This is a technical candidate, not an approved migration. No provider, local database layout or desktop framework has been selected.

The second research checkpoint is in `research/local-workspace-and-plugins.md`; current Notion, cloud-drive and version-management evidence is added to `research/provider-comparison.md`.

## Research requirements

| ID | Requirement | Evidence / proposed acceptance |
| --- | --- | --- |
| R1 | Inventory durable data and distinguish user content, binary assets, device-local cache, secrets and executable state | Table/owner map; current ZIP coverage and gaps explicit |
| R2 | Verify Obsidian plugin/vault, official Headless Sync, Anytype API/network and any-sync reuse using primary sources | Host/runtime needs, storage limits, credential handling, licensing/distribution and unresolved gates recorded |
| R3 | Compare provider-neutral files/folder sync, S3/WebDAV and a managed/default service | Nontechnical onboarding, developer self-host path, ongoing costs and media suitability compared |
| R4 | Propose migration and conflict/recovery rules without changing current business behavior | Stable identities, concurrent/offline edits, delete/edit conflicts, partial transfers, schema versions and paid-execution safety covered |
| R5 | Converge product decisions and select bounded proof-of-concept experiments before an implementation plan | Independent shape, personal sequential use, application-only editing, managed import copies, automatic full delivery, device-local secrets, managed-service-first onboarding and first-release plugin/version scope are confirmed; concrete service economics are deferred to the live-service child |
| R6 | Plan a Cuepoint-owned extension boundary with sync as one capability | Core data owners retain validation/conflict authority; provider capabilities, lifecycle, credentials, progress and future compatibility are explicit |
| R7 | Compare database-first, file-first and hybrid project workspace models | Canonical-write authority, media/output layout, project portability, global library ownership, migration and crash recovery are explicit |
| R8 | Evaluate optional Git/SVN version history separately from transport sync | Local history, remote hosting, binary limits, restore consistency and user onboarding are documented; no active database file is treated as mergeable content |
| R9 | Plan personal device handoff and recovery without collaboration features | A committed version can be published on one device and applied on another while the first is closed; offline/pending work survives restart; stale branches are retained instead of silently overwritten; local save, provider publication and device application have distinct evidence |
| R10 | Define generated-file authority and non-destructive asset loss | External project JSON edits cannot change live content or be republished as new app edits; next relevant save regenerates the file; deleted assets retain identity/references and show missing; a local absence cannot become a replicated deletion |
| R11 | Keep imported/generated content inside a managed workspace container | Successful import remains usable after moving/deleting the original or disconnecting its drive; independent copied bytes and stable identity are verified before completion; partial imports cannot create ready references; output files and migrated nested Blobs are covered |

## Scope of this planning task

Keep the primary-source comparison and current-data inventory as planning evidence, and execute the approved design in independently verifiable children. Start with storage-neutral workspace primitives and disposable fixtures. Preserve source URLs and distinguish implemented contracts from proposals, documentation capability and untested native/live-service behavior.

## Out of scope at this stage

The first implementation children do not perform native packaging selection, real user database migration, synchronization of real user content, installation/account login, paid subscriptions, external vendor messages or live network deployment. Those actions require concrete scope and evidence in their later children. Current tests use disposable records and simulated adapters.

Multi-person membership, roles, invitations, collaborative cursors and intentional real-time co-editing are outside the current product scope. Do not introduce a collaboration-specific framework or distributed live editing solely for hypothetical future use.

Automatic ingestion of manually edited project JSON and automatic external replacement/relinking of media are outside the first-release editing scope. User requested missing-file reporting, not automatic reconstruction or paid regeneration.

External-original file links and dependencies on another device's absolute paths are excluded. Workspace-owned internal storage/deduplication can be evaluated, but must preserve independent ownership of imported content.

## Deferred decisions for later children

1. What service economics, account model and quota should a Cuepoint-managed sync service use? This is a later service-design decision; the product direction is managed-service-first for ordinary users with optional self-hosted provider plugins.
2. Concrete service deployment and native desktop binding remain separate technical decisions before live integration; they do not block storage-neutral fixture work.

The approved core implementation can proceed with isolated fixtures and transport adapters. Service economics, production accounts and native packaging remain later gates rather than implicit approvals to deploy or migrate real user content.

## Planning acceptance

- All options have current primary-source evidence and explicit integration/licensing/UX gates.
- Existing data ownership, ZIP limitations and media/runtime constraints are reflected in the design.
- Recommendations distinguish local storage, transport, business conflict handling and hosted infrastructure.
- The initial phase transition was approved in a subsequent user message on 2026-10-10. Materially changed product scope and later real service/migration decisions still require their concrete reviewed artifacts.

## Follow-on production-codec refinement

The clarification asked on 2026-10-10 was resolved on 2026-10-11: the user chose complete original tool-history retention and accepted field-by-field review and additional work. This supersedes the earlier summary-only recommendation. Preserve reviewed original arguments/results, readable chat, associations and provenance in a historical representation; do not silently omit an unreviewed result bag or substitute a summary and call the history complete. Classify each field before implementing production history codecs, retaining non-secret historical content while excluding device credentials, provider continuation tokens and executable authority. Incoming history remains dormant and cannot approve, claim, retry or replay a paid operation. Any unresolved field or explicitly excluded content needs visible completeness/omission evidence. This is a follow-on production-codec requirement; the accepted partial protocol-fixture child implements no history codec.
