# Research: Immutable checkpoint and provider-neutral contract

- Query: Identify the smallest independently testable checkpoint/provider boundary for the next implementation child, including reusable identity and validation owners, field-level sanitization, an immutable manifest/revision contract, a conditional remote head, and the gaps that prevent a full-workspace round trip claim.
- Scope: internal
- Date: 2026-10-10
- Repository basis: current `main` source plus the completed workspace-foundation child. No provider account, native filesystem, SQLite binding, live service, or user data was used.

## Findings

### 1. Reusable owners and the identity-preserving boundary

The repository already has useful read, validation and binary-integrity pieces, but the existing project package is a copy/import package rather than a synchronization codec.

- `src/lib/projectPackage.ts:71-154` opens one read transaction, gathers project rows and referenced media, and only compresses after the read boundary closes. This is the right shape for a checkpoint **source snapshot**: collect the rows and binary references first, then encode/hash outside the transaction. Its media metadata and `media/<id>.<ext>` staging conventions are useful fixture material.
- `src/lib/projectPackage.ts:194-341` is deliberately not an identity-preserving apply path. It creates a new project (`:254`), remaps every media ID (`:256-276`), remaps related rows (`:298`) and inserts the copy in one transaction (`:300-333`). Reusing it for sync would fork identities and turn every delivery into a new project.
- `src/lib/packages/projectPackageCodec.ts:765-797` (`parseProjectPackageRows`) is a strong structural validator/normalizer for project, episode, shot, memory, reference and audio package input. `:799-975` (`remapProjectPackageRows`) must not be called by a sync apply because it intentionally generates new IDs. A future checkpoint codec should share the parsers' allowlists and relation checks while adding an identity-preserving branch that requires existing IDs/owners and performs no remap.
- `src/lib/packages/audioPackageCodec.ts:199-228` has an explicit Zod allowlist and cross-row ownership checks. `src/lib/audioProjectPackage.ts:23-45` already produces a safe historical audio projection: generation jobs/batches become dormant, agent ownership and confirmation are cleared, connector records are reduced to an imported provider identity, and arrangement history is sanitized. This is the strongest existing precedent for applying a checkpoint as inspectable history without granting execution authority. `:47-106` validates imported ownership and dormant state before insertion. `remapAudioPackage` (`audioPackageCodec.ts:231-308`) is still copy/import behavior and cannot be the sync apply.
- `src/lib/references/package.ts:48-73` validates reference/chunk ownership, versions and coverage; `:76-110` verifies byte size, format, signature and SHA-256 before it creates new IDs. The verification ordering is reusable, while the ID remapping is not.
- `src/lib/agent/businessStore.ts:42-64` and `:192-229` provide owner-checked business reads and allowlisted projections. The projection deliberately excludes `extra` bags, so it is safe for a bounded model view but incomplete for a lossless checkpoint. `ownerSnapshot` is a useful evidence shape, not a complete workspace serializer.
- `src/lib/productionRevision.ts:6-23` (`targetRevision`) gives deterministic key-order canonicalization and a synchronous `sha256-v1:` conflict token. It includes entity content (including timestamps and `extra`) but cannot encode `Blob`; a checkpoint must hash binary entries separately and hash references to those entries in the record projection.
- `src/lib/sha256.ts:1-…` (the extracted `Sha256` implementation in the workspace child) and `src/lib/workspace.ts:6-101,155-193` provide the current storage-neutral identity/path and managed-copy boundary. The browser adapter intentionally uses `BROWSER_WORKSPACE_ID = "browser-local"` (`workspace.ts:42-44`); that value is not a cross-device workspace identity.
- `tests/helpers/workspaceBinaryFixture.ts:60-246` is a read-only binary/reference inventory. It now covers media, material-version nested Blobs, audio recordings/exports, generation/proposal references and arrangement history, and reports missing/foreign/empty/read-failed observations. It proves inventory and hashing only; it is not a checkpoint encoder or round-trip proof.

**Required boundary for the next child:** add a checkpoint-specific source/apply owner (for example `src/lib/checkpoint/checkpointCodec.ts` plus `src/db/checkpoint.ts`) that consumes the existing read/validation owners, preserves the original IDs and owner IDs, and stages binary bytes before the identity-preserving database transaction. Do not route it through `remapProjectPackageRows`, `remapReferencePackage`, or `remapAudioPackage`.

