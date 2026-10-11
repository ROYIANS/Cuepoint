# Shared product persistence design

Status: reviewed for implementation, 2026-10-11. The user's explicit full-responsibility/automatic-approval instruction authorizes autonomous execution of this displayed scope; see PRD and planning signoff.

## 1. Architecture and authority

```text
Shared React routes / existing Agent runner and registered tools
                         |
Existing shared TypeScript business command owners
                         |
ProductStore + explicit StoreTx + useProductQuery + binary access
                 /                            \
 Browser IndexedDB adapter             Native typed IPC adapter
                                                |
                              Reused Rust worker / checked commit owner
                                                |
                        Fresh SQLite + managed files + private recovery state
```

The shared store is a bounded application API, not an implementation of every Dexie feature. Derive its table/index registry, key paths, uniqueness and operations from `research/storage-callsite-inventory.json`. Keep all 49 current durable tables and all current product domains. The `versionId` primary keys on immutable history tables must not be assumed to be `id`.

Existing business commands own project/studio validation, ordering, CAS, immutable versions, adoption, approvals, generated-result placement and execution receipts. Rust owns storage integrity, table/index allowlists, parameterized statements, transaction guards, file authority and crash recovery. It must not contain another implementation of those product commands.

Storage is selected once before routes render. Browser uses IndexedDB; normal Tauri uses the fresh full-product SQLite adapter. Native initialization failure displays a recoverable storage error and cannot select IndexedDB. Remove the old SQLite capability shortcuts and video-only repository dispatch from normal product paths. Retain explicitly isolated historical prototype fixtures only as reference/test infrastructure; never let them own normal product rows.

## 2. Shared table/query boundary

Define typed `ProductTables`, `ProductStore`, `StoreTx`, selectors and storage errors. Implement only inventoried operations: key/compound-key reads, equality/range/any-of selectors, count/first/sort/iteration, and add/put/update/delete/bulk operations. Client predicates/modifier callbacks run in shared TypeScript over bounded query results; do not send JavaScript callbacks or raw SQL through IPC.

Query ordering must preserve the current primary-key tie behavior, index comparison, unique/optional-key semantics and absent-row results. An absent detail row becomes `null` at the existing read owner; it must not remain a loading spinner. Native storage failures propagate as typed storage failures and must not be swallowed by code that currently recognizes only `DexieError`.

The local row codec must preserve own `undefined` properties and distinguish an omitted patch from an explicit clear, including nested fields. `productionRevision.ts` hashes that distinction; plain `JSON.stringify(row)` would lose it after reopen. Use a collision-safe typed encoding for supported current structured values, independently from the portable checkpoint codec. Reject unsupported types explicitly instead of silently stripping them. Preserve reserved user property names as data, and test encode/decode equality and receipt/revision equality before/after reopen.

Dynamic `db.tables` and `db.table(name)` usage becomes an explicit allowlisted table set/accessor. Keep the original durable mutation owners; mechanical dependency/transaction-context changes are permitted, duplicate feature implementation is not.

## 3. Explicit transaction contract

`store.transaction(mode, scope, async tx => result)` supplies a transaction-bound store. Nested helpers receive that same `tx` explicitly. Joining is allowed only for compatible mode and declared table scope; an undeclared table, cross-root context, widening or use-after-close rejects. No process-global current transaction may capture unrelated concurrent operations.

Native unit-of-work protocol:

1. Begin a generation/session-bound context with allowlisted scope and unique operation identity. Rust tracks its read guards; the renderer cannot invent a trusted baseline.
2. Perform short consistent native reads. Point reads track row revisions/absence; selector/count/first/predicate reads track table/index revisions to detect phantoms. Validate prior guards as further reads arrive. Mutations remain in a transaction-local overlay; point and index queries see additions, updates and deletions in that overlay.
3. Preserve uniqueness and key/index behavior in the overlay and revalidate with SQLite constraints at commit. Shared receipts may inspect uncommitted new rows through the same context.
4. Close a read-only context with guard validation before its snapshot is usable. For writes, send one closed typed mutation batch, read guards and prepared binary claims. Rust validates session/ownership/structure and all guards, then applies records, references, revisions, operation receipt and change sequence in one short SQLite transaction.
5. Emit invalidation only after commit and return the callback result only after native acknowledgement. Any precommit failure aborts the entire root context; no completed Agent evidence is independently written for rolled-back business changes.

All read paths are lazy/scoped, not persistent whole-database mirrors. No native SQLite writer or renderer-global mutex may remain held across network requests, user approval, hashing, byte transfers or decoding. Existing unusual `Dexie.waitFor` helpers become explicit compute/read phases with final validation; preserve their ownership/atomicity, not Dexie liveness workarounds.

