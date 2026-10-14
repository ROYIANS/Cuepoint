# Storage and sync: initial provider comparison

Checked: 2026-10-10. Status: planning. This records documentation research and architectural inferences; no provider was installed, authenticated, contacted or tested with user data.

## User outcome and interpretation

The user wants local-first cross-platform desktop use plus approachable multi-device synchronization for one person, with devices normally used in sequence. Multi-person collaboration is excluded. Novices must not install or administer a database server. Advanced users may optionally self-host. Cuepoint owns its plugin system and remains independent. Obsidian and Anytype are integration candidates; Notion, cloud drives and optional Git/SVN version history were added by the user.

The constraint concerns deployment effort. An embedded database can be invisible to the user: [SQLite's serverless documentation](https://sqlite.org/serverless.html) describes in-process access without a separate database server. This is a candidate, not a decision to migrate Dexie to SQLite.

Using a hosted sync provider can remove Cuepoint's own server operation. Internet relay/storage still runs somewhere and creates account, capacity, availability and provider-dependency considerations. A local-only peer arrangement has different availability and recovery properties; it must not be presented as equivalent to a managed cloud path.

## Evidence and suitability

| Option | Documented capability | Cuepoint integration inference | Unresolved gates / suitability |
| --- | --- | --- | --- |
| Obsidian-hosted plugin (historical comparison, outside the chosen main product shape) | TypeScript plugins run inside Obsidian and are enabled as community plugins ([official tutorial](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin)) | Would expose Cuepoint inside the host | User instead chose an independent Cuepoint-owned plugin system; this is not the planned desktop product |
| Standalone Cuepoint + Obsidian Headless Sync | Official open-beta CLI synchronizes vault files without the desktop UI; requires a Sync subscription; supports continuous operation, E2EE and selectable attachment types ([Headless Sync](https://obsidian.md/help/sync/headless)) | Could use a dedicated sync directory while retaining our own app | Distribution/license, novice onboarding, runtime packaging, custom-record delivery and conflicts are unverified. Avoid two sync methods on one device |
| Standalone Cuepoint + Anytype application API | Documented authentication requires the latest desktop app running and logged in; local API keys and interactive authorization are available ([authentication](https://developers.anytype.io/docs/guides/get-started/authentication/)) | Could translate Cuepoint records into host objects/files and let Anytype handle its normal synchronization | Not a drop-in Dexie adapter. Field fidelity, identifiers, ordering, attachments, limits, deletion and app lifecycle need proof. API v2 is advertised as pre-release |
| Reuse any-sync protocol | MIT-licensed local-first encrypted peer protocol; Go node/filenode/coordinator/consensus components ([repository](https://github.com/anyproto/any-sync), [license](https://raw.githubusercontent.com/anyproto/any-sync/main/LICENSE.md)) | Potential foundation for an independent sync engine | Significant data/runtime integration. Protocol licensing does not establish a right to use the managed Anytype Network, nor the license of every adjacent component |
| Cuepoint-owned sync protocol over S3/WebDAV | S3 conditional writes can reject overwrite of changed objects ([AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)); Joplin demonstrates provider drivers for S3/WebDAV/filesystems ([Joplin](https://joplinapp.org/help/apps/sync/)) | Lets an independent app own conflict handling while a provider stores portable objects | Client sync protocol, encryption, credentials, recovery and compatibility still need implementation. Bucket/endpoint/key setup is not a novice account-login experience |
| Cuepoint-managed default service | Product direction selected for ordinary-user onboarding; account, quota and pricing are not designed yet | Could offer simple sign-in and automate storage provisioning while keeping optional advanced adapters | Requires service operation, support, quotas, cost and an ownership decision. Users need not deploy databases, but Cuepoint would operate infrastructure |

### Obsidian feasibility gates

- [Current plans](https://obsidian.md/help/sync/plans): Standard has a 5 MB maximum per file and 1 GB storage; Plus has a 200 MB maximum per file and 10 GB with storage expansion up to 100 GB. Version history consumes capacity. Media-heavy workspaces may exceed either per-file or total limits. Large-video transport or a metadata-only route must therefore be an explicit design choice.
- [Official package metadata](https://raw.githubusercontent.com/obsidianmd/obsidian-headless/master/package.json): version 0.0.14 is marked `UNLICENSED`, with Node >=22 and native SQLite dependency. Public source/package availability does not demonstrate permission to redistribute it inside Cuepoint. Treat distribution/embedding as unresolved, not as a permissive SDK. A separately installed official CLI is a distinct onboarding option, not automatically an approved shipping path.
- [Conflict documentation](https://obsidian.md/help/sync/troubleshoot): Markdown uses textual merge; other file types use last-modified-wins, while Obsidian settings JSON has special key handling. A generic Cuepoint JSON file is not proven to receive settings semantics. Conflict-file support must not be assumed to protect every custom format. Mutable shared JSON would risk losing an offline branch.
- The headless client exposes an `unsupported` file-type selection for custom attachments. Actual JSON/custom-file delivery, ignore rules, credential persistence, restart behavior and platform binaries still require a disposable-fixture experiment. Published command option spellings vary between documentation and repository examples; any future experiment must pin the CLI version.
- A host/plugin path and a headless sidecar path are separate options. A plugin does not inherit permission to redistribute the host or its services, and a Sync subscription does not solve Cuepoint's own business conflicts.

### Anytype feasibility gates

- [Sync and backup](https://doc.anytype.io/anytype/data/sync-and-backup): the default network supplies encrypted remote backup/sync and supports local-network peer use. Only file attachments count toward its backup quota; exceeding it stops new file synchronization. Self-host/local-only modes exist, with the default managed path recommended for ordinary users.
- A local API integration borrows an installed host's object model and account; embedding the protocol is a different product and engineering effort. No evidence reviewed establishes that an unrelated standalone client can use the hosted network merely by importing any-sync.
- [Official self-host compose](https://github.com/anyproto/any-sync-dockercompose/blob/main/docker-compose.yml) includes MongoDB, Redis, S3-compatible Garage and several protocol services. This is an advanced operator option, not a database-free novice deployment. Earlier references to MinIO must not be copied as the current default.
- The Anytype sync documentation explicitly warns against putting its active data directory in a third-party synced folder. For Cuepoint, replicate validated portable records rather than active database backing files. A static backup snapshot and a live sync stream are different contracts.

### What to learn from Joplin

[Joplin's sync specification](https://joplinapp.org/help/dev/spec/sync/) separates a synchronizer, provider targets and file-operation drivers; per-item sync state is scoped to the target. This is a useful pattern for portable provider integration. It does not establish that Joplin Cloud is a generic storage backend for another app, or that its conflict logic can be copied without adapting Cuepoint's data and licenses.

## Candidate architecture for discussion

Confirmed direction: preserve independent Cuepoint applications and its own plugin entry point, with a Cuepoint-managed service as the ordinary-user default and optional self-hosted transports. Evaluate optional connectors, beginning with Obsidian feasibility while extending comparison to Notion/cloud drives. This retains an exit path if media, licensing or onboarding gates fail. Concrete provider implementation, account economics and low-level synchronization policies remain unapproved.

Conceptual layers:

1. Local content and business owners: projects, studio library, audio timelines, history and media references remain usable offline. Embedded storage and native framework are unresolved.
2. Portable synchronization records: stable workspace/entity identities, schema versions, binary object identities and revision ancestry. Local indexes and active database files do not become the exchange format.
3. Cuepoint reconciliation: validates incoming ownership/reference closure, identifies concurrent branches and enforces domain conflict policy. Incoming history grants no execution permission.
4. Transport adapter: file directory/Obsidian, direct S3/WebDAV, host API or a later managed service. Each publishes concrete capabilities, limits and status.

A file-based candidate should consider immutable revision objects plus committed manifests, rather than updating one shared project JSON. A manifest arriving before its referenced media must be staged or shown as incomplete; missing files must not trigger destructive cleanup. This is a design hypothesis, not an approved schema or a proven guarantee of any provider.

S3 conditional writes can protect a mutable manifest from blind overwrite on AWS. They do not merge two versions of a shot or audio clip. Other S3-compatible services and WebDAV targets need their own capability tests; do not assume identical conditional-write or listing behavior.

## Business scenarios any chosen route must address

| Scenario | Proposed safety property for planning | Remaining product decision |
| --- | --- | --- |
| An old device was offline and has disjoint edits | Retain both independent changes and preserve references | Personal sequential use is confirmed; define stale-device reconciliation UX |
| Two devices edit the same shot, selection or timing | Preserve conflicting intent; no silent field overwrite that breaks business invariants | Conflict review versus defined automatic merge per content type |
| One device deletes while the other edits | Retain a deletion record and recoverable competing edit; avoid unintentional resurrection | Retention period, recovery UI and default resolution |
| Media transfer interrupts or exceeds quota | Visible pending/unsupported status; preserve usable local work and retry safely; the first-release default is automatic full delivery | Media size targets and the later large-library optimization policy |
| Device receives paid-generation history | No automatic submit/retry/approval or claim takeover | Whether live job monitoring/takeover is in initial scope at all |
| Connection-dependent settings arrive without a key | Preserve content/settings intent and request local configuration when needed; credentials stay on each device | Which paid account/onboarding path is acceptable for the first release |
| Existing browser workspace moves to desktop | Verify row counts, identities, nested binaries and reference closure against a preserved backup | Browser compatibility duration, full workspace scope and rollback expectations |
| Older client opens newer synced data | Detect schema incompatibility before applying destructive writes | Supported version window and upgrade UX |

## Proposed bounded experiments after scope approval

1. Provider-independent fixtures: one visual project, an audio timeline, a studio/IP library item with a nested binary, a chat/evidence record and a dormant generation history. Include small, >5 MB and >200 MB media samples where the selected provider permits a safe rejection test.
2. Two independent clients/devices: identity-preserving exchange, offline disjoint edits, same-entity edits, edit/delete races and reconnect convergence.
3. Failure/recovery: manifest/media reordered delivery, interruption, quota failure, corrupted payload, repeated ingestion, restart and provider unlink. Verify no missing-content purge and no paid request replay.
4. Obsidian-specific: license/distribution gate first; pin official CLI version; custom attachment types, conflict preservation and one sync method per device. No secret-bearing user data.
5. Anytype-specific if selected: pin API version; object/file round trip and fidelity; host close/reopen, schema mapping and quota failure. Separately assess licenses and managed-network entitlement before an embedded-runtime experiment.

No experiment in this list has been run. No final implementation plan exists yet.

## Decision queue

Independent Cuepoint, its own plugin system, personal sequential multi-device use, application-only editing, managed asset copies, automatic full delivery, device-local credentials and managed-service-first onboarding are confirmed. Account, quota and pricing remain service-design work; self-hosted provider plugins remain an advanced path. Do not turn a research preference into an implementation dependency for Obsidian, Anytype or Notion. A usable default handoff route must persist updates remotely so the source device can be closed before the destination resumes; pure simultaneous-peer availability is not enough for the intended ordinary workflow.

## Additional providers and version management

Checked on 2026-10-10; documentation capability only, with no authenticated tests.

| Candidate | Primary-source facts | Product/engineering inference |
| --- | --- | --- |
| Notion | API supports file upload/attachment; <=20 MB uses a simple upload while larger files use multipart. Free workspaces permit 5 MiB per file; paid workspaces 5 GiB ([files](https://developers.notion.com/guides/data-apis/working-with-files-and-media)). Download links expire after an hour ([retrieval](https://developers.notion.com/guides/data-apis/retrieving-files)). Rate budgets depend on plan and also include a shared workspace budget ([limits](https://developers.notion.com/reference/request-limits)). | Feasible connector candidate for publishing, references, export or backups. Full-fidelity two-way Cuepoint workspace sync needs identity mapping, deletion/merge policy and media tests; this documentation does not make it a generic database replica. Persist file IDs/owners, not expiring URLs as durable media identity |
| Notion authorization | Public connection token exchange uses client ID and client secret ([authorization](https://developers.notion.com/guides/get-started/authorization)). | A distributed desktop binary cannot keep a shared developer secret private. Investigate a secure authorization service or a user-created internal connection; no zero-server public-login path has been established in this research |
| Cloud-drive API, with Dropbox as a verified example | File API supplies IDs, revisions, content hashes and paginated folder cursors ([file access](https://docs.dropboxapi.com/dropbox-api/docs/file-access)). Official OAuth recommends PKCE plus refresh tokens for desktop apps requiring background access ([OAuth](https://docs.dropboxapi.com/dropbox-api/docs/oauth)). | Promising file-transport plugin category without requiring the user to configure a database. Requires developer app registration and provider-specific access/quotas; does not itself resolve Cuepoint business conflicts. Other vendors must be assessed individually |
| Existing cloud-synced folder | SQLite documents journal/WAL pairing and filesystem lock requirements ([integrity](https://sqlite.org/howtocorrupt.html)); safe database snapshots use its backup mechanisms ([backup](https://sqlite.org/backup.html)). | A plugin can exchange committed portable files through a watched directory. Keep the active SQLite runtime outside that directory and handle partial/reordered delivery in the core. Folder replication and backup are distinct from validated bidirectional application sync |
| Git | Most operations, including commits, can occur locally/offline ([Git book](https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F)). GitHub blocks ordinary repository files above 100 MiB ([host limit](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)). Git LFS stores pointers in the repository and binary contents separately ([LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)). | Useful optional local history/remote-repository adapter for stable text snapshots or revision records. Host-specific 100 MiB is not a Git-wide limit. Large media needs separate storage or an LFS-capable server; merging JSON text does not establish valid timeline semantics |
| SVN | The version-control model uses a central repository and connecting clients ([SVN book](https://svnbook.red-bean.com/en/1.8/svn.basic.version-control-basics.html)). | Available advanced-user adapter candidate, especially where a repository already exists. Does not eliminate hosted/self-managed repository infrastructure. Prefer evaluating Git first for offline local history; neither needs to be mandatory for ordinary users |

Provider plugins should advertise supported operations (such as backup, publication or bidirectional sync), metadata/media limits, conditional-update capability and authentication requirements. A common plugin interface must not falsely imply that every connected service provides identical full-workspace synchronization.