There is one path-contract detail that must be resolved in that child. `WorkspaceRef` currently contains `{workspaceId, projectId, relativePath}` but no `mediaId` (`src/lib/workspace.ts:8-12`). A portable manifest must carry the stable binary ID and derive the expected path from `(workspaceId, owner, binaryId)`; it must verify any supplied `relativePath` against that derivation. Trusting a serialized path alone would allow an entry to claim another owner's location. Nested material blobs and historical embedded snapshots need a separate stable `binaryId`/owner-kind derivation; `mediaWorkspaceRef` only covers ordinary `MediaRecord` IDs.

### 2. Field-level secret, runtime and approval sanitization

Sanitization must follow the persisted field's trust boundary. It must not apply a keyword scrubber to every string: user text can legitimately contain words that resemble keys, and a user may intentionally write a credential into prose. The safe rule is typed allowlists for known records, explicit omission for provider/runtime envelopes, and a historical/non-executable marker on anything received from another device.

| Source | Portable checkpoint treatment | Apply-time rule / evidence |
| --- | --- | --- |
| `ConnectorConfig` (`src/domain/types.ts:518-533`) and `connectorAliases` | Include credential-free metadata only: stable connector ID, definition/protocol, label, validated `baseUrl`, default model and update time. **Exclude `apiKey`.** `connectorRunIdentity` already rejects URL credentials/query/hash (`src/db/agentRuns.ts:30-37`). | If the connector is missing locally, retain an unresolved connector reference; never synthesize a key or enable paid execution. |
| `SearchConnection` | Exclude the record; its `apiKey` is explicitly a global local-only secret (`src/domain/search.ts:1-11`). A future UI may sync only a non-secret configured/enabled status. | Require local reconfiguration before search. |
| `AgentConfig` (`src/domain/agent.ts:9-19`) | User-authored `name`, `instructions`, context policy, and generation preference selections may be portable content. `generationPreferences` carry connector/model/parameter hints only. Skills are portable only by validated built-in/plugin IDs. | Reset execution policy to local safe defaults (at least `permissionMode: "ask"`); unknown skill IDs become unresolved. Incoming instructions remain data, not authorization. |
| `ChatThread` (`src/domain/types.ts:540-558`) | Preserve title, project binding, task/conversation mode and non-secret connector/model hints. A `reasoningSelection` is a hint, not credentials. | Missing connector is shown as needing local setup; never auto-run a thread. |
| `ChatMessage` (`src/domain/types.ts:560-576`) | `content` is user/history content and may be carried as-is under the provider's encryption/retention policy. Attachments/reference IDs are portable only when their project/reference closure is included. | Drop raw `error` unless it has a typed safe error code/message; do not treat message content as an instruction to the sync engine. Reasoning may be kept as display-only bounded text, but `encrypted_content` and opaque provider continuation are excluded by default. |
| `AgentRun` (`src/domain/agent.ts:174-233`) | Keep a historical summary (model, credential-free connector identity, user/assistant message IDs, public activity/output and usage if desired). `requestMessages`/`ContextSnapshot` are content and need an explicit retention choice. | Never import `running` or `waiting_approval` as runnable. Clear `responseItems`, continuation envelopes, tool-loading/runtime claims and execution locks; apply active runs as interrupted/dormant history with an import marker. |
| `AgentToolCall` (`src/domain/agent.ts:82-107`) | Preserve typed title/effect/target summary and a bounded historical result summary where an existing safe projection exists. `arguments`, `result`, `error`, `preview` and `generationOverride` are opaque bags unless a tool-specific codec validates them. | Clear approval/decision authority. Pending/awaiting/running/approved calls must become non-runnable historical/unknown records. Never replay a tool result or use an incoming approval to authorize a new write or paid request. |
| `AgentResponseItem` and context compaction (`src/domain/agent.ts:109-130`, `src/domain/context.ts:19-52`) | Exclude provider continuation/reasoning envelopes and encrypted fields by default. Preserve a normalized summary and source coverage only when needed for history. | No response continuation may be sent to a provider automatically after apply. |
| `AgentTask`, task records and wrapups (`src/domain/agent.ts:244-258`, `src/domain/agentTaskRecords.ts:1-32`, `src/domain/agentTaskWrapup.ts:1-80`) | Titles, goals, criteria, plans, user/AI record bodies and confirmed decisions are user/history content. Preserve source IDs only when the referenced historical item is present. Wrapup evidence should use bounded safe summaries rather than raw runtime bags. | `confirmedAt` is historical evidence, never a new-device execution grant. Broken source IDs remain unresolved; do not silently certify a result. |
| `AgentGenerationJob` (`src/domain/agentGeneration.ts:4-52`) | Keep target/model/parameters, stable media IDs, source revisions and provider task IDs as historical provenance if desired; exclude all credentials. `baseUrl` must pass credential-free URL validation. | Active states (`submitting`, `submitted`, `running`, `downloading`, `remote_completed`) become dormant/unknown. Do not poll, claim, retry or submit from arrival. A result is available only when the referenced managed media is present and verified. |
| `GenerationBatch`/items (`src/domain/agentGenerationBatch.ts:12-65`) | Preserve proposal/draft content and selection/application history through an explicit batch history codec. Remove `sourceCallId`/runtime ownership from the executable view; preserve IDs only as historical links. | Queued/claimed/ready states are non-runnable on the receiver. Do not infer paid retry eligibility from a copied error string. |
| `AudioGenerationJob`/batches (`src/domain/audioGeneration.ts:53-70`, `src/domain/audioGenerationBatch.ts:18-42`) | Reuse the established `snapshotAudioPackage` policy (`src/lib/audioProjectPackage.ts:28-41`): dormant jobs, manual/imported owner, cleared claim/confirmation, connector without credentials and preserved results. | Keep dormant guard on import; existing `insertAudioPackage` rejects non-dormant/confirmed imported batches (`audioProjectPackage.ts:90-104`). |
| `ProductionProposal` (`src/domain/production.ts:38-50`) and arrangement history (`src/domain/audioArrangement.ts:48-63`) | Preserve before/after/result and provider provenance as history; no raw remote token is needed to render history. Arrangement proposals already have a `dormant` field and sanitize owner in `src/lib/packages/audioArrangementCodec.ts:1-32`. | A received proposal must not be auto-applied or treated as a local approval. If a proposal is still pending, retain it as historical/pending-review or add an explicit `executionState: "dormant"` sidecar. |