Conflict is a typed outcome. Read-only UI queries may safely rerun as new queries; mutations and supplier/Agent callbacks are never automatically replayed. Commit acknowledgement uncertainty uses the operation receipt/status query to determine the original result; it is not permission to issue a new operation or supplier request. Keep operation identity, bounded context cleanup and close/reopen generations separate from domain revisions.

Durable outcome lookup uses the current trusted session, the same persistent workspace and the original operation ID. It must work after reopen even though the old transaction handle/generation is invalid. Bind each stored operation receipt to a canonical mutation/binary-claim fingerprint; reusing an ID for another payload rejects. An outcome lookup never revives an expired handle. Preserve unknown certainty if both acknowledgement and outcome read fail; the existing `executeAtomicTool` catch-all rollback wrapper must not misclassify that as a proven rollback.

Large query results use bounded pages tied to the same tracked table/index epoch; a change between pages rejects the logical read before publication. Large atomic write sets use bounded preparation chunks and a sealed, verified native mutation-batch capability/fingerprint; final commit references that capability rather than a giant IPC argument. Staging/preparation does not apply product rows. Project copy-import remains one atomic checked commit regardless of transfer paging; no new row count cap or partial-import commit may be introduced. Status `not found` while commit may still settle remains unknown, not proven rollback.

## 4. Native format, schema and startup

Create a fresh full-product format under a fixed application-data container, with a server-resolved workspace identity. Example logical layout:

```text
<app-data>/product-workspace-v1/
  workspace.ready.json
  .local/state.sqlite              # all local tables; never a portable artifact
  .local/lock-and-operation-state/
  .staging/
  projects/<encoded-owner>/assets/<encoded-binary>/...
  studio/assets/<encoded-binary>/...
  outputs/...
```

The final physical layout may reuse existing native path constructors, provided these ownership/containment boundaries stay exact. The renderer never supplies an absolute root or file path. Reuse exclusive writer lock, ready marker, inode/symlink checks and fresh schema validation. Unsupported formats fail explicitly; no schema-4 or IndexedDB import/upgrade is introduced.

Use one SQLite transaction owner for all 49 local tables. Record table/field scope in the schema registry: content, device-only credentials/preferences, and mixed content/runtime. Local continuation state and connection keys remain readable only through current local business owners and are not public diagnostic/portable JSON. Do not physically split atomic connection/settings transactions across databases. Native SQL stores typed payloads and explicit indexed scalar/compound projections under generated allowlisted statements; never rely on JSON string lexical comparison to implement IndexedDB index semantics.

Keep pinned Tauri/Rust/rusqlite dependencies unless implementation evidence justifies an independently reviewed change. Full integrity scans are startup/diagnostic checks, not each read, chunk or heartbeat. Normal bounded queries and indexed reads must remain responsive as history grows.

## 5. Binary and output lifecycle

Cover `media.blob`, material-version file payload Blobs and setting snapshot media Blobs. Immutable snapshots own bytes even if the source media row is later removed. Audio takes/exports, music variants and generated results reference those binary owners; do not erase closure during codec conversion.

The shared byte/URL loader exposes metadata separately from loading, ready, missing and read-error states. Browser loads stored Blobs; native resolves opaque workspace binary references and verifies real bytes. Adapt actual `.blob` consumers, vision, previews, audio decoding, archive export and result-evidence checks through this single seam. Avoid fabricated Blobs and eager full-library hydration. A successful local read returns real bytes; storage errors stay distinct from a missing managed file.

Byte/URL and decode caches include immutable binary identity and workspace generation. Current evidence/render/export/provider input must revalidate file identity/availability so a previously decoded buffer cannot falsely prove that externally removed/corrupted bytes are still available. Use a verified immutable read lease for each operation; verify before publishing prepared input/result and fail visibly if the file changes during that lease. Metadata references remain intact.

Stage binary writes outside row transactions using bounded 256 KiB transfer/read/hash chunks and cancellation. Reuse file intent, hash verification, no-overwrite publication and durability checks. The final database commit claims prepared files together with affected domain/job/evidence rows. Publication failure yields no ready row; commit failure leaves only recoverable unreferenced staging/files. Reopen resolves intents against committed operation/binary records and never reconstructs a paid request. Maintain original cancellation semantics around the point of authoritative commit.

Generated media and retained audio/export records live inside the container. User-requested external Save remains the already accepted independent system service; an externally exported copy is not a project storage authority. Do not silently turn every transient external CSV/ZIP into an additional durable domain record.

