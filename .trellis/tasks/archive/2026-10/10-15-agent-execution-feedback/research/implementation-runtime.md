# E03 runtime/controller implementation evidence

Date: 2026-10-15. Runtime/controller worker; product files frozen for independent review.

## Changed ownership

- `packages/studio/src/features/agent/runtime/executionFeedback.ts`: one mounted-owner controller and optional typed runtime observation port. Snapshot contains invocation/thread/run/message identity, internal phase and a numeric output revision. No visible copy is defined here.
- `packages/studio/src/features/agent/runtime/runChat.ts`: optional eighth feedback argument on execute/resume; actual context preparation, selected main fetch invocation, nonempty public callbacks and existing core observer events. Existing seven-argument callers remain valid.
- `tests/e03ExecutionFeedback.test.ts`: seven controller cases.
- `tests/e03RuntimeFeedback.test.ts`: eight actual Studio/ProductStore cases.

The separate UI worker owns session/page/flow integration, controls and actual visible DOM probes. Root owns canonical specs, ownership ledger, final review and Git. No core/provider/platform/schema/dependency sources changed.

## Runtime and timing contracts

The existing core invocation execution ID is paired with the current UI invocation and exact thread/run/assistant identity. Stale or non-increasing core event sequences cannot change current feedback. Explicit Stop wins over later work/approval phase callbacks until release. Observation exceptions cannot affect the provider, transaction or retained terminal status.

The selected original fetch receives the original input/init unchanged, immediately after the protocol materializes its request. The original explicitly supplied `fetchImpl` boolean still controls credential fallback; the diagnostic wrapper cannot enable it in production. Auxiliary summary requests receive the original transport and never create a main-request mark. Both supported protocols use the same public content/reasoning boundary; tool argument fragments and opaque provider reasoning are excluded.

Standard `cuepoint.agent.<local-numeric-trace>.<fixed-mark>` marks contain only monotonic numeric timestamps. Ten first/final marks and seven derived intervals yield at most 17 owned entries per trace; at most eight traces / 136 entries are retained. Cleanup uses exact names and leaves other owners untouched. Unsupported or throwing timing/cleanup disables further diagnostic writes while execution continues. Dispose invalidates all older handles and is reusable after React effect cleanup/replay.

Public DOM correlation uses an outer-whitespace-normalized size plus a lightweight hash, matched to this invocation's latest confirmed checkpoint and public channel. It stores no answer/reasoning text and is a diagnostic guard rather than cryptographic identity or authorization. Saved resume-baseline signatures are excluded. `publicCommitted` returns true once the matching invocation has been sampled so the UI can stop its observer. Compact lineage remains available after release until the next invocation, allowing a slower store observation to publish the answer. This is DOM commit/visibility eligibility, not physical compositor paint.

## Final necessary checks

All commands used the explicitly authorized machine pnpm. No build wrappers were invoked.

```text
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec vitest run tests/e03ExecutionFeedback.test.ts tests/e03RuntimeFeedback.test.ts tests/agentRuntimeOwnership.test.ts tests/agentRuntimeCredentials.test.ts --reporter=dot
PASS: 4 files, 26 tests, exit 0 (final run 18:08:39).

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc -p packages/studio/tsconfig.json --noEmit --pretty false
PASS: exit 0.

/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint packages/studio/src/features/agent/runtime/executionFeedback.ts packages/studio/src/features/agent/runtime/runChat.ts
PASS: exit 0, zero errors, one reviewed complexity warning in the central event reducer (26 against threshold 20).

git diff --check -- packages/studio/src/features/agent/runtime/runChat.ts packages/studio/src/features/agent/runtime/executionFeedback.ts tests/e03ExecutionFeedback.test.ts tests/e03RuntimeFeedback.test.ts
PASS: exit 0 for the tracked diff; root must check all staged files, including new files, before commit.
```

The actual runtime cases exercise both protocol adapters with one POST, public callbacks before confirmed checkpoints, authoritative settlement, throwing observers, missing production connector, summary/main key rotation, and the absence of fabricated receipt/display for an empty answer. A held terminal transaction acknowledgement demonstrates that Stop keeps ownership until drainage and reports the already committed `completed` status. Actual resume observes old saved output as a baseline and accepts only the following new confirmed output.

An initial additional resume fixture failed with `此执行不能继续` and timed out while awaiting its request: a plain conversation run is not a resumable tool run. The fixture was corrected using the actual `saveToolRound` command to preserve a settled unavailable-tool result before interruption/budget continuation. Production resume eligibility was not changed. Final cases pass without unhandled rejection.

## Limits and remaining work

No live-text overlay or checkpoint/publication tuning was selected. Current display remains storage-dependent. Signature correlation deliberately omits ambiguous identical-to-baseline output or an older checkpoint skipped by observation; absent marks must not be fabricated or interpreted as zero latency. The lightweight hash has collision risk and is never a security control.

Synthetic clocks/HTTP and real browser-adapter transactions establish these callback and persistence contracts. Actual visible DOM eligibility belongs to the UI worker's focused cases. They establish no paid-provider, network-wire/server-receipt, compositor-paint, desktop WebView or native packaging result. Full regression, build, packaging and native acceptance remain deferred to batch completion by the owner's instruction. No install, commit or push was performed by this worker.