The initial recommendation for opaque bags was a summary/typed-metadata projection with visible omission evidence. The user superseded that recommendation on 2026-10-11 by selecting complete original tool-history retention after field-by-field review and accepting the additional work. The follow-on codec must preserve reviewed original argument/result/error content and historical associations rather than silently omit unvalidated envelopes. Credentials, provider continuation and execution authority remain excluded; any unresolved or excluded content requires explicit completeness/omission evidence. No arbitrary keyword-based redaction is justified by the current data model. The accepted partial protocol fixture does not implement these codecs.

### 3. Minimal provider-neutral immutable manifest and conditional-head contract

The next child can be fixture-tested without choosing SQLite, a desktop framework, S3, WebDAV or a managed service. The fixture should exchange an in-memory `CheckpointBundle` with deterministic canonical bytes.

#### 3.1 Bundle shape

Use one immutable checkpoint object with a separate mutable head pointer:

```ts
type CheckpointScope =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "project"; workspaceId: string; projectId: string };

type CheckpointRecord = {
  table: string;                 // registered core owner, never arbitrary SQL
  id: string;
  ownerId?: string;
  revision: string;               // targetRevision-style conflict token
  operation: "upsert" | "tombstone";
  payload?: unknown;              // validated owner projection only
  payloadDigest: string;
  executionState?: "portable" | "historical" | "dormant";
};

type CheckpointBinary = {
  binaryId: string;               // media ID or stable nested-owner key
  ownerId: string;
  ownerKind: "media" | "material-version" | "audio-output" | "other-registered";
  relativePath: string;           // derived and re-validated by the core
  mimeType: string;
  byteLength: number;
  sha256: string;
  state: "ready" | "missing";
};

type CheckpointManifestV1 = {
  format: "cuepoint-checkpoint";
  version: 1;
  scope: CheckpointScope;
  revisionId: string;
  parentRevisionId?: string;
  manifestDigest: string;
  records: Array<Omit<CheckpointRecord, "payload"> & { entry: string }>;
  binaries: CheckpointBinary[];
  createdAt: string;
};

type CheckpointBundle = {
  manifest: CheckpointManifestV1;
  records: CheckpointRecord[];
  binaryEntries: AsyncIterable<{ binaryId: string; bytes: Uint8Array }>;
};
```

The actual wire representation may be JSON plus separate binary objects or a ZIP-like container; the contract is the sorted logical entries, not a required archive. The canonical manifest sorts records by `(table, ownerId, id)`, binaries by `(ownerKind, ownerId, binaryId)`, and object keys recursively. `payloadDigest` is over the validated canonical payload; `manifestDigest` covers schema, scope, parent, record digests and binary metadata, never device absolute paths. `revisionId` is an immutable content/ancestry address, for example `sha256-v1:<digest>`. A record tombstone is explicit and never inferred from provider absence.

Before publication the core must:

