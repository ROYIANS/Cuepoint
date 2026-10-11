# Shared product storage

## 1. Scope / Trigger

Read before changing `src/db/`, Agent transaction dependencies, reactive reads,
managed bytes, or the full-product native worker. The product has one React page
tree, one set of TypeScript commands and one Agent/tool registry. Persistence is
an adapter boundary: browser IndexedDB and the complete native SQLite/files
store implement the same `ProductStore`. Do not rebuild a business domain in
Rust, mirror a second database, or retry a rejected native operation in Dexie.

The full-product SQLite implementation is separate from the retained schema-4
video prototype. Activation of the normal packaged profile requires actual
isolated full-product acceptance; source/unit proof does not satisfy that gate.
Fresh development is the default. No legacy import, backfill or migration is
authorized without the user's explicit request.

## 2. Signatures

Owners: `storage/types.ts`, `store.ts`, `schema.ts`/`schema.json`, `codec.ts`,
`browser.ts`/`browserDatabase.ts`, `native.ts`/`nativeBridge.ts`, `nativeBinary.ts`,
`binary.ts`, `hooks.ts`, and Rust `full_product_store/`, `product_binary.rs`,
`product_media.rs`/`worker.rs`.

```ts
type ProductStore = StoreApi & {[N in TableName]: StoreTable<ProductRows[N]>};
type StoreTx = ProductStore & {
  readonly transactionId: string;
  readonly mode: "r" | "rw";
  readonly scope: readonly TableName[];
};
store.transaction<T>(
  mode: "r" | "rw", scope: readonly (TableName | {name: TableName})[],
  callback: (tx: StoreTx) => Promise<T> | T,
): Promise<T>;
store.observe<T>(
  query: (tx: StoreTx) => Promise<T> | T,
  observer: {next(value: T): void; error(error: unknown): void},
): () => void;
useProductQuery<T>(query: (tx: StoreTx) => Promise<T> | T,
  dependencies?: DependencyList, defaultResult?: T): T | undefined;
useProductQueryState<T>(query: (tx: StoreTx) => Promise<T> | T,
  dependencies?: DependencyList, defaultResult?: T): {
    value: T | undefined; error: Error | null;
  };
```

Table operations are `get`, `bulkGet`, `toArray`, `count`, `where`, `orderBy`,
`filter`, `add`, `put`, `update`, `delete`, `bulkAdd`, `bulkPut`, `bulkDelete`,
`clear`. Collections retain `first`, `filter`/`and`, `reverse`, `limit`, `sortBy`,
`each`, `modify`, `delete`; `anyOf` accepts an array or variadic keys.
`storage/schema.json` is the closed 49-table key/index/scope registry, shared
with Rust and checked against the browser schema. Immutable version tables use
their declared `versionId`, rather than an invented universal `id`.

Existing business commands accept an optional final `ProductStore`. A `StoreTx`
implements that interface. Every nested helper, preview, tool callback and
receipt read must receive the initiating transaction; there is no ambient
renderer transaction context. A nested transaction joins that context only
when its mode and table scope fit the parent. Handles cannot escape settlement.

```ts
type BinaryContent = Blob | ManagedBinaryRef;
interface ManagedBinaryRef {
  version: 1; workspaceId: string; binaryId: string;
  byteLength: number; contentHash: string; mimeType: string;
}
readBinaryBlob(binary: BinaryContent, signal?: AbortSignal): Promise<Blob>;
binaryAvailability(binary: BinaryContent, signal?: AbortSignal):
  Promise<"ready" | "missing" | "corrupt">;
createBinaryObjectUrl(binary: BinaryContent, signal?: AbortSignal):
  Promise<{url: string; release(): void}>;
withBinaryReadLease<T>(binary: BinaryContent,
  consume: (lease: BinaryReadLease) => Promise<T>,
  signal?: AbortSignal): Promise<T>;
```

## 3. Contracts

The fixed trusted startup profile chooses the adapter before database/module
construction. `initializeProductStorage()` completes before mounting routes.
SQLite startup failure is visible and does not construct an IndexedDB catalog.
Browser identity, isolated native profile, and normal native profile are
separate. A preference, query string or later global mutation cannot change the
loaded owner. Keep HTTP, external Save, printing and dark icon contracts in
`native-product-runtime.md`.

All local tables, including device connection/settings and full Agent/tool
records, belong to one private SQLite transaction owner. Table scope labels
`content`/`device`/`mixed` describe future projection requirements; they do not
make the database safe for raw cloud synchronization. Preserve current local
tool arguments/results, explicit continuation state, approval fingerprints and
receipts. A portable projection must separately review fields and exclude local
credentials/live authority. This task supplies no cloud provider or sync codec.