Missing managed bytes preserve identity, slots, timings and historical references and show lost-material state. Removing the original source after import is harmless. Logical deletions can leave verified unreferenced bytes; automatic physical GC is deferred and must not unlink bytes inside a rollbackable SQL transaction. No fixture-only 32 MiB transfer cap or full-table 10,000-row limit may be applied to the full product without explicit product review.

## 6. Reactive reads and UI reuse

Replace direct `dexie-react-hooks` dependencies with shared `useProductQuery` preserving current loading/null/error and dependency behavior. Browser can delegate observation to Dexie. Native uses committed table/key invalidation, monotonic change sequence, generation reset, subscription cleanup and query cancellation. Attach observation before the first snapshot read or reconcile its sequence afterward; do not lose a commit in the read/subscribe race.

Keep the same routes, workspace chrome, tabs, Agent UI, drafts and dialogs. No polling-as-correctness workaround, second global state library or separate native UI tree. Deletion/error states must preserve mounted drafts according to current workspace contracts. Native file availability needs refresh/focus checking through the byte owner; external absence does not produce logical deletion or a remote change.

## 7. Agent and local/portable separation

Losslessly persist original tool arguments/results, approval fingerprints, failures, receipts, chat, task/version history, generation outcomes and local run continuation data. Preserve business-write-plus-tool-ledger and media-plus-job atomicity. Explicit same-device resume continues through existing owner guards; relaunch/refresh alone does not resubmit a paid job or treat historical approval as current authority.

This is a local storage codec, not a synchronization codec. Future portable projection must review individual fields and exclude device secrets, continuation tokens and live execution authority while retaining historical associations. Keep the existing partial checkpoint/plugin boundary honest and add no full-workspace export/apply or provider implementation here.

## 8. Validation, operational limits and rollback

Use the old full-product route/tool inventory as behavioral baseline, regenerating counts when implementation begins. Test shared transaction and command cases against browser IndexedDB and the actual Rust SQLite bridge. Native mock replies alone cannot establish SQLite atomicity or recovery. Retain source/fixture/build identities and failed attempts.

Acceptance requires all product domains, all registered tool contracts, nested receipt atomicity, phantom/uniqueness/rollback races, real binary closure, interrupted file stages, restart, missing files, reactive reads, and actual packaged macOS product smoke. Windows/Linux actual host checks remain deferred; no all-platform completion claim follows from macOS.

There is no historical data rollback/migration pipeline. Before changing native startup ownership, verify the new adapter behind explicit test selection. If gates fail, keep the previous full-product build usable without activating a dual owner. Do not delete old local stores or copy secrets to make fixtures work. A new normal build activates SQLite only after the full coverage gate, not after a video-only slice passes.

## Verified media-response repair scope — 2026-10-12

Actual native review confirmed two defects before source freeze: the original custom-protocol response returns only the first bounded chunk for a GET without Range, and64 permanently held playback descriptors prevent later full-grid previews. HEAD also incorrectly applied Range; its narrow repair has real-file regression evidence. These are implementation gaps within the approved managed-byte preview behavior, not optional packaged smoke exclusions.

The pinned Tauri2.12.2/Wry0.57.0 response interface accepts one complete response body rather than a streaming body. Root reviewed and authorized the minimal application-owned loopback media transport under the user's explicit full-responsibility/automatic-approval instruction. Keep `product_media_preview/release` as closed Session+ManagedBinaryRef/opaqueUUID operations. Bind only127.0.0.1 to a random port; no remote deployment/account, arbitrary paths, SQL, credentials, provider proxy or sync capability. Return canonical opaque URLs; require exact Host and validate a supplied Origin against the current trusted packaged origin, without wildcard/null-origin CORS. Ordinary media requests may omit Origin only when the unguessable current capability and all other checks pass.

Separate capability metadata from an actual request descriptor; bounded active readers open lazily, validate session/root/file at each chunk, and release on finish/disconnect/timeout/revocation. Full GET is200 and transfers the complete verified representation with bounded memory; Range is206 with matching content length/range; HEAD ignores Range and returns200/full metadata/zero body. More than64 mounted preview capabilities must not retain64 permanent descriptors or leave later items indefinitely loading. Any CSP change is limited to local media transport.

Owner: native_store_engine, narrow native media/desktop lifecycle/URL validator and actual disk/rawHTTP regressions. Shared business/UI/FIFO/root-owner activation are unchanged. Preserve prior raw logs and add actual >32MiB full-body/range/HEAD/revocation/containment/65-capacity evidence. Actual WK playback/seek remains a separate pending host gate while macOS is locked. Normal owner activation and task completion remain pending until complete packaged acceptance.