1. Read owner rows and binary references under a consistent read boundary.
2. Stage/copy each binary into the managed workspace or transport staging area, hash it, and verify the row/reference still has the same revision and byte hash. If it changed, restart the snapshot rather than mixing revisions.
3. Derive each binary path from the current workspace ID, owner and binary ID; reject a manifest path that does not equal the derived safe path. Do not use an absolute OS path or trust a serialized `WorkspaceRef.relativePath` by itself.
4. Validate every record's owner and every reference closure before the bundle is marked ready.

#### 3.2 Provider interface and head semantics

A provider only transports validated checkpoints. It cannot access Dexie/SQLite tables or decide business conflicts:

```ts
interface CheckpointProvider {
  readonly id: string;
  capabilities(): {
    read: boolean; write: boolean; conditionalHead: boolean;
    resumableBlobs: boolean; maxObjectBytes?: number;
  };
  readHead(scope: CheckpointScope): Promise<CheckpointHead | null>;
  publishCheckpoint(
    bundle: CheckpointBundle,
    expected: { revisionId: string } | { absent: true },
  ): Promise<"published" | "already-present" | "head-conflict">;
  readCheckpoint(scope: CheckpointScope, revisionId: string): Promise<CheckpointBundle>;
  listRevisions(scope: CheckpointScope, cursor?: string): Promise<{ items: CheckpointHead[]; nextCursor?: string }>;
}

type CheckpointHead = {
  scope: CheckpointScope;
  revisionId: string;
  manifestDigest: string;
  parentRevisionId?: string;
  updatedAt: string;
};
```

Required semantics are deliberately provider-neutral:

- The checkpoint object addressed by `revisionId` is immutable. Re-publishing the same ID is idempotent only when `manifestDigest` matches; a same-ID/different-digest collision is an error.
- The mutable head changes only if `expected` matches the current head. `{absent: true}` is a create-if-empty operation. A mismatch returns `head-conflict` with the current head available for branch handling; it never overwrites silently.
- A provider may store an immutable checkpoint successfully while the head CAS loses a race. That orphan is retained for history/garbage collection; the caller reports publication conflict, not data loss.
- Provider acknowledgement means the checkpoint/head was durably accepted by that provider. It does not mean another device downloaded, verified or applied it. Local publication, download and apply statuses remain separate core records.
- `readCheckpoint` verifies manifest digest, record digests, path safety, binary sizes and SHA-256 before any application transaction. Reordered entries, duplicate delivery and interrupted downloads are normal fixture cases.
- Deletion is represented by a core tombstone in a later immutable revision. Provider object absence is never interpreted as a logical asset deletion.

This interface is enough to test a fake provider with an in-memory map and conditional head CAS. S3 `If-Match`/`If-None-Match`, WebDAV locks or a managed API can be adapters later; none is assumed by the core contract.

### 4. What can be implemented next, and what cannot honestly be claimed

The next child can implement and fixture-test the following without a native runtime or service account:

