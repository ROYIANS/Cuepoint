# Responses fixture final-envelope consistency repair

Date: 2026-10-11. Scope: the synthetic loopback fixture and its self-check only.
No product parser, transport, safety validation, tool implementation, package,
credentials or persisted application data was changed.

## Demonstrated defect

The actual packaged product request recorded in
`../packaged/43-native-responses-fixture-failure-events.json` used
`POST /v1/responses`, `gpt-5.6-luna`, and offered `workspace_overview`.
The corresponding AX evidence reports:
`Responses 最终内容与流事件不一致`.

The fixture always emitted the public reasoning summary delta
`正在验证原生传输。`, then completed with an output array containing only the
assistant message or function call. It omitted the reasoning item from the
authoritative final output. The unchanged `streamResponses` implementation
decodes that final array and requires the final text and reasoning to begin
with the previously received deltas. Its rejection was correct; neither native
HTTP transport nor the product consistency guard needed a workaround.

## Repair boundary

- `scripts/native-product-fixture.mjs` now places the same reasoning summary
  into a completed output reasoning item for both message and tool-only turns.
  The delta and final item use the same local value. Function names, arguments,
  tool eligibility, continuation behavior and streaming timing remain intact.
- `scripts/native-product-fixture-check.mjs` loads the actual unchanged
  TypeScript `streamResponses`/`toResponseInput` through Vite's module loader.
  The loader has no HTTP listener. Fixture requests still use a separate
  ephemeral loopback server and real Node fetch; this is not native transport
  or actual packaged acceptance evidence.
- Earlier self-checks merely searched SSE strings or inspected the final raw
  array. They could pass the malformed fixture. They were replaced/extended
  with actual product-parser checks for text/reasoning, the overview tool and
  stateless continuation, and supplied tool arguments.
- A negative check removes final reasoning from actual fixture wire bytes and
  verifies that the product still rejects it with the original error and
  returns no tool calls. This protects the guard instead of weakening it.

## Validation

Commands used the explicit machine Node/pnpm paths.

| Evidence | Result | Meaning |
| --- | --- | --- |
| `responses-fixture-before-fix.log` | Exit 1, original consistency error | The new real-parser self-check detects the old fixture defect |
| `responses-fixture-after-fix.log` | Exit 0, 16 checks pass | Repaired wire passes all fixture checks, including the four real-parser checks and negative rejection |
| `responses-fixture-product-parser-regression.log` | 2 files, 44 tests pass | Existing Responses and bounded-input product regressions remain valid |
| `responses-fixture-final-selfcheck.log` | Exit 0, 16 checks pass | Final frozen self-check source, including cleanup on loader initialization failure |
| Node syntax checks and whitespace check | Pass | Both fixture scripts parse; no trailing whitespace |

`src/lib/ai/responsesStream.ts` is byte-identical to HEAD. Its SHA-256 is
`fbc45b9bfc676bcff079bafcb01db526d764cb3b9f57850a7c6a1508a09c66e0`.

Frozen fixture source SHA-256:

- Fixture: `31a367a2dd05645765a95c30432e4137c4250462e93368b10e821fc02c1eb2bc`
- Self-check: `b019398b25a1a66e1a310101c5b36f3daea93020c6850e6050309df0936cf31c`

The worker did not start, stop or mutate the fixed port 56368 fixture process.
The root restarted that server after the response script was frozen and will
record the subsequent actual packaged UI result separately. The earlier
failure evidence remains a failure, not a successful native acceptance result.
