# Research: oversized native read identity timeout

- Query: Why does the actual GHCR full root suite time out after 30019ms only in `transfers arbitrary oversized read identities within the IPC envelope budget`, and what is the smallest correction preserving that contract?
- Scope: internal, actual local real-probe timing, owner-supplied hosted failure log; no hosted Linux execution.
- Date: 2026-10-12

## Findings

The supplied GHCR log reports 227 passing files / 3954 passing tests, one failure and the existing seven skipped tests. The real SQLite probe exists; this is separate from the earlier missing-executable failure. The only reported failure is the explicit 30000ms case in `tests/sharedNativeStorageContract.test.ts:11`.

The unchanged focused permanent case passes locally on macOS ARM64, Node22.21.1, with the exact real no-GUI probe from the prior cold-build readiness receipt. Total runner duration is13.56s. It did not reproduce a30s timeout locally. Research instrumentation then ran the exact same workload and assertions, with90s only as a research observation deadline: the complete operation took13.557s. Neither permanent test nor product source was edited.

The dominant cost is repeated large `anyOf` selector upload on cursor pages:

| Measured phase | Current code | Research-only byte-group candidate |
| --- | ---: | ---: |
| Complete original workload, inside test | 13.557s | 4.129s |
|41-key `anyOf().toArray()` phase | 9.883s | 0.838s |
| Query pages in this phase | 41 | 41 |
| `requestStart` / `requestFinish` pairs | 41 | 0 |
| `requestChunk` calls | 1353 | 0 |
| All request envelope bytes in this phase | 43,732,895 | 2,643,011 |
| Maximum request envelope across complete workload |252453 bytes |252453 bytes |

These are individual local measurements, not a performance threshold or corresponding-platform release result. The byte-group candidate removes an observed16.55x request-byte amplification while preserving all41 result rows.

### Mechanism and code patterns

- `tests/sharedNativeStorageContract.test.ts:14` creates a72001-code-unit identity (`key\\0` repeated18000times plus one lone high surrogate), plus40keys each containing20000`x` characters. All41records use their own long identity as `projectId`, so each mixed record body contains over40000characters.
- `src/lib/storage/native.ts:110-112` deduplicates `anyOf` keys and divides them only by the256-key page size. All41large keys therefore stay in one selector group.
- `src/lib/storage/native.ts:117-129` resends that entire group with every cursor page.
- `desktop/tauri/src-tauri/src/full_product_store/query.rs:287-305` holds a65536-byte payload budget, accepting at most one oversize record per page. Two mixed record payloads exceed the budget, so this fixture yields41pages.
- `src/lib/storage/nativeBridge.ts:55-71` wire-encodes the complete selector on each request. A selector larger than262144-byte envelope budget uses `requestStart`, ordered32768-byte text chunks, and `requestFinish`.
- `desktop/tauri/src-tauri/src/full_product_store/mod.rs:472-550` validates/clones/serializes the query, binds cursor identity, converts all selector keys into ordered UTF16 SQLite BLOBs and executes the query on each page. This repeats parsing and selector preparation as well as IPC bytes; baseline41`requestFinish` roundtrips alone account for8.520s. The timing includes transport and Rust work; it does not isolate native CPU from IO.
- `vitest.config.ts:33-37` imposes maxWorkers2 only on the explicit full SQLite-owner lane. The ordinary root/GHCR run stays on browser owner while including six real-native files, using Vitest's default worker scheduling. GHCR runs `pnpm test` on Node22 at `.github/workflows/ghcr.yml:42-43`. The owner log's229 spawned workers means one isolate per file over the run, not229 simultaneous workers. No assertion of global CPU competition follows from this count.

### Recommended implementation boundary

Change only query-side `anyOf` grouping in `NativeTransaction.query`:

1. Keep current selector-key deduplication and the256-key transport cap.
2. Additionally group by the UTF8 bytes of `JSON.stringify(encodeWireKey(key))`, including separators. Use `IPC_CHUNK_BYTES/4` (65536bytes) as an internal scheduling budget.
3. A single key larger than that budget remains admitted as a one-key group. Existing bounded `read` transfer handles genuinely oversized identities. This budget is not a metadata/key admission limit.
4. Keep the original dependency query, cross-group epoch check, row deduplication, cursor loop, global ordering/reverse/limit, and transaction-local overlay semantics.
5. Leave `count`'s current256-key aggregate groups alone. It performs one aggregate query per group, with no cursor selector replay; the complete41-key count measured0.192s. This is a query-only correction, not a reason to widen Rust protocol or rewrite storage.
6. Preserve the permanent30000ms deadline, all40mixed rows, NUL/lone-surrogate identity, get/equals/bulkGet/anyOf/count/reopen/delete assertions, and262144-byte IPC ceiling. Add meaningful request-byte/call bounds for the affected read phase and grouping-boundary/dedup/order/reverse/limit/epoch/overlay regressions. Do not rely on wall-clock assertions alone.

