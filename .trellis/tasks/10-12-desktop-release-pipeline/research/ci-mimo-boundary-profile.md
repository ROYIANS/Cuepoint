# Research: MiMo exact audio boundary timeout and byte-copy profile

- Query: Why did the hosted default root suite time out at 5,000 ms in the unchanged legitimate MiMo envelope / exact 32 MiB audio acceptance test, and which minimal production optimization has measurable support?
- Scope: internal, with one finite isolated primitive comparison and matched actual-production stage profiles; no remote provider/network request.
- Date: 2026-10-12

## Findings

### Original failure and finite baseline

The owner supplied a hosted failure at `tests/boundedInput.test.ts:183`: the legitimate MiMo base64 envelope / exact decoded audio boundary case exceeded the default 5-second deadline. The hosted summary was 1 failed file, 227 passed files, 1 skipped file; 1 failed case, 3,956 passed cases, 7 skipped cases. Retain this original report in `logs/ci-mimo-boundary-profile/owner-hosted-failure.txt`. The broader root run completed in 112.64 seconds. This research neither reproduced nor dismisses the original hosted failure.

One unchanged exact-case local baseline on macOS 27.0.1 ARM64, 10 logical CPUs and existing Node v22.21.1 passed at **1,589 ms** (2.477 s complete command). The approved machine pnpm path was invoked explicitly with the existing Node22 directory first on PATH. The fixture, resource budgets, Vitest configuration, setup, production MiMo response/decoder and MIME source hashes matched before/after. No test timeout, worker count, assertion or fixture size was changed. The finite baseline ran only this exact test name; 20 other cases were explicitly filtered out, not claimed as acceptance coverage.

### Files found / production path

| File | Description and contract owner |
| --- | --- |
| `tests/boundedInput.test.ts:183` | Original actual-provider exact 32 MiB WAV/base64 fixture; verifies successful result, unchanged Blob size and single injected fetch call. |
| `tests/boundedInput.test.ts:172` | Exact +1/+2 decoded byte rejections assert that `atob` is never called beyond the limit. |
| `src/lib/ai/mimoSpeech.ts:43` | `readMimoResponse` consumes bounded success/error bytes, then JSON.parse; preserves protocol, HTTP and abort distinctions. |
| `src/lib/ai/mimoSpeech.ts:68` | Once-only request boundary; speech reads use dedicated envelope limit rather than ordinary JSON limit. |
| `src/lib/ai/mimoSpeech.ts:169` | Actual speech envelope schema, strict base64 syntax and padding-adjusted decoded-size guard. |
| `src/lib/ai/mimoSpeech.ts:177` | Original `atob` plus `Uint8Array.from(decoded, char => char.charCodeAt(0))`; candidate preallocates the exact decoded length and copies indexed byte code units. |
| `src/lib/ai/boundedResponse.ts:37` | Stream byte accounting, exact read-size enforcement, cleanup and reader lock release. |
| `src/lib/ai/boundedResponse.ts:75` | Fatal UTF-8 decode after bounded byte read; ordinary JSON reader follows. |
| `src/lib/resource/limits.ts:2` | 32 MiB audio limit, 4 MiB ordinary JSON, speech envelope ceil(audio/3)*4 + ordinary JSON allowance. |
| `src/lib/audio/mime.ts:2` | Small first-64-byte container signature check; WAV requires RIFF and WAVE. |
| `vitest.config.ts:35` | Default root suite leaves Vitest's ordinary 5-second deadline intact; SQLite-owner lane has its existing separate 20-second deadline. |
| `tests/setup.ts:5` | Existing isolated browser fixture database setup; unchanged in this research. |

For the original exact fixture, 33,554,432 decoded bytes become 44,739,244 base64 characters plus the surrounding JSON envelope. The result is legitimately larger than the ordinary 4 MiB JSON budget but fits the distinct speech envelope policy. The application preserves actual byte reading and exact decoded size validation before allocation.

### Actual-source matched stage profile

A finite Vite pre-transform adds timing, CPU and `process.memoryUsage()` markers around the **actual production implementation** and **original exact test**. It never replaces the response reader, decoder, MIME detector, fetch invocation or assertions with a mock acceptance substitute. Only the existing fixture's injected Response.json transport is used. Original source/fixture copies and the explicit marker configuration are retained. Both profiles keep the same ordinary 5-second deadline. The candidate profile instruments the implementation written by the separate implementer; research edits no product source.

| Measured stage | Original ms | Indexed candidate ms |
| --- | ---: | ---: |
| Fixture allocation + Buffer base64 serialization | 23.81 | 13.78 |
| Response.json stringify / encode | 118.83 | 114.04 |
| Stream read | 0.51 | 0.37 |
| Bounded byte assembly | 9.52 | 8.18 |
| TextDecoder | 22.40 | 13.48 |
| JSON.parse | 19.29 | 18.64 |
| Strict base64 regex | 27.95 | 36.49 |
| Padding-adjusted exact decoded-size guard | 0.10 | 0.11 |
| atob | 7.51 | 8.01 |
| Decoded binary string → Uint8Array | **1,378.44** | **37.09** |
| WAV Blob copy | 4.02 | 3.06 |
| WAV MIME signature check | 0.59 | 0.44 |

The original instrumented test passed in **1,624 ms**; the corresponding candidate test passed in **263 ms**. The original byte conversion accounts for approximately **85.4%** of all measured stages. It consumed 1,210,488 microseconds of process user CPU plus 135,926 microseconds of system CPU between its markers; the indexed stage consumed 36,821 and 1,200 microseconds respectively. These are local measurements, not proof that the hosted runner has identical timing.