The local tagged codec preserves own `undefined`, omitted versus explicit-clear
patches, nested values, special numbers, dates, bytes, arbitrary authored keys
and unpaired UTF-16. It uses entry arrays, so user keys including `__proto__` or
tag-like names do not collide with transport syntax. Native identity transport
uses `WireText` where JSON Unicode would lose UTF-16. Native references are
registered only by the storage producer/decoder; an authored object with the
same fields cannot authorize filesystem access. Unsupported types/cycles reject
before durable publication. Do not add an arbitrary metadata/key cap to hide
transport failures.

Native reads use short SQLite operations with point/absence and predicate
guards. The renderer maintains a transaction-local overlay for read-your-writes.
Indexed pages are epoch checked. A sealed prepared batch contains ordered
mutation/claim entries, bounded 262144-byte UTF-8 chunks and a SHA-256 fingerprint
of `cuepoint-batch-v1\n` plus the exact JSON lines. The final SQLite transaction
commits rows, projections, binary claims, revision/change sequence and durable
operation receipt together. Supplier IO does not hold a SQLite writer lock.
Individual large metadata rows/change records use bounded transfers rather than
new whole-row IPC caps.

Oversized read arguments use the same closed `product_store_request` command:
`requestStart` binds `purpose: get | query | count` to an existing transaction;
`requestChunk` supplies transfer ID, ordered byte offset and at most32768 raw
UTF-8 bytes; `requestFinish` consumes that capability. Its payload is exactly
`{table, keys}` or `{query}`, with no embedded session, SQL, path or command.
Current session/operation, guards and expiry remain authoritative throughout.
The raw text bound keeps worst-case JSON escaping within the262144-byte IPC
envelope. Transfer setup is not permission to widen the transaction scope.

Registered readonly selectors may push `limit` and aggregate `count` into the
adapter without hydrating complete selected row bodies. Limit/first ordering,
primary-key ties, anyOf deduplication and table/predicate guards still apply,
including limit zero. Transaction-local mutations and JavaScript predicates
require correct overlay/filter semantics; do not silently push a filter after
the limit or count the wrong rows. Actual query/byte counters must distinguish
SQL count from full-row reduction; a correct small result alone does not prove
bounded history reads.

One native driver admits at most **32 concurrent root readonly snapshots** in
FIFO order, serializes root read/write units of work fairly, and keeps later
readers behind a queued writer. Rust retains its independent 64-context guard;
large thumbnail grids must queue rather than raise that guard or fail the page.
An explicit nested StoreTx joins its existing unit of work without entering that
root queue. Settlement, cancellation and callback failures release admission;
callbacks run once. Disposing an observation cancels its not-yet-admitted query;
if admission already began, recheck the observation owner before calling its
selector and finish the context without publishing stale results. This matches
local browser write scheduling while retaining
point/predicate/CAS guards against independently admitted external drivers.
Supplier/network work remains outside storage admission. Do not repair a local
sibling conflict by replaying a transaction callback or paid request.

Once COMMIT may have been sent, a lost reply or malformed acknowledgement is
uncertain. Resolve durable status using the same operation/fingerprint. Only a
confirmed `rolledBack` outcome permits rollback classification. `unknown`,
`pending`, `notFound`, or a failed status read remain `UnknownCommitError` with
operation/workspace identity; they never authorize mutation or paid replay.
Reopen may query the persistent operation identity through a fresh session,
without reviving an expired handle. Notifications are post-commit invalidation,
not evidence that a mutation was rolled back.

This certainty contract also governs plan/bookkeeping completion, generation
preparation/claim, pending-draft flush and approval wrappers. An atomic business
tool regression alone does not establish these separate catches. Preserve typed
unknown certainty when completion-ledger reads or saving the unknown state also
fail; a generic interruption fallback must not silently mark the call retryable.

Native observation subscribes before its initial snapshot and reconciles
committed sequence changes. Point/index dependencies distinguish relevant
changes; irrelevant owners/kinds must not reread. Rollbacks emit no committed
invalidation. Disposal suppresses late publication. Keep existing scope envelopes
around held query values: a previous owner's result cannot populate a newly
selected editor/library. `useProductQueryState` retains successful data with an
explicit error; `useProductQuery` throws errors for the owning boundary.
Detail queries return `?? null` to distinguish missing from initial loading.

The three binary carriers are media `blob`, file material-version payload
`blob`, and immutable setting-snapshot `media[].blob`. Browser stores independent
Blobs. Native stores independent hashed managed files plus opaque references;
display filenames and logical IDs do not become trusted OS paths. Bounded
prepare/write/read sessions enforce order, length, hash, workspace/session and
containment. Claims publish with the row transaction; recovery handles interrupted
intents without treating unfinished files as ready. Logical deletion does not
promise physical erasure or an unimplemented garbage collector.

