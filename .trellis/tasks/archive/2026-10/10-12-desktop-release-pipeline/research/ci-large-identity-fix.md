# Implementation: native oversized-selector pagination

## Change boundary

The current query adapter repeats a complete oversized `anyOf` selector on each
row page. The finalized research measured 43,732,895 request bytes for the
41-row array phase. The smallest correction is query scheduling in
`src/lib/storage/native.ts`: preserve the existing 256-key ceiling and additionally
partition by actual encoded selector bytes. A single oversized key remains a
valid one-key group and uses the existing bounded bridge transfer.

Owned production/test changes are `src/lib/storage/native.ts` and
`tests/sharedNativeStorageContract.test.ts`. The test retains the complete
historical oversized fixture, assertions and 30-second deadline, and adds a
transport-amplification bound plus actual Rust semantic cases for grouped
selectors. No Rust, DTO, bridge, count, schema, dependency, deadline or worker
configuration changes are included. Root owns task/spec/commit coordination;
peer edits are preserved.

## Execution

Implementation and focused verification are complete. `NativeTransaction.query`
deduplicates selectors as before, then groups by both 256 keys and the actual
UTF-8 bytes of `JSON.stringify(encodeWireKey(key))`, including JSON array brackets
and separators. The scheduling budget is `IPC_CHUNK_BYTES/4` (65,536 bytes).
An individually larger selector remains admitted alone. Count still uses its
previous aggregate groups. Dependency registration, epoch checks, native guards,
row deduplication, global ordering/reverse/limit and overlays are unchanged.

## Meaningful verification

The new permanent array-phase assertion was run against unchanged production
source first and failed with exactly **43,732,895 bytes > 4,194,304 bytes**.
Every preceding original identity assertion passed. The complete original
40-row mixed fixture and 72,001-unit NUL/lone-surrogate identity, get/equals/
bulkGet/count/array/reopen/delete coverage, 262,144-byte envelope assertion and
30-second deadline remain intact.

The final complete focused file passes **71 actual TypeScript/Rust adapter and
shared storage cases** on macOS ARM64 / Node22.21.1 in 14.55 seconds. Two added
cases use the real unchanged Rust probe:

- Compound selectors contain multibyte text, JSON quote/backslash/NUL escaping,
  lone UTF-16, duplicates separated by grouping boundaries and a single key
  whose encoded payload exceeds the whole IPC envelope. Observed groups satisfy
  encoded byte/key bounds, flattened distinct keys match exactly, and actual
  `requestStart`/`requestChunk`/`requestFinish` occur for that oversized key.
  Global index/primary-key ordering, reverse, limits, first, limit zero, count,
  limit-before-sortBy and staged insertion/deletion/index changes retain their
  expected results.
- An independent native driver commits a real external row between two distinct
  selector groups. Rust rejects the changed table epoch before group two returns.
  The mutation callback runs once, the previously staged project is absent after
  rollback, and the independent row remains committed.

The retained 600-row/600-selector case now also observes actual first-page key
groups **[256, 256, 88]** and exact flattened selector equality. Its original
large metadata/reopen assertions are preserved.

The first green attempt passed 70 cases but the new epoch test incorrectly
expected two successful epochs. The actual native guard returns a conflict
before the second epoch response. The test now asserts two distinct attempts,
one successful epoch, conflict, rollback and no callback replay. The failed
attempt remains in the evidence; production grouping did not change for this
correction.

## Current-source request measurement

An instrumented exact historical workload ran against the final production
source with the same 30-second deadline. It passed in 4.49 seconds runner time;
the operation itself took 4.232 seconds. The array phase took 0.881 seconds and
sent **2,643,011 bytes over 41 query pages**, with no request upload transfers
in that phase. Earlier source sent 43,732,895 bytes and 1,353 request chunks.
The complete workload's maximum envelope remains **252,453 <= 262,144 bytes**.
These single local measurements demonstrate removed transport amplification;
they are not wall-clock guarantees or corresponding-host acceptance.

## Frozen source and evidence

Final owned SHA256:

| Path | SHA256 |
| --- | --- |
| `src/lib/storage/native.ts` | `4532d47791ac0ad389a73ede820bb5c1cf38f695878fd308ac3ab232eb5948a6` |
| `tests/sharedNativeStorageContract.test.ts` | `7b38de5b8c532fba42a096d38e181f23540d5ede39adfbee9aab8e3858f5d642` |

Finite evidence is in `research/logs/ci-large-identity-fix/`:

- `implementation-receipt.json` records commands, failures/pass counts, final
  inputs, preserved contracts, exact Node/probe identity and request totals.
- `red-array-byte-budget-node22.log` and `baseline-native.ts.txt` retain the
  reached transport regression and baseline source hash.
- `focused-green-node22.log` retains the corrected new-test expectation failure;
  `focused-green-node22-2.log` is the final 71-case pass.
- `profile-current.test.ts`, `profile-current.config.ts`,
  `profile-current-node22.log` and `profile-result.json` retain the current-source
  exact-workload measurement. The config is diagnostic-only, not a product or
  permanent test entry.

Commands use the explicitly approved machine pnpm executable (10.15.0), with PATH
selecting Node22.21.1. The existing cold-built real probe SHA256 remains
`5b4f8694f3c42f471cb418f5de81be7a4a8e24a1153995dfab926fcb9254c8a5`, matching
the prior locked Rust1.99.0 readiness receipt. No Rust rebuild was needed.

Root/checker own the combined formal gates and independent final review. Local
macOS proof does not establish Linux/GitHub success or close installer
acceptance. No timeout, worker setting, fixture reduction, dependency change,
user-data access, GUI/provider request, commit, push or remote run occurred.