- Canonical manifest/revision encoding and digest stability.
- Explicit record allowlists for a narrow registered scope (initially the workspace-foundation fixture's proven binary/identity set).
- Binary staging, derived-path validation, size/hash verification and idempotent receipt.
- Fake-provider immutable storage, conditional-head CAS, duplicate delivery, same-ID collision, reordered entries, corrupted bytes and interrupted transfer.
- Safe historical sanitization fixtures for connectors, agent/chat/tool envelopes and generation/audio history.
- A read-only checkpoint inspect result that reports omitted/unreviewed owners instead of claiming complete coverage.

The following are real blockers to a **full-workspace round-trip** claim and must remain explicit gates:

1. There is no identity-preserving codec/apply path for every durable owner. Current project/audio/reference codecs either omit global/runtime tables or remap IDs for copy import. `extra` bags and future fields are not covered by a complete owner registry.
2. The browser adapter's `browser-local` workspace ID is intentionally not a cross-device identity, and the current `WorkspaceRef` lacks a binary ID. A desktop runtime must persist a real workspace identity and derive/verify paths for both ordinary media and nested material/history blobs.
3. No native filesystem/SQLite binding, crash-safe file+record commit, or native root/symlink containment proof exists yet. Browser Blob staging does not prove desktop durability.
4. There is no durable provider registry/head/history store, credential vault integration or managed-service account/quota/billing contract. A real official provider is a later service-design gate.
5. Tombstone retention, stale-device branch application, conflict policy and restore-to-new-checkpoint are designed at the parent level but have no identity-preserving application implementation.
6. Global chat/agent/task evidence, IP/material library scopes, localStorage/sessionStorage preferences, nested blobs and all generated/output owners do not yet have a complete lossless checkpoint codec. The binary fixture only enumerates and reports them.
7. The user selected complete original tool-history retention on 2026-10-11. Field-level codecs, preservation of original historical content/links, completeness evidence and retention/encryption policy remain implementation gates. Provider continuation, credentials and execution authority remain excluded; the decision is not an approval to transport every provider/runtime field verbatim.

Therefore the next child should claim **protocol and fixture coverage**, not “full workspace sync” or “full round-trip”. A provider adapter is safe to implement against the fake contract before native packaging and service economics are decided.

### Coordinator-selected boundary for the current child

The coordinator has selected a deliberately narrower implementation boundary: the current child may add only the provider-neutral manifest/head protocol and disposable `cuepoint.protocol-fixture.v1` fixtures. It has **partial coverage** by design. The child must not add or imply a production table codec, a database checkpoint owner, identity-preserving apply, tombstone/restore application, connector/agent/chat/tool secret sanitization, or a live provider adapter. The candidate files and historical sanitization rules below are follow-on options for later children, not commitments in this child.

The existing binary fixture is evidence that files can be enumerated and hashed; it is not a migration codec, import path, or proof of full-workspace round-trip. In particular, the current ZIP/package codecs cannot be reused as a checkpoint apply mechanism because their import paths intentionally remap IDs and their allowlists do not cover every durable owner. Opaque result bags, secret-bearing runtime fields, dormant-job reactivation, and all 49-table closure remain explicit later gates.

### 5. Proposed implementation files and tests

These are proposed ownership boundaries, not edits made by this research:

- `src/domain/checkpoint.ts`: versioned manifest, record/binary entry, scope, head, typed provider result/error and execution-state types.
- `src/lib/checkpoint/canonical.ts`: recursive canonical encoding, digest/revision helpers built on `targetRevision`/`sha256Bytes` semantics; excludes absolute paths and timestamps from content identity where appropriate.
- `src/lib/checkpoint/sanitize.ts`: explicit allowlists for connector, agent, chat/tool, task/evidence and generation/audio records; no keyword redaction.
- `src/lib/checkpoint/checkpointCodec.ts`: parse/validate canonical bundle, relation closure, tombstones, duplicate IDs, owner checks and derived-path checks. Reuse existing package schemas but never the remap functions.
- `src/lib/checkpoint/provider.ts`: internal provider registry and `CheckpointProvider` contract; capability declarations and typed `head-conflict`/digest/limit/auth errors.
- `src/db/checkpoint.ts`: source read boundary, staged binary verification and identity-preserving apply transaction. It should call business owner validators rather than writing arbitrary tables.
- `tests/checkpointManifest.test.ts`: canonical order, stable digest, revision ancestry, absolute-path omission and same-ID/different-content rejection.
- `tests/checkpointSanitization.test.ts`: API keys/search keys absent; credential-free connector metadata retained; active claims/approval/runtime states dormant; original reviewed tool-history content and links preserved; exclusions/unresolved fields have explicit completeness evidence; no summary-only substitution falsely claims complete history; dormant audio precedent remains valid.
- `tests/checkpointProviderFixture.test.ts`: fake provider publish/read/list, initial create-if-empty, expected-head CAS, duplicate idempotency, head race, immutable revision collision, reordered/corrupt/partial binary delivery and separate provider-ack/download/apply statuses.
- `tests/checkpointApplyFixture.test.ts`: two isolated workspace roots with the same stable IDs, derived paths, full verified binary staging before row commit, restart after staging, missing managed media, tombstones and unresolved-owner reporting. This fixture must state its registered scope and omitted owners in its output.

## Caveats / Not Found

- No code was changed by this research pass. The source evidence above is structural and contract-level; it does not prove native desktop I/O, SQLite transaction behavior, provider durability, cloud authentication or performance.
- The parent inventory already records the declaration-level table count and current ZIP exclusions; this file intentionally does not repeat that declaration. It focuses on the next child boundary and names the owner families that still lack codecs.
- The exact first-release set of agent/chat opaque history fields, the representation of pending production proposals, retention/encryption of user text, and whether connector metadata includes a host URL require coordinator judgment before implementation. The recommended defaults are stated above but are not a substitute for those decisions.
- The current `WorkspaceRef`/browser adapter was designed for the workspace-foundation child. Before a portable checkpoint is accepted, the next child must include the stable binary ID in its manifest and re-derive the path; a serialized relative path alone is insufficient.
- Provider plugins, Obsidian/Anytype/Notion connectors, S3/WebDAV adapters, native packaging and managed-service economics remain future gates. A fake provider fixture is intentionally the highest honest proof available before those decisions.