Metadata size, an object URL or a decoded-audio cache is not proof of current
bytes. Native consuming leases verify before and after use, including cache
hits. Preserve logical records, tool history, timing and associations when files
are missing/corrupt. Audio/video preview uses a session-bound opaque capability
on an application-owned `127.0.0.1` random-port byte service. The capability
contains no renderer-selected path and is separate from a bounded active file
reader. GET without Range delivers the complete representation with status200;
valid Range delivers truthful206/Content-Range; HEAD ignores Range and reports
the full Content-Length with no body. Each streamed chunk checks current
session/root/file identity; disconnect, timeout, revocation and app close release
the reader. Exact Host and current trusted-origin checks, bounded request headers
and GET/HEAD-only handling are required. The service is local media transport,
not a synchronization server or arbitrary native HTTP proxy. Actual WK playback,
range continuation and seek still need packaged acceptance. External Save remains independent: cancellation does not delete
internal results; published warnings do not trigger rerender or paid replay.

## 4. Validation & Error Matrix

| Trigger | Required behavior |
| --- | --- |
| Undeclared table / widened nested scope / readonly write | `StorageError("scope")`; no durable partial write |
| Handle used after settlement | `StorageError("closed")` |
| Duplicate primary or valid unique compound key | Constraint rejection; complete root rollback |
| Concurrent point/absence/predicate change | Conflict; do not replay a mutation callback |
| Malformed acknowledgement after possible commit | Durable status first; retain unknown certainty if unresolved |
| Confirmed commit followed by invalidation failure | Do not represent committed rows as a rollback |
| Foreign/stale/forged binary reference | Reject actual access; no renderer path authority |
| Managed bytes absent or altered | Missing/corrupt state; retain logical records |
| Late read after dispose or scope switch | Suppress publication / reject held foreign identity |
| More than 32 root readonly units on one native driver | Queue in FIFO order; keep writer fairness and Rust's 64-context guard |
| Native storage open fails | Truthful recovery; no silent second owner |

## 5. Good / Base / Bad Cases

Good: one `executeAtomicTool` context sees uncommitted business rows and commits
business receipt, original completed tool result and ledger together. Base: the
same command and pages run against browser IndexedDB or actual Rust SQLite.
Bad: append a `store` parameter but let an arrow callback, table array, helper or
receipt query still capture the root database; this silently opens a second
transaction and loses atomicity.

## 6. Tests Required

- Same shared cases on actual browser adapter and actual disposable Rust probe:
  all 49 primary-key families and every registered index, optional/compound
  uniqueness, ordering, clones/clear semantics, nested modes/scopes, overlays,
  rollback, closed handles and commit-only notifications.
- Actual native loss/recovery at command/Agent boundaries: lost or malformed
  commit reply, failed status/completed-ledger read, unresolved status and fresh
  session lookup; assert no second mutation or paid dispatch.
- Actual disk tests for all three binary carriers: source deletion, independent
  immutable snapshot copies, hash equality/reopen, missing/corrupt files, partial
  transfer/cancel, row/claim failure and intent interruption. Warm-cache tests
  must mutate/delete the underlying file and still reject stale availability.
- Actual existing domain/registered tool bodies under each owner; a registry
  inventory or fabricated completed result is not execution evidence.
- Shared query hook races, disposal, precise invalidation and scope identity,
  plus retained E04 actual-browser negative invalidation matrix.
- Actual Rust admission regression (`tests/sharedNativeAdmission.test.ts`):
  three rounds of 70 compound material-version queries return correct rows,
  bounded contexts settle to zero, disposed queued observations never run,
  callback failures release slots, and a queued writer precedes later readers.
  Verify the packaged 70-item grid, navigation away/back and subsequent save;
  row counts or an initially visible grid do not prove lifecycle stability.
- Actual isolated packaged macOS full UI/Agent/files/range/reopen proof before
  normal activation. Source/unit/probe evidence cannot replace a locked-screen
  or pending system window check. Other operating systems need their own proof.

Historical original/current fixtures remain byte-identical and use the explicit
raw browser comparator. New fault tests intercept transaction-bound table
handles (`tests/helpers/storeFaults.ts`), not root-table spies that the actual
mutation never uses. Preserve fault-reached, rollback and uncommitted-read
assertions. Missing real-native executable must fail an explicit native gate.

`scripts/native-storage-regression.mjs`, exposed as `test:storage:native`, owns
the permanent complete core/business lane. Its current suite manifest is
`tests/fixtures/shared-storage/nativeAcceptanceSuites.json`. The gate rebuilds
the locked probe, requires an empty evidence directory, rejects source changes
during execution and checks the actual registered tool outcomes. Confirmed
table/test mappings contain no record values or original tool arguments. A
partial `--suite core` run does not establish complete business coverage.

## 7. Wrong vs Correct

```ts
// Wrong: nested command and completed evidence read use the root store.
await db.transaction("rw", tables, async () => {
  await applyChange(input);
  await readWriteReceipt(id);
});

// Correct: one explicit context flows through every real operation.
await db.transaction("rw", tables, async tx => {
  await applyChange(input, tx);
  await readWriteReceipt(id, tx);
});
```

Wrong: catch a reply decode failure and mark the tool safely rolled back.
Correct: query the durable outcome, retain committed evidence when confirmed,
and block automatic replay while certainty remains unknown.
