# MiMo exact audio boundary: hosted CI follow-up

## Reached failure and scope

After the owner pushed the preceding fixes, the supplied hosted root-suite log
reported one failure: `tests/boundedInput.test.ts:183`, `actual provider inbound
limits > accepts a legitimate MiMo envelope above 4 MiB and exactly the decoded
audio boundary`, exceeded the unchanged default 5,000 ms deadline. The log
reported 3,956 passing tests, seven existing skipped tests and one failure.
This is a new reached failure, separate from the previous native selector and
desktop Knip issues. The supplied excerpt does not identify the host/run SHA.

The smallest behavior gap is the cost of accepting a valid 32 MiB MiMo WAV
inside its bounded base64 JSON envelope. Actual response decoding is owned by
`src/lib/ai/mimoSpeech.ts`. Investigate that path and retain all validation,
once-only paid request behavior, error classification and audio bytes.

The candidate source boundary is that module and meaningful regressions in
`tests/boundedInput.test.ts` / `tests/mimoSpeech.test.ts`. Keep the exact existing
32 MiB acceptance, above-limit rejections, default 5-second deadline and worker
configuration. No provider limit, dependency, database, workflow, native Rust,
packaging or old-data compatibility change is part of this fix.

## Execution and evidence boundaries

Work starts from `d6a7fa68d3ee1e850b86f1cfebc84ba062022402` on
`codex/ci-mimo-audio-boundary`. A Trellis implementer owns product/test edits;
an independent researcher profiles the original workload; root owns spec sync,
final frozen gates and any subsequently approved local commits. Heavy profiles
and test gates run sequentially to avoid self-induced contention.

Use the explicit approved local pnpm and existing Node22/Node24 executables.
Retain finite original/candidate diagnostics and source identities. Local macOS
ARM64 measurements do not prove hosted Linux success, four-host installer
acceptance or draft delivery. H1a/H1b remain pending. No remote push, tag,
workflow dispatch, Release mutation or task archive is authorized by this
failure report.

## Result

The source correction preallocates the exact decoded `Uint8Array` and copies
binary code units directly, replacing only the iterable/callback conversion.
Strict base64 validation, the padding-aware size check before `atob`, WAV/Blob
validation, preview requirements, errors and once-only request behavior retain
their original bodies. The original `boundedInput.test.ts` is byte-identical to
HEAD. Three full-byte parity tests exercise NUL/high bytes, final bytes and all
base64 padding residues through the actual provider entry.

The independent matched original/candidate profile keeps the original 32 MiB
fixture, assertions and default 5-second deadline: the measured case falls from
1,624 ms to 263 ms, with the copy stage falling from 1,378.44 ms to 37.09 ms.
That original stage accounts for 85.4% of measured stage time. Recorded marker
RSS falls from about 984 MiB to 476 MiB; these are sampled local observations,
not a continuous peak or an OOM guarantee. The hosted timeout was not reproduced
locally. See `ci-mimo-boundary-profile.md` for retained original/candidate source,
fixture identities and all measurement caveats.

Final frozen local gates, sequential with no competing test/build workload:

| Gate | Result |
| --- | --- |
| Original focused provider/boundary/runtime cases, Node22 | 3 files / 56 tests pass |
| Complete ordinary root suite, Node22.21.1 | 228 files / 3,960 tests pass; existing one file / seven tests skipped |
| Complete ordinary root suite, Node24.11.0 | Same 228 files / 3,960 tests pass and existing skips |
| Actual SQLite `--suite all` | 108 files / 1,905 tests pass; 95 registered tools, every missing coverage/owner assertion array empty |
| Additional actual native binary and browser capability lanes | Six and five tests pass respectively |
| Root types, root formal quality; desktop types/lint/quality | All exit zero; existing 12 reviewed quality allowances / 585 review warnings unchanged |
| Quality failure-contract self-test | 88 cases pass |
| Model snapshot and production build | Both pass; build 21.36 seconds |

`logs/ci-mimo-boundary-final/verification.json` records all 11 final commands
exiting zero and identical before/after identities for 1,058 product/test/tool
inputs. Root independently recomputed every current input hash and checked the
unchanged original fixture. The complete native evidence remains in the ignored
local `desktop/tauri/.acceptance/ci-mimo-boundary-final-native-20261012` directory;
its complete acceptance receipt is copied unchanged into tracked
`logs/ci-mimo-boundary-final/native-acceptance.json`. No compiled probe or repeated
full native trace tree is included in the proposed work commits.

Independent review is recorded in `ci-mimo-boundary-check.md`. The concrete
commit plan is prepared only after that final review. Local verification does
not close the next hosted quality run or H1a/H1b. No commit, main merge, push,
workflow dispatch, Release change or archive is included in this result.