The research candidate changes query grouping only in a task-owned copy of `native.ts`. It passes the same complete original workload, real Rust probe and every original assertion. This proves feasibility of eliminating measured replay; it does not independently prove every grouping semantic. Implementation and check agents must review the additional semantic cases.

### Files found

| Path | Description |
| --- | --- |
| `tests/sharedNativeStorageContract.test.ts` | Permanent real TypeScript/Rust adapter contract and explicit30s case. |
| `tests/helpers/nativeProductProbe.ts` | Actual child-process JSON-line probe; disposable workspace, reopen and clean close. |
| `src/lib/storage/native.ts` | Selector partition, query cursor loop, epochs, overlay and result ordering. |
| `src/lib/storage/nativeBridge.ts` | Request-envelope sizing and bounded read upload. |
| `src/lib/storage/wireText.ts` | Lossless unpaired UTF16 key transport. |
| `src/lib/storage/protocol.ts` |262144-byte envelope,32768-byte text chunks,256-key/page bounds. |
| `src/lib/storage/codec.ts` | Complete local strings and authored value codec. |
| `desktop/tauri/src-tauri/src/full_product_store/query.rs` | Ordered UTF16 SQLite selectors and65536-byte record page budget. |
| `desktop/tauri/src-tauri/src/full_product_store/mod.rs` | Cursor authority, query parsing and bounded transfer owner. |
| `vitest.config.ts` / `.github/workflows/ghcr.yml` | Ordinary full-suite owner and CI test command. |

### Evidence and provenance

Evidence directory: `research/logs/ci-large-identity-timeout/`.

- `focused-original-node22.log`: unmodified permanent test,1pass/68name-filtered skips; runner13.56s.
- `profile.test.ts`, `profile.config.ts`, `profile-node22.log`, `profile-result.json`: exact full-workload research instrument, phase/call/byte timing;1pass.
- `native-byte-group.ts`, `profile-byte-group.test.ts`, `profile-byte-group.config.ts`, `profile-byte-group-node22.log`, `profile-byte-group-result.json`: task-only candidate and identical workload/contract;1pass.
- `provenance.json`: Node/platform/architecture, exact probe SHA256 and11 source-input hashes compared to the prior frozen full-root receipt. Probe remains `5b4f8694f3c42f471cb418f5de81be7a4a8e24a1153995dfab926fcb9254c8a5`, matching prior cold-build readiness proof. All11 inspected current inputs match that prior frozen receipt. No Rust rebuild or product-source write was performed.

Commands used the explicit approved machine pnpm executable, with PATH selecting Node22.21.1. The exact probe came from ignored `desktop/tauri/.acceptance/ci-probe-readiness-node22-20261012/target/debug/product_store_probe`. Its original cold build and clean ready/closed/exit receipt remain in `research/logs/ci-probe-readiness/cold-build-node22/probe-ready.json`.

### Related specs

- `.trellis/spec/frontend/shared-product-storage.md`: one adapter boundary; arbitrary metadata/identity; lossless UTF16; bounded IPC; no arbitrary authored key cap; epoch/overlay/ordering/count contracts.
- `.trellis/spec/frontend/quality-guidelines.md`: actual probe prerequisite, meaningful native contracts, full frozen-source verification; preserve all historical fixture/assertion boundaries.
- Task PRD AC6: appropriate full browser/native storage and independent review before local source commitments; local proof does not close hosted acceptance.

## External references

No external technical source was needed: the amplification and candidate effect are established by current repository implementation and actual local probe requests. Installed versions used: Node22.21.1, pnpm10.15.0, Vitest5.0.1, the locked Rust1.99.0 no-GUI probe from the prior readiness receipt. The supplied hosted failure log is owner-provided evidence, not a newly inspected GitHub run.

## Caveats / Not Found

- The actual30s hosted failure did not reproduce locally. No Linux/hosted candidate run or resource profile was collected, and root must keep the next GitHub run pending.
- No causal claim about runner CPU/memory/parallel contention is made. The measured algorithmic amplification exists independently of those unknowns.
- Research-only candidate90s observation deadline is not a proposal to change the permanent30s contract.
- Candidate semantic coverage remains for implementation/check: duplicate typed keys, escaped/compound/UTF16 key size,256-key scheduling boundary, global reverse/limit, across-group epoch failure, and read/write overlays.
- Research files are diagnostic copies, not production entry points; only implementation agent may adopt source changes. No GUI, providers, existing user data, Git operations, remote dispatch or cache deletion was used.
