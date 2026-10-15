# MiMo decoded audio boundary: implementation

Status: narrow implementation and focused validation complete. Final full-suite,
quality and independent review are parent-owned pending gates. Starting revision is
`d6a7fa68d3ee1e850b86f1cfebc84ba062022402`. The owner supplied a hosted root-suite
failure at the unchanged default 5000 ms deadline in `boundedInput.test.ts`:
"accepts a legitimate MiMo envelope above 4 MiB and exactly the decoded audio
boundary". The other 3956 tests passed. This is supplied diagnostic evidence,
not a downloaded complete hosted run.

## Change boundary, recorded before code edits

- Gap: a valid 32 MiB decoded MiMo WAV response must retain its current exact
  bytes/limits and finish without the costly iterable/callback conversion in the
  provider decoder. The hosted timeout alone does not identify its cause.
- Owner: `src/lib/ai/mimoSpeech.ts`, immediately after the unchanged strict base64
  syntax and exact decoded-size checks, currently uses
  `Uint8Array.from(decoded, char => char.charCodeAt(0))`.
- Candidate: keep `atob` and preallocate one exact-length Uint8Array, then copy
  binary-string code units by index. No shared helper is needed: the source
  search found no other base64 audio decoder with this owner contract.
- Planned files: that one product module; `tests/mimoSpeech.test.ts` for byte
  parity including zero/high-byte values, final-byte preservation and all three
  base64 padding cases. `tests/boundedInput.test.ts` stays byte-identical so the
  original 32 MiB fixture, +1/+2 rejection cases, assertions and 5000 ms deadline
  continue to exercise the correction.
- Preserve envelope/raw limits, exact size-before-atob, WAV MIME detection,
  optimized text preview, validation/protocol/network/HTTP/abort classification,
  request bodies/policies and exactly one paid POST. No new API, browser/Node
  transport choice, replay, timeout, worker, dependency or workflow change.
- Prove behavior through the real provider entry with injected finite Response
  bodies; record actual sequential Node22 baseline/candidate measurements and
  original focused suites. The parent owns the final frozen full-suite, quality,
  spec and Git gates. Local macOS timing does not establish Linux hosted success,
  live supplier availability, acoustic decode or packaged UI/device acceptance.

## Implemented behavior

The decoder now preallocates `new Uint8Array(decoded.length)` and copies each
`decoded.charCodeAt(index)` directly. `atob` returns a binary string, so every
code unit is one byte; indexed copying preserves zero and high-bit bytes without
the string iterator/callback's large intermediate heap. The unchanged strict
syntax, padding-aware exact decoded-size guard and subsequent Blob-size/MIME/
preview checks stay on the same path. All public APIs and request/failure
classification branches retain their original bodies.

The regression adds three otherwise valid WAV bodies of lengths 65535, 65536
and 65537, cycling every byte value 0 through 255. The cases cover no padding,
two padding characters and one padding character respectively, repeated NULs,
high bytes and a final byte of 254, 255 or 0. Each calls the actual
`generateMimoSpeech`, compares **every** returned Blob byte and MIME, and requires
exactly one fetch. They make no timing assertion or implementation-call spy.

## Sequential baseline and candidate evidence

Research profiling ran first without concurrent test/build work. Only after the
baseline profile finished was the product source edited. The same profiler then
measured the candidate; focused tests waited until that profiling finished.
Both profiles executed the actual provider entry, original fixture and original
assertions with the 5000 ms default deadline. Finite task-owned Vite transforms
inserted measurement markers, without changing tracked source or tests.

| Measured local Node22 stage | Original | Indexed candidate |
| --- | ---: | ---: |
| Original 32 MiB case, matched profiling run | 1624 ms | 263 ms |
| Decoded string to byte array | 1378.44 ms | 37.09 ms |
| Conversion-stage heapUsed delta | +610628600 bytes | +21120 bytes |
| Largest RSS observed at recorded stage boundaries | 1032175616 bytes | 499122176 bytes |

The candidate's conversion also records exactly +33554432 arrayBuffer bytes,
matching its preallocated 32 MiB destination. Stage samples are not continuous
peak-memory measurements. The unchanged uninstrumented original focused test
passed locally in 1589 ms; its hosted 5000 ms timeout was **not** locally
reproduced. The measured copy bottleneck justifies removing substantial CPU and
temporary allocation overhead, but does not identify the hosted runner's exact
resource contention or establish its subsequent success.

Separate finite 32 MiB patterned primitive measurements compare every output's
SHA256: both implementations retain the complete bytes, with original 1331 ms
and indexed 31.95 ms. This supports the actual-provider profile; it is not a
substitute for the original acceptance fixture or full-suite gates. Receipts:

- `logs/ci-mimo-boundary-profile/baseline-exact-node22.json`
- `logs/ci-mimo-boundary-profile/production-stage-profile-node22.json`
- `logs/ci-mimo-boundary-profile/candidate-stage-profile-node22.json`
- `logs/ci-mimo-boundary-profile/byte-copy-comparison-node22.json`

## Focused validation and source freeze

Command, using `PATH` prefixed by the existing Node22.21.1 directory and explicit
machine pnpm10.15.0:

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test tests/boundedInput.test.ts tests/mimoSpeech.test.ts tests/mimoRuntime.test.ts
```

Result: **3 files / 56 tests passed**, Vitest 1.11 seconds, command wall1.7438
seconds, exit0. `CUEPOINT_STORAGE_TEST_OWNER` and
`CUEPOINT_NATIVE_STORAGE_ACCEPTANCE` were unset; ordinary original Vitest
configuration, worker settings and deadlines were used. Before/after hashes for
all eight recorded inputs matched. Full raw output and receipt are retained at
`logs/ci-mimo-boundary-implementation/focused.log` and `focused.json`.

`git diff --check -- src/lib/ai/mimoSpeech.ts tests/mimoSpeech.test.ts` passed.
The original acceptance/rejection file remains byte-identical, including exact
32 MiB acceptance, +1/+2 padding checks proving no `atob` call, envelope overflow,
HTTP authority, reader cleanup and independent media limits. MiMo wire roles,
clone validation, malformed/error responses and optimized text pass; runtime
tests also retain original raw bytes and text checkpoint/recovery, one paid
submission, no uncertain POST replay, owned references and dormant ZIP history.

| Frozen path | SHA256 |
| --- | --- |
| `src/lib/ai/mimoSpeech.ts` | `d6cfdbb126e27590b9f421474edfea9e3e52e51ba201d992d12d4e2b4a30aced` |
| `tests/mimoSpeech.test.ts` | `b148681dc02d3974e98e8677d01b635554f1de5817c3f9c790147be4ec8984d3` |
| `tests/boundedInput.test.ts` (unchanged) | `e8b8b385012157a718eebb8a46a26048f93094c1003621dd15fb58f6a3a1b761` |

No further product/test changes or heavy checks are pending from this implementer.
The parent coordinates strict types, final formal root/desktop quality, complete
frozen ordinary/native gates, independent review, executable spec updates and
any later authorized Git integration. No commit, merge, push, provider request,
GUI/device action, Release mutation or task archival occurred here. Hosted Linux
quality, installer gate H1a and draft gate H1b remain pending actual execution.