The largest **observed marker RSS** fell from 1,032,175,616 bytes (~984 MiB) to 499,122,176 bytes (~476 MiB). The conversion marker's heapUsed delta fell from +610,628,600 bytes (~582 MiB) to +21,120 bytes. The candidate allocates the expected 33,554,432 byte typed-array backing store, recorded separately under arrayBuffers. These snapshots support eliminating unnecessary string-iterator conversion work and temporary JavaScript heap growth. They are not a continuous peak-memory trace, nor a proof of general OOM prevention. Other read/JSON/base64/Blob copies remain present.

### Finite independent primitive check

Two fresh Node22 processes each copy the same decoded 32 MiB binary string containing a complete repeated 0–255 byte pattern. One uses the original `Uint8Array.from` callback, the other exact preallocation plus indexed charCodeAt. Both output buffers have the same complete SHA256 as their input (`e09320c5b00b34bb704802136c599a95b3996332ba84d7c7f21112b6231b6bd0`). Original conversion measured 1,331.05 ms; indexed conversion measured 31.95 ms.

This corroborates local primitive performance and byte parity. It is intentionally labelled a primitive comparison, not a production-adapter acceptance test. The implementer retains responsibility for actual-provider full-byte WAV parity, all padding residues, original 32 MiB and +1/+2 rejection regressions, complete provider suites and quality checks.

### Baseline and candidate identity

- Original production MiMo source SHA256: `661610d0e4617531b9600a6ce4c3a9593cb9a296abe7abcc9df6a9218aac8b64`.
- Actual candidate MiMo source SHA256: `d6cfdbb126e27590b9f421474edfea9e3e52e51ba201d992d12d4e2b4a30aced`.
- Original exact fixture file SHA256 in all profiling runs: `e8b8b385012157a718eebb8a46a26048f93094c1003621dd15fb58f6a3a1b761`.
- Bounded reader, resource limits, MIME source and root configuration are unchanged; each receipt records source before/after.
- All heavy research runs were sequential. Implementer held focused tests until baseline/production/primitive/candidate profiling finished, then received explicit slot release. No full-suite retries or blanket worker/config changes were made by research.

### Recommendation

The evidence supports the minimal candidate: retain strict syntax/padding/exact decoded-size checks and unchanged atob, then allocate precisely decoded.length and fill indexed binary code units. The response limits, HTTP/provider/protocol/abort handling, paid request count, audio container check and final Blob-size guard remain intact. Do not shrink the fixture or accepted audio limit, raise the ordinary deadline, change workers, bypass the production path with Buffer-only decoding, or claim hosted Linux success from this Mac profile.

## Related specs

- `.trellis/spec/frontend/ai-connectors.md:173`: MiMo WAV/schema/redaction/once-only generation contracts.
- `.trellis/spec/frontend/ai-connectors.md:224`: C06 actual bounded read and exact decoded base64 boundary; accepted exact limit and rejected +1; no paid auto-retry.
- `.trellis/spec/frontend/ai-connectors.md:307`: preserve original assertion/timeout/limit behavior and adapter transport boundaries.
- `.trellis/spec/frontend/quality-guidelines.md:326`: keep failures and original deadline/assertion authority; investigate rather than relax checks.
- `.trellis/spec/frontend/quality-guidelines.md:373`: local macOS Node22 evidence is not hosted Linux proof.
- Active task PRD/design/implementation retain corresponding-host release gates and require real hosted execution before archive.

## External references / versions

No external product/provider claim or browser support claim was needed. Versions were read from the actual installed executables and test runner: Node v22.21.1, Vitest v5.0.1; local macOS ARM64 environment is recorded in the baseline receipt. No dependency installation or version change was performed.

## Evidence inventory

`logs/ci-mimo-boundary-profile/` contains only finite text/JSON/script artifacts:

- `owner-hosted-failure.txt`: owner-reported original hosted timeout excerpt, explicitly labelled.
- `baseline-mimoSpeech.ts.txt`, `baseline-boundedInput.test.ts.txt`: immutable original source and fixture copies.
- `baseline-exact-node22.log`, `.json`: unchanged exact-case run with original deadline and source hashes.
- `profile.config.mjs`: finite markers for the actual original production path and same exact fixture.
- `production-stage-profile-node22.log`, `.json`: original stage timing/CPU/memory and immutable input receipt.
- `byte-copy-primitive.mjs`, `byte-copy-original-node22.log`, `byte-copy-indexed-node22.log`, `byte-copy-comparison-node22.json`: finite original/indexed primitive comparison, full-byte SHA256 parity.
- `profile-candidate.config.mjs`, `candidate-stage-profile-node22.log`, `.json`: same exact fixture and actual candidate production path with matched markers/hashes.

## Caveats / Not Found

- The unchanged exact fixture passed locally; the reported hosted 5-second failure is not locally reproduced and remains a real reached failure.
- No actual Linux runner, parallel hosted-worker resource profile, packaged native WebView, live MiMo request, hardware audio decode or end-user session was exercised here.
- Marker memory snapshots and fresh-process primitives show unnecessary local cost; they do not identify the hosted CPU/memory scheduling cause, establish a universal peak, or prove that the next hosted run must pass.
- Research does not claim the candidate's broad regression gate passed; that is owned by implementation/check agents and subsequent root verification.
- No product/spec/config/Git changes, dependency installation, public remote action, paid call or task archival were performed by this researcher.
